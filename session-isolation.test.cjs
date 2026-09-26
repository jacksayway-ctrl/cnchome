const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/session-context.js','utf8');
for(const role of ['employee','admin']){
 const calls=[];const location={href:'https://example.test/office.php#home',origin:'https://example.test'};
 const w={CNCHOME_LIVE:{user:{role}},fetch:(...args)=>{calls.push(args);return Promise.resolve()}};
 let replaced;
 vm.runInNewContext(source,{window:w,URL,Request,Headers,location,history:{state:null,replaceState:(_s,_t,url)=>replaced=url},document:{addEventListener(){}}});
 assert.equal(replaced.searchParams.get('role'),role);
 w.fetch('/hr-api.php',{method:'POST',headers:{'X-CSRF-Token':'token'},body:'{}'});
 assert.equal(calls[0][1].headers.get('X-CNC-Role'),role);
 assert.equal(calls[0][1].headers.get('X-CSRF-Token'),'token');
 assert.equal(calls[0][1].body,'{}');
 w.fetch(new Request('https://example.test/grade-api.php',{headers:{'X-Test':'yes'}}));
 assert.equal(calls[1][1].headers.get('X-CNC-Role'),role);
 assert.equal(calls[1][1].headers.get('X-Test'),'yes');
 w.fetch('https://external.test/hr-api.php');assert.equal(calls[2][1],undefined);
 w.fetch('/sales-api.php?month=2026-09');assert.equal(calls[3][1].headers.get('X-CNC-Role'),role);
}
console.log('Employee/admin request scope, CSRF preservation, URL persistence and external isolation passed');
