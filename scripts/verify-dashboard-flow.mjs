import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
export async function verifyDashboardFlow(check, upload) {
  const {requestCsvAnalysis,toDashboardLeaks}=await import('../app/lib/csv-dashboard.ts');
  const {POST}=await import('../app/api/analyze-csv/route.ts');
  const csv='Customer,Status,Invoice\nCustomer A,Unpaid,725.50';
  await check('dashboard/preview-does-not-run-detectors',async()=>{
    const {body:d}=await upload(csv,{mode:'preview'});
    assert.equal(d.previewOnly,true);assert.equal(d.analysis.performed,false);
    assert.equal(d.analysis.stats.detectorsRan,0);assert.equal(d.analysis.leaks.length,0);
    assert.equal(d.file.rowsAccepted,1);assert.ok(d.mapping.availableTargets.includes('Customer Name'));
    assert.throws(()=>toDashboardLeaks(d),/No valid rows/);
  });
  await check('dashboard/client-preview-review-analyze-results',async()=>{
    const original=globalThis.fetch;
    try {
      globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/analyze-csv');return POST(new Request('http://verification.local'+url,options));};
      const preview=await requestCsvAnalysis(csv,{preview:true,industry:'home_services'});
      const mappings=Object.fromEntries(preview.mapping.matches.map(m=>[m.sourceField,m.targetField]));
      assert.equal(preview.analysis.performed,false);
      const result=await requestCsvAnalysis(csv,{mappings,industry:'home_services'});
      assert.equal(result.previewOnly,false);assert.equal(result.analysis.performed,true);
      const leaks=toDashboardLeaks(result);
      assert.equal(leaks.length,1);assert.equal(leaks[0].amount,725.5);assert.equal(leaks[0].customer,'Customer A');
      assert.equal(leaks[0].category,'Recoverable');assert.match(leaks[0].reason,/data row 1/);
    } finally {globalThis.fetch=original;}
  });
  await check('dashboard/user-mapping-and-skip-are-honored',async()=>{
    const csv='Who,Unfamiliar Amount,Status\nCustomer A,900,Unpaid';
    const mappings={Who:'Customer Name','Unfamiliar Amount':'Invoice Amount',Status:'Status'};
    const {body:d}=await upload(csv,{mappingOverrides:JSON.stringify(mappings)});
    assert.equal(d.analysis.totalEstimatedLoss,900);assert.equal(d.analysis.leaks[0].customerName,'Customer A');
    const {body:skipped}=await upload(csv,{mappingOverrides:JSON.stringify({...mappings,'Unfamiliar Amount':''})});
    assert.equal(skipped.analysis.leaks.length,0);assert.ok(skipped.mapping.unmappedSourceFields.includes('Unfamiliar Amount'));
  });
  for(const [name,mappings]of [['malformed','{'],['unknown-source',JSON.stringify({Missing:'Invoice Amount'})],['unknown-target',JSON.stringify({Invoice:'Made Up'})],['duplicate',JSON.stringify({Customer:'Invoice Amount',Invoice:'Invoice Amount'})],['array','[]']]) {
    await check(`dashboard/reject-mapping-${name}`,async()=>{
      const {status,body:d}=await upload(csv,{mappingOverrides:mappings});assert.equal(status,400);assert.equal(d.success,false);
    });
  }
  await check('dashboard/all-blocked-cannot-be-saved',async()=>{
    const {body:d}=await upload('Customer,Invoice Amount,Payment Status\nA,invalid,Unpaid');
    assert.throws(()=>toDashboardLeaks(d),/No valid rows/);
  });
  await check('dashboard/industry-finding-survives-adapter',async()=>{
    const {body:d}=await upload(readFileSync('tests/fixtures/csv/construction-milestone.csv'),{industry:'construction'});
    const leaks=toDashboardLeaks(d);assert.equal(leaks.length,1);assert.equal(leaks[0].type,'Unbilled Progress Payment');assert.equal(leaks[0].amount,12000);
    assert.ok(leaks[0].action.length>0);
  });
  await check('dashboard/mixed-row-evidence-preserved',async()=>{
    const {body:d}=await upload('Customer,Invoice Amount,Payment Status\nBad,invalid,Unpaid\nGood,500,Unpaid');
    const leaks=toDashboardLeaks(d);assert.equal(leaks.length,1);assert.match(leaks[0].reason,/data row 2/);
  });
  await check('dashboard/transport-errors-do-not-produce-results',async()=>{
    const original=globalThis.fetch;
    try {
      globalThis.fetch=async()=>new Response(JSON.stringify({success:false,error:'Upload rejected'}),{status:400});
      await assert.rejects(requestCsvAnalysis(csv),/Upload rejected/);
      globalThis.fetch=async()=>new Response('<html>Sign in</html>');
      await assert.rejects(requestCsvAnalysis(csv),/sign-in/);
      globalThis.fetch=async()=>new Response(JSON.stringify({success:true}));
      await assert.rejects(requestCsvAnalysis(csv),/Incomplete/);
    }finally{globalThis.fetch=original;}
  });
  await check('dashboard/expired-session-is-actionable',async()=>{
    const original=globalThis.fetch;
    try {
      globalThis.fetch=async()=>new Response('Unauthorized',{status:401});
      await assert.rejects(requestCsvAnalysis(csv),/session has expired/);
      globalThis.fetch=async()=>({redirected:true,status:200});
      await assert.rejects(requestCsvAnalysis(csv),/session has expired/);
    }finally{globalThis.fetch=original;}
  });
  await check('dashboard/malformed-responses-cannot-reach-review',async()=>{
    const original=globalThis.fetch;
    const {body:valid}=await upload(csv,{mode:'preview'});
    try {
      for (const body of [null, {success:true,mapping:{},file:{},analysis:{leaks:[]}},
        {...valid,normalization:null}, {...valid,dataQuality:{issues:null}},
        {...valid,file:{...valid.file,rowsAccepted:-1}},
        {...valid,classification:{effectiveIndustry:null}}]) {
        globalThis.fetch=async()=>Response.json(body);
        await assert.rejects(requestCsvAnalysis(csv),/Analysis failed|Incomplete analysis/);
      }
    }finally{globalThis.fetch=original;}
  });
  await check('dashboard/import-component-initial-controls',async()=>{
    const {default:React}=await import('react');
    const {renderToStaticMarkup}=await import('react-dom/server');
    const {default:Component}=await import('../app/components/CsvImportFlow.tsx');
    const html=renderToStaticMarkup(React.createElement(Component,{onComplete:async()=>true}));
    assert.match(html,/Business data file/);assert.match(html,/Detect automatically/);
    assert.match(html,/Nothing is saved during review/);assert.ok(!html.includes('Analyze reviewed data'));
  });
}
