const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function boot(file,role){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(fs.readFileSync(path.join(root,'.build',file),'utf8'),{url:'https://test.invalid/personnel.php?role='+role,runScripts:'outside-only',virtualConsole:vc,pretendToBeVisual:true});
 const w=dom.window;require('./dom-fixture.cjs')(w);
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const script of w.document.querySelectorAll('script:not([type="application/json"])')){
  if(script.src&&/admin-save-confirm|membership-notification|session-keepalive|notice-ticker|public-holidays/.test(script.src))continue;
  w.eval(script.src?fs.readFileSync(path.join(root,new URL(script.src).pathname),'utf8'):script.textContent);
 }
 return {dom,w,d:w.document,errors};
}
for(const file of ['personnel-new.html','personnel-edit.html']){
 const a=boot(file,'admin');
 try{
  const form=a.d.querySelector('.personnel-form');assert.ok(form);
  for(const name of ['name','phone','payAmount','startDate','contractStart','contractEnd','address','addressDetail','accountNumber','jobRank'])assert.ok(form.elements['profile['+name+']'],name);
  const rank=form.elements['profile[jobRank]'];assert.equal(rank.maxLength,60);rank.value='선임';assert.equal(new a.w.FormData(form).get('profile[jobRank]'),'선임');
  assert.ok(form.elements.csrf.value);assert.ok(form.elements.id);assert.equal(form.method,'post');
  assert.match(form.elements['profile[payAmount]'].value,/^\d+$/);assert.match(form.elements['profile[startDate]'].value,/^\d{4}-\d{2}-\d{2}$/);
  assert.ok(a.d.querySelector('a[href*="personnel.php"]'));assert.deepEqual(a.errors,[]);
 }finally{a.dom.window.close();}
}
const employee=boot('personnel-employee.html','employee');
try{
 assert.equal(employee.d.querySelector('.personnel-form'),null);assert.ok(employee.d.querySelector('.personnel-card'));assert.match(employee.d.querySelector('.personnel-card').textContent,/직급/);
 // The shared statement row must support both pointer and keyboard expansion.
 const table=employee.d.createElement('table');table.innerHTML='<tbody><tr data-pay-toggle="statement" tabindex="0" aria-expanded="false"><td>명세서</td></tr><tr id="statement" hidden><td>지급 내역</td></tr></tbody>';
 employee.d.body.append(table);const row=table.querySelector('[data-pay-toggle]'),detail=table.querySelector('#statement');
 row.click();assert.equal(detail.hidden,false);assert.equal(row.getAttribute('aria-expanded'),'true');
 row.dispatchEvent(new employee.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert.equal(detail.hidden,true);assert.equal(row.getAttribute('aria-expanded'),'false');
 assert.deepEqual(employee.errors,[]);
}finally{employee.dom.window.close();}
console.log('PASS: native personnel forms, job rank, employee read-only card and accessible statement expansion.');
