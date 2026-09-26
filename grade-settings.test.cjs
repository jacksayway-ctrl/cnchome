const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, 'index.html'), 'utf8');
const code = html.slice(html.indexOf('// Editable grade policy.'), html.indexOf('function adminAttendance()'));
const listeners={};
const context = vm.createContext({GradeNumbers:require('./grade-numbers.js'),GradeCalendar:require('./grade-calendar.js'),GradeCalendarPreview:require('./grade-calendar-preview.js'),fmt:n=>n.toLocaleString("ko-KR"),Intl,Date,structuredClone,root:{addEventListener(type,fn){(listeners[type]??=[]).push(fn)}},window:{addEventListener(){}},localStorage:{getItem(){return null}}});
vm.runInContext(code+'\nglobalThis.api={gradeDefaults,gradeValidate,gradeCalculate,gradeValidDate,gradePolicyAt,gradeReadStore,gradeSyncWeeklyBounds,gradeGenerateWeekly,gradePrepareDraft,gradeDailyCashTable,gradeOriginalMonthlyTable,gradeAggregateCalculate,gradeReferenceMonthly,gradePreviewHtml,gradeUpdatePreview};',context);
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

test('original monthly table preserves supplied labels and estimates without the deleted footer',()=>{
 const html=context.api.gradeOriginalMonthlyTable();for(const label of ['100건 이하','101~110건','111~120건','121~130건','131~140건','141~150건','151~160건','161~170건','171건 이상','18,000원','600,000원','3,026,000원','2,694,000원','2,794,000원','1,980,000','2,005,000','2,187,000','2,237,000','2,362,000','2,594,000','0.5건','취소건 제외 실오더 기준'])assert.ok(html.includes(label),label);assert.ok(!html.includes('100건이상 추가건당'));assert.equal((html.match(/<th>/g)||[]).length,7);assert.ok(!html.includes('<th>기본</th>'));assert.ok(!html.includes('<td>7</td>'));
});

test('aggregate 150 cases at 22 six-hour days uses current monthly table and counts cash once',()=>{
 const p=context.api.gradePrepareDraft(gradeDefaults()),r=context.api.gradeAggregateCalculate(p,'insurance',150,22,6);
 assert.equal(r.distribution.reduce((x,y)=>x+y,0),150);assert.equal(r.hours,132);assert.equal(r.hourly,17000);assert.equal(r.base,2244000);assert.equal(r.daily,200000);assert.equal(r.weekly,0);assert.equal(r.monthly.achievement,300000);assert.equal(r.monthly.extra,100000);assert.equal(r.salary,2644000);assert.equal(r.total,2844000);assert.equal(r.calculationAmount,4656000);
 const weekly=context.api.gradeAggregateCalculate(p,'cosmetics',176,22,6);assert.equal(weekly.weeks.length,5);assert.equal(weekly.weeks.at(-1).carryover,true);assert.equal(weekly.weeks.at(-1).payrollMonth,'2026-10');assert.equal(weekly.weekly,90000);assert.equal(weekly.daily,330000);
 const half=context.api.gradeAggregateCalculate(p,'insurance',150.5,22,6);assert.equal(half.distribution.reduce((x,y)=>x+y,0),150.5);assert.equal(half.monthly.extra,5000);assert.equal(half.hourly,17000);assert.equal(half.monthly.achievement,400000);
 for(const input of [[-1,22,6],[150,0,6],[150,1.5,6],[150,32,6],[150,22,0],[150,22,25],[150.1,22,6]])assert.throws(()=>context.api.gradeAggregateCalculate(p,'insurance',...input));
});
test('monthly calculation matches displayed estimates and boundaries including half-cases',()=>{
 for(const [count,amount] of [[0,1980000],[100,1980000],[101,1985000],[105,2005000],[110,2030000],[110.5,2164500],[111,2167000],[115,2187000],[120,2212000],[121,2217000],[125,2237000],[130,2262000],[131,2322000],[135,2362000],[140,2412000],[141,2554000],[145,2594000]])assert.equal(context.api.gradeReferenceMonthly(count,132).total,amount,String(count));
});
test('aggregate preview waits for confirmation and invalidates stale results after editing',()=>{
 const markup=context.api.gradePreviewHtml();assert.match(markup,/>합산</);assert.match(markup,/value="150"/);assert.match(markup,/data-grade-preview-confirm/);
 const result={innerHTML:'',textContent:''},fields={'#tm-grade-preview-result':result};for(const [key,value] of [['count','150'],['days','22'],['hours','6']])fields['#tm-grade-preview-'+key]={value,checkValidity(){return true}};
 context.root.querySelector=key=>fields[key];context.table=(heads,rows)=>JSON.stringify({heads,rows});
 context.api.gradeUpdatePreview();assert.ok(!result.innerHTML.includes('2,844,000원'));
 let prevented=false;for(const listener of listeners.submit)listener({target:{id:'tm-grade-preview-form'},preventDefault(){prevented=true}});
 assert.ok(prevented);assert.match(result.innerHTML,/최종 예상액 \(세전\): 2,644,000원 \/ 일그레이드 포함 합계: 2,844,000원/);assert.match(result.innerHTML,/정상실적 × 50,000원 − 일그레이드 포함 지급액\(세전\)/);assert.match(result.innerHTML,/총 계산 금액<\/strong>/);assert.match(result.innerHTML,/150건 × 50,000원/);assert.match(result.innerHTML,/− 2,844,000원/);assert.match(result.innerHTML,/= <strong>4,656,000원/);
 fields['#tm-grade-preview-count'].value='0';context.api.gradeUpdatePreview();assert.ok(!result.innerHTML.includes('2,844,000원'));context.api.gradeUpdatePreview(true);assert.match(result.innerHTML,/1,980,000원/);assert.match(result.innerHTML,/0건 × 50,000원/);assert.match(result.innerHTML,/− 1,980,000원/);assert.match(result.innerHTML,/= <strong>-1,980,000원/);
 fields['#tm-grade-preview-days'].value='';context.api.gradeUpdatePreview(true);assert.match(result.textContent,/올바르게/);
 fields['#tm-grade-preview-count'].value='150';fields['#tm-grade-preview-days'].value='22';context.api.gradeUpdatePreview();
});

test('monthly tiers use corrected 17000 hourly through 170 and 18000 above',()=>{
 for(const [count,hourly,award,extra,total] of [[150,17000,300000,100000,2644000],[151,17000,400000,10000,2654000],[155,17000,400000,50000,2694000],[160,17000,400000,100000,2744000],[160.5,17000,500000,5000,2749000],[161,17000,500000,10000,2754000],[165,17000,500000,50000,2794000],[170,17000,500000,100000,2844000]]){const r=context.api.gradeReferenceMonthly(count,132);assert.equal(r.hourly,hourly);assert.equal(r.achievement,award);assert.equal(r.extra,extra);assert.equal(r.total,total);}
 assert.equal(context.api.gradeReferenceMonthly(170.5,132).total,2981000);assert.equal(context.api.gradeReferenceMonthly(171,132).total,2986000);assert.equal(context.api.gradeReferenceMonthly(175,132).total,3026000);assert.equal(context.api.gradeReferenceMonthly(200,132).total,3276000);const r=context.api.gradeAggregateCalculate(context.api.gradePrepareDraft(gradeDefaults()),'insurance',175,22,6);assert.equal(r.hourly,18000);assert.equal(r.monthly.achievement,600000);assert.equal(r.monthly.extra,50000);assert.equal(r.base,2376000);assert.equal(r.salary,3116000);assert.equal(r.total,3441000);
});
