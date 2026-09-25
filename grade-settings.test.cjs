const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, 'index.html'), 'utf8');
const code = html.slice(html.indexOf('// Editable grade policy.'), html.indexOf('function adminAttendance()'));
const context = vm.createContext({Intl,Date,root:{addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem(){return null}}});
vm.runInContext(code+'\nglobalThis.api={gradeDefaults,gradeValidate,gradeCalculate,gradeValidDate,gradePolicyAt,gradeReadStore};',context);
const {gradeDefaults,gradeValidate,gradeCalculate,gradeValidDate,gradePolicyAt,gradeReadStore}=context.api;
test('monthly screenshot boundaries use only the current tier and include its first count',()=>{
 const p=gradeDefaults();assert.equal(gradeValidate(p),'');
 for(const [count,hourly,bonus] of [[0,14000,0],[60,14000,0],[61,14000,5000],[70,14000,50000],[71,15000,55000],[80,15000,100000],[81,15000,105000],[88,15000,140000],[90,15000,150000],[91,15000,210000],[100,15000,300000],[101,16000,310000]]){
  const r=gradeCalculate(p,'monthly',count,132);assert.equal(r.hourly,hourly);assert.equal(r.bonus,bonus);assert.equal(r.total,132*hourly+bonus);
 }
});
test('daily count and weekly averages select the correct threshold',()=>{
 const p=gradeDefaults();p.daily[1].achievement=10000;assert.equal(gradeCalculate(p,'daily',5).bonus,0);assert.equal(gradeCalculate(p,'daily',6).bonus,10000);assert.equal(gradeCalculate(p,'daily',8).bonus,10000);assert.equal(gradeCalculate(p,'daily',8,6).base,0);
 for(const [count,bonus] of [[29,0],[30,30000],[34,30000],[35,40000],[39,40000],[40,50000]])assert.equal(gradeCalculate(p,'weekly',count,0,5).bonus,bonus);
});
test('reject gaps, overlaps, negative amounts, missing limits and invalid additional thresholds',()=>{
 for(const mutate of [p=>p.monthly[1].min=60,p=>p.monthly[1].min=62,p=>p.monthly[1].hourly=-1,p=>p.monthly[0].max=null,p=>p.monthly[5].max=110,p=>p.monthly[2].extraStart=70,p=>p.daily[0].min=NaN]){
  const p=gradeDefaults();mutate(p);assert.notEqual(gradeValidate(p),'');
 }
});
test('future policies wait until the selected date; latest same-day save wins',()=>{
 const old=gradeDefaults(),future=gradeDefaults(),revision=gradeDefaults();future.monthly[0].hourly=17000;revision.monthly[0].hourly=18000;
 const entries=[{date:'2026-09-01',savedAt:'2026-09-01T00:00:00Z',policy:old},{date:'2026-10-01',savedAt:'2026-09-24T00:00:00Z',policy:future},{date:'2026-10-01',savedAt:'2026-09-24T00:01:00Z',policy:revision}];
 assert.equal(gradePolicyAt(entries,'2026-09-30'),old);assert.equal(gradePolicyAt(entries,'2026-10-01'),revision);
 const restored=gradeReadStore(JSON.stringify({version:2,entries}));assert.equal(gradePolicyAt(restored,'2026-10-01').monthly[0].hourly,18000);
});
test('invalid dates and corrupted storage are rejected; legacy policy is retained',()=>{
 assert.equal(gradeValidDate('2026-02-30'),false);assert.equal(gradeValidDate('2028-02-29'),true);assert.equal(gradeValidDate(''),false);
 assert.throws(()=>gradeReadStore('{'));assert.throws(()=>gradeReadStore('{"version":2,"entries":[{}]}'));
 assert.equal(gradeReadStore(JSON.stringify(gradeDefaults())).length,1);
});
