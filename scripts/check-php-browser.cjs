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
  const salesRecords=['insurance','cosmetics'].flatMap((team,i)=>['pending','normal','as'].map((status,j)=>({id:String(i*3+j+1),date:'2026-09-26',employeeId:i+2,employee:team+' 직원',team,customer:'검증 고객 '+(i*3+j+1),carrier:'GA',kind:'general',status,revision:1,isTest:false})));
  await context.route('**/sales-api.php?*',async route=>{
   assert.equal(route.request().headers()['x-cnc-role'],new URL(route.request().frame().url()).searchParams.get('role'));
   if(route.request().method()==='POST'){const body=route.request().postDataJSON(),row=salesRecords.find(r=>r.id===body.id);assert(row);assert.equal(body.revision,row.revision);row.status=body.status;row.revision++;}
   const month=new URL(route.request().url()).searchParams.get('month');
   await route.fulfill({contentType:'application/json',body:JSON.stringify({records:salesRecords.filter(r=>r.date.startsWith(month)),staff:[{id:2,name:'보험 직원',team:'insurance'},{id:3,name:'화장품 직원',team:'cosmetics'}],month,today:'2026-09-26'})});
  });
  const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});page.on('console',m=>{if(m.type()==='error')console.error('Console:',m.text().slice(0,250));});
  await page.clock.setFixedTime(new Date('2026-09-26T08:00:00Z'));
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
    await page.evaluate(()=>location.hash='adminHome');await page.locator('[data-sales-calendar="insurance"]').waitFor();
    for(const team of ['insurance','cosmetics'])for(const key of ['pending','normal','as'])assert.match(await page.locator('[data-sales-team="'+team+'"][data-sales-day="2026-09-26"] [data-sales-count="'+key+'"]').innerText(),/1건/);
    await page.locator('[data-sales-team="cosmetics"][data-sales-day="2026-09-26"]').click();
    await page.locator('[data-sales-status="4"]').selectOption('as');
    await page.waitForFunction(()=>document.querySelector('[data-sales-team="cosmetics"][data-sales-day="2026-09-26"] [data-sales-count="as"]')?.textContent.includes('2건'));
    salesRecords[0].status='normal';salesRecords[0].revision++;
    await page.waitForFunction(()=>document.querySelector('[data-sales-team="insurance"][data-sales-day="2026-09-26"] [data-sales-count="normal"]')?.textContent.includes('2건'),null,{timeout:9000});
    await page.screenshot({path:path.join(root,'.build/live-calendars.png')});
    assert.doesNotMatch(await page.locator('#live-page-status').innerText(),/미리보기|반영되지 않습니다/);
    await page.evaluate(()=>location.hash='adminPerformance');await page.locator('[data-sales-week-start]').waitFor();await page.locator('[data-sales-week-start]').selectOption('0');assert.equal(await page.evaluate(()=>localStorage.getItem('tm-performance-week-start')),'0');
    await page.evaluate(()=>location.hash='adminIntake');await page.locator('#tm-policy-paste').waitFor();
    await page.locator('#tm-policy-paste').fill('GA\n일반 61세 이하\n수도권 4\n광주주전남 1\n실버 62~70세\n부산광역시 2');
    await page.waitForTimeout(1200);assert.equal(await page.locator('#tm-policy-preview .policy-sheet').count(),0,'pasting must wait for conversion button');
    await page.locator('[data-action="policy-parse"]').click();assert.equal(await page.locator('#tm-policy-publication-kind').inputValue(),'auto');
    await page.locator('#tm-policy-publication-client').selectOption('legacy');await page.locator('[data-action="policy-register"]').click();
    const published=await page.evaluate(()=>JSON.parse(localStorage.getItem('cnchome.regionPolicies.v1')).policies);
    assert(published['ga:general']);assert(published['ga:silver']);assert.equal(published['ga:general'].rows[1][1],'4');assert.equal(published['ga:silver'].rows[1][1],'2');
    await page.locator('[data-action="policy-clear"]').click();
    await page.locator('#tm-policy-image').setInputFiles({name:'policy.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8dQAAAAASUVORK5CYII=','base64')});
    await page.waitForTimeout(1200);assert.equal(await page.locator('#tm-policy-preview img').count(),1);assert.equal(await page.locator('[data-action="policy-parse"]').isEnabled(),true);assert.match(await page.locator('#tm-policy-timer').innerText(),/이미지 준비 완료/);
    await page.evaluate(()=>localStorage.removeItem('cnchome.regionPolicies.v1'));
    await page.evaluate(()=>location.hash='adminStaff');await page.waitForFunction(()=>new URL(location.href).searchParams.get('page')==='adminStaff');
    await page.screenshot({path:path.join(root,'.build/admin-php.png')});
    await page.reload();assert.equal(await page.locator('aside [data-aw-section]').count(),6);
   }else{
    await page.evaluate(()=>location.hash='adminGrade');await page.waitForFunction(()=>new URL(location.href).searchParams.get('page')==='home');assert.equal(await page.locator('#tm-grade-form').count(),0);
    await page.clock.setFixedTime(new Date('2026-09-26T08:00:00Z'));
    await page.goto(base+'/office.php?role=employee&page=regions');await page.locator('#tm-region-map svg').first().waitFor();
    assert.match(await page.locator('#tm-region-policy-date').innerText(),/예시.*2026\.09\.26 정책표.*오늘 등록/s);
    assert.equal(await page.locator('#tm-region-conditions tbody tr').count(),3);
    assert.deepEqual(await page.locator('.policy-example-columns th').allInnerTexts(),['GA','한화','신한']);assert.equal(await page.locator('.policy-region-list').count(),3);
    await page.locator('#tm-region-conditions').screenshot({path:path.join(root,'.build/policy-example-horizontal.png')});
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
    await page.locator('#tm-customer-age').fill('61');assert.equal(await page.locator('#tm-age').evaluate(el=>el.selectedIndex),0);
    await page.locator('#tm-customer-age').fill('62');assert.equal(await page.locator('#tm-age').evaluate(el=>el.selectedIndex),1);
    await page.locator('#tm-customer-age').fill('70');assert.equal(await page.locator('#tm-region-map').isVisible(),true);
    await page.locator('#tm-customer-age').fill('71');assert.equal(await page.locator('#tm-region-map').isVisible(),false);assert.match(await page.locator('#tm-region-results').innerText(),/가능한 보험 상품이 없습니다/);
    await page.setViewportSize({width:390,height:844});await page.reload();assert.equal(await page.locator('aside [data-page]').count(),8);await page.screenshot({path:path.join(root,'.build/employee-mobile.png')});
   }
  }
  assert.deepEqual(errors,[]);await context.close();
  console.log('PASS: PHP first paint, 28 menus, refresh, role isolation, policy order and escaping, Korean policy dates, horizontal examples, manual text/image conversion, mixed policy publishing, age limits, live insurance/cosmetics status polling, desktop/mobile rendering; no browser errors.');
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
