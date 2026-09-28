const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync(__dirname+'/policy-sync.js','utf8');
const sample=(revision=0)=>({revision,version:1,clients:[{id:'legacy',label:'메타버스'}],codes:[{id:'hanwha',label:'한화',aliases:[]}],policies:{}});
function boot(role,fetcher){
 const ctx={CNCHOME_POLICY:{role,csrf:'csrf-test'},fetch:fetcher,AbortController,setTimeout,clearTimeout,setInterval(){},addEventListener(){},document:{hidden:false}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(code,ctx);return ctx.PolicySync;
}
const response=(body,status=200)=>({ok:status===200,status,json:async()=>body});
test('admin registration waits for DB acknowledgement; independent employee sees saved rows',async()=>{
 let saved=sample(),posts=0;
 const fetcher=async(url,options)=>{assert.match(url,/intake-policy-api.php\?role=/);if(options.method==='POST'){
  posts++;assert.equal(options.headers['X-CSRF-Token'],'csrf-test');const data=JSON.parse(options.body);assert.equal(data.revision,saved.revision);
  saved={...saved,revision:saved.revision+1,policies:{'hanwha:general':{client:'legacy',carrier:'hanwha',kind:'general',rows:data.groups.general,savedAt:'2026-09-28T06:00:00Z'}}};
 }return response(structuredClone(saved));};
 const admin=boot('admin',fetcher),employee=boot('employee',fetcher);await admin.load();
 await admin.save({action:'publish',client:'legacy',carrier:'hanwha',groups:{general:[['지역','수량'],['수도권','4']]}});
 let seen;employee.init({apply:data=>seen=data,notify(){}});await new Promise(r=>setImmediate(r));
 assert.equal(posts,1);assert.equal(seen.policies['hanwha:general'].rows[1][1],'4');assert.equal(employee.ready,true);
 await assert.rejects(()=>employee.save({action:'publish'}),/관리자/);assert.equal(posts,1);
});
test('failed DB saves never report success and conflict refresh preserves pending caller data',async()=>{
 let status=503,getCount=0;const sync=boot('admin',async(url,options)=>options.method==='POST'?response({error:'DB failed'},status):response(sample(getCount++)));
 await sync.load();await assert.rejects(()=>sync.save({action:'publish'}),/DB failed/);assert.equal(sync.saving,false);
 status=409;await assert.rejects(()=>sync.save({action:'publish'}),/DB failed/);assert.equal(getCount,2);
});
test('old GET arriving after successful save cannot move revision backwards',async()=>{
 let resolveRead,requests=0,sent=[];const sync=boot('admin',async(url,options)=>{
  if(options.method==='POST'){sent.push(JSON.parse(options.body).revision);return response(sample(2));}
  if(requests++===0)return response(sample(1));return new Promise(r=>resolveRead=r);
 });await sync.load();const pending=sync.load();await sync.save({action:'publish'});resolveRead(response(sample(1)));await pending;
 await sync.save({action:'publish'});assert.deepEqual(sent,[1,2]);assert.equal(sync.ready,true);assert.equal(sync.error,'');
});
test('empty or unauthenticated server never enables offline publication',async()=>{
 const sync=boot('admin',async()=>response({error:'로그인 필요'},401));assert.equal(await sync.load(),false);assert.equal(sync.ready,false);
 await assert.rejects(()=>sync.save({action:'publish'}),/먼저 불러/);
});
test('readback performs an independent server read and propagates DB failure',async()=>{
 let reads=0,failed=false;
 const sync=boot('admin',async()=>{reads++;return failed?response({error:'readback unavailable'},503):response(sample(reads));});
 await sync.load();const saved=await sync.readback();assert.equal(reads,2);assert.equal(saved.revision,2);
 failed=true;await assert.rejects(()=>sync.readback(),/readback unavailable/);
});
