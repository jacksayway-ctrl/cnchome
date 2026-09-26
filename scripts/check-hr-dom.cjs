const {JSDOM,VirtualConsole}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const folder=path.resolve(__dirname,'..');
const profile={name:'홍테스트',payType:'시급제',payAmount:15000,startDate:'2026-09-01',workDays:['월','화','수','목','금'],team:'insurance',role:'상담원',bank:'테스트은행',accountNumber:'12345678'};
const hr={today:'2026-09-26',accounts:[],employees:[{id:1,employeeNo:'cnc20260926001',userId:2,revision:1,profile}],payroll:[]};
const c={payType:'시급제',rate:15000,minutes:120,base:30000,allowance:0,deductions:0,gross:30000,net:30000,note:'검토'};
function boot(role){const errors=[],v=new VirtualConsole();v.on('jsdomError',e=>errors.push(e.message));const dom=new JSDOM(fs.readFileSync(folder+'/index.html','utf8'),{url:'https://site.test/office.php#'+(role==='admin'?'adminStaff':'payslips'),runScripts:'outside-only',virtualConsole:v,pretendToBeVisual:true});const w=dom.window;Object.assign(w,{structuredClone,TextEncoder,TextDecoder,CNCHOME_LIVE:{entries:[],revision:0,csrf:'TOKEN',user:{role,department:'insurance',display_name:'테스트'},hr:structuredClone(hr)}});w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};for(const s of w.document.querySelectorAll('script'))w.eval(s.src?fs.readFileSync(folder+new URL(s.src).pathname,'utf8'):s.textContent);return {dom,w,d:w.document,errors};}
const tick=()=>new Promise(r=>setTimeout(r,5));
(async()=>{
 const a=boot('admin');try{
 const q=s=>{const x=a.d.querySelector(s);assert.ok(x,s);return x};q('[data-hr="new"]').click();await tick();
 const f=q('[data-hr-form="staff"]');assert.equal(f.elements.payAmount.value,'15000');assert.equal(f.elements.contractStart.value,'2026-09-26');
 f.querySelector('[value="week"]').click();assert.equal(f.elements.contractEnd.value,'2026-10-02');
 f.elements.contractStart.value='2026-01-31';f.elements.contractStart.dispatchEvent(new a.w.Event('input',{bubbles:true}));f.querySelector('[value="month"]').click();assert.equal(f.elements.contractEnd.value,'2026-02-28');
 assert.ok(f.elements.accountNumber);assert.ok(f.elements.addressDetail);assert.match(q('.hr-dialog').textContent,/cnc20260926/);
 a.w.kakao={Postcode:class{constructor(opts){this.opts=opts}embed(){this.opts.oncomplete({zonecode:'12345',userSelectedType:'R',roadAddress:'테스트로 1'})}}};q('[data-hr="address"]').click();await tick();assert.equal(f.elements.address.value,'테스트로 1');assert.equal(f.elements.postcode.value,'12345');
 f.elements.name.value='새 직원';f.elements.phone.value='010-1234-5678';let calls=0;a.w.fetch=async()=>{calls++;return {ok:false,json:async()=>({error:'저장 충돌'})}};f.requestSubmit();f.requestSubmit();await tick();assert.equal(calls,1);assert.match(q('.hr-dialog .hr-error').textContent,/저장 충돌/);assert.equal(f.elements.name.value,'새 직원');q('[data-hr="close"]').click();await tick();
 a.w.location.hash='adminPayroll';a.w.dispatchEvent(new a.w.HashChangeEvent('hashchange'));q('[data-hr="pay-new"]').click();await tick();const pf=q('[data-hr-form="pay"]');pf.elements.minutes.value='120';pf.elements.minutes.dispatchEvent(new a.w.Event('input',{bubbles:true}));assert.match(q('#hr-calc-preview').textContent,/30,000원/);
 assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close()}
 hr.payroll=[{id:1,employee_id:1,month:'2026-09',status:'published',revision:2,calculation:c,published_snapshot:{name:'홍테스트',employeeNo:'cnc20260926001',calculation:c},events:[]},{id:2,employee_id:1,month:'2026-08',status:'confirmed',revision:3,calculation:c,published_snapshot:{name:'홍테스트',employeeNo:'cnc20260926001',calculation:c},events:[]}];
 const e=boot('employee');try{
 for(const route of ['home','attendance','sales','as','myInfo','payslips']){e.w.location.hash=route;e.w.dispatchEvent(new e.w.HashChangeEvent('hashchange'));await tick();assert.equal(e.d.querySelector('[data-page="'+route+'"]').hidden,false);assert.ok(e.d.querySelector('#tm-main').textContent.trim());if(['attendance','sales','as'].includes(route))assert.match(e.d.querySelector('#tm-main').textContent,/연결 준비 중/);}
 assert.equal(e.d.querySelector('[data-page="regions"]').hidden,false);
 assert.equal(e.d.querySelector('[data-page="adminStaff"]').hidden,true);
 assert.match(e.d.querySelector('#tm-main').textContent,/가지급명세서/);assert.equal(e.d.querySelector('[data-page="payslips"]').hidden,false);
 e.d.querySelector('[data-hr="pay-detail"][data-id="1"]').click();await tick();assert.ok(e.d.querySelector('[data-hr-form="confirm"]'));assert.ok(e.d.querySelector('[data-hr-form="request"]'));
 let body;e.w.fetch=async(u,o)=>{body=JSON.parse(o.body);return {ok:true,json:async()=>structuredClone(hr)}};const f=e.d.querySelector('[data-hr-form="request"]');f.elements.note.value='근무시간 확인 부탁합니다';f.requestSubmit();await tick();assert.equal(body.action,'request');assert.equal(body.revision,2);assert.equal(body.note,'근무시간 확인 부탁합니다');
 e.d.querySelector('[data-hr="pay-detail"][data-id="2"]').click();await tick();assert.equal(e.d.querySelector('[data-hr-form="confirm"]'),null);assert.equal(e.d.querySelector('[data-hr-form="request"]'),null);assert.match(e.d.querySelector('.hr-dialog').textContent,/조회만/);assert.deepEqual(e.errors,[]);
 }finally{e.dom.window.close()}
 console.log('PASS: staff form, defaults, contract dates, address selection, failure retention, double submit, pay calculation, employee requests, immutable history.');
})().catch(e=>{console.error(e);process.exitCode=1});
