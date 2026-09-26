const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('./grade-calendar.js');
const defaults={dailyCash:{perCase:100},weekly:{threshold:5,amount:10000},monthly:{threshold:10,amount:20000,hourly:15000}};
function evaluate(policy,period,count,hours){
  if(period==='daily')return {bonus:count*policy.dailyCash.perCase};
  const p=policy[period],achievement=count>=p.threshold?p.amount:0;
  return {achievement,extra:0,bonus:achievement,hourly:p.hourly||0,base:hours*(p.hourly||0)};
}
const calculate=input=>C.calculate({defaults,department:'insurance',evaluate,...input});
const record=(date,count=0,hours=6,role='general')=>({date,count,hours,role});
const spanning=C.week('2026-09-28').dates.map((date,i)=>record(date,i+3));
test('a cross-month week is a single item in the Friday month and is never divided across two payrolls',()=>{
  const september=calculate({month:'2026-09',records:spanning}),october=calculate({month:'2026-10',records:spanning});
  const carried=september.weeks.find(w=>w.start==='2026-09-28'),included=october.weeks.find(w=>w.start==='2026-09-28');
  assert.equal(carried.carryover,true);assert.equal(carried.included,false);assert.equal(september.weekly,0);
  assert.equal(included.count,25);assert.equal(included.fromPreviousMonth,true);assert.equal(included.included,true);assert.equal(october.weekly,10000);
  assert.equal(october.weeks.filter(w=>w.start==='2026-09-28').length,1);
});
test('year changes roll over; a weekend in the following month does not move a Monday-Friday bonus',()=>{
  assert.equal(C.week('2026-12-28').payrollMonth,'2027-01');
  assert.equal(C.week('2026-07-27').payrollMonth,'2026-07');
  const records=C.week('2026-12-28').dates.map(date=>record(date,2));
  assert.equal(calculate({month:'2026-12',records}).weekly,0);
  assert.equal(calculate({month:'2027-01',records}).weekly,10000);
});
test('a midweek change uses the new policy on the effective date and combines its segments into one weekly item',()=>{
  const changed={...defaults,weekly:{threshold:10,amount:30000}};
  const entries=[{date:'2026-09-30',policy:changed}];
  const result=calculate({month:'2026-10',records:spanning,entries}),w=result.weeks[0];
  assert.deepEqual(w.segments.map(s=>[s.start,s.end,s.count,s.bonus]),[['2026-09-28','2026-09-29',7,10000],['2026-09-30','2026-10-02',18,30000]]);
  assert.equal(result.weekly,40000);assert.equal(w.bonus,40000);assert.equal(w.payrollMonth,'2026-10');
});
test('monthly changes evaluate only each effective period and sum basic pay and allowances',()=>{
  const changed={...defaults,monthly:{threshold:10,amount:40000,hourly:20000}};
  const result=calculate({month:'2026-09',records:[record('2026-09-15',12),record('2026-09-16',8)],entries:[{date:'2026-09-16',policy:changed}]});
  assert.deepEqual(result.monthly.segments.map(s=>[s.count,s.hourly,s.bonus]),[[12,15000,20000],[8,20000,0]]);
  assert.equal(result.base,210000);assert.equal(result.monthly.bonus,20000);assert.equal(result.salary,230000);
  assert.equal(result.total,result.salary+result.daily);
});
test('changing only a weekly table cannot reset or duplicate monthly performance',()=>{
  const changed={...defaults,weekly:{threshold:20,amount:80000}};
  const result=calculate({month:'2026-09',records:[record('2026-09-15',6),record('2026-09-16',6)],entries:[{date:'2026-09-16',policy:changed}]});
  assert.equal(result.monthly.segments.length,1);assert.equal(result.monthly.bonus,20000);
});
test('future tables do not recalculate earlier dates and the latest version on the same date wins',()=>{
  const changed={...defaults,monthly:{threshold:10,amount:40000,hourly:20000}};
  const entries=[{date:'2026-10-01',savedAt:'2026-09-01',policy:changed},{date:'2026-10-01',savedAt:'2026-09-02',policy:{...changed,monthly:{...changed.monthly,amount:50000}}}];
  assert.equal(calculate({month:'2026-09',records:[record('2026-09-15',12)],entries}).monthly.bonus,20000);
  assert.equal(calculate({month:'2026-10',records:[record('2026-10-15',12)],entries}).monthly.bonus,50000);
});
test('missing preceding-month performance stays pending until explicitly entered, including an explicit zero',()=>{
  const records=C.week('2026-08-31').dates.slice(1).map(date=>record(date,3));
  const pending=calculate({month:'2026-09',records});assert.equal(pending.weekly,0);assert.deepEqual(pending.weeks[0].missing,['2026-08-31']);
  const complete=calculate({month:'2026-09',records:[record('2026-08-31',0,0),...records]});assert.equal(complete.weekly,10000);assert.equal(complete.daily,1200);
});
test('ordinary-employee grades exclude a team-leader payroll and do not pay a leader-only period',()=>{
  assert.equal(calculate({month:'2026-09',role:'leader',records:spanning}).eligible,false);
  const leader=calculate({month:'2026-09',records:[record('2026-09-15',20,6,'팀장')]});
  assert.equal(leader.base,0);assert.equal(leader.monthly.bonus,0);assert.equal(leader.daily,0);
  const mixed=calculate({month:'2026-09',records:[record('2026-09-15',6),record('2026-09-16',6,6,'팀장')]});
  assert.equal(mixed.monthly.bonus,10000);assert.equal(mixed.base,90000);assert.equal(mixed.daily,600);
});
test('a half case stays intact and zero-hour normal performance can earn an ordinary-employee allowance',()=>{
  const rows=C.distribute('2026-09',150.5,22,6);assert.equal(rows.reduce((s,r)=>s+r.count,0),150.5);
  assert.equal(calculate({month:'2026-09',records:[record('2026-09-15',10,0)]}).monthly.bonus,20000);
});
test('invalid and duplicate dates, unsupported values, and excess monthly workdays are rejected',()=>{
  assert.throws(()=>C.distribute('2026-02',100,22,6));assert.throws(()=>C.workdays('2026-13'));
  assert.throws(()=>calculate({month:'2026-09',records:[record('2026-09-31')]}));
  assert.throws(()=>calculate({month:'2026-09',records:[record('2026-09-01'),record('2026-09-01')]}));
  assert.throws(()=>calculate({month:'2026-09',records:[record('2026-09-01',1.1)]}));
  assert.throws(()=>calculate({month:'2026-09',records:[record('2026-09-01',1,25)]}));
});
