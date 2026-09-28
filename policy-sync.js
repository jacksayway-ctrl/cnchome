(function(root){
 'use strict';
 const context=root.CNCHOME_POLICY||(root.CNCHOME_LIVE?{role:root.CNCHOME_LIVE.user.role,csrf:root.CNCHOME_LIVE.csrf}:null);
 let revision=null,loading=false,saving=false,error='',apply=()=>{},notify=()=>{},active=()=>true;
 const url='/intake-policy-api.php?role='+encodeURIComponent(context?.role||'employee');
 async function request(options){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,signal:controller.signal});
   let data;try{data=await response.json()}catch(e){throw new Error('정책 서버 응답을 읽지 못했습니다. 저장 여부를 확인해 주세요.')}
   if(!response.ok){const e=new Error(data.error||'정책 서버에 연결하지 못했습니다.');e.status=response.status;throw e;}
   if(!Number.isSafeInteger(data.revision)||!Array.isArray(data.clients)||!Array.isArray(data.codes)||!data.policies||typeof data.policies!=='object')throw new Error('정책 서버 자료를 확인할 수 없습니다.');
   return data;
  }finally{clearTimeout(timer)}
 }
 function accept(data){if(revision!==null&&data.revision<revision)return;const changed=revision!==data.revision,hadError=!!error;error='';if(changed){apply(data);revision=data.revision;}if(changed||hadError)notify();}
 async function load(){
  if(!context||loading||saving)return false;loading=true;
  try{accept(await request());return true}catch(e){error=e.name==='AbortError'?'정책 조회 시간이 초과됐습니다. 다시 시도해 주세요.':e.message;notify();return false}finally{loading=false;}
 }
 async function save(payload){
  if(!context||context.role!=='admin')throw new Error('관리자만 정책을 저장할 수 있습니다.');
  if(saving)throw new Error('정책을 저장 중입니다. 잠시 기다려 주세요.');
  if(revision===null)throw new Error('서버 정책을 먼저 불러와 주세요. 새로고침 후 다시 시도해 주세요.');
  saving=true;notify();
  try{const data=await request({method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':context.csrf,'X-CNC-Role':context.role},body:JSON.stringify({...payload,revision})});accept(data);return data;}
  catch(e){if(e.status===409){saving=false;await load();}throw new Error(e.name==='AbortError'?'저장 응답이 지연됐습니다. 새로고침하여 저장 여부를 확인해 주세요.':e.message)}
  finally{saving=false;notify();}
 }
 root.PolicySync={enabled:!!context,role:context?.role,get ready(){return revision!==null},get saving(){return saving},get error(){return error},load,save,
  init(options){if(!context)return;apply=options.apply;notify=options.notify;active=options.active||active;load();setInterval(()=>{if(!document.hidden&&active())load()},15000);root.addEventListener('focus',()=>{if(active())load()});}
 };
})(typeof window!=='undefined'?window:globalThis);
