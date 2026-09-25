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
 const s=seed(),p=s.payroll[1];s.daily[1].amount=0;const a=C.payrollAmounts(s,p);assert.equal(a.dailyTotal,15000);assert.equal(a.cash,15000);assert.equal(a.net,p.base+p.allowance-p.deductions);
});
test('last active highest administrator cannot be disabled or demoted',()=>{
 const s=seed();assert.throws(()=>C.setPermission(s,'admin-owner',{highest:false,active:true},'권한 변경'),/최소 한 명/);
 C.setPermission(s,'admin-payroll',{highest:true,active:true},'추가 지정');C.setPermission(s,'admin-owner',{highest:false,active:true},'업무 인계');assert.equal(s.accounts[0].highest,false);
});
