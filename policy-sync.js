(function(root){
 'use strict';
 let nativeContext=null;
 const nativeData=root.document?.getElementById('native-session-data');
 if(nativeData){try{const data=JSON.parse(nativeData.textContent);if(data.user?.role==='admin')nativeContext={role:'admin',csrf:data.csrf};}catch(_){}}
 const context=root.CNCHOME_POLICY||(root.CNCHOME_LIVE?{role:root.CNCHOME_LIVE.user.role,csrf:root.CNCHOME_LIVE.csrf}:nativeContext);
 let snapshot=null;const subscribers=new Set();
 let revision=null,loading=false,saving=false,error='',apply=()=>{},notify=()=>{},active=()=>true;
 const department=()=>{const params=new URL(root.CNCPageNavigation?.url()||root.location?.href||'https://cnc.invalid/').searchParams,value=params.get('department')||params.get('team');return ['insurance','cosmetics','health'].includes(value)?value:'insurance';};
 const url=()=>'/intake-policy-api.php?role='+encodeURIComponent(context?.role||'employee')+'&department='+department();
 async function request(options){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch(url(),{credentials:'same-origin',cache:'no-store',...options,signal:controller.signal});
   let data;try{data=await response.json()}catch(e){throw new Error('정책 서버 응답을 읽지 못했습니다. 저장 여부를 확인해 주세요.')}
   if(!response.ok){const e=new Error(data.error||'정책 서버에 연결하지 못했습니다.');e.status=response.status;throw e;}
   if(!Number.isSafeInteger(data.revision)||!Array.isArray(data.clients)||!Array.isArray(data.codes)||!data.policies||typeof data.policies!=='object')throw new Error('정책 서버 자료를 확인할 수 없습니다.');
   return data;
  }finally{clearTimeout(timer)}
 }
 function announce(){notify();for(const fn of subscribers)fn();}
 function accept(data){if(context?.role==='admin'&&data.department!==department())return;if(revision!==null&&data.revision<revision)return;const changed=revision!==data.revision||snapshot?.date!==data.date||snapshot?.department!==data.department,hadError=!!error;error='';if(changed){apply(data);snapshot=data;revision=data.revision;}if(changed||hadError)announce();}
 async function load(){
  if(!context||loading||saving)return false;loading=true;const requestedDepartment=department();
  try{accept(await request());return true}catch(e){error=e.name==='AbortError'?'정책 조회 시간이 초과됐습니다. 다시 시도해 주세요.':e.message;announce();return false}finally{loading=false;if(requestedDepartment!==department())load();}
 }
 async function save(payload){
  if(!context||context.role!=='admin')throw new Error('관리자만 정책을 저장할 수 있습니다.');
  if(saving)throw new Error('정책을 저장 중입니다. 잠시 기다려 주세요.');
  if(revision===null||(context.role==='admin'&&snapshot?.department!==department()))throw new Error('서버 정책을 먼저 불러와 주세요. 새로고침 후 다시 시도해 주세요.');
  saving=true;const requestedDepartment=department();
  try{announce();const data=await request({method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':context.csrf,'X-CNC-Role':context.role},body:JSON.stringify({...payload,revision})});accept(data);return data;}
  catch(e){if(e.status===409){saving=false;await load();}throw new Error(e.name==='AbortError'?'저장 응답이 지연됐습니다. 새로고침하여 저장 여부를 확인해 주세요.':e.message)}
  finally{saving=false;announce();if(requestedDepartment!==department())load();}
 }
 root.PolicySync={enabled:!!context,role:context?.role,get snapshot(){return snapshot},subscribe(fn){subscribers.add(fn);return ()=>subscribers.delete(fn)},get ready(){return revision!==null&&(context?.role!=='admin'||snapshot?.department===department())},get saving(){return saving},get error(){return error},load,save,async readback(){const data=await request();accept(data);return data;},
  init(options){if(!context)return;apply=options.apply;notify=options.notify;active=options.active||active;load();setInterval(()=>{if(!document.hidden&&(active()||subscribers.size))load()},15000);root.addEventListener('focus',()=>{if(active()||subscribers.size)load()});}
 };
 if(nativeContext)root.PolicySync.init({apply:()=>{},notify:()=>{},active:()=>!!root.document.querySelector('.receipt-form')});
})(typeof window!=='undefined'?window:globalThis);
