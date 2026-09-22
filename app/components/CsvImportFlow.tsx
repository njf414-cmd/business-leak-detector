"use client";
import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { requestCsvAnalysis, type CsvDashboardResult } from "../lib/csv-dashboard";

type Source = { file: File; csv: string };
export default function CsvImportFlow({ disabled = false, businessName = "", onBusyChange, onComplete }: {
  disabled?: boolean;
  businessName?: string;
  onBusyChange?: (busy: boolean) => void;
  onComplete: (file: File, csv: string, result: CsvDashboardResult) => Promise<boolean>;
}) {
  const [source, setSource] = useState<Source | null>(null);
  const [preview, setPreview] = useState<CsvDashboardResult | null>(null);
  const [mappings, setMappings] = useState<Record<string,string>>({});
  const [industry, setIndustry] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(false);
  const [unsavedResult, setUnsavedResult] = useState<CsvDashboardResult | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const locked = useRef(false);
  useEffect(() => () => { generation.current++; request.current?.abort(); }, []);
  const duplicate = Object.values(mappings).filter(Boolean).length !== new Set(Object.values(mappings).filter(Boolean)).size;
  async function run(action: (signal: AbortSignal) => Promise<void>) {
    if (locked.current || disabled) return;
    locked.current = true; setBusy(true); onBusyChange?.(true); setError(""); setMessage("");
    const controller = new AbortController(); request.current = controller;
    const timer = setTimeout(() => controller.abort(), 60000);
    try { await action(controller.signal); }
    catch (cause) { setError(controller.signal.aborted ? "The request timed out. Please retry." : cause instanceof Error ? cause.message : "We couldn't process this file."); }
    finally { clearTimeout(timer); locked.current = false; setBusy(false); onBusyChange?.(false); }
  }
  async function choose(file: File) {
    await run(async (signal) => {
      const version = ++generation.current;
      setUnsavedResult(null); setPreview(null); setSource(null); setReviewed(false); setCompleted(false); setDirty(false); setMappings({});
      if (!/\.(csv|xlsx|xls)$/i.test(file.name)) throw new Error("Choose a CSV or Excel file.");
      if (file.size > 10 * 1024 * 1024) throw new Error("Choose a file up to 10 MB.");
      let csv: string;
      if (/\.csv$/i.test(file.name)) csv = await file.text();
      else {
        const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const name = workbook.SheetNames.includes("Business Data") ? "Business Data" : workbook.SheetNames[0];
        if (!name) throw new Error("No worksheet found.");
        csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name], { blankrows: false });
      }
      const result = await requestCsvAnalysis(csv, { preview: true, industry, businessName, signal });
      if (version !== generation.current) return;
      setSource({file,csv}); setPreview(result);
      setMappings(Object.fromEntries(result.mapping.sourceFields.map(field => [field, result.mapping.matches.find(m => m.sourceField === field)?.targetField ?? ""])));
    });
  }
  async function refresh() {
    if (!source) return;
    await run(async(signal)=>{
      setReviewed(false);
      const result=await requestCsvAnalysis(source.csv,{preview:true,mappings,industry,businessName,signal});
      setPreview(result);setDirty(false);
    });
  }
  async function analyze() {
    if (!source || !preview || !reviewed || dirty || duplicate || completed || (!preview.file.rowsAccepted || !Object.values(mappings).some(Boolean))) return;
    await run(async(signal)=>{
      const result=await requestCsvAnalysis(source.csv,{mappings,industry,businessName,signal});
      if (!result.analysis.performed) throw new Error("No valid rows remain. Correct the file and review it again.");
      if (result.analysis.errors.length) throw new Error("Some checks failed. Retry before saving the result.");
      const saved=await onComplete(source.file,source.csv,result);
      setUnsavedResult(saved ? null : result);
      setCompleted(true);
      setMessage(saved ? `Analysis complete: ${result.analysis.leaks.length} findings. Results saved to your dashboard.` : "Analysis complete and shown in your dashboard, but saving failed. Keep this page open; results are not saved.");
    });
  }
  async function retrySave() {
    if (!source || !unsavedResult) return;
    await run(async () => {
      const saved = await onComplete(source.file, source.csv, unsavedResult);
      if (saved) { setUnsavedResult(null); setMessage("Results saved to your dashboard."); }
      else setMessage("Saving failed again. Keep this page open and retry when your connection is restored.");
    });
  }
  function changed() { setUnsavedResult(null); setReviewed(false);setDirty(true);setCompleted(false);setMessage(""); }
  return <section aria-label="Business data import" className="mt-6 space-y-4 rounded-xl border border-slate-700 p-4">
    <p className="text-sm text-slate-300">Choose a file, review its columns and data checks, then analyze. Nothing is saved during review.</p>
    <label className="block">Business data file<input type="file" accept=".csv,.xlsx,.xls" disabled={busy||disabled} onChange={e=>{const file=e.target.files?.[0];if(file)void choose(file);e.target.value="";}} className="mt-2 block w-full" /></label>
    <label className="block">Industry<select value={industry} disabled={busy||disabled} onChange={e=>{setIndustry(e.target.value);if(source)changed();}} className="ml-3 rounded bg-slate-800 p-2">
      <option value="">Detect automatically</option>{[["automotive","Automotive"],["home_services","Home services / HVAC"],["construction","Construction"],["restaurant","Restaurant"],["retail","Retail"],["ecommerce","Ecommerce"],["other","Other"]].map(([id,label])=><option key={id} value={id}>{label}</option>)}
    </select></label>
    {busy&&<p role="status">Checking your data…</p>}
    {error&&<p role="alert" className="text-red-300">{error}</p>}
    {preview&&source&&<>
      <p>{source.file.name}: {preview.file.rowCount} rows · {preview.file.rowsAccepted} accepted · {preview.file.rowsBlocked} blocked</p>
      <p className="text-sm">Industry: {preview.classification.effectiveIndustry.replaceAll("_"," ")} · {preview.detectorReadiness.runnableFromFields} checks available from these columns.</p>
      <div className="max-h-80 overflow-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Review column mappings</caption><thead><tr><th scope="col">Your column</th><th scope="col">Use as</th></tr></thead><tbody>
        {preview.mapping.sourceFields.map(field=><tr key={field}><th scope="row" className="p-2">{field}</th><td><select aria-label={`Map ${field}`} disabled={busy||disabled||completed} value={mappings[field]??""} onChange={e=>{setMappings(current=>({...current,[field]:e.target.value}));changed();}} className="max-w-full rounded bg-slate-800 p-2"><option value="">Skip this column</option>{preview.mapping.availableTargets.slice().sort().map(target=><option key={target}>{target}</option>)}</select></td></tr>)}
      </tbody></table></div>
      {Object.values(mappings).some(v=>!v)&&<p className="text-amber-200">Skipped columns will not be analyzed. Review them before continuing.</p>}
      {duplicate&&<p role="alert">Two columns use the same field. Change or skip one.</p>}
      {(preview.dataQuality.issues.length>0||preview.normalization.issues.length>0)&&<details open><summary>Data checks to review</summary><ul className="list-disc pl-5 text-sm">{[...preview.dataQuality.issues,...preview.normalization.issues].slice(0,30).map((issue,index)=><li key={index}>{issue.rowIndex===null?"File":`Data row ${issue.rowIndex+1}`}: {issue.message}</li>)}</ul><p>Showing up to 30 issues. Blocked rows are excluded from analysis.</p></details>}
      {dirty&&<p role="status">Selections changed. Update the preview before approving.</p>}
      <button type="button" disabled={busy||disabled||duplicate||completed} onClick={()=>void refresh()} className="rounded border border-slate-600 px-4 py-2 disabled:opacity-50">Update preview</button>
      <label className="flex gap-2"><input type="checkbox" checked={reviewed} disabled={busy||disabled||dirty||duplicate||completed||(!preview.file.rowsAccepted || !Object.values(mappings).some(Boolean))} onChange={e=>setReviewed(e.target.checked)}/>I reviewed the mappings, skipped columns, and excluded rows.</label>
      <button type="button" disabled={busy||disabled||dirty||duplicate||completed||!reviewed||(!preview.file.rowsAccepted || !Object.values(mappings).some(Boolean))} onClick={()=>void analyze()} className="rounded bg-blue-600 px-4 py-2 disabled:opacity-50">{completed?"Analysis complete":"Analyze reviewed data"}</button>
      {(!preview.file.rowsAccepted || !Object.values(mappings).some(Boolean))&&<p role="alert">No valid rows can be analyzed. Correct the file or mappings first.</p>}
    </>}
    {message&&<p role="status">{message}</p>}
    {unsavedResult&&<button type="button" disabled={busy||disabled} onClick={()=>void retrySave()} className="rounded border border-amber-400 px-4 py-2">Retry saving results</button>}
  </section>;
}
