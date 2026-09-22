import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
export async function verifySuppliedCsv(check, upload) {
  const root = 'tests/fixtures/supplied/';
  for (const fixture of JSON.parse(readFileSync(root+'expected.json','utf8'))) {
    await check(`supplied/${fixture.file}`,async()=>{
      const {status,body:d}=await upload(readFileSync(root+fixture.file),{description:'HVAC heating cooling'});
      assert.equal(status,200);assert.equal(d.success,true);
      assert.equal(d.file.rowsAccepted,fixture.rows);assert.equal(d.file.rowsBlocked,0);
      assert.equal(d.analysis.stats.errors,0);assert.equal(d.analysis.stats.detectorsFailed,0);
      assert.equal(d.analysis.stats.detectorsRan,d.detectorReadiness.runnableFromFields);
      const actual=d.analysis.leaks.map(l=>({rowIndex:l.sourceRowIndex,customerName:l.customerName,leakType:l.leakType,estimatedLoss:l.estimatedLoss})).sort((a,b)=>a.rowIndex-b.rowIndex);
      assert.deepEqual(actual,fixture.leaks,'all positive amounts, customer identities and negative rows');
      assert.equal(d.analysis.totalEstimatedLoss,fixture.leaks.reduce((sum,l)=>sum+l.estimatedLoss,0));
      assert.ok(d.mapping.matches.some(m=>m.sourceField==='Customer' && m.targetField==='Customer Name'));
    });
  }
  await check('supplied/mixed-CRM-amount-ownership',async()=>{
    const {status,body:d}=await upload(readFileSync(root+'ai_mapper_messy_test.csv'));
    assert.equal(status,200);assert.equal(d.file.rowsAccepted,12);assert.equal(d.analysis.stats.detectorsFailed,0);
    const expectedMappings={'Account':'Customer Name','Pipeline Stage':'Status','Deal Value':'Deal Value','Reached':'Contacted','Created On':'Date','Last Called':'Last Contact Date','Cash Received':'Amount Paid','Record Type':'Record Type'};
    for(const [sourceField,targetField]of Object.entries(expectedMappings)) assert.ok(d.mapping.matches.some(m=>m.sourceField===sourceField&&m.targetField===targetField));
    assert.deepEqual(d.mapping.unmappedSourceFields,['Rep','Internal Notes']);
    for(const [rowIndex,amount]of [[4,5600],[8,4400]]) {
      const leaks=d.analysis.leaks.filter(l=>l.sourceRowIndex===rowIndex);
      assert.equal(leaks.length,1);assert.equal(leaks[0].detectorId,'universal.partial-payment');
      assert.equal(leaks[0].estimatedLoss,amount);assert.equal(leaks[0].customerName,`Account ${String(rowIndex+1).padStart(3,'0')}`);
    }
    // Won/paid/scheduled rows must not produce money-recovery findings.
    for(const rowIndex of [2,5,10]) assert.equal(d.analysis.leaks.filter(l=>l.sourceRowIndex===rowIndex).length,0);
    assert.equal(d.normalization.derivations.filter(x=>x.sourceField==='Deal Value').length,12);
    assert.equal(d.normalization.issues.length,0);
  });
  for(const status of ['Unpaid','Overdue','Past Due','Payment Pending','Balance Due','Outstanding','Awaiting Payment']) {
    await check(`import/unpaid-status/${status}`,async()=>{
      const {body:d}=await upload(`Customer,Status,Invoice\nCustomer A,${status},725.50`);
      assert.equal(d.analysis.leakCount,1);assert.equal(d.analysis.totalEstimatedLoss,725.50);
      assert.equal(d.analysis.leaks[0].customerName,'Customer A');
      assert.ok(d.normalization.derivations.some(x=>x.sourceField==='Status'&&x.targetField==='Payment Status'));
    });
  }
  for(const status of ['Invoice Sent','Invoice Paid','Paid in Full','Cancelled Invoice','Not Unpaid','Completed']) {
    await check(`import/no-payment-guess/${status}`,async()=>{
      const {body:d}=await upload(`Customer,Status,Invoice\nCustomer A,${status},725.50`);
      assert.equal(d.analysis.leakCount,0);assert.equal(d.normalization.derivations.length,0);
    });
  }
  await check('import/explicit-fields-win',async()=>{
    const {body:d}=await upload('Customer,Status,Payment Status,Invoice Amount,Deal Value,Record Type,Amount Paid\nCustomer A,Unpaid,Paid,200,9999,Invoice,200');
    assert.equal(d.analysis.leakCount,0);assert.equal(d.normalization.derivations.length,0);
  });
  for(const recordType of ['', 'Unknown', 'constructor', '__proto__']) await check(`import/ambiguous-deal-value/${recordType||'missing'}`,async()=>{
    const {body:d}=await upload(`Account,Deal Value,Record Type,Pipeline Stage\nAccount A,500,${recordType},Unpaid`);
    assert.equal(d.analysis.leakCount,0);assert.equal(d.normalization.issues.length,1);
    assert.equal(d.normalization.derivations.length,0);
    assert.ok(!d.detectorReadiness.readyDetectorIds.includes('universal.unpaid-invoice'));
  });
  await check('import/normalized-invalid-money-is-blocked',async()=>{
    const {body:d}=await upload('Account,Deal Value,Record Type,Pipeline Stage\nAccount A,invalid,Invoice,Unpaid');
    assert.equal(d.file.rowsBlocked,1);assert.equal(d.analysis.performed,false);
  });
  await check('mapping/no-substring-or-empty-header-guesses',async()=>{
    const {mapFields}=await import('../app/lib/business-intelligence/field-mapper.ts');
    const {getDetectorCatalog}=await import('../app/lib/business-intelligence/detector-catalog.ts');
    const targets=[...new Set(getDetectorCatalog().flatMap(d=>[...(d.requirements.requiredFields??[]),...(d.requirements.optionalFields??[])]))];
    const mapped=mapFields(['Rep','Internal Notes',''],targets);
    assert.equal(mapped.matches.length,0);
  });
}
