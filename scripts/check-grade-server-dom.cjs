const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const directory=path.resolve(__dirname,'..');
const tick=()=>new Promise(r=>setTimeout(r,15));
function estimateResponse(options,entries,role){
 const body=JSON.parse(options?.body||'{}');
 const code="require $argv[1];$fixture=json_decode(stream_get_contents(STDIN),true);echo hr_json(grade_estimates($fixture['input'],$fixture['history'],[],$fixture['admin']));";
 let data;try{data=JSON.parse(require('node:child_process').execFileSync(process.env.PHP_BINARY||'php',['-r',code,path.join(directory,'server/lib/grade-estimates.php')],{input:JSON.stringify({input:body,history:entries,admin:role==='admin'}),encoding:'utf8'}));}catch{return {ok:false,json:async()=>({error:'invalid forecast fixture'})};}
 const response={ok:true,json:async()=>data};
 if(holdForecast&&body.counts?.[8]===220)return new Promise(resolve=>{releaseForecast=()=>resolve(response);});
 return response;
}
let holdForecast=false,releaseForecast;
function boot(role='admin',entries=[],saveHandler,region=false){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(fs.readFileSync(path.join(directory,'.build/office-preview.html'),'utf8'),{url:'https://preview.local/office.php?role='+role+(region?'&policyWindow=1':'')+'#'+(region?'regions':role==='employee'?'grade':'adminGrade'),runScripts:'outside-only',virtualConsole:vc,pretendToBeVisual:true,beforeParse(w){
  w.structuredClone=structuredClone;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
  w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  w.CNCHOME_LIVE={entries,revision:0,csrf:'token',user:{id:1,role,department:'insurance',display_name:'테스트'}};
  w.fetch=async(url,options)=>String(url).includes('grade-api.php')?saveHandler(url,options):String(url).includes('grade-estimates.php')?estimateResponse(options,entries,role):String(url).includes('intake-policy-api.php')?{ok:true,json:async()=>({revision:1,version:1,clients:[{id:'legacy',label:'가상 거래처'}],codes:[{id:'hanwha',label:'한화',aliases:[]}],policies:{'hanwha:general':{client:'legacy',carrier:'hanwha',kind:'general',rows:[['지역','수량'],['경기도 전체','4']],reviewed:true,savedAt:'2026-09-29T00:00:00Z'}}})}:String(url).includes('grade-personal-totals.php')?{ok:false,json:async()=>({error:'personal totals fixture omitted'})}:{ok:true,json:async()=>({revision:0,entries:[],records:[],staff:[],employees:[],payroll:[]})};
 }});
 const w=dom.window,d=w.document;
 if(region){d.body.classList.add('policy-window');const style=d.createElement('style');style.textContent=fs.readFileSync(path.join(directory,'office.css'),'utf8');d.head.append(style);}
 for(const script of d.querySelectorAll('script'))w.eval(script.src?fs.readFileSync(path.join(directory,new URL(script.src).pathname),'utf8'):script.textContent);
 return {dom,w,d,errors};
}
(async()=>{
 let fail=true,calls=0,revision=0,entries=[],lastRequest;
 const a=boot('admin',[],async(url,options)=>{
  assert.equal(url,'/grade-api.php?role=admin');assert.equal(options.headers['X-CSRF-Token'],'token');
  const body=JSON.parse(options.body);lastRequest=body;assert.equal(body.revision,revision);calls++;
  if(fail)return {ok:false,json:async()=>({error:'다른 관리자가 변경했습니다. 충돌 테스트'})};
  const saved={department:body.department,date:body.date,period:body.period||'all',policy:body.policy};
  entries.push({...saved,savedPolicy:body.policy,savedAt:'2026-09-29T12:00:0'+revision+'.000000Z',savedBy:'테스트'});revision++;
  return {ok:true,json:async()=>({entries:structuredClone(entries),revision,saved})};
 });
 const q=s=>{const el=a.d.querySelector(s);assert.ok(el,s);return el};
 const edit=(selector,value,type='input')=>{const el=q(selector);el.value=value;el.dispatchEvent(new a.w.Event(type,{bubbles:true}));};
 try{
  await tick();assert.equal(a.d.querySelectorAll('[data-grade-save-period]').length,3);
  assert.equal(a.d.querySelector('#tm-grade-preview-form'),null);assert.equal(a.d.querySelector('#live-account'),null);
  assert.equal(q('[data-grade-samples]').querySelectorAll('tbody tr').length,6);
  q('#tm-grade-form').requestSubmit();q('[data-grade-confirm]').click();await tick();
  assert.match(q('#tm-grade-confirm-error').textContent,/충돌/);assert.equal(a.w.CNCHOME_LIVE.revision,0);
  fail=false;q('[data-grade-confirm]').click();q('[data-grade-confirm]').click();await tick();assert.equal(calls,2);
  assert.equal(a.w.CNCHOME_LIVE.revision,1);assert.match(q('#tm-grade-history').textContent,/2026/);
  const performance='[data-grade-monthly-reference="example"][data-grade-reference-index="8"]';
  const amount=key=>q('[data-original-monthly] tbody tr:nth-child(9) [data-estimate-column="'+key+'"]');
  edit('#tm-grade-effective-date','2026-09-29','change');await new Promise(r=>setTimeout(r,370));
  assert.equal(amount('daily').textContent,'325,000원');assert.equal(amount('weekly').textContent,'120,000원');assert.equal(amount('monthly').textContent,'650,000원');
  assert.equal(amount('total').textContent,'3,471,000원');assert.equal(amount('salary').textContent,'3,146,000원');assert.match(q('[data-grade-caption]').textContent,/월 전체 비교/);
  assert.match(q('[data-grade-calculation]').textContent,/월 175건/);assert.match(q('[data-estimate-breakdown="advance"]').textContent,/일 선지급/);
  const smallWidth=Number(q(performance).style.getPropertyValue('--grade-number-ch'));
  edit(performance,'123456');assert.equal(q(performance).value,'123,456');assert.ok(Number(q(performance).style.getPropertyValue('--grade-number-ch'))>smallWidth);
  edit('#tm-grade-effective-date','2026-09-01','change');
  edit(performance,'220');assert.equal(amount('daily').textContent,'—');await new Promise(r=>setTimeout(r,370));
  assert.equal(amount('daily').textContent,'550,000원');assert.equal(amount('weekly').textContent,'160,000원');assert.equal(amount('total').textContent,'4,186,000원');assert.equal(amount('salary').textContent,'3,636,000원');
  edit(performance,'330');await new Promise(r=>setTimeout(r,370));
  assert.equal(amount('daily').textContent,'1,100,000원');assert.equal(amount('weekly').textContent,'260,000원');assert.equal(amount('total').textContent,'5,936,000원');assert.equal(amount('salary').textContent,'4,836,000원');
  assert.match(amount('salary').title,/선지급 1,100,000원/);assert.match(q('[data-original-monthly] tbody tr:nth-child(9) [data-estimate-average]').textContent,/15건/);
  holdForecast=true;edit(performance,'220');await new Promise(r=>setTimeout(r,370));assert.equal(typeof releaseForecast,'function');
  edit(performance,'330');holdForecast=false;await new Promise(r=>setTimeout(r,370));releaseForecast();await tick();assert.equal(amount('daily').textContent,'1,100,000원');
  edit(performance,'');await new Promise(r=>setTimeout(r,370));assert.equal(amount('total').textContent,'—');assert.match(q('[data-grade-caption]').textContent,/예상실적/);
  edit(performance,'330');await new Promise(r=>setTimeout(r,370));
  const monthly='[data-grade-monthly-reference="achievement"][data-grade-reference-index="0"]';
  const daily='[data-grade-dailycash="perCase"]';const weekly='[data-grade-auto="weekly"][data-auto-key="amount"]';
  edit(monthly,'321000');edit(weekly,'41000','change');edit(daily,'6000');
  q('[data-grade-save-period="daily"]').click();q('[data-grade-save-period="daily"]').click();await tick();
  assert.equal(calls,3);assert.equal(lastRequest.period,'daily');assert.equal(lastRequest.policy.dailyCash.perCase,6000);
  assert.equal(lastRequest.policy.weekly[1].achievement,30000);assert.equal(lastRequest.policy.monthlyReference?.[0]?.achievement||0,0);
  assert.equal(q(weekly).value,'41,000');assert.equal(q(monthly).value,'321,000');assert.match(q('[data-grade-period-status="monthly"]').textContent,/수정 중/);
  assert.match(q('[data-grade-period-status="daily"]').textContent,/DB 저장 완료/);
  q('[data-grade-save-period="weekly"]').click();await tick();assert.equal(lastRequest.period,'weekly');assert.equal(lastRequest.policy.dailyCash.perCase,6000);assert.equal(lastRequest.policy.weekly[1].achievement,41000);assert.equal(q(monthly).value,'321,000');
  q('[data-grade-save-period="monthly"]').click();await tick();assert.equal(lastRequest.period,'monthly');assert.equal(lastRequest.policy.monthlyReference[0].achievement,321000);assert.equal(lastRequest.policy.monthlyReference[8].example,330);assert.equal(lastRequest.policy.weekly[1].achievement,41000);
  edit(monthly,'');edit(daily,'7000');q('[data-grade-save-period="daily"]').click();await tick();
  assert.equal(lastRequest.policy.dailyCash.perCase,7000);assert.equal(lastRequest.policy.monthlyReference[0].achievement,321000);assert.equal(q(monthly).value,'');
  const before=calls;q('[data-grade-save-period="monthly"]').click();await tick();assert.equal(calls,before);assert.ok(q('#tm-grade-error').textContent);
  edit(monthly,'333000');fail=true;q('[data-grade-save-period="monthly"]').click();await tick();assert.match(q('#tm-grade-error').textContent,/충돌/);assert.equal(q(monthly).value,'333,000');assert.equal(q('[data-grade-save-period="monthly"]').disabled,false);
  assert.equal(a.w.localStorage.getItem('tm-office-grade-policy-v1'),null);
  const employee=boot('employee',entries);try{await tick();assert.equal(employee.d.querySelector('#tm-grade-form'),null);assert.match(employee.d.querySelector('#tm-main').textContent,/개인별 주그레이드/);assert.deepEqual(employee.errors,[]);}finally{employee.dom.window.close();}
  const region=boot('employee',entries,undefined,true);try{
   await tick();const button=region.d.querySelector('.policy-registration-heading .policy-intake-button');assert.ok(button);assert.equal(button.previousElementSibling.textContent,'접수 정책표');assert.equal(region.w.getComputedStyle(button).display,'inline-flex');button.click();assert.ok(region.d.querySelector('#tm-dialog[open] [data-sales-form]'));assert.deepEqual(region.errors,[]);
  }finally{region.dom.window.close();}
  const calendarDom=new JSDOM(fs.readFileSync(path.join(directory,'.build/business-calendar.html'),'utf8'));
  try{const doc=calendarDom.window.document,day=doc.querySelector('input[name="days[]"][value="2026-09-23"]'),form=day.form;assert.equal(day.checked,true);day.closest('label').click();assert.equal(day.checked,false);assert.ok(!new calendarDom.window.FormData(form).getAll('days[]').includes('2026-09-23'));day.closest('label').click();assert.equal(day.checked,true);assert.ok(new calendarDom.window.FormData(form).getAll('days[]').includes('2026-09-23'));assert.equal(form.method,'post');assert.equal(form.elements.csrf.value,'TEST');assert.ok(doc.querySelector('a[href="/business-calendar.php?role=admin"]'));}finally{calendarDom.window.close();}
  assert.deepEqual(a.errors,[]);
  console.log('PASS: admin-session DB requests, individual saves, retained unrelated edits, invalid-section isolation, conflict retention, duplicate-click prevention, live PHP forecast changes, stale-response isolation, saved expected performance, six sample rows, employee read-only view policy-window intake button and native calendar toggles.');
 }finally{a.dom.window.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
