(function(){
 'use strict';
 const pending=new WeakMap();
 function message(content,text,retry){
  content.querySelector('[data-intake-load-message]')?.remove();
  const box=document.createElement('div');box.dataset.intakeLoadMessage='';
  const status=document.createElement('p');status.setAttribute('role',retry?'alert':'status');status.textContent=text;box.append(status);
  if(retry){const button=document.createElement('button');button.type='button';button.textContent='다시 불러오기';button.dataset.intakeRetry='';button.addEventListener('click',retry);box.append(button);}
  content.prepend(box);
 }
 async function hydrate(content){
  if(content.querySelector('[data-intake-edit-host]')){
   const editor=window.AdminIntakeEdit||await window.AdminIntakeLoader?.ensure();
   if(typeof editor?.hydrate!=='function')throw new Error('접수 입력 양식을 불러오지 못했습니다. 페이지를 새로고침해 주세요.');
   editor.hydrate(content);
  }
  attachSearch(content);
  for(const form of content.querySelectorAll('form'))window.CNCWindowSession?.decorateForm(form);
 }
 function attachSearch(root){
  for(const box of root.querySelectorAll('[data-intake-side-search]')){
   if(box.dataset.ready)return;box.dataset.ready='1';
   const input=box.querySelector('[data-intake-search-input]'),status=box.querySelector('[data-intake-search-status]'),results=box.querySelector('[data-intake-search-results]');
   const panel=box.closest('[data-intake-detail-panel]');let dirty=false;
   for(const eventName of ['input','change'])panel.addEventListener(eventName,event=>{if(event.target.closest('form[data-intake-edit-form]'))dirty=true;});
   let timer=0,request=null,version=0,composing=false;
   function cancel(){clearTimeout(timer);request?.abort();request=null;version++;}
   async function search(sequence,query){
    if(!box.isConnected||composing||sequence!==version)return;
    request=new AbortController();const controller=request,timeout=setTimeout(()=>controller.abort(),15000);status.textContent='검색 중…';
    try{
     const params=new URLSearchParams({role:'admin',q:query,scope:box.dataset.scope||'real'});
     const response=await fetch('/intake-search.php?'+params.toString(),{credentials:'same-origin',cache:'no-store',signal:controller.signal});
     const data=await response.json();if(!response.ok)throw new Error(data.error||'검색하지 못했습니다.');
     if(sequence!==version||!box.isConnected||composing)return;
     if(!Array.isArray(data.records))throw new Error('검색 응답을 확인하지 못했습니다.');
     const fragment=document.createDocumentFragment();
     for(const record of data.records){
      if(!/^(?:\d+|test:\d+:\d+)$/.test(record.id)||!/^\d{4}-\d{2}-\d{2}$/.test(record.date))continue;
      const link=document.createElement('a'),name=document.createElement('strong'),phone=document.createElement('span'),meta=document.createElement('small');
      const target=new URL('/intake.php',location.origin);target.search=new URLSearchParams({role:'admin',month:record.date.slice(0,7),scope:record.isTest?'test':'real',id:record.id,popup:'1'}).toString();
      link.href=window.CNCWindowSession?.url(target.href)||target.href;
      name.textContent=record.customer;phone.textContent=record.phone||'연락처 미입력';meta.textContent=[record.isTest?'테스트':'',record.employee,record.date,({pending:'가접수',normal:'정상접수',as:'A/S'})[record.status]||''].filter(Boolean).join(' · ');
      link.append(name,phone,meta);link.addEventListener('click',event=>{if(dirty&&!confirm('수정 중인 내용을 저장하지 않고 다른 접수증을 여시겠습니까?')){event.preventDefault();event.stopImmediatePropagation();}},true);fragment.append(link);
     }
     results.replaceChildren(fragment);status.textContent=data.records.length?(data.hasMore?'검색 결과 20건 · 검색어를 더 입력하면 좁힐 수 있습니다.':'검색 결과 '+data.records.length+'건'):'일치하는 접수가 없습니다.';
    }catch(error){if(sequence===version&&box.isConnected){results.replaceChildren();status.textContent=error.name==='AbortError'?'검색 응답이 지연되었습니다. 다시 입력해 주세요.':error.message;}}
    finally{clearTimeout(timeout);if(request===controller)request=null;}
   }
   function schedule(){cancel();results.replaceChildren();const query=input.value.trim();if(composing)return;if(!query){status.textContent='이름 또는 전화번호를 입력해 주세요.';return;}status.textContent='검색 중…';const sequence=version;timer=setTimeout(()=>search(sequence,query),180);}
   input.addEventListener('compositionstart',()=>{composing=true;cancel();results.replaceChildren();status.textContent='입력 중…';});input.addEventListener('compositionend',()=>{composing=false;schedule();});
   input.addEventListener('input',event=>{if(!event.isComposing)schedule();});
   input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!composing&&!event.isComposing){event.preventDefault();cancel();if(input.value.trim())search(version,input.value.trim());}});
   window.addEventListener('pagehide',cancel,{once:true});
  }
 }
 function parts(row){
  const toggle=row.querySelector('[data-intake-toggle]');
  const detail=toggle?document.getElementById(toggle.getAttribute('aria-controls')):null;
  return {toggle,detail,content:detail?.querySelector('[data-intake-content]')};
 }
 async function load(row){
  const {detail,content}=parts(row);
  if(!detail||!content||detail.dataset.intakeReady==='true')return;
  if(pending.has(detail))return pending.get(detail);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  const task=Promise.resolve().then(async()=>{
   if(detail.dataset.intakeLoaded!=='true')content.replaceChildren();content.setAttribute('aria-busy','true');
   message(content,'접수 내용을 불러오고 있습니다.');
   try{
    if(detail.dataset.intakeLoaded!=='true'){
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
    }
    clearTimeout(timer);await hydrate(content);detail.dataset.intakeReady='true';content.querySelector('[data-intake-load-message]')?.remove();
   }catch(error){
    message(content,error.name==='AbortError'?'조회 응답이 늦어지고 있습니다. 다시 불러와 주세요.':error.message,()=>load(row));
   }finally{clearTimeout(timer);content.removeAttribute('aria-busy');pending.delete(detail);}
  });
  pending.set(detail,task);return task;
 }
 function loadStandalone(panel){
  if(pending.has(panel))return pending.get(panel);
  const task=Promise.resolve().then(async()=>{
   panel.setAttribute('aria-busy','true');message(panel,'접수 입력 양식을 불러오고 있습니다.');
   try{await hydrate(panel);panel.querySelector('[data-intake-load-message]')?.remove();}
   catch(error){message(panel,error.message,()=>loadStandalone(panel));}
   finally{panel.removeAttribute('aria-busy');pending.delete(panel);}
  });
  pending.set(panel,task);return task;
 }
 function start(){
  for(const row of document.querySelectorAll('[data-intake-row]')){const {detail}=parts(row);if(detail&&!detail.hidden)load(row);}
  for(const panel of document.querySelectorAll('[data-intake-detail-panel]'))if(!panel.closest('[data-intake-detail]'))loadStandalone(panel);
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
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
