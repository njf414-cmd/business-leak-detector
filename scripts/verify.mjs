import './verification-loader.mjs';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NextRequest } from 'next/server.js';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
process.env.TZ = 'UTC';
const RealDate = Date;
const clock = '2026-09-20T16:00:00.000Z';
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [clock])); }
  static now() { return new RealDate(clock).getTime(); }
};
const results = [];
async function check(name, fn) {
  try { await fn(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, passed: false, error: error.stack }); console.error(`FAIL ${name}: ${error.message}`); }
}
function assertReportedChecks(value, path = '') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    const location = `${path}.${key}`;
    if (typeof child === 'boolean' && (/passed$/i.test(key) || /^(expansionReady|ownershipReady|all25Healthy)$/.test(key))) assert.equal(child, true, location);
    if (/^(failedTests|expectationsFailed|runnerFailures|runnerErrors)$/.test(key)) assert.equal(child, 0, location);
    assertReportedChecks(child, location);
  }
}
// Existing checks include loss/recovery, safe negatives, ownership and legacy parity.
for (const route of readdirSync('app/api').filter(name => name.startsWith('test-') && name !== 'test-detector-batch').sort()) {
  await check(route, async () => {
    const { GET } = await import(`../app/api/${route}/route.ts`);
    const response = await GET(new NextRequest(`http://verification.local/api/${route}`));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true, body.message ?? body.error);
    assertReportedChecks(body);
    if (route === 'test-field-mapper') {
      assert.equal(body.result.matches.length, 8);
      assert.equal(body.result.unmappedSourceFields.length, 0);
      const expected = ['Record','Invoice Amount','Invoice Date','Amount Paid','Worked Hours','Billed Hours','Last Service Date','Renewal Due Date'];
      assert.deepEqual(body.result.matches.map(m => m.targetField).sort(), expected.sort());
    }
  });
}
const { GET: batch } = await import('../app/api/test-detector-batch/route.ts');
for (const file of readdirSync('detector-specs').filter(f => (f.endsWith('-batch.json') && !f.startsWith('example')) || f === 'deep-leak-master-expansion.json').sort()) {
  await check(`batch/${file}`, async () => {
    const response = await batch(new NextRequest(`http://verification.local/api/test-detector-batch?file=${file}`));
    const data = await response.json();
    assert.equal(response.status, 200); assert.equal(data.success, true, data.message ?? data.error);
    assertReportedChecks(data);
  });
}
const { POST } = await import('../app/api/analyze-csv/route.ts');
async function upload(csv, context = {}, filename = 'fixture.csv') {
  const form = new FormData();
  if (csv !== null) form.set('file', new File([csv], filename, { type: 'text/csv' }));
  for (const [key, value] of Object.entries(context)) form.set(key, value);
  const response = await POST(new Request('http://verification.local/api/analyze-csv', { method: 'POST', body: form }));
  return { status: response.status, body: await response.json() };
}
const fixtures = JSON.parse(readFileSync('tests/fixtures/csv/manifest.json', 'utf8'));
for (const fixture of fixtures) {
  await check(`csv/${fixture.name}`, async () => {
    const { status, body: d } = await upload(readFileSync(`tests/fixtures/csv/${fixture.file}`), { description: fixture.description });
    assert.equal(status, 200); assert.equal(d.success, true);
    assert.equal(d.classification.detectedIndustry, fixture.industry);
    assert.equal(d.classification.selectionMode, 'automatic');
    assert.equal(d.file.rowsAccepted, fixture.rows); assert.equal(d.file.rowsBlocked, 0);
    assert.equal(d.analysis.stats.detectorsFailed, 0); assert.equal(d.analysis.stats.errors, 0);
    assert.equal(d.analysis.stats.detectorsRan, d.detectorReadiness.runnableFromFields);
    assert.deepEqual(d.analysis.leaks.map(l => [l.detectorId, l.estimatedLoss]).sort(), Object.entries(fixture.leaks).sort());
    assert.equal(d.analysis.totalEstimatedLoss, Object.values(fixture.leaks).reduce((a,b) => a+b, 0));
    for (const leak of d.analysis.leaks) {
      assert.ok(d.detectorReadiness.readyDetectorIds.includes(leak.detectorId));
      assert.equal(leak.sourceRowIndex, 0, 'paid/control row must not leak');
      assert.ok(Number.isFinite(leak.estimatedRecovery));
      assert.ok(leak.estimatedRecovery >= 0 && leak.estimatedRecovery <= leak.estimatedLoss);
    }
    for (const [source, target] of Object.entries(fixture.mapping ?? {})) {
      assert.ok(d.mapping.matches.some(m => m.sourceField === source && m.targetField === target && m.confidence >= 0.7));
    }
  });
}
const header = 'Customer Name,Invoice Amount,Amount Paid,Payment Status';
const good = 'Good Customer,1200,200,Partial';
for (const [name, csv, filename, status] of [
  ['missing-file', null, 'x.csv', 400], ['wrong-extension', header+'\n'+good, 'x.txt', 400],
  ['empty', '', 'x.csv', 400], ['headers-only', header, 'x.csv', 400],
  ['oversize', 'x'.repeat(10*1024*1024+1), 'x.csv', 413],
  ['duplicate-header','Invoice Amount,Invoice Amount\n100,900','x.csv',400],
  ['empty-header','Customer Name,,Amount Paid\nA,100,0','x.csv',400],
  ['too-many-columns',header+'\n'+good+',extra','x.csv',400],
  ['too-few-columns',header+'\nA,100','x.csv',400],
  ['unclosed-quote',header+'\n"A,100,0,Unpaid','x.csv',400],
  ['unescaped-quote',header+'\nA"B,100,0,Unpaid','x.csv',400],
  ['text-after-quote',header+'\n"A"oops,100,0,Unpaid','x.csv',400],
]) await check(`csv/reject-${name}`, async () => {
  const result = await upload(csv, {}, filename); assert.equal(result.status, status); assert.equal(result.body.success, false); assert.ok(result.body.error); assert.equal(result.body.analysis, undefined);
});
await check('csv/BOM-CRLF-quotes-newlines-currency', async () => {
  const { body:d, status } = await upload('\uFEFF"Customer Name",Invoice Amount,Amount Paid,Payment Status\r\n"Example, ""A""\nCustomer","$1,200.50",200.25,Partial\r\n\r\n');
  assert.equal(status,200); assert.equal(d.file.rowsAccepted,1); assert.equal(d.file.skippedRows,1);
  assert.equal(d.analysis.leakCount,1); assert.equal(d.analysis.totalEstimatedLoss,1000.25);
  assert.equal(d.analysis.leaks[0].customerName,'Example, "A"\nCustomer');
});
for (const [name,bad] of [['invalid-money','Bad,banana,0,Unpaid'],['negative-money','Bad,-100,0,Unpaid']]) {
  for (const mixed of [false,true]) await check(`csv/${name}/${mixed?'mixed':'all-blocked'}`,async()=>{
    const {status,body:d}=await upload(header+'\n'+bad+(mixed?'\n'+good:''));
    assert.equal(status,200); assert.equal(d.file.rowsBlocked,1); assert.equal(d.file.rowsAccepted,mixed?1:0);
    assert.equal(d.analysis.performed,mixed); assert.equal(d.analysis.totalEstimatedLoss,mixed?1000:0);
    assert.equal(d.analysis.leakCount,mixed?1:0);
    if (mixed) assert.equal(d.analysis.leaks[0].sourceRowIndex,1,'evidence must refer to the original uploaded row'); assert.equal(d.dataQuality.valid,false);
  });
}
await check('csv/manual-industry-override',async()=>{
  const {body:d}=await upload(header+'\n'+good,{description:'HVAC heating cooling',industry:'automotive'});
  assert.equal(d.classification.detectedIndustry,'home_services'); assert.equal(d.classification.effectiveIndustry,'automotive'); assert.equal(d.classification.selectionMode,'manual');
  assert.ok(d.detectorReadiness.readyDetectorIds.some(id=>id.startsWith('automotive.')));
  assert.ok(!d.detectorReadiness.readyDetectorIds.some(id=>id.startsWith('home-services.')));
});
await check('csv/required-fields-gate',async()=>{
  const {body:d}=await upload('Record,Revenue Impact,Expected Inventory\nSKU-1,75,10',{industry:'retail'});
  assert.ok(!d.detectorReadiness.readyDetectorIds.includes('deep.inventory-shrinkage'));
  assert.ok(!d.analysis.leaks.some(l=>l.detectorId==='deep.inventory-shrinkage'));
  assert.ok(d.detectorReadiness.partiallySupported > 0);
});
const {classifyBusinessIndustry}=await import('../app/lib/business-intelligence/industry-classifier.ts');
await check('classification/word-boundaries',()=>{
  assert.equal(classifyBusinessIndustry({rows:[],description:'Ecommerce online store shopping cart'}).industry,'ecommerce');
  assert.equal(classifyBusinessIndustry({rows:[],description:'A workshop for local residents'}).industry,'other');
  assert.equal(classifyBusinessIndustry({rows:[],description:'HVAC, heating & cooling.'}).industry,'home_services');
});
await check('csv/paid-amount-overrides-unpaid-label',async()=>{
  const {body:d}=await upload(header+'\nPaid Customer,100,100,Unpaid');
  assert.equal(d.file.rowsAccepted,1); assert.equal(d.analysis.leakCount,0);
});
await check('csv/invalid-date-blocking',async()=>{
  const {body:d}=await upload(header+',Invoice Date\n'+good+',not-a-date');
  assert.equal(d.file.rowsBlocked,1); assert.equal(d.analysis.performed,false);
});
const {getDetectorCatalog}=await import('../app/lib/business-intelligence/detector-catalog.ts');
const {buildBusinessProfileFromData}=await import('../app/lib/business-intelligence/industry-classifier.ts');
const master=JSON.parse(readFileSync('detector-specs/master-expansion.json','utf8'));
for(const spec of master) await check(`master/${spec.id}`,async()=>{
  const detector=getDetectorCatalog().find(d=>d.id===spec.id);
  assert.ok(detector,'master specification must be registered');
  const positive={'Customer Name':'Positive',[spec.itemField]:'Documented item',[spec.amountField]:'321.50',[spec.statusField]:spec.positiveStatuses[0],[spec.billingStatusField]:'pending'};
  const paid={...positive,'Customer Name':'Paid',[spec.billingStatusField]:spec.billedStatuses[0]};
  const missing={...positive,'Customer Name':'Missing',[spec.amountField]:''};
  const rows=[positive,paid,missing];
  const profile=buildBusinessProfileFromData({rows}); profile.industry=spec.industry;
  assert.equal(detector.supports(profile),true);
  const result=await detector.detect({profile,rows,now:new Date(clock)});
  assert.equal(result.errors.length,0); assert.equal(result.leaks.length,1);
  assert.equal(result.leaks[0].estimatedLoss,321.50); assert.equal(result.leaks[0].sourceRowIndex,0);
});
const { verifySuppliedCsv } = await import('./verify-supplied-csv.mjs');
await verifySuppliedCsv(check, upload);

const { verifyDashboardFlow } = await import('./verify-dashboard-flow.mjs');
await verifyDashboardFlow(check, upload);

mkdirSync('test-results',{recursive:true});
const failed=results.filter(r=>!r.passed);
writeFileSync('test-results/verification.json',JSON.stringify({clock,total:results.length,passed:results.length-failed.length,failed:failed.length,results},null,2)+'\n');
console.log(`\n${results.length-failed.length}/${results.length} verification groups passed. Report: test-results/verification.json`);
process.exitCode=failed.length?1:0;
