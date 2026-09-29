const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/grade-header.js','utf8');
const sample=()=>({date:'2026-09-29',isTest:false,scheduleRegistered:true,policyRegistered:true,general:true,policyDate:'2026-09-01',workdays:{total:22,elapsed:21},daily:{count:2,target:6},weekly:{count:3,value:0.6,target:8,basis:'average',availableDays:5,start:'2026-09-28',end:'2026-10-02'},monthly:{count:3,range:'100건 이하'}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(){const elements=Object.fromEntries(['workdays','daily','weekly','monthly'].map(n=>['tm-head-'+n,{textContent:'',title:''}])),root={dataset:{},setAttribute(k,v){this[k]=v;}},events={},timers=[];let result=sample(),ok=true;
 const window={Event:class{constructor(type){this.type=type;}},dispatchEvent:event=>events[event.type]?.(event),CNCHOME_LIVE:{user:{role:'employee'}},document:{hidden:false,getElementById:id=>elements[id],querySelector:()=>root,addEventListener:(k,fn)=>events[k]=fn},fetch:async(url,opts)=>{assert.equal(url,'/grade-summary-api.php');assert.equal(opts.cache,'no-store');return {ok,json:async()=>result};},setInterval:(fn,ms)=>{assert.equal(ms,5000);timers.push(fn);},addEventListener:(k,fn)=>events[k]=fn};vm.runInNewContext(source,{window});return {window,elements,root,events,timers,set(value,success=true){result=value;ok=success;}};}
test('header displays live personal counts and reloads status, settings, and day changes',async()=>{
 const s=setup();assert.equal(s.elements['tm-head-daily'].textContent,'불러오는 중');await tick();assert.equal(s.elements['tm-head-workdays'].textContent,'22일 / 21일');assert.equal(s.elements['tm-head-daily'].textContent,'2 / 6건');assert.equal(s.elements['tm-head-weekly'].textContent,'평균 0.6 / 8건');assert.equal(s.elements['tm-head-monthly'].textContent,'3건 · 100건 이하');
 const next=sample();next.daily={count:1,target:7};s.set(next);await s.events['cnc:sales-changed']();assert.equal(s.elements['tm-head-daily'].textContent,'1 / 7건');s.window.GradeHeader.render();assert.equal(s.elements['tm-head-daily'].textContent,'1 / 7건');
 next.date='2026-10-01';next.workdays={total:22,elapsed:1};s.set(next);s.timers[0]();await tick();assert.equal(s.elements['tm-head-workdays'].textContent,'22일 / 1일');
});
test('failed fetch never shows stale sample values and unregistered settings remain explicit',async()=>{
 const s=setup();await tick();s.set({error:'연결 실패'},false);await s.window.GradeHeader.load();for(const el of Object.values(s.elements)){assert.equal(el.textContent,'조회 실패');assert.equal(el.title,'연결 실패');}
 const next=sample();next.policyRegistered=false;next.scheduleRegistered=false;next.workdays={total:null,elapsed:null};next.monthly.range=null;next.isTest=true;s.set(next);await s.window.GradeHeader.load();assert.equal(s.elements['tm-head-workdays'].textContent,'근무정보 미등록');assert.match(s.elements['tm-head-daily'].textContent,/기준 미등록/);assert.match(s.root['aria-label'],/테스트 실적/);
 next.general=false;s.set(next);await s.window.GradeHeader.load();assert.equal(s.elements['tm-head-weekly'].textContent,'별도 기준');
});
