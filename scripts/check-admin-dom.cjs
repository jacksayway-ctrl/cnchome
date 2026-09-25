// Development-only check. Install jsdom separately; no runtime CDN or dependency.
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'http://preview.local/#adminHome',runScripts:'outside-only',virtualConsole:vc,pretendToBeVisual:true,beforeParse(w){
 w.structuredClone=structuredClone;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
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
 const sections=w.AdminWorkspace.navigation,nav=sections.flatMap(g=>g.items.map(([id])=>id));
 assert.equal(d.querySelectorAll('aside [data-aw-section]').length,6);assert.equal(d.querySelectorAll('aside [data-page^="admin"]').length,0);
 assert.equal(nav.length,20);assert.equal(new Set(nav).size,20);
 for(const id of nav){await page(id);const index=sections.findIndex(g=>g.items.some(([p])=>p===id));assert.ok(d.querySelector('[data-aw-section="'+index+'"][aria-current="true"]'),'Parent navigation '+id);assert.ok(d.querySelector('#aw-subpages [data-page="'+id+'"][aria-current="page"]'),'Subpage navigation '+id);assert.equal(d.querySelectorAll('#aw-subpages [data-page]').length,sections[index].items.length);}
 for(let i=0;i<sections.length;i++){click('[data-aw-section="'+i+'"]');await pause();assert.equal(w.location.hash,'#'+sections[i].items[0][0]);const last=sections[i].items.at(-1)[0];click('#aw-subpages [data-page="'+last+'"]');await pause();assert.equal(w.location.hash,'#'+last);}
 await page('home');assert.equal(q('#aw-subpages').hidden,true);assert.equal(d.querySelectorAll('[data-aw-section][aria-current]').length,0);
 await page('adminPayroll');assert.equal(q('#aw-subpages a').getAttribute('href'),'./payroll.html');
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
 await page('adminGrade');assert.equal(q('#tm-grade-preview-period').value,'aggregate');assert.equal(q('#tm-grade-preview-count').value,'150');assert.ok(!q('#tm-grade-preview-result').textContent.includes('2,844,000원'));q('#tm-grade-preview-form').requestSubmit();assert.match(q('#tm-grade-preview-result').textContent,/2,844,000원/);assert.match(q('[data-grade-calculation-amount]').textContent,/4,656,000원/);const aggregateCount=q('#tm-grade-preview-count');aggregateCount.value='105';aggregateCount.dispatchEvent(new w.Event('input',{bubbles:true}));assert.ok(!q('#tm-grade-preview-result').textContent.includes('2,844,000원'));q('#tm-grade-preview-form').requestSubmit();assert.match(q('#tm-grade-preview-result').textContent,/2,005,000원/);aggregateCount.value='150';aggregateCount.dispatchEvent(new w.Event('input',{bubbles:true}));q('#tm-grade-preview-form').requestSubmit();
 const award=q('[data-grade-dailycash="perCase"]');award.value='5000';award.dispatchEvent(new w.Event('input',{bubbles:true}));q('#tm-grade-form').requestSubmit();click('[data-grade-confirm]');
 const setAuto=(kind,key,value)=>{const el=q('[data-grade-auto="'+kind+'"][data-auto-key="'+key+'"]');el.value=String(value);el.dispatchEvent(new w.Event('change',{bubbles:true}));};
 assert.equal(q('[data-weekly-horizontal] thead').querySelectorAll('th').length,20);assert.equal(q('[data-weekly-horizontal] tbody').children.length,1);assert.match(q('[data-weekly-horizontal] tbody').textContent,/125,000원/);
 setAuto('weekly','start',7);assert.equal(q('[data-weekly-horizontal] th').textContent,'7건');assert.equal(q('[data-weekly-horizontal] thead tr').lastElementChild.textContent,'26건');setAuto('weekly','start',8);
 assert.equal(d.querySelectorAll('[data-grade-auto="monthly"]').length,0);assert.equal(q('[data-original-monthly] tbody').children.length,9);assert.match(q('[data-original-monthly]').textContent,/101~110건/);
 assert.equal(d.querySelectorAll('[data-grade-department]').length,3);assert.equal(q('[data-daily-horizontal] thead tr').children.length,20);assert.equal(d.querySelectorAll('[data-grade-add="daily"]').length,0);
 click('[data-grade-department="cosmetics"]');let productAward=q('[data-grade-dailycash="perCase"]');assert.equal(productAward.value,'0');productAward.value='20000';productAward.dispatchEvent(new w.Event('input',{bubbles:true}));
 click('[data-grade-department="health"]');productAward=q('[data-grade-dailycash="perCase"]');assert.equal(productAward.value,'0');productAward.value='30000';productAward.dispatchEvent(new w.Event('input',{bubbles:true}));q('#tm-grade-form').requestSubmit();assert.match(q('#tm-dialog').textContent,/식품 기준/);click('[data-grade-confirm]');
 click('[data-grade-department="cosmetics"]');assert.equal(q('[data-grade-dailycash="perCase"]').value,'20000');q('#tm-grade-form').requestSubmit();click('[data-grade-confirm]');assert.match(q('#tm-grade-history').textContent,/총 1건/);
 click('[data-grade-department="insurance"]');assert.equal(q('[data-grade-dailycash="perCase"]').value,'5000');assert.match(q('#tm-grade-history').textContent,/총 1건/);
 const savedProducts=JSON.parse(w.localStorage.getItem('tm-office-grade-policy-v1')).entries;assert.equal(savedProducts.length,3);assert.deepEqual([...new Set(savedProducts.map(x=>x.department))].sort(),['cosmetics','health','insurance']);
 await page('adminDaily');click('[data-aw="daily-edit"][data-id="staff-8"]');set('count','8');submit();assert.equal(state().daily.find(x=>x.employee==='staff-8').amount,60000);
 await page('adminDaily');assert.match(q('#tm-main').textContent,/0건/);click('[data-aw="daily-edit"][data-id="staff-0"]');set('count','8');submit();assert.equal(state().daily.at(-1).count,8);assert.equal(state().daily.at(-1).amount,15000);await page('adminDailyHistory');click('[data-aw="daily-pay"][data-id="D-1"]');set('paidConfirmed',true);submit();assert.equal(state().daily[0].paid,10000);
 await page('adminContracts');click('[data-aw="contract-add"]');set('start','2026-09-01');set('pay','<img src=x onerror="window.injected=true">');submit();
 assert.equal(state().contracts.length,3);assert.equal(d.querySelectorAll('#tm-main img').length,0);assert.equal(w.injected,undefined);
 const cid=state().contracts[2].id;click('[data-aw="contract-detail"][data-id="'+cid+'"]');set('reviewed',true);submit();assert.equal(state().contracts[2].status,'초안');assert.match(q('.aw-form-error').textContent,/보완 필요/);q('#tm-dialog').close();
 await page('adminPermissions');click('[data-aw="permission-edit"][data-id="admin-owner"]');set('highest',false);set('reason','변경');submit();assert.match(q('.aw-form-error').textContent,/최소 한 명/);assert.equal(state().accounts[0].highest,true);q('#tm-dialog').close();
 await page('adminCorrections');click('[data-aw="correction-review"]');set('status','처리 완료');set('gross','1000');set('tax','100');set('reason','공제 입력 오류 확인');submit();assert.equal(state().requests[0].status,'처리 완료');
 const sid=state().settlements.at(-1).id;
 for(const amount of ['500','600']){click('[data-aw="settlement-detail"][data-id="'+sid+'"]');set('amount',amount);set('reason','실제 지급 기록');const paymentForm=q('#tm-dialog form');paymentForm.requestSubmit();const count=state().settlements.at(-1).payments.length;paymentForm.requestSubmit();assert.equal(state().settlements.at(-1).payments.length,count);}
 assert.match(q('#tm-main').textContent,/초과 지급/);assert.equal(state().settlements.at(-1).payments.length,2);
 click('[data-aw="settlement-detail"][data-id="'+sid+'"]');const pid=state().settlements.at(-1).payments[1].id;click('[data-aw="payment-edit"][data-id="'+sid+'/'+pid+'"]');set('amount','0');set('reason','잘못 입력한 지급 취소');submit();assert.equal(state().settlements.at(-1).payments[1].amount,0);
 await page('adminAudit');assert.ok(q('#tm-main').textContent.includes('공제 입력 오류 확인'));click('[data-aw="audit-detail"]');assert.ok(q('.aw-compare').textContent.includes('payments'));q('#tm-dialog').close();
 await page('adminNotifications');assert.ok(state().notifications.length>0);click('[data-aw="notify-read-all"]');assert.ok(state().notifications.every(n=>n.read));
 for(const id of ['home','sales','grade','attendance','as'])await page(id);
 await page('adminStaff');assert.match(q('#tm-main').textContent,/전체 16명/);click('[data-aw="staff-new"]');await pause();
 const staffForm=q('[data-aw-form="staff-save"]');const staffSet=(name,value)=>staffForm.querySelector('[name="'+name+'"]').value=value;
 staffSet('name','<img src=x onerror="window.staffInjected=true">');staffSet('phone','010-0000-0000');staffSet('team','insurance');staffSet('startDate','2026-09-25');staffSet('weeklyHoliday','일');staffSet('employeeNo','TEST-17');staffSet('payAmount','12000');staffSet('address','예시시 예시로 1');staffSet('workplace','예시 사무실');staffSet('duties','전화 상담');staffSet('contractStart','2026-09-25');staffSet('wageEffective','2026-09-25');staffForm.requestSubmit();await pause();
 assert.equal(state().staff.length,17);assert.match(q('#tm-main').textContent,/TEST-17/);
 click('[data-aw="staff-edit"][data-id="staff-16"]');await pause();const edit=q('[data-aw-form="staff-save"]');assert.equal(edit.querySelector('[name="payAmount"]').value,'12000');edit.querySelector('[name="memo"]').value='정보 확인 완료';edit.requestSubmit();await pause();assert.equal(state().staff.length,17);
 assert.equal(d.querySelectorAll('#tm-main img').length,0);assert.equal(w.staffInjected,undefined);
 await page('adminContracts');click('[data-aw="contract-add"]');assert.ok([...q('#tm-dialog select[name="employee"]').options].some(o=>o.text.includes('staffInjected')));q('#tm-dialog').close();
 await page('adminContracts');click('[data-aw="company-edit"]');set('name','가상 회사');set('representative','가상 대표');set('address','가상 사업장');submit();
 click('[data-aw="contract-add"]');const picker=q('#tm-dialog [name="employee"]');picker.value='staff-16';picker.dispatchEvent(new w.Event('change',{bubbles:true}));assert.equal(q('#tm-dialog [name="start"]').value,'2026-09-25');assert.match(q('#tm-dialog [name="pay"]').value,/12,000/);assert.match(q('#tm-dialog').textContent,/전화 상담/);assert.equal(d.querySelectorAll('#tm-dialog img').length,0);submit();const generated=state().contracts.at(-1);assert.equal(generated.snapshot.person.address,'예시시 예시로 1');assert.equal(generated.snapshot.company.name,'가상 회사');assert.equal(generated.snapshot.person.memo,undefined);
 click('[data-aw="contract-detail"][data-id="'+generated.id+'"]');set('reviewed',true);submit();assert.equal(state().contracts.at(-1).status,'서명 대기');
 await page('adminStaff');click('[data-aw="staff-edit"][data-id="staff-16"]');await pause();q('[data-aw-form="staff-save"] [name="address"]').value='변경된 주소';q('[data-aw-form="staff-save"]').requestSubmit();await pause();assert.equal(state().contracts.at(-1).snapshot.person.address,'예시시 예시로 1');
 await page('adminLeave');assert.equal(state().staff.length,17);assert.equal(state().leaves.at(-1).lots.length,0);
 await page('adminPerformance');assert.equal(d.querySelectorAll('[data-performance-record]').length,0);assert.ok(d.querySelector('#tm-main [data-page="adminAs"]'));
 await page('adminPayroll');click('[data-aw="payroll-reverse"][data-id="PAY-2/unpay"]');set('reason','지급 표시 오류');set('reviewed',true);submit();assert.equal(state().payroll[2].status,'확정');
 await page('adminBank');click('[data-aw="bank-edit"][data-id="staff-2"]');set('bank','예시은행');set('number','001-234567');set('holder','가상 예금주');set('reason','가상 계좌 등록');submit();assert.match(q('#tm-main').textContent,/•••• 4567/);
 click('[data-aw-select="PAY-2"]');click('[data-aw="bank-preview"]');assert.match(q('#tm-dialog').textContent,/001-234567/);set('reviewed',true);submit();assert.match(exported.name,/지급계좌/);assert.equal(exported.rows.length,3);assert.equal(state().payroll[2].status,'확정');
 await page('adminCorrections');click('[data-aw="correction-add"]');set('payrollId','PAY-2');set('reason','퇴사 직원 요청 대리 접수');submit();assert.equal(state().requests.at(-1).source,'관리자 대리 접수');
 await page('adminDailyHistory');click('[data-aw="daily-export"]');assert.match(exported.name,/일그레이드/);assert.equal(exported.rows[1].includes('실지급액'),false);
 await page('adminPayroll');click('[data-aw="payroll-reverse"][data-id="PAY-2/unconfirm"]');set('reason','계산 재검토');set('reviewed',true);submit();assert.equal(state().payroll[2].previousStatement.status,'수정 중');assert.match(q('#tm-main').textContent,/이전 명세서 수정 중/);
 await page('adminCorrections');const request=state().requests.at(-1),settlementCount=state().settlements.length;
 click('[data-aw="correction-review"][data-id="'+request.id+'"]');set('status','처리 완료');set('gross','10000');set('tax','1000');set('reason','미지급 급여 계산 보정');submit();assert.equal(state().requests.at(-1).resolution,'월 급여 보정');assert.equal(state().settlements.length,settlementCount);assert.equal(state().payroll[2].adjustments.at(-1).gross,10000);
 await page('adminPayroll');click('[data-aw="payroll-export"]');const headers=exported.rows[1],row=exported.rows.at(-1);assert.equal(row[headers.indexOf('세전 보정')],10000);assert.equal(row[headers.indexOf('공제 보정')],1000);assert.equal(headers.some(x=>x.includes('일 그레이드')),false);
 await page('adminAttendance');if(!q('[data-aw-select="AT-3"]').checked)click('[data-aw-select="AT-3"]');click('[data-aw="attendance-reject-bulk"]');set('reason','중복 일정 확인');submit();assert.equal(state().attendance.find(r=>r.id==='AT-3').status,'반려');
 assert.deepEqual(errors,[],'No JavaScript/resource errors');
 console.log('PASS: 20 admin routes, staff registration/editing, attendance/AS/payroll/contracts/settlements/permissions/audit/notifications, XLSX action and existing staff routes.');
 dom.window.close();
}
main().catch(e=>{console.error(e);console.error('Browser errors:',errors);dom.window.close();process.exitCode=1;});
