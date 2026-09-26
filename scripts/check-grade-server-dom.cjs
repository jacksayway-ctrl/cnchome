const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const directory=path.resolve(__dirname,'..');
function boot(role='admin',entries=[]){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(fs.readFileSync(path.join(directory,'.build/office-preview.html'),'utf8'),{url:'https://preview.local/office.php#'+(role==='employee'?'grade':'adminGrade'),runScripts:'outside-only',virtualConsole:vc,pretendToBeVisual:true,beforeParse(w){w.structuredClone=structuredClone;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};w.CNCHOME_LIVE={entries,revision:0,csrf:'token',user:{role,department:'insurance',display_name:'테스트'}};}});
 const w=dom.window,d=w.document;
 for(const script of d.querySelectorAll('script'))w.eval(script.src?fs.readFileSync(path.join(directory,new URL(script.src).pathname),'utf8'):script.textContent);
 return {dom,w,d,errors};
}
(async()=>{
 const a=boot();const q=s=>{const el=a.d.querySelector(s);assert.ok(el,s);return el};
 try{
 assert.equal(a.d.querySelectorAll('[data-aw-section]').length,6);
 assert.equal(q('[data-page="adminGrade"]').hidden,false);
 assert.equal(a.d.querySelector('#tm-grade-preview-form'),null);
 assert.match(q('#live-account').textContent,/테스트/);
 let saved,fail=true,calls=0;
 a.w.fetch=async(url,options)=>{calls++;const body=JSON.parse(options.body);assert.equal(options.headers['X-CSRF-Token'],'token');assert.equal(body.revision,0);if(fail)return {ok:false,json:async()=>({error:'충돌 테스트'})};saved={...body,savedAt:'2026-09-26T04:00:00.000000Z',savedBy:'테스트'};return {ok:true,json:async()=>({entries:[saved],revision:1})}};
 q('#tm-grade-form').requestSubmit();q('[data-grade-confirm]').click();await new Promise(r=>setTimeout(r,10));
 assert.match(q('#tm-grade-confirm-error').textContent,/충돌/);assert.equal(a.w.CNCHOME_LIVE.revision,0);
 assert.equal(q('[data-grade-confirm]').disabled,false);fail=false;q('[data-grade-confirm]').click();q('[data-grade-confirm]').click();await new Promise(r=>setTimeout(r,10));assert.equal(calls,2);
 assert.equal(a.w.CNCHOME_LIVE.revision,1);assert.match(q('#tm-grade-history').textContent,/2026/);
 assert.equal(a.w.localStorage.getItem('tm-office-grade-policy-v1'),null);
 const employee=boot('employee',[saved]);try{
 assert.equal(employee.d.querySelector('[data-page="adminGrade"]'),null);
 assert.equal(employee.d.querySelector('#tm-grade-form'),null);
 assert.match(employee.d.querySelector('#tm-main').textContent,/개인별 주그레이드/);
 assert.deepEqual(employee.errors,[]);
 }finally{employee.dom.window.close()}
 for(const [route] of a.w.AdminWorkspace.navigation.flatMap(g=>g.items)){
 a.w.location.hash=route;a.w.dispatchEvent(new a.w.HashChangeEvent('hashchange'));
 await new Promise(r=>setTimeout(r,1));
 assert.ok(q('#tm-main').textContent.trim().length,route);
 assert.ok(q('[data-page="'+route+'"]').classList.contains('active'),route);
 if(a.w.HRWorkspace.handles(route))assert.match(q('#live-page-status').textContent,/DB 연결됨/);else if(route!=='adminGrade')assert.match(q('#live-page-status').textContent,/미리보기/);
 }
 a.w.location.hash='adminStaffRegister';a.w.dispatchEvent(new a.w.HashChangeEvent('hashchange'));await new Promise(r=>setTimeout(r,1));
 assert.ok(a.w.AdminWorkspace.navigation.find(g=>g.label==='인사·출결').items.some(([route])=>route==='adminStaffRegister'));
 assert.ok(!a.w.AdminWorkspace.navigation.find(g=>g.label==='운영 관리').items.some(([route])=>route==='adminStaffRegister'));
 q('[data-page="adminStaffRegister"]').click();
 assert.ok(q('.hr-dialog').hasAttribute('open'));
 const form=q('.hr-dialog [data-hr-form="staff"]');
 assert.equal(form.querySelector('[name="payAmount"]').value,'15000');
 assert.ok(form.querySelector('[name="accountNumber"]'));
 q('.hr-dialog [data-hr="close"]').click();
 a.w.location.hash='unknown-page';a.w.dispatchEvent(new a.w.HashChangeEvent('hashchange'));await new Promise(r=>setTimeout(r,1));
 assert.ok(q('[data-page="adminHome"]').classList.contains('active'));
 assert.deepEqual(a.errors,[]);console.log('PASS: authenticated grade UI, no demo calculator, failure retention, double-submit prevention, server-only saving and employee read-only route.');
 }finally{a.dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
