const test=require('node:test'),assert=require('node:assert/strict');const sales=require('./sales-workspace.js').core;
test('live status transition moves a record without duplicating team or date totals',()=>{
 const rows=[{team:'insurance',date:'2026-09-26',status:'pending'},{team:'insurance',date:'2026-09-25',status:'as'},{team:'cosmetics',date:'2026-09-26',status:'normal'}];
 assert.deepEqual(sales.daily(rows,'insurance','2026-09-26'),{pending:1,normal:0,as:0});rows[0].status='normal';
 assert.deepEqual(sales.daily(rows,'insurance','2026-09-26'),{pending:0,normal:1,as:0});rows[2].status='as';
 assert.deepEqual(sales.daily(rows,'cosmetics','2026-09-26'),{pending:0,normal:0,as:1});assert.equal(sales.counts(rows).as,2);
});
test('counting age uses the selected year, not whether the birthday has passed',()=>{
 assert.deepEqual(sales.ageKind(1967,'2026-01-01'),{age:60,kind:'general'});assert.deepEqual(sales.ageKind(1966,'2026-01-01'),{age:61,kind:'silver'});assert.deepEqual(sales.ageKind(1965,'2026-01-01'),{age:62,kind:'silver'});assert.equal(sales.ageKind(1957,'2026-12-31').kind,'silver');assert.equal(sales.ageKind(1956,'2026-01-01').kind,null);
});
test('weekly calendar includes the previous month for each configured starting day',()=>{
 assert.deepEqual(sales.weekDates('2026-10-01',1),['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03','2026-10-04']);assert.equal(sales.weekDates('2026-10-01',0)[0],'2026-09-27');
});

const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function boot({role='employee',username='employee',page='sales',data}={}){
 const dom=new JSDOM('<div id="workspace"><dialog><h2 id="tm-dialog-title"></h2><div id="form-host"></div></dialog><main></main></div>',{url:'https://example.test/office.php?page='+page,runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,root=w.document.getElementById('workspace'),posts=[],intervals=[];let reads=0;
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 let snapshot=data||{month:date.slice(0,7),records:[],homeRecords:[],pendingRecords:[],staff:[{id:2,name:'직원',team:'insurance'}],isTestAccount:/^user[1-6]$/.test(username)};
 w.CNCHOME_LIVE={csrf:'fixture',page,user:{id:2,role,username,department:'insurance',display_name:'직원'}};
 w.setInterval=(fn,ms)=>{intervals.push({fn,ms});return intervals.length;};w.clearInterval=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.fetch=async(url,options={})=>{
  if(options.method==='POST'){
   const body=JSON.parse(options.body);posts.push(body);
   const record={...body,id:'1',employeeId:2,employee:'직원',team:'insurance',kind:'general',status:'pending',isTest:false,revision:1};
   snapshot={...snapshot,records:[record],pendingRecords:[record]};
  }else reads++;
  return {ok:true,status:200,json:async()=>structuredClone(snapshot)};
 };
 for(const file of ['korea-regions.js','intake-codes.js','region-rules.js','receipt-form.js','intake-details.js','sales-workspace.js'])w.eval(fs.readFileSync(__dirname+'/'+file,'utf8'));
 const api=w.SalesWorkspace;
 const render=()=>{root.querySelector('main').innerHTML=api.render(page);};
 api.init({root,open(title,html){root.querySelector('#form-host').innerHTML=html;root.querySelector('dialog').showModal();},close(){root.querySelector('dialog').close();},toast(){},render});
 await tick();render();
 return {dom,w,root,posts,intervals,date,get reads(){return reads;},setData(value){snapshot=value;},api};
}

test('actual receipt forms submit consultation fields and recall requests, then reset for the next receipt',async()=>{
 for(const role of ['employee','admin']){
  const s=await boot({role,page:role==='admin'?'adminHome':'sales'});
  try{
   assert.equal(s.api.intake(),true);const form=s.root.querySelector('[data-sales-form]');
   assert.ok(form.querySelector('[data-receipt-date]'));assert.equal(form.querySelectorAll('[name="premiumBand"]').length,3);assert.ok(form.querySelector('[data-receipt-recall]'));
   function input(selector,value){const el=form.querySelector(selector);el.value=value;el.dispatchEvent(new s.w.Event('input',{bubbles:true}));}
   if(role==='admin')input('[name="employeeId"]','2');
   input('[data-receipt-date]',s.date.slice(5).replace('-',''));
   input('[name="customer"]','검증 고객');input('[data-receipt-phone]','0000-0000');
   input('[data-receipt-birth-year]','1990');input('[data-receipt-birth-month]','03');input('[data-receipt-birth-day]','23');
   input('[name="consultationPlace"]','직장 <상담실>');form.querySelector('[name="premiumBand"][value="200000"]').click();
   form.querySelector('[data-receipt-recall]').click();input('[name="recallMemo"]','다음 연락 예정');
   assert.equal(form.querySelector('[data-receipt-recall-note]').hidden,false);assert.equal(form.checkValidity(),true);
   form.requestSubmit();await tick();await new Promise(resolve=>setTimeout(resolve,5));
   assert.equal(s.posts.length,1);const posted=s.posts[0];
   assert.equal(Object.hasOwn(posted,'address'),false);assert.equal(posted.birthMonth,'03');assert.equal(posted.birthDay,'23');
   assert.equal(posted.consultationPlace,'직장 <상담실>');assert.equal(posted.premiumBand,'200000');assert.equal(posted.recallRequested,true);assert.equal(posted.recallMemo,'다음 연락 예정');
   assert.match(form.querySelector('[data-sales-error]').textContent,/재콜 가접수로 저장했습니다/);
   assert.equal(form.elements.customer.value,'');assert.equal(form.elements.recallRequested.value,'false');assert.equal(form.querySelector('[data-receipt-recall-note]').hidden,true);
   const markup=s.api.render(role==='admin'?'adminHome':'sales');assert.match(markup,/직장 &lt;상담실&gt;/);assert.match(markup,/20만 원 이상/);assert.doesNotMatch(markup,/<상담실>/);
  }finally{s.dom.window.close();}
 }
});

test('test accounts see their own saved test sales while real staff and administrators default to real sales',async()=>{
 for(const username of ['user1','user2','user3','user4','user5','user6','real-staff','admin']){
  const role=username==='admin'?'admin':'employee',isTestAccount=/^user[1-6]$/.test(username);
  const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const s=await boot({role,username,page:role==='admin'?'adminHome':'sales',data:{month:date.slice(0,7),isTestAccount,records:[{id:'test:2:1',employeeId:2,date,employee:'가상 직원',team:'insurance',customer:'TEST_VISIBLE_CUSTOMER',carrier:'GA',kind:'general',status:'normal',isTest:true,revision:1}]}});
  try{const markup=s.api.render(role==='admin'?'adminHome':'sales');if(isTestAccount){assert.match(markup,/TEST_VISIBLE_CUSTOMER/);assert.match(markup,/data-sales-test checked/);}else assert.doesNotMatch(markup,/TEST_VISIBLE_CUSTOMER/);}finally{s.dom.window.close();}
 }
});

test('home totals exclude normal conversions from pending groups and use first receipt dates for normal bars and A/S',()=>{
 const records=[{id:'old',date:'2026-09-02',firstDate:'2026-09-02',statusDate:'2026-10-02',status:'normal'},{id:'current',date:'2026-10-01',firstDate:'2026-10-01',statusDate:'2026-10-02',status:'normal'},{id:'pending',date:'2026-10-03',status:'pending'},{id:'old-pending',date:'2026-09-15',status:'pending'},{id:'as',date:'2026-10-01',statusDate:'2026-10-03',status:'as'}];
 const data={records,homeRecords:records,pendingRecords:records};const result=sales.homeMonthlyGroups(data,'2026-10');
 assert.deepEqual(result.normal.map(row=>row.id),['old','current']);assert.deepEqual(result.currentPending.map(row=>row.id),['pending']);assert.deepEqual(result.previousPending.map(row=>row.id),['old-pending']);assert.deepEqual(result.as.map(row=>row.id),['as']);
 assert.deepEqual(result.firstRecords.filter(row=>row.status==='normal').map(row=>row.id),['current']);
 records[2].status='normal';records[2].statusDate='2026-10-03';assert.equal(sales.homeMonthlyGroups(data,'2026-10').currentPending.length,0);
});

test('home refreshes once per minute and monthly cards toggle their corresponding record table',async()=>{
 const s=await boot({page:'home'});
 try{
  const now=s.w.Date.now();let clock=now;s.w.Date.now=()=>clock;
  const poll=s.intervals.find(item=>item.ms===5000);assert.ok(poll);const initial=s.reads;
  clock=now+59000;poll.fn();await tick();assert.equal(s.reads,initial);
  const row={id:'pending',employeeId:2,team:'insurance',date:s.date,status:'pending',customer:'미처리 고객',isTest:false};
  s.setData({month:s.date.slice(0,7),records:[row],homeRecords:[],pendingRecords:[row]});
  clock=now+61000;poll.fn();await tick();assert.equal(s.reads,initial+1);
  const button=()=>s.root.querySelector('[data-sales-home-month-status="current"]');assert.match(button().textContent,/1건/);
  button().click();assert.equal(button().getAttribute('aria-expanded'),'true');assert.match(s.root.querySelector('#sales-home-month-records').textContent,/미처리 고객/);
  button().click();assert.equal(button().getAttribute('aria-expanded'),'false');assert.equal(s.root.querySelector('#sales-home-month-records').textContent,'');
 }finally{s.dom.window.close();}
});
