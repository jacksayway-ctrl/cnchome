const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, 'index.html'), 'utf8');
const code = html.slice(html.indexOf('// Editable grade policy.'), html.indexOf('function adminAttendance()'));
const context = vm.createContext({fmt:n=>n.toLocaleString("ko-KR"),Intl,Date,structuredClone,root:{addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem(){return null}}});
vm.runInContext(code+'\nglobalThis.api={gradeDefaults,gradeValidate,gradeCalculate,gradeValidDate,gradePolicyAt,gradeReadStore,gradeSyncWeeklyBounds,gradeGenerateWeekly,gradePrepareDraft,gradeDailyCashTable};',context);
const {gradeDefaults,gradeValidate,gradeCalculate,gradeValidDate,gradePolicyAt,gradeReadStore}=context.api;
test('monthly screenshot boundaries use only the current tier and include its first count',()=>{
 const p=gradeDefaults();assert.equal(gradeValidate(p),'');
 for(const [count,hourly,bonus] of [[0,14000,0],[60,14000,0],[61,14000,5000],[70,14000,50000],[71,15000,55000],[80,15000,100000],[81,15000,105000],[88,15000,140000],[90,15000,150000],[91,15000,210000],[100,15000,300000],[101,16000,310000]]){
  const r=gradeCalculate(p,'monthly',count===0?0:count+39,132);assert.equal(r.hourly,hourly);assert.equal(r.bonus,bonus);assert.equal(r.total,132*hourly+bonus);
 }
});
test('daily count and weekly averages select the correct threshold',()=>{
 const p=gradeDefaults();for(const [count,amount] of [[0,0],[5,0],[6,5000],[7,10000],[8,15000],[100,475000]])assert.equal(gradeCalculate(p,'daily',count).bonus,amount);assert.equal(gradeCalculate(p,'daily',8,6).base,0);
 for(const [count,bonus] of [[39,0],[40,30000],[44,30000],[45,35000],[49,35000],[50,40000]])assert.equal(gradeCalculate(p,'weekly',count,0,5).bonus,bonus);
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
test('department policies isolate effective dates, retain legacy insurance and start other products empty',()=>{
 const insurance=gradeDefaults(),cosmetics=gradeDefaults(),health=gradeDefaults();cosmetics.monthly[0].hourly=20000;health.monthly[0].hourly=30000;
 const entries=[{date:'2026-01-01',savedAt:'2026-01-01T00:00:00Z',policy:insurance},{department:'cosmetics',date:'2026-01-01',savedAt:'2026-01-02T00:00:00Z',policy:cosmetics},{department:'health',date:'2026-10-01',savedAt:'2026-01-03T00:00:00Z',policy:health}];
 assert.equal(gradePolicyAt(entries,'2026-09-01','insurance').monthly[0].hourly,14000);
 assert.equal(gradePolicyAt(entries,'2026-09-01','cosmetics').monthly[0].hourly,20000);
 assert.equal(gradePolicyAt(entries,'2026-09-01','health').monthly[0].hourly,0);
 assert.equal(gradePolicyAt(entries,'2026-10-01','health').monthly[0].hourly,30000);
 assert.equal(gradeValidate(gradePolicyAt([],'2026-09-01','cosmetics')),'');
 assert.equal(gradeReadStore(JSON.stringify({version:2,entries})).length,3);
 assert.throws(()=>gradeReadStore(JSON.stringify({version:2,entries:[{...entries[0],department:'unknown'}]})));
});
test('daily per-case cash is unbounded and independent from weekly/monthly calculations',()=>{
 const p=gradeDefaults(),weekly=gradeCalculate(p,'weekly',40,30),monthly=gradeCalculate(p,'monthly',88,132);
 p.dailyCash={start:6,perCase:5000};assert.equal(gradeCalculate(p,'daily',1000).total,4975000);
 assert.deepEqual(gradeCalculate(p,'weekly',40,30),weekly);assert.deepEqual(gradeCalculate(p,'monthly',88,132),monthly);
 p.dailyCash.start=0;assert.notEqual(gradeValidate(p),'');p.dailyCash={start:6,perCase:-1};assert.notEqual(gradeValidate(p),'');
 const legacy=gradeDefaults();delete legacy.dailyCash;const entries=gradeReadStore(JSON.stringify(legacy));assert.equal(entries[0].policy.dailyCash.start,6);assert.equal(entries[0].policy.dailyCash.perCase,5000);
});

test('weekly configurable thresholds allow 20 entries, reject 21 and calculate edited gaps',()=>{
 const p=gradeDefaults();p.weekly=[{min:0,max:null,hourly:0,achievement:0,extraStart:null,extra:0},...Array.from({length:20},(_,i)=>({min:6+i,max:null,hourly:0,achievement:30000+i*5000,extraStart:null,extra:0}))];context.api.gradeSyncWeeklyBounds(p);assert.equal(gradeValidate(p),'');assert.equal(gradeCalculate(p,'weekly',125,0,5).bonus,125000);
 p.weekly.push({min:26,max:null,hourly:0,achievement:130000,extraStart:null,extra:0});context.api.gradeSyncWeeklyBounds(p);assert.match(gradeValidate(p),/20/);
 const edited=gradeDefaults();edited.weekly[1].min=6;edited.weekly[2].min=7;edited.weekly[3].min=10;context.api.gradeSyncWeeklyBounds(edited);assert.equal(gradeValidate(edited),'');assert.equal(gradeCalculate(edited,'weekly',45,0,5).bonus,35000);edited.weekly[2].min=6;context.api.gradeSyncWeeklyBounds(edited);assert.notEqual(gradeValidate(edited),'');
});

test('automatic weekly list has twenty consecutive thresholds and 5000 increments',()=>{
 const rows=context.api.gradeGenerateWeekly(6,30000);assert.equal(rows.length,21);assert.equal(rows[1].achievement,30000);assert.equal(rows[2].achievement,35000);assert.equal(rows[20].min,25);assert.equal(rows[20].achievement,125000);assert.equal(context.api.gradeGenerateWeekly(7,30000)[20].min,26);assert.throws(()=>context.api.gradeGenerateWeekly(0,30000));
});
test('monthly editor restores six rows at 100 without auto expansion or rate changes',()=>{
 const p=gradeDefaults(),draft=context.api.gradePrepareDraft(p);
 assert.equal(draft.monthly.length,6);assert.deepEqual(Array.from(draft.monthly,r=>r.min),[0,100,110,120,130,140]);assert.equal(draft.monthly[0].max,99);assert.equal(draft.monthly.at(-1).max,null);assert.equal(JSON.stringify(draft.monthly),JSON.stringify(p.monthly));assert.equal(draft.monthlyAuto,undefined);assert.equal(gradeValidate(draft),'');
 const legacy=gradeDefaults();legacy.monthly.forEach((r,i)=>{if(i)r.min-=39;if(r.max!==null)r.max-=39;if(r.extraStart!==null)r.extraStart-=39;});legacy.monthlyAuto={source:structuredClone(legacy.monthly)};legacy.monthly.push({...legacy.monthly.at(-1),min:201});const restored=context.api.gradePrepareDraft(legacy);assert.equal(JSON.stringify(restored.monthly),JSON.stringify(p.monthly));assert.equal(legacy.monthly[1].min,61);
 restored.monthly[1].hourly=17000;assert.equal(context.api.gradePrepareDraft(restored).monthly[1].hourly,17000);
});

test('daily horizontal table starts at six and matches unbounded cash calculation',()=>{
 const p=gradeDefaults(),html=context.api.gradeDailyCashTable(p);assert.equal((html.match(/<th>/g)||[]).length,20);assert.match(html,/<th>6건<\/th>/);assert.match(html,/<th>25건<\/th>/);assert.match(html,/5,000원/);assert.match(html,/100,000원/);assert.equal(gradeCalculate(p,'daily',26).bonus,105000);
 p.dailyCash.start=7;p.dailyCash.perCase=1000;const changed=context.api.gradeDailyCashTable(p);assert.match(changed,/<th>7건<\/th>/);assert.match(changed,/20,000원/);
});
test('weekly draft starts at eight with unchanged amounts and preserves later edits',()=>{
 const p=gradeDefaults(),draft=context.api.gradePrepareDraft(p);assert.equal(draft.weeklyAuto.start,8);assert.equal(draft.weekly[1].min,8);assert.equal(draft.weekly.at(-1).min,27);assert.equal(draft.weekly[1].achievement,30000);assert.equal(draft.weekly[2].achievement,35000);
 draft.weeklyAuto.start=9;draft.weekly=context.api.gradeGenerateWeekly(9,30000);assert.equal(context.api.gradePrepareDraft(draft).weekly[1].min,9);
});
