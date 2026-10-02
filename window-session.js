(function(global){
 'use strict';
 if(global.CNCWindowSession)return;
 const storageKey='cnc.window.v1',parameter='_cw',pattern=/^[a-f0-9]{32}$/;
 const initialURL=new URL(global.location.href),initialRole=initialURL.searchParams.get('role')||(initialURL.pathname==='/admin.php'?'admin':'employee');
 const nativeFetch=global.fetch.bind(global),nativeOpen=global.open.bind(global);
 const root=document.documentElement,previousVisibility=root.style.visibility;
 const isBootstrap=!!document.querySelector('meta[name="cnc-window-bootstrap"]');
 let context='',usable=false,leaving=false,releaseLease=null,intakeWindow=null;
 let resolveReady,rejectReady;
 const ready=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
 ready.catch(()=>{});
 root.style.visibility='hidden';

 function randomId(){const bytes=new Uint8Array(16);global.crypto.getRandomValues(bytes);return Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');}
 function role(){return global.CNCHOME_LIVE?.user?.role||document.documentElement.dataset.cncRole||initialRole;}
 function currentURL(){try{return new URL(global.CNCPageUrl||initialURL.href);}catch(_){return new URL(initialURL.href);}}
 function appURL(value){
  if(typeof value==='string'&&value.startsWith('#'))return null;
  try{const url=new URL(value,currentURL());return url.origin===initialURL.origin&&(url.pathname==='/'||/\.(?:php|html)$/.test(url.pathname))?url:null;}catch(_){return null;}
 }
 function url(value,windowId=context){
  const result=appURL(value);if(!result)return String(value);
  result.searchParams.set(parameter,windowId);
  if(!result.searchParams.has('role'))result.searchParams.set('role',role()==='admin'?'admin':'employee');
  return result.href;
 }
 function stopLease(){if(releaseLease){releaseLease();releaseLease=null;}}
 function redirect(windowId){
  if(leaving)return;
  leaving=true;usable=false;context=windowId;
  try{sessionStorage.setItem(storageKey,context);}catch(_){fail('이 창의 로그인 정보를 보관할 수 없습니다. 브라우저의 사이트 저장 설정을 확인해 주세요.');return;}
  stopLease();
  global.location.replace(url(initialURL.href));
 }
 function fail(message){
  usable=false;stopLease();rejectReady(new Error(message));
  const render=()=>{root.style.visibility=previousVisibility;const main=document.createElement('main'),title=document.createElement('h1'),detail=document.createElement('p'),button=document.createElement('button');title.textContent='로그인 창을 확인해 주세요';detail.textContent=message;button.type='button';button.textContent='새로고침';button.addEventListener('click',()=>global.location.reload());main.append(title,detail,button);document.body.replaceChildren(main);};
  if(document.body)render();else document.addEventListener('DOMContentLoaded',render,{once:true});
 }
 function delay(milliseconds){return new Promise(resolve=>global.setTimeout(resolve,milliseconds));}
 function lockOnce(id){
  return new Promise((resolve,reject)=>{
   global.navigator.locks.request('cnc.window.'+id,{mode:'exclusive',ifAvailable:true},lock=>{
    if(!lock){resolve(false);return;}
    return new Promise(release=>{releaseLease=release;resolve(true);});
   }).catch(reject);
  });
 }
 async function webLock(id){
  if(await lockOnce(id))return true;
  // A reload can start just before the previous document releases its lease.
  await delay(160);return lockOnce(id);
 }
 async function lease(id){
  if(global.navigator.locks?.request){try{return await webLock(id);}catch(_){stopLease();}}
  throw new Error('현재 브라우저에서는 창별 로그인을 안전하게 구분할 수 없습니다. 최신 브라우저에서 다시 열어 주세요.');
 }

 function decorateForm(form,submitter){
  if(!(form instanceof HTMLFormElement))return;
  const raw=submitter?.hasAttribute('formaction')?submitter.getAttribute('formaction'):form.getAttribute('action');
  const destination=appURL(raw||currentURL().href);if(!destination)return;
  if(submitter?.hasAttribute('formaction'))submitter.formAction=url(destination.href);else form.action=url(destination.href);
  let field=Array.from(form.elements).find(input=>input.name===parameter);
  if(!field){field=document.createElement('input');field.type='hidden';field.name=parameter;form.append(field);}
  field.value=context;
  const method=(submitter?.getAttribute('formmethod')||form.method||'get').toLowerCase();
  if(method==='get'&&!Array.from(form.elements).some(input=>input.name==='role')){
   const fieldRole=document.createElement('input');fieldRole.type='hidden';fieldRole.name='role';fieldRole.value=destination.searchParams.get('role')||(role()==='admin'?'admin':'employee');form.append(fieldRole);
  }
 }
 function decorateLink(link){const destination=appURL(link.getAttribute('href'));if(destination)link.href=url(destination.href);}
 function decorateDocument(){for(const form of document.forms)decorateForm(form);for(const link of document.querySelectorAll('a[href]'))decorateLink(link);}
 function getNativeContext(){try{return JSON.parse(document.getElementById('native-session-data')?.textContent||'null');}catch(_){return null;}}
 async function fork(childId){
  await ready;
  if(!usable||leaving)throw new Error('로그인 창이 이동 중입니다. 새 화면에서 다시 열어 주세요.');
  let csrf=global.CNCHOME_LIVE?.csrf||getNativeContext()?.csrf;
  if(!csrf){
   const response=await nativeFetch(url('/session-api.php'),{credentials:'same-origin',cache:'no-store',headers:{'X-CNC-Window':context,'X-CNC-Role':role()}});
   if(response.status===401)return;
   if(!response.ok)throw new Error('로그인 상태를 확인하지 못했습니다.');
   const session=await response.json();if(!session.authenticated)return;if(!session.csrf)throw new Error('로그인 상태를 확인하지 못했습니다.');csrf=session.csrf;
  }
  const response=await nativeFetch(url('/window-fork.php'),{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CNC-Window':context,'X-CNC-Role':role(),'X-CSRF-Token':csrf},body:JSON.stringify({windowId:childId})});
  if(response.status===401)return; // An expired parent opens an independent login window.
  const result=await response.json();
  if(!response.ok||result.ok!==true||result.windowId!==childId)throw new Error(result.error||'새 창의 로그인을 준비하지 못했습니다.');
 }
 function popupMessage(child,message){try{child.document.title='씨앤씨';const paragraph=child.document.createElement('p');paragraph.textContent=message;child.document.body.replaceChildren(paragraph);}catch(_){} }
 function focusPopup(child){
  try{if(child.closed)return;child.focus();}catch(_){return;}
  // Some browsers return focus to the opener at the end of the click handler.
  global.setTimeout(()=>{try{if(!child.closed&&document.hasFocus())child.focus();}catch(_){}},150);
 }
 function isIntakePopup(destination){return destination.pathname==='/intake.php'&&destination.searchParams.get('role')==='admin'&&destination.searchParams.get('popup')==='1';}
 function intakeKey(destination){
  const id=destination.searchParams.get('id');if(id)return 'receipt:'+id;
  if(destination.searchParams.get('new')==='1')return 'new';
  const copy=new URL(destination.href);copy.searchParams.delete(parameter);copy.searchParams.sort();return copy.pathname+copy.search;
 }
 function reuseIntakeWindow(destination){
  const entry=intakeWindow;if(!entry||entry.child.closed){intakeWindow=null;return null;}
  const child=entry.child;
  if(entry.preparing){entry.destination=destination;focusPopup(child);return child;}
  try{
   const current=new URL(child.CNCPageUrl||child.location.href);
   if(current.origin===initialURL.origin&&isIntakePopup(current)&&intakeKey(current)===intakeKey(destination)){focusPopup(child);return child;}
   if(child.document.querySelector('.receipt-form[data-receipt-dirty="true"]')&&!global.confirm('다른 접수증을 열면 저장하지 않은 변경 내용이 사라집니다. 계속하시겠습니까?')){focusPopup(child);return child;}
   const childContext=child.CNCWindowSession?.id||child.sessionStorage.getItem(storageKey)||entry.id;
   if(!pattern.test(childContext))throw new Error('접수창의 로그인 상태를 확인하지 못했습니다.');
   entry.id=childContext;entry.destination=destination;
   focusPopup(child);child.location.assign(url(destination.href,childContext));
  }catch(_){try{child.focus();}catch(_){}global.alert('열려 있는 접수창을 확인해 주세요. 다시 열려면 해당 창을 닫은 후 눌러 주세요.');}
  return child;
 }
 function open(value,target='_blank',features=''){
  const destination=appURL(value);
  if(!destination)return nativeOpen(value,target,features);
  if(['_self','_parent','_top'].includes(String(target).toLowerCase()))return nativeOpen(url(destination.href),target,features);
  const intake=isIntakePopup(destination);
  if(intake){const reused=reuseIntakeWindow(destination);if(reused)return reused;}
  const childId=randomId();
  // Only the administrator's receipt popup is reused; other windows keep independent sessions.
  const cleanFeatures=String(features||'').split(',').filter(item=>!/^\s*(?:noopener|noreferrer)(?:\s*=.*)?\s*$/i.test(item)).join(',');
  const child=nativeOpen('about:blank','_blank',cleanFeatures);if(!child)return null;
  focusPopup(child);
  try{child.sessionStorage.setItem(storageKey,childId);child.sessionStorage.removeItem('cnc.currentPage.v1');child.opener=null;popupMessage(child,'로그인 정보를 준비하고 있습니다.');}catch(_){try{child.close();}catch(_){}return null;}
  const entry=intake?{child,id:childId,destination,preparing:true}:null;if(entry)intakeWindow=entry;
  fork(childId).then(()=>{if(!child.closed){const foreground=document.hasFocus()||child.document.hasFocus();child.location.replace(url((entry?.destination||destination).href,childId));if(foreground)focusPopup(child);}if(entry)entry.preparing=false;}).catch(error=>{if(entry)entry.preparing=false;popupMessage(child,error.message||'새 창을 열지 못했습니다. 이 창을 닫고 다시 시도해 주세요.');});
  return child;
 }

 const api={ready,url,open,decorateForm,get id(){return context;},get role(){return role();}};
 global.CNCWindowSession=api;
 global.open=open;
 global.fetch=function(input,init){
  const requestURL=appURL(input instanceof Request?input.url:input);
  if(!requestURL)return nativeFetch(input,init);
  return ready.then(()=>{
   if(!usable||leaving)throw new Error('로그인 창이 이동 중입니다. 새 화면에서 다시 시도해 주세요.');
   const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));
   headers.set('X-CNC-Window',context);
   if(!requestURL.searchParams.has('role')&&!headers.has('X-CNC-Role'))headers.set('X-CNC-Role',role());
   // Keep Request streams, credentials and AbortSignal through the normal fetch overload.
   return nativeFetch(input,{...init,headers});
  });
 };
 global.addEventListener('submit',event=>{
  const form=event.target;if(!(form instanceof HTMLFormElement))return;
  if(!usable){event.preventDefault();event.stopImmediatePropagation();const submitter=event.submitter;ready.then(()=>{if(usable&&!leaving&&form.isConnected&&(!submitter||submitter.isConnected))form.requestSubmit(submitter||undefined);}).catch(()=>{});return;}
  decorateForm(form,event.submitter);
 },true);
 function followLink(event){
  if(event.defaultPrevented||event.type==='click'&&event.button!==0||event.type==='auxclick'&&event.button!==1)return;
  const link=event.target instanceof Element?event.target.closest('a[href]'):null;if(!link)return;
  const destination=appURL(link.getAttribute('href'));if(!destination)return;
  const newWindow=event.type==='auxclick'||event.ctrlKey||event.metaKey||event.shiftKey||link.target&&!['_self','_parent','_top'].includes(link.target.toLowerCase());
  if(newWindow&&!link.hasAttribute('download')&&!destination.searchParams.has('download')){
   // Existing popup handlers supply the appropriate size and document mode.
   const managed=link.matches('[data-policy-new-window],[data-intake-window],[data-personnel-window],[data-personnel-history-window],[data-membership-window],[data-contract-window],.nf-contract-manage-open,.nf-contract-open,a[href*="personnel.php"][href*="new=1"]');
   if(usable&&managed&&event.type==='click'&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){decorateLink(link);return;}
   event.preventDefault();event.stopImmediatePropagation();open(destination.href,'_blank');return;
  }
  decorateLink(link);
  if(!usable){event.preventDefault();event.stopImmediatePropagation();ready.then(()=>{if(usable&&!leaving)global.location.assign(url(destination.href));}).catch(()=>{});}
 }
 global.addEventListener('click',followLink,true);
 global.addEventListener('auxclick',followLink,true);
 document.addEventListener('DOMContentLoaded',()=>{if(usable)decorateDocument();});
 global.addEventListener('pagehide',()=>{usable=false;stopLease();});
 global.addEventListener('pageshow',event=>{if(event.persisted){root.style.visibility='hidden';global.location.reload();}});
 (async()=>{
  try{
   const stored=sessionStorage.getItem(storageKey);context=pattern.test(stored||'')?stored:randomId();sessionStorage.setItem(storageKey,context);
   const incoming=initialURL.searchParams.get(parameter);
   if(incoming&&incoming!==context){redirect(context);return;}
   if(!await lease(context)){redirect(randomId());return;}
   if(isBootstrap){redirect(context);return;}
   if(leaving)return;
   usable=true;root.style.visibility=previousVisibility;decorateDocument();resolveReady({id:context});
  }catch(error){fail(error.message||'이 창의 로그인 정보를 준비하지 못했습니다.');}
 })();
})(window);
