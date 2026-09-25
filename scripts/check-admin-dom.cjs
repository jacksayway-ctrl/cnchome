// Development-only check. Install jsdom separately; no runtime CDN or dependency.
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'http://preview.local/#adminHome',runScripts:'outside-only',virtualConsole:vc,pretendToBeVisual:true,beforeParse(w){
 w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
 w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
}});
const w=dom.window,d=w.document;
const pause=()=>new Promise(r=>setTimeout(r,25));
const q=s=>{const e=d.querySelector(s);assert.ok(e,'Missing element: '+s);return e;};
const click=s=>q(s).click();
const set=(name,value)=>{const e=q('#tm-dialog [name="'+name+'"]');if(e.type==='checkbox')e.checked=value;else e.value=value;};
const submit=()=>q('#tm-dialog form').requestSubmit();
const state=()=>w.AdminWorkspace.getState();
async function page(id){w.location.hash=id;await pause();assert.ok(q('#tm-main').textContent.trim(),'Empty page '+id);}
async function main(){
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Page load timeout')),15000);w.addEventListener('load',()=>{clearTimeout(timer);resolve();},{once:true});});
 for(const script of d.querySelectorAll('script')){
  let source=script.textContent;
  if(script.src){const u=new URL(script.src);assert.equal(u.origin,'http://preview.local');const file=path.resolve(root,'.'+u.pathname);assert.ok(file.startsWith(root+path.sep));source=fs.readFileSync(file,'utf8');}
  w.eval(source);
 }
 assert.ok(w.AdminWorkspace,'Admin module loaded');
 const nav=[...d.querySelectorAll('nav [data-page^="admin"]')].map(e=>e.dataset.page);
 assert.equal(nav.length,19);assert.equal(new Set(nav).size,19);
 for(const id of nav){await page(id);assert.ok(d.querySelector('nav [data-page="'+id+'"][aria-current="page"]'),'Active navigation '+id);}
 await page('adminAttendance');
 for(const id of ['AT-2','AT-3'])click('[data-aw-select="'+id+'"]');click('[data-aw="attendance-bulk"]');
 assert.equal(state().attendance[1].status,'승인');assert.equal(state().attendance[2].status,'대기');assert.match(q('#tm-main').textContent,/중복/);
 click('[data-aw="attendance-review"][data-id="AT-1"]');set('reason','승인 검토');submit();assert.equal(state().attendance[0].status,'승인');assert.equal(state().leaves[0].lots[0].used,3);
 click('[data-aw="attendance-cancel"][data-id="AT-1"]');set('reason','일정 변경');submit();assert.equal(state().leaves[0].lots[0].used,2);
 await page('adminAs');click('[data-aw="as-detail"][data-id="RC-001/AS-1"]');set('decision','차감');set('reason','차감 검토');submit();assert.equal(state().cases[0].blocked,true);
 for(const id of ['AS-1','AS-2']){click('[data-aw="as-detail"][data-id="RC-001/'+id+'"]');set('action','complete');set('reason','정상 처리 완료');submit();}
 assert.equal(state().cases[0].blocked,false);
 await page('adminPayroll');click('[data-aw="payroll-detail"][data-id="PAY-2"]');set('wageReviewed',true);set('deductionsChecked',true);submit();
 click('[data-aw-select="PAY-2"]');click('[data-aw="payroll-bulk"][data-id="confirm"]');assert.equal(state().payroll[2].status,'미확정');assert.match(q('#tm-main').textContent,/공휴일 달력 확인/);
 await page('adminSettings');click('[data-aw="calendar-confirm"]');await page('adminPayroll');click('[data-aw="payroll-bulk"][data-id="confirm"]');assert.equal(state().payroll[2].status,'확정');
 click('[data-aw="payroll-bulk"][data-id="paid"]');set('paidConfirmed',true);submit();assert.equal(state().payroll[2].status,'확정');assert.match(q('#tm-main').textContent,/명세서 공개 필요/);
 click('[data-aw="payroll-bulk"][data-id="publish"]');click('[data-aw="payroll-bulk"][data-id="paid"]');set('paidConfirmed',true);set('date','2026-10-14');submit();assert.equal(state().payroll[2].status,'지급 완료');assert.equal(state().payroll[2].paidDate,'2026-10-14');
 let exported;w.AdminXlsx.download=(rows,name)=>exported={rows,name};click('[data-aw="payroll-export"]');assert.equal(exported.rows.length,5);assert.match(exported.name,/\.xlsx$/);
 await page('adminGrade');const award=q('[data-grade-period="daily"][data-grade-index="1"][data-grade-field="achievement"]');award.value='10000';award.dispatchEvent(new w.Event('input',{bubbles:true}));q('#tm-grade-form').requestSubmit();click('[data-grade-confirm]');
 await page('adminDaily');assert.match(q('#tm-main').textContent,/0건/);click('[data-aw="daily-edit"][data-id="staff-0"]');set('count','8');submit();assert.equal(state().daily.at(-1).count,8);assert.ok(state().daily.at(-1).amount>0);await page('adminDailyHistory');click('[data-aw="daily-pay"][data-id="D-1"]');set('paidConfirmed',true);submit();assert.equal(state().daily[0].paid,10000);
 await page('adminContracts');click('[data-aw="contract-add"]');set('pay','<img src=x onerror="window.injected=true">');submit();
 assert.equal(state().contracts.length,3);assert.equal(d.querySelectorAll('#tm-main img').length,0);assert.equal(w.injected,undefined);
 const cid=state().contracts[2].id;click('[data-aw="contract-detail"][data-id="'+cid+'"]');set('reviewed',true);submit();assert.equal(state().contracts[2].status,'서명 대기');
 await page('adminPermissions');click('[data-aw="permission-edit"][data-id="admin-owner"]');set('highest',false);set('reason','변경');submit();assert.match(q('.aw-form-error').textContent,/최소 한 명/);assert.equal(state().accounts[0].highest,true);q('#tm-dialog').close();
 await page('adminCorrections');click('[data-aw="correction-review"]');set('status','처리 완료');set('gross','1000');set('tax','100');set('reason','공제 입력 오류 확인');submit();assert.equal(state().requests[0].status,'처리 완료');
 const sid=state().settlements.at(-1).id;
 for(const amount of ['500','600']){click('[data-aw="settlement-detail"][data-id="'+sid+'"]');set('amount',amount);set('reason','실제 지급 기록');submit();}
 assert.match(q('#tm-main').textContent,/초과 지급/);assert.equal(state().settlements.at(-1).payments.length,2);
 click('[data-aw="settlement-detail"][data-id="'+sid+'"]');const pid=state().settlements.at(-1).payments[1].id;click('[data-aw="payment-edit"][data-id="'+sid+'/'+pid+'"]');set('amount','0');set('reason','잘못 입력한 지급 취소');submit();assert.equal(state().settlements.at(-1).payments[1].amount,0);
 await page('adminAudit');assert.ok(q('#tm-main').textContent.includes('공제 입력 오류 확인'));click('[data-aw="audit-detail"]');assert.ok(q('.aw-compare').textContent.includes('payments'));q('#tm-dialog').close();
 await page('adminNotifications');assert.ok(state().notifications.length>0);click('[data-aw="notify-read-all"]');assert.ok(state().notifications.every(n=>n.read));
 for(const id of ['home','sales','grade','attendance','as'])await page(id);
 await page('adminStaff');click('[data-action="staff-add"]');set('name','<img src=x onerror="window.staffInjected=true">');set('phone','010-0000-0000');set('team','insurance');submit();
 assert.equal(d.querySelectorAll('#tm-main img').length,0);assert.equal(w.staffInjected,undefined);
 await page('adminContracts');click('[data-aw="contract-add"]');assert.ok([...q('#tm-dialog select[name="employee"]').options].some(o=>o.text.includes('staffInjected')));q('#tm-dialog').close();
 await page('adminLeave');assert.equal(state().staff.length,17);assert.equal(state().leaves.at(-1).lots.length,0);
 await page('adminPerformance');assert.equal(d.querySelectorAll('[data-performance-record]').length,0);assert.ok(d.querySelector('#tm-main [data-page="adminAs"]'));
 await page('adminPayroll');click('[data-aw="payroll-reverse"][data-id="PAY-2/unpay"]');set('reason','지급 표시 오류');set('reviewed',true);submit();assert.equal(state().payroll[2].status,'확정');
 await page('adminBank');click('[data-aw="bank-edit"][data-id="staff-2"]');set('bank','예시은행');set('number','001-234567');set('holder','가상 예금주');set('reason','가상 계좌 등록');submit();assert.match(q('#tm-main').textContent,/•••• 4567/);
 click('[data-aw-select="PAY-2"]');click('[data-aw="bank-preview"]');assert.match(q('#tm-dialog').textContent,/001-234567/);set('reviewed',true);submit();assert.match(exported.name,/지급계좌/);assert.equal(exported.rows.length,3);assert.equal(state().payroll[2].status,'확정');
 await page('adminCorrections');click('[data-aw="correction-add"]');set('reason','퇴사 직원 요청 대리 접수');submit();assert.equal(state().requests.at(-1).source,'관리자 대리 접수');
 await page('adminDailyHistory');click('[data-aw="daily-export"]');assert.match(exported.name,/일그레이드/);assert.equal(exported.rows[1].includes('실지급액'),false);
 await page('adminPayroll');click('[data-aw="payroll-reverse"][data-id="PAY-2/unconfirm"]');set('reason','계산 재검토');set('reviewed',true);submit();assert.equal(state().payroll[2].previousStatement.status,'수정 중');assert.match(q('#tm-main').textContent,/이전 명세서 수정 중/);
 await page('adminAttendance');if(!q('[data-aw-select="AT-3"]').checked)click('[data-aw-select="AT-3"]');click('[data-aw="attendance-reject-bulk"]');set('reason','중복 일정 확인');submit();assert.equal(state().attendance.find(r=>r.id==='AT-3').status,'반려');
 assert.deepEqual(errors,[],'No JavaScript/resource errors');
 console.log('PASS: 19 admin routes, attendance/AS/payroll/contracts/settlements/permissions/audit/notifications, XLSX action and existing staff routes.');
 dom.window.close();
}
main().catch(e=>{console.error(e);console.error('Browser errors:',errors);dom.window.close();process.exitCode=1;});
