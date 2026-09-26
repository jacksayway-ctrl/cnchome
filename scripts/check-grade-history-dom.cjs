// Run with jsdom installed separately; it is not a runtime dependency.
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const directory=path.resolve(__dirname,'..'),errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(path.join(directory,'.build/office-preview.html'),'utf8'),{url:'http://preview.local/#adminGrade',runScripts:'outside-only',virtualConsole:vc,pretendToBeVisual:true,beforeParse(w){w.structuredClone=structuredClone;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};}});
const w=dom.window,d=w.document;
for(const script of d.querySelectorAll('script'))w.eval(script.src?fs.readFileSync(path.join(directory,new URL(script.src).pathname),'utf8'):script.textContent);
const q=selector=>{const el=d.querySelector(selector);assert.ok(el,'Missing '+selector);return el;};
const input=(selector,value)=>{const el=q(selector);el.value=String(value);el.dispatchEvent(new w.Event('input',{bubbles:true}));};
const change=(selector,value)=>{const el=q(selector);el.value=String(value);el.dispatchEvent(new w.Event('input',{bubbles:true}));el.dispatchEvent(new w.Event('change',{bubbles:true}));};
const calculate=()=>q('#tm-grade-preview-form').requestSubmit();
try{
 const save=(date,limit,hourly)=>{
 change('#tm-grade-effective-date',date);
 change('[data-grade-monthly-reference="max"][data-grade-reference-index="0"]',limit);
 input('[data-grade-monthly-reference="hourly"][data-grade-reference-index="0"]',hourly);
 q('#tm-grade-form').requestSubmit();q('[data-grade-confirm]').click();
 };
 save('2026-01-01',80,19000);save('2026-02-01',70,21000);
 q('[data-page="grade"]').click();w.dispatchEvent(new w.HashChangeEvent('hashchange'));
 assert.match(q('[data-original-monthly]').textContent,/70건 이하/);
 assert.match(q('[data-original-monthly]').textContent,/21,000원/);
 assert.match(q('#tm-head-monthly').textContent,/81~90건/);
 assert.match(q('#tm-grade-history').textContent,/변경일시/);
 assert.match(q('#tm-grade-history').textContent,/2026-01-01/);
 assert.equal(d.querySelector('[data-grade-load]'),null);
 const before=w.localStorage.getItem('tm-office-grade-policy-v1');
 q('tr[data-grade-history-view="1"] td').click();
 assert.match(q('#tm-dialog-body').textContent,/80건 이하/);
 assert.match(q('#tm-dialog-body').textContent,/19,000원/);
 assert.equal(q('#tm-dialog-body').querySelectorAll('input,select,textarea').length,0);
 assert.equal(w.localStorage.getItem('tm-office-grade-policy-v1'),before);
 q('[data-action="close"]').click();
 const stored=JSON.parse(before);const future=JSON.parse(JSON.stringify(stored.entries[1]));future.date='2099-01-01';future.savedAt='2026-09-26T03:00:00Z';future.policy.monthlyReference[0].hourly=25000;stored.entries.push(future);
 const next=JSON.stringify(stored);w.localStorage.setItem('tm-office-grade-policy-v1',next);
 w.dispatchEvent(new w.StorageEvent('storage',{key:'tm-office-grade-policy-v1',newValue:next}));
 assert.match(q('[data-original-monthly]').textContent,/21,000원/);assert.match(q('#tm-grade-history').textContent,/적용 예정/);
 assert.deepEqual(errors,[]);console.log('PASS: saved admin criteria, employee view and header, clickable historical snapshots, read-only history, and scheduled policy isolation.');
}finally{w.close();}
