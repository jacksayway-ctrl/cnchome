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

test('employee and admin intake forms submit and display consultation fields',async()=>{
 const fs=require('node:fs'),vm=require('node:vm');
 for(const role of ['employee','admin']){
  const page=role==='admin'?'adminHome':'sales',events=new Map(),posts=[];let formHtml='',closed=0,records=[];
  const context={URL,console,crypto:{randomUUID:()=> 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'},document:{hidden:false},location:{href:'https://example.test/office.php?page='+page},CNCHOME_LIVE:{csrf:'test-csrf',user:{id:2,role,username:'employee',department:'insurance'}},localStorage:{getItem:()=>null,setItem(){}},addEventListener(){},setInterval(){},FormData:class{constructor(form){return Object.entries(form.values);}}};
  context.window=context;
  context.fetch=async(url,options)=>{
   if(options.method==='POST'){const body=JSON.parse(options.body);posts.push(body);records=[{...body,id:'1',employee:'직원',team:'insurance',kind:'general',status:'pending',isTest:false,revision:1}];}
   return {ok:true,json:async()=>({month:new URL(url,'https://example.test').searchParams.get('month'),records,staff:[{id:2,name:'직원',team:'insurance'}]})};
  };
  vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('./sales-workspace.js'),'utf8'),context);
  const api=context.SalesWorkspace;
  api.init({root:{addEventListener(type,fn){if(!events.has(type))events.set(type,[]);events.get(type).push(fn);},querySelector:()=>null,querySelectorAll:()=>[]},open(title,html){formHtml=html;},close(){closed++;},toast(){},render(){}});
  await new Promise(setImmediate);assert.equal(api.intake(),true);
  assert.doesNotMatch(formHtml,/name="address"/);assert.match(formHtml,/name="birthMonth"/);assert.match(formHtml,/name="birthDay"/);assert.match(formHtml,/data-age-number/);assert.match(formHtml,/data-intake-decision/);assert.match(formHtml,/role="combobox"/);assert.match(formHtml,/name="consultationTime" type="time"/);assert.match(formHtml,/name="consultationPlace" maxlength="500"/);
  for(const [value,label] of [['100000','10만 원 이상'],['200000','20만 원 이상'],['300000','30만 원 이상']])assert.ok(formHtml.includes('<option value="'+value+'">'+label+'</option>'));
  const date=formHtml.match(/name="date"[^>]*value="([^"]+)"/)[1];
  const form={dataset:{requestKey:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'},reportValidity:()=>true,values:{employeeId:'2',date,customer:'검증 고객',phone:'010-0000-0000',carrier:'GA',birthYear:'1990',birthMonth:'03',birthDay:'23',consultationTime:'14:30',consultationPlace:'직장 <상담실>',premiumBand:'200000',note:'메모'}};
  for(const handler of events.get('submit'))handler({target:{closest:()=>form},preventDefault(){}});
  await new Promise(setImmediate);
  assert.equal(posts.length,1);assert.equal(Object.hasOwn(posts[0],'address'),false);assert.equal(posts[0].birthMonth,'03');assert.equal(posts[0].birthDay,'23');assert.equal(posts[0].consultationTime,'14:30');assert.equal(posts[0].consultationPlace,'직장 <상담실>');assert.equal(posts[0].premiumBand,'200000');assert.equal(closed,1);
  const html=api.render(page);assert.match(html,/14:30/);assert.match(html,/직장 &lt;상담실&gt;/);assert.match(html,/20만 원 이상/);assert.doesNotMatch(html,/<상담실>/);
 }
});
