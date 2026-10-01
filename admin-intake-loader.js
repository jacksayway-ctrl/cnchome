(function(global){
 'use strict';
 const expected=['korea-regions.js','korea-localities.js','intake-codes.js','region-rules.js','policy-sync.js','consultation-location.js','intake-details.js','hangul.js','korean-input.js','road-address.js','admin-intake-edit.js'];
 const loaded=new Set(),requests=new Map();let pending=null;
 function assets(){
  const config=document.getElementById('admin-intake-editor-assets');let values;
  try{values=JSON.parse(config?.textContent||'');}catch(_){throw new Error('접수 입력 양식 정보를 불러오지 못했습니다. 페이지를 새로고침해 주세요.');}
  if(!Array.isArray(values)||values.length!==expected.length)throw new Error('접수 입력 양식 정보가 일치하지 않습니다. 페이지를 새로고침해 주세요.');
  return values.map((value,index)=>{
   if(typeof value!=='string')throw new Error('접수 입력 양식 주소가 올바르지 않습니다.');
   const url=new URL(value,global.CNCPageUrl||location.href),params=[...url.searchParams];
   if(url.origin!==location.origin||!['http:','https:'].includes(url.protocol)||url.pathname!=='/'+expected[index]||url.username||url.password||url.hash||params.length>1||params.some(([key,value])=>key!=='v'||!/^[a-z0-9]{1,64}$/i.test(value)))throw new Error('접수 입력 양식 주소가 올바르지 않습니다.');
   return url.href;
  });
 }
 function load(url){
  if(loaded.has(url))return Promise.resolve();
  let request=requests.get(url);
  if(!request){
   request=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=url;script.async=false;
    script.onload=()=>{script.onload=script.onerror=null;loaded.add(url);resolve();};
    script.onerror=()=>{script.onload=script.onerror=null;script.remove();reject(new Error('접수 입력 양식을 불러오지 못했습니다. 다시 시도해 주세요.'));};
    document.head.append(script);
   });
   requests.set(url,request);
   request.then(()=>requests.delete(url),()=>requests.delete(url));
  }
  // Keep a slow request alive after the message timeout; retry must not execute it twice.
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('접수 입력 양식 연결이 늦어지고 있습니다. 다시 시도해 주세요.')),20000);
   request.then(()=>{clearTimeout(timer);resolve();},error=>{clearTimeout(timer);reject(error);});
  });
 }
 function ensure(){
  if(typeof global.AdminIntakeEdit?.hydrate==='function')return Promise.resolve(global.AdminIntakeEdit);
  if(pending)return pending;
  const task=Promise.resolve().then(async()=>{
   for(const url of assets())await load(url);
   if(typeof global.AdminIntakeEdit?.hydrate!=='function')throw new Error('접수 입력 양식을 준비하지 못했습니다. 페이지를 새로고침해 주세요.');
   return global.AdminIntakeEdit;
  });
  pending=task;task.catch(()=>{if(pending===task)pending=null;});return task;
 }
 global.AdminIntakeLoader={ensure};
})(window);
