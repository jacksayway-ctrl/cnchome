'use strict';
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=require('http').createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;if(!/^\/[a-z][a-z0-9.-]*\.(css|js|svg)$/.test(pathname)){res.writeHead(404);res.end();return;}const file=path.join(root,pathname);if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',pathname.endsWith('.js')?'text/javascript':pathname.endsWith('.css')?'text/css':'image/svg+xml');res.end(fs.readFileSync(file));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;let browser;
 try{browser=await chromium.launch({headless:true,...(process.env.CNC_CHROMIUM_EXECUTABLE?{executablePath:process.env.CNC_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
  const errors=[];
  const context=await browser.newContext({viewport:{width:1440,height:1050}});
  await context.route('**/office.php?*',async route=>{
   const u=new URL(route.request().url()),role=u.searchParams.get('role'),page=u.searchParams.get('page');
   const file=path.join(root,'.build',role+'-'+page+'.html');
   await route.fulfill({contentType:'text/html',body:fs.readFileSync(file,'utf8')});
  });
  await context.route(/\/(hr|session|test)-api\.php/,route=>route.fulfill({contentType:'application/json',body:JSON.stringify({authenticated:true,name:'테스트',csrf:'TEST',employees:[],payroll:[],accounts:[]})}));
  const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});page.on('console',m=>{if(m.type()==='error')console.error('Console:',m.text().slice(0,250));});
  // First paint with JavaScript disabled: no legacy full-menu flash is possible.
  const first=await browser.newContext({javaScriptEnabled:false,viewport:{width:1440,height:900}});
  await first.route('**/office.php?*',route=>route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'.build/admin-adminStaff.html'),'utf8')}));
  const plain=await first.newPage();await plain.goto(base+'/office.php?role=admin&page=adminStaff');
  assert.equal(await plain.locator('aside [data-aw-section]:visible').count(),6);
  assert.equal(await plain.locator('aside [data-page]').count(),0);
  assert.equal(await plain.locator('#aw-subpages [data-page]').count(),5);
  await plain.screenshot({path:path.join(root,'.build/admin-first-paint.png')});await first.close();
  for(const role of ['admin','employee']){
   await page.goto(base+'/office.php?role='+role+'&page='+(role==='admin'?'adminStaff':'home'));
   await page.locator('#tm-main .page-loading').waitFor({state:'detached'});
   assert.equal(await page.locator('#aw-subpages').count(),role==='admin'?1:0);
   assert.equal(await page.locator('aside [data-aw-section]').count(),role==='admin'?6:0);
   const routes=await page.evaluate(role=>role==='admin'?AdminWorkspace.navigation.flatMap(g=>g.items.map(x=>x[0])):['home','regions','sales','grade','attendance','as','payslips','myInfo'],role);
   for(const target of routes){
    await page.evaluate(route=>{location.hash=route;},target);
    await page.waitForFunction(route=>new URL(location.href).searchParams.get('page')===route,target);
    assert.ok((await page.locator('#tm-main').innerText()).trim(),target);
    assert.ok(await page.locator('[data-page="'+target+'"].active').count(),target);
   }
   if(role==='admin'){
    await page.evaluate(()=>location.hash='adminStaff');await page.waitForFunction(()=>new URL(location.href).searchParams.get('page')==='adminStaff');
    await page.screenshot({path:path.join(root,'.build/admin-php.png')});
    await page.reload();assert.equal(await page.locator('aside [data-aw-section]').count(),6);
   }else{
    await page.evaluate(()=>location.hash='adminGrade');await page.waitForFunction(()=>new URL(location.href).searchParams.get('page')==='home');assert.equal(await page.locator('#tm-grade-form').count(),0);
    await page.clock.setFixedTime(new Date('2026-09-26T08:00:00Z'));
    await page.goto(base+'/office.php?role=employee&page=regions');await page.locator('#tm-region-map svg').first().waitFor();
    assert.match(await page.locator('#tm-region-policy-date').innerText(),/예시.*2026\.09\.26 정책표.*오늘 등록/s);
    assert.equal(await page.locator('#tm-region-conditions tbody tr').count(),3);
    assert.equal(await page.locator('#tm-region-conditions .policy-date-badge.today').count(),1);
    assert.equal(await page.locator('#tm-region-conditions .policy-date-badge.past').count(),2);
    assert.match(await page.locator('#tm-region-conditions').innerText(),/실제 접수 기준이 아닙니다/);
    assert.equal(await page.evaluate(()=>localStorage.getItem('cnchome.regionPolicies.v1')),null,'examples must not be published');
    await page.evaluate(()=>localStorage.setItem('cnchome.regionPolicies.v1',JSON.stringify({version:1,policies:{'shinhan:general':{savedAt:'2026-09-23T15:00:00Z',rows:[['지역','수량','조건'],['서울','2','신한 조건']]},'hanwha:general':{savedAt:'2026-09-24T15:00:00Z',rows:[['지역','수량','연령'],['부산','3','40~60']]},'ga:general':{savedAt:'2026-09-25T15:00:00Z',rows:[['지역','수량','제외'],['경기','4','<img src=x onerror=alert(1)>']]}}})));
    await page.goto(base+'/office.php?role=employee&page=regions');await page.locator('#tm-region-map svg').first().waitFor();
    const text=await page.locator('#tm-region-conditions').innerText();
    assert(text.indexOf('GA')<text.indexOf('한화'));assert(text.indexOf('한화')<text.indexOf('신한'));assert.match(text,/40~60/);assert.match(text,/신한 조건/);
    assert.equal(await page.locator('#tm-region-conditions img').count(),0);
    const dateLabels=await page.locator('.policy-table-heading .policy-date-badge').allInnerTexts();
    assert.match(dateLabels[0],/2026\.09\.26 정책표.*오늘 등록/s);assert.match(dateLabels[1],/2026\.09\.25 정책표.*1일 전 등록/s);assert.match(dateLabels[2],/2026\.09\.24 정책표.*2일 전 등록/s);
    assert.match(await page.locator('#tm-region-policy-date').innerText(),/오늘 등록.*이전 날짜 정책 2건/s);
    assert(await page.evaluate(()=>document.querySelector('#tm-region-policy-date').getBoundingClientRect().left>=document.querySelector('.region-page-heading h2').getBoundingClientRect().right),'date belongs to the right of the heading on desktop');
    assert(await page.evaluate(()=>document.querySelector('#tm-region-conditions').getBoundingClientRect().bottom<=document.querySelector('#tm-region-map').getBoundingClientRect().top));
    await page.screenshot({path:path.join(root,'.build/employee-policies.png')});
    await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('cnchome.regionPolicies.v1'));delete data.policies['ga:general'].savedAt;localStorage.setItem('cnchome.regionPolicies.v1',JSON.stringify(data));});
    await page.reload();
    assert.match(await page.locator('#tm-region-policy-date').innerText(),/2026\.09\.25 정책표.*1일 전 등록.*등록일 확인 필요 1건/s);
    assert.match(await page.locator('.policy-table-heading .policy-date-badge').first().innerText(),/등록일 확인 필요/);
    assert.equal(await page.locator('#tm-region-policy-date .today').count(),0);
    await page.setViewportSize({width:390,height:844});await page.reload();assert.equal(await page.locator('aside [data-page]').count(),8);await page.screenshot({path:path.join(root,'.build/employee-mobile.png')});
   }
  }
  assert.deepEqual(errors,[]);await context.close();
  console.log('PASS: PHP first paint, 28 menus, refresh, role isolation, policy order and escaping, Korean policy dates and unsaved examples, desktop/mobile rendering; no browser errors.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
