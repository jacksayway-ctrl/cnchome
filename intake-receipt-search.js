(function(window){
 'use strict';
 function attach(root,options={}){
  for(const box of root.querySelectorAll('[data-intake-side-search]')){
   if(box.dataset.ready)continue;box.dataset.ready='1';
   const input=box.querySelector('[data-intake-search-input]'),status=box.querySelector('[data-intake-search-status]'),results=box.querySelector('[data-intake-search-results]'),popover=box.querySelector('[data-intake-search-popover]');
   const panel=options.panel||box.closest('[data-intake-detail-panel]');let dirty=false;
   for(const eventName of ['input','change'])panel.addEventListener(eventName,event=>{if(event.target.closest(options.formSelector||'form[data-intake-edit-form]')&&!event.target.closest('[data-intake-side-search]')&&!event.target.matches('[data-receipt-input-mode]'))dirty=true;});
   panel.addEventListener('intake:editor-reset',()=>{dirty=false;});
   function confirmNavigation(event){if(dirty&&!confirm('수정 중인 내용을 저장하지 않고 다른 접수 화면을 여시겠습니까?')){event.preventDefault();event.stopImmediatePropagation();}}
   panel.querySelector('.intake-detail-heading')?.addEventListener('click',event=>{if(event.target.closest('a'))confirmNavigation(event);},true);
   const resultsId='intake-search-results-'+(panel.dataset.intakeRecord||'new').replace(/[^a-zA-Z0-9_-]/g,'-');results.id=resultsId;input.setAttribute('aria-controls',resultsId);
   function showResults(show){popover.hidden=!show;input.setAttribute('aria-expanded',String(show));}
   let timer=0,request=null,version=0,composing=false;
   function cancel(){clearTimeout(timer);request?.abort();request=null;version++;}
   async function search(sequence,query){
    if(!box.isConnected||composing||sequence!==version)return;
    request=new AbortController();const controller=request,timeout=setTimeout(()=>controller.abort(),15000);status.textContent='검색 중…';
    try{
     const params=new URLSearchParams({role:'admin',q:query,scope:options.scope?.()||box.dataset.scope||'real'});
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
      name.textContent=record.customer;phone.textContent=record.phone||'연락처 미입력';meta.textContent=[record.isTest?'테스트':'','상담원 '+(record.employee||'미입력'),record.date,({pending:'가접수',normal:'정상접수',as:'A/S'})[record.status]||''].filter(Boolean).join(' · ');
      link.append(name,phone,meta);link.addEventListener('click',confirmNavigation,true);fragment.append(link);
     }
     if(data.records.length&&fragment.childNodes.length!==data.records.length)throw new Error('검색 응답을 확인하지 못했습니다.');
     results.replaceChildren(fragment);status.textContent=data.records.length?(data.hasMore?'검색 결과 20건 · 검색어를 더 입력하면 좁힐 수 있습니다.':'검색 결과 '+data.records.length+'건'):(options.onEmpty?'일치하는 접수가 없습니다. 신규 가접수로 입력해 주세요.':'일치하는 접수가 없습니다.');
     if(!data.records.length)options.onEmpty?.(query,results,()=>showResults(false));
    }catch(error){if(sequence===version&&box.isConnected){results.replaceChildren();status.textContent=error.name==='AbortError'?'검색 응답이 지연되었습니다. 다시 입력해 주세요.':error.message;}}
    finally{clearTimeout(timeout);if(request===controller)request=null;}
   }
   function schedule(){cancel();options.onQuery?.();results.replaceChildren();const query=input.value.trim();if(composing)return;showResults(!!query);if(!query){status.textContent='이름 또는 전화번호를 입력해 주세요.';return;}status.textContent='검색 중…';const sequence=version;timer=setTimeout(()=>search(sequence,query),180);}
   function searchNow(){if(composing)return;cancel();options.onQuery?.();results.replaceChildren();showResults(true);const query=input.value.trim();if(query)search(version,query);else{status.textContent='이름 또는 전화번호를 입력해 주세요.';input.focus();}}
   input.addEventListener('compositionstart',()=>{composing=true;cancel();results.replaceChildren();showResults(false);status.textContent='입력 중…';});input.addEventListener('compositionend',()=>{composing=false;schedule();});
   input.addEventListener('input',event=>{if(!event.isComposing)schedule();});
   input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!composing&&!event.isComposing){event.preventDefault();searchNow();}else if(event.key==='Escape'){event.preventDefault();showResults(false);}});
   input.addEventListener('focus',()=>{if(input.value.trim())schedule();});
   box.querySelector('[data-intake-search-submit]').addEventListener('click',searchNow);
   box.querySelector('[data-intake-search-reset],[data-intake-new-url]')?.addEventListener('click',event=>{
    if(dirty&&!confirm('수정 중인 내용을 저장하지 않고 새 접수를 입력하시겠습니까?'))return;
    if(options.onNew){cancel();options.onNew();return;}
    const target=new URL(event.currentTarget.dataset.intakeNewUrl,location.origin);
    if(target.origin!==location.origin||target.pathname!=='/intake.php'||target.searchParams.get('new')!=='1'||target.searchParams.has('id'))return;
    cancel();location.assign(window.CNCWindowSession?.url(target.href)||target.href);
   });
   if(options.onNew)panel.addEventListener('reset',()=>{cancel();input.value='';results.replaceChildren();showResults(false);status.textContent='이름 또는 전화번호를 입력해 주세요.';options.onQuery?.();dirty=false;});
   box.addEventListener('intake:search-cancel',()=>{cancel();showResults(false);});
   box.addEventListener('intake:search-refresh',schedule);
   box.addEventListener('focusout',event=>{if(!box.contains(event.relatedTarget))showResults(false);});
   window.addEventListener('pagehide',cancel,{once:true});
  }
 }
 window.IntakeReceiptSearch={attach};
})(window);
