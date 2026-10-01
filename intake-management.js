(function(){
 'use strict';
 const pending=new WeakMap();
 function parts(row){
  const toggle=row.querySelector('[data-intake-toggle]');
  const detail=toggle?document.getElementById(toggle.getAttribute('aria-controls')):null;
  return {toggle,detail,content:detail?.querySelector('[data-intake-content]')};
 }
 async function load(row){
  const {detail,content}=parts(row);
  if(!detail||!content||detail.dataset.intakeLoaded==='true')return;
  if(pending.has(detail))return pending.get(detail);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  const task=Promise.resolve().then(async()=>{
   content.replaceChildren();content.setAttribute('aria-busy','true');
   const status=document.createElement('p');status.setAttribute('role','status');status.textContent='접수 내용을 불러오고 있습니다.';content.append(status);
   try{
    const target=new URL(row.dataset.intakeUrl,window.CNCPageUrl||location.href);
    if(target.origin!==location.origin||target.pathname!=='/intake.php'||target.searchParams.get('detail')!=='1')throw new Error('접수 조회 주소를 확인해 주세요.');
    const response=await fetch(target.href,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
    if(response.status===401)throw new Error('로그인이 만료되었습니다. 새로고침 후 다시 로그인해 주세요.');
    if(response.status===404)throw new Error('접수를 찾을 수 없습니다. 목록을 새로고침해 주세요.');
    if(!response.ok||response.headers.get('X-CNC-Intake-Detail')!=='1')throw new Error('접수 내용을 불러오지 못했습니다. 다시 시도해 주세요.');
    const html=new DOMParser().parseFromString(await response.text(),'text/html');
    const panel=html.querySelector('[data-intake-detail-panel]');
    if(!panel||panel.dataset.intakeRecord!==row.dataset.intakeId)throw new Error('접수 정보가 일치하지 않습니다. 목록을 새로고침해 주세요.');
    content.replaceChildren(document.importNode(panel,true));detail.dataset.intakeLoaded='true';
    for(const form of content.querySelectorAll('form'))window.CNCWindowSession?.decorateForm(form);
   }catch(error){
    const message=document.createElement('p');message.setAttribute('role','alert');message.textContent=error.name==='AbortError'?'조회 응답이 늦어지고 있습니다. 다시 불러와 주세요.':error.message;
    const retry=document.createElement('button');retry.type='button';retry.textContent='다시 불러오기';retry.dataset.intakeRetry='';
    retry.addEventListener('click',()=>load(row));content.replaceChildren(message,retry);
   }finally{clearTimeout(timer);content.removeAttribute('aria-busy');pending.delete(detail);}
  });
  pending.set(detail,task);return task;
 }
 function toggleRow(row){
  const {toggle,detail}=parts(row);if(!toggle||!detail)return;
  const open=detail.hidden;detail.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
  row.classList.toggle('is-expanded',open);toggle.textContent=open?'접기':'보기·수정';
  if(open)load(row);
 }
 document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const target=event.target instanceof Element?event.target:null;
  const row=target?.closest('[data-intake-row]');if(!row)return;
  if(target.closest('a,button,input,select,textarea,label')&&!target.closest('[data-intake-toggle]'))return;
  event.preventDefault();toggleRow(row);
 });
 document.addEventListener('keydown',event=>{
  if(event.key!==' '||!(event.target instanceof Element)||!event.target.matches('[data-intake-toggle]'))return;
  const row=event.target.closest('[data-intake-row]');if(row){event.preventDefault();toggleRow(row);}
 });
})();
