// Run with jsdom installed separately; it is not a runtime dependency.
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const directory=path.resolve(__dirname,'..'),errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(path.join(directory,'index.html'),'utf8'),{url:'http://preview.local/#adminGrade',runScripts:'outside-only',virtualConsole:vc,pretendToBeVisual:true,beforeParse(w){w.structuredClone=structuredClone;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};}});
const w=dom.window,d=w.document;
for(const script of d.querySelectorAll('script'))w.eval(script.src?fs.readFileSync(path.join(directory,new URL(script.src).pathname),'utf8'):script.textContent);
const q=selector=>{const el=d.querySelector(selector);assert.ok(el,'Missing '+selector);return el;};
const input=(selector,value)=>{const el=q(selector);el.value=String(value);el.dispatchEvent(new w.Event('input',{bubbles:true}));};
const change=(selector,value)=>{const el=q(selector);el.value=String(value);el.dispatchEvent(new w.Event('input',{bubbles:true}));el.dispatchEvent(new w.Event('change',{bubbles:true}));};
const calculate=()=>q('#tm-grade-preview-form').requestSubmit();
try{
  calculate();assert.match(q('#tm-grade-preview-result').textContent,/2,844,000원/);assert.equal(q('.grade-calculation-title').textContent,'총 계산 금액');
  assert.match(q('#tm-grade-preview-result').textContent,/2026-09-28 ~ 2026-10-02/);assert.match(q('[data-grade-week-pending]').textContent,/2026-08-31/);
  for(const date of ['2026-09-28','2026-09-29','2026-09-30'])input(`[data-grade-record-date="${date}"][data-grade-record-field="count"]`,10);
  calculate();assert.equal(q('#tm-grade-preview-mode').value,'daily');
  const saved=JSON.parse(w.localStorage.getItem('tm-office-grade-calendar-preview-v1'));assert.equal(saved.ledger.insurance['2026-09-30'].count,10);
  change('#tm-grade-preview-month','2026-10');assert.equal(q('#tm-grade-preview-month').value,'2026-10');
  change('#tm-grade-preview-mode','aggregate');input('#tm-grade-preview-count',176);calculate();
  const firstWeek=[...q('#tm-grade-preview-result').querySelectorAll('tr')].find(row=>row.textContent.includes('2026-09-28 ~ 2026-10-02'));
  assert.ok(firstWeek);assert.match(firstWeek.textContent,/46건/);assert.match(firstWeek.textContent,/35,000원/);assert.match(firstWeek.textContent,/이전 달에서 연결/);
  calculate();assert.equal(JSON.parse(w.localStorage.getItem('tm-office-grade-calendar-preview-v1')).ledger.insurance['2026-09-30'].count,10);
  change('#tm-grade-preview-role','leader');calculate();assert.ok(q('[data-grade-role-excluded]'));assert.equal(d.querySelector('[data-grade-final-amount]'),null);
  change('#tm-grade-preview-role','general');change('#tm-grade-preview-month','2026-09');
  change('#tm-grade-preview-mode','aggregate');input('#tm-grade-preview-count',150);calculate();
  change('#tm-grade-effective-date','2026-09-16');input('[data-grade-monthly-reference="hourly"][data-grade-reference-index="0"]',20000);calculate();
  assert.match(q('#tm-grade-preview-result').textContent,/2026-09-01 ~ 2026-09-15/);assert.match(q('#tm-grade-preview-result').textContent,/2026-09-16 ~ 2026-09-30/);assert.match(q('[data-grade-final-amount]').textContent,/2,310,000원/);
  q('#tm-grade-form').requestSubmit();q('[data-grade-confirm]').click();
  const entry=JSON.parse(w.localStorage.getItem('tm-office-grade-policy-v1')).entries.at(-1);assert.equal(entry.date,'2026-09-16');assert.equal(entry.policy.monthlyReference[0].hourly,20000);
  calculate();assert.match(q('[data-grade-final-amount]').textContent,/2,310,000원/);
  assert.deepEqual(errors,[]);console.log('PASS: live page month rollover, ledger reuse, role exclusion, effective-date monthly changes and saving.');
}finally{w.close();}
