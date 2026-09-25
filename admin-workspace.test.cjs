const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('./admin-workspace.js').core;
const seed=()=>C.seed([{name:'예시 A',team:'insurance'},{name:'예시 B',team:'insurance'},{name:'예시 C',team:'cosmetics'}]);
test('unpaid rounding excludes lunch before flooring each event',()=>{
 assert.equal(C.unpaidMinutes({kind:'외출',start:'12:50',end:'13:21'}),20);
 assert.equal(C.unpaidMinutes({kind:'외출',start:'14:00',end:'14:09'}),0);
});
test('bulk attendance approves eligible entries and retains overlapping request',()=>{
 const s=seed();const result=C.approveAttendance(s,['AT-2','AT-3']);
 assert.equal(result.filter(x=>x.ok).length,1);assert.equal(s.attendance[1].unpaid,20);assert.equal(s.attendance[2].status,'대기');
});
test('annual leave uses earliest use date and earliest unexpired lot',()=>{
 const s=seed();s.leaves[0].lots=[{id:'expired',granted:1,used:0,expires:'2026-10-01'},{id:'early',granted:1,used:0,expires:'2026-10-31'}];
 s.attendance.push({...s.attendance[0],id:'AT-4',date:'2026-10-20'});
 C.approveAttendance(s,['AT-4','AT-1']);assert.equal(s.attendance[0].leaveLot,'early');assert.equal(s.attendance[3].status,'대기');assert.equal(s.leaves[0].lots[0].used,0);
});
test('administrator cannot approve own attendance',()=>{const s=seed();s.actor='staff-0';assert.equal(C.approveAttendance(s,['AT-1'])[0].ok,false);});
test('AS registration does not itself deduct and completion waits for all valid issues',()=>{
 const s=seed();assert.equal(s.cases[0].blocked,false);
 C.updateAs(s,'RC-001','AS-1','decision','차감','차감 검토');
 C.updateAs(s,'RC-001','AS-1','complete','','문제 해결');assert.equal(s.cases[0].blocked,true);
 C.updateAs(s,'RC-001','AS-2','complete','','남은 문제 해결');assert.equal(s.cases[0].blocked,false);
});
test('cancelling sole erroneous deduction restores despite non-deducting issue',()=>{
 const s=seed();C.updateAs(s,'RC-001','AS-1','decision','차감','차감 검토');C.updateAs(s,'RC-001','AS-1','cancel','','중복 등록 오류');
 assert.equal(s.cases[0].blocked,false);assert.equal(s.cases[0].issues[1].status,'진행');assert.equal(s.audit.length,2);
});
test('cancelling one of multiple deduction causes does not restore credit',()=>{
 const s=seed();for(const id of ['AS-1','AS-2'])C.updateAs(s,'RC-001',id,'decision','차감','검토');C.updateAs(s,'RC-001','AS-1','cancel','','입력 오류');assert.equal(s.cases[0].blocked,true);
});
test('AS completion requires a deduction decision and assignment requires same product department',()=>{
 const s=seed();assert.throws(()=>C.updateAs(s,'RC-001','AS-1','complete','','해결'),/먼저/);assert.throws(()=>C.updateAs(s,'RC-001','AS-1','assign','staff-2','인계'),/부서/);
});
test('bulk payroll finalization only processes eligible staff with reasons',()=>{
 const s=seed();s.calendars[2026].confirmed=true;s.payroll.forEach(p=>p.wageReviewed=true);
 const result=C.payrollTransition(s,s.payroll.map(p=>p.id),'confirm');
 assert.deepEqual(result.map(r=>r.ok),[false,false,true]);assert.match(result[0].reason,/A\/S/);assert.match(result[1].reason,/공제/);
});
test('publication precedes payment and duplicate payment is blocked',()=>{
 const s=seed(),p=s.payroll[2];s.calendars[2026].confirmed=true;p.wageReviewed=true;
 C.payrollTransition(s,[p.id],'confirm');assert.equal(C.payrollTransition(s,[p.id],'paid')[0].ok,false);
 C.payrollTransition(s,[p.id],'publish');assert.equal(C.payrollTransition(s,[p.id],'paid')[0].ok,true);assert.equal(C.payrollTransition(s,[p.id],'paid')[0].ok,false);
});
test('confirmed amount snapshot stays immutable after source values change',()=>{
 const s=seed(),p=s.payroll[2];s.calendars[2026].confirmed=true;p.wageReviewed=true;
 C.payrollTransition(s,[p.id],'confirm');const a=C.payrollAmounts(s,p);p.base=1;p.deductions=0;assert.deepEqual(C.payrollAmounts(s,p),a);
});
test('negative net and unconfirmed calendar block payroll',()=>{
 const s=seed(),p=s.payroll[2];p.prepaid=9999999;assert.match(C.payrollIssues(s,p).join(' '),/실지급액 음수/);assert.match(C.payrollIssues(s,p).join(' '),/달력/);
});
test('paid daily allowance remains protected when its calculated amount drops',()=>{
 const s=seed(),p=s.payroll[1];s.daily[1].amount=0;const before=C.payrollAmounts(s,p);s.daily.push({employee:p.employee,date:'2026-09-25',amount:9999999,paid:123});assert.deepEqual(C.payrollAmounts(s,p),before);assert.equal(s.daily[1].paid,15000);
});
test('last active highest administrator cannot be disabled or demoted',()=>{
 const s=seed();assert.throws(()=>C.setPermission(s,'admin-owner',{highest:false,active:true},'권한 변경'),/최소 한 명/);
 C.setPermission(s,'admin-payroll',{highest:true,active:true},'추가 지정');C.setPermission(s,'admin-owner',{highest:false,active:true},'업무 인계');assert.equal(s.accounts[0].highest,false);
});

test('Korean midnight starts a new zero daily view and preserves yesterday',()=>{
 const s=seed();const a=C.koreaDay(new Date('2026-09-24T14:59:59Z')),b=C.koreaDay(new Date('2026-09-24T15:00:00Z'));
 assert.equal(a,'2026-09-24');assert.equal(b,'2026-09-25');s.daily.push({id:'old',employee:'staff-0',date:a,count:10,amount:10000,paid:10000});
 assert.equal(C.dailyView(s,'staff-0',b).count,0);assert.equal(C.dailyView(s,'staff-0',b).paid,0);assert.equal(C.dailyView(s,'staff-0',a).paid,10000);
});
test('only TM staff can receive daily awards and finalized payroll is unaffected',()=>{
 const s=seed(),today=C.koreaDay(),p=s.payroll[0];p.snapshot=C.payrollAmounts(s,p);p.status='확정';const before=structuredClone(p);
 const d=C.recordDaily(s,'staff-0',today,8,10000);C.payDaily(s,d.id,today);assert.deepEqual(p,before);assert.equal(d.paid,10000);
 assert.throws(()=>C.payDaily(s,d.id,today));
 for(const role of ['팀장','관리자','관리직']){s.staff[1].role=role;assert.equal(C.dailyView(s,'staff-1',today).eligible,false);assert.throws(()=>C.recordDaily(s,'staff-1',today,8,10000),/TM/);assert.throws(()=>C.payDaily(s,'D-2',today),/TM/);}
 assert.throws(()=>C.recordDaily(s,'staff-0','2020-01-01',8,10000));
});
test('payout exports confirmed unpaid salaries using latest accounts, preserves snapshots',()=>{
 const s=seed();s.payroll[0].status='확정';s.payroll[0].snapshot=C.payrollAmounts(s,s.payroll[0]);s.payroll[1].status='확정';s.payroll[2].status='지급 완료';
 assert.throws(()=>C.saveBank(s,'staff-0',{bank:'예시',number:'12345',holder:'A'},''));
 C.saveBank(s,'staff-0',{bank:'예시은행',number:'001-23456',holder:'예시 A'},'예시 등록');
 const original=structuredClone(s.payroll[0]);C.saveBank(s,'staff-0',{bank:'새예시은행',number:'009-87654',holder:'예시 A'},'변경');
 const plan=C.payoutPreview(s,['PAY-0','PAY-0','PAY-1','PAY-2']);assert.equal(plan.rows.length,1);assert.equal(plan.rows[0][3],'009-87654');assert.equal(plan.excluded.length,2);assert.match(plan.excluded[0].reason,/은행·계좌번호·예금주/);assert.deepEqual(s.payroll[0],original);
 s.daily[0].amount=9999999;assert.deepEqual(C.payoutPreview(s,['PAY-0']).rows,plan.rows);
});
test('payroll reversal enforces paid boundary and retains prior published statement',()=>{
 const s=seed(),p=s.payroll[2];p.snapshot=C.payrollAmounts(s,p);p.status='지급 완료';p.published=true;p.paidDate='2026-10-14';
 assert.throws(()=>C.reversePayroll(s,p.id,'unconfirm','오류'));assert.throws(()=>C.reversePayroll(s,p.id,'unpublish','오류'));assert.throws(()=>C.reversePayroll(s,p.id,'unpay',''));
 C.reversePayroll(s,p.id,'unpay','실제 미지급');assert.equal(p.status,'확정');assert.equal(p.paidDate,null);
 const old=structuredClone(p.snapshot);C.reversePayroll(s,p.id,'unconfirm','입력 오류');assert.equal(p.status,'미확정');assert.equal(p.snapshot,null);assert.deepEqual(p.previousStatement.snapshot,old);assert.equal(p.previousStatement.status,'수정 중');assert.equal(p.published,false);
 assert.throws(()=>C.reversePayroll(s,p.id,'unconfirm','중복'));
});
test('unpublish only applies before payment and retains amount',()=>{
 const s=seed(),p=s.payroll[2];p.status='확정';p.published=true;p.snapshot=C.payrollAmounts(s,p);const a=structuredClone(p.snapshot);
 C.reversePayroll(s,p.id,'unpublish','공개 오류');assert.equal(p.published,false);assert.deepEqual(p.snapshot,a);assert.throws(()=>C.reversePayroll(s,p.id,'unpublish','중복'));
});
test('bulk rejection requires reason and skips own or already processed requests',()=>{
 const s=seed();s.actor='staff-0';s.attendance[2].status='승인';assert.throws(()=>C.rejectAttendance(s,['AT-2'],''));
 const results=C.rejectAttendance(s,['AT-1','AT-2','AT-3'],'일정 확인 필요');assert.equal(results.filter(r=>r.ok).length,1);assert.equal(s.attendance[1].reply,'일정 확인 필요');assert.equal(s.notifications.length,1);
});
test('proxy correction requests retain payroll reference and allow independent requests',()=>{
 const s=seed();assert.throws(()=>C.proxyRequest(s,'PAY-2','오류'));s.payroll[2].status='지급 완료';assert.throws(()=>C.proxyRequest(s,'PAY-2',' '));
 const a=C.proxyRequest(s,'PAY-2','퇴사 직원 전달 내용'),b=C.proxyRequest(s,'PAY-2','추가 전달');assert.notEqual(a.id,b.id);assert.equal(a.payrollId,'PAY-2');assert.equal(a.status,'접수');assert.equal(a.month,'2026-09');assert.equal(s.notifications.length,2);
});
