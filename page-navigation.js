(()=>{
 'use strict';
 if(window.CNCPageNavigation)return;
 const key='cnc.currentPage.v1';
 const windowSession=window.CNCWindowSession;
 let route=new URL(location.href),ready=false,sessionReady=!windowSession;
 const replace=history.replaceState.bind(history);
 function remember(){if(sessionReady){if(windowSession)route=new URL(windowSession.url(route.href));try{sessionStorage.setItem(key,route.pathname+route.search+route.hash);}catch(_){}}window.CNCPageUrl=route.href;}
 function conceal(){if(!sessionReady)return;remember();replace({...history.state,cncRoute:route.pathname+route.search+route.hash},'','/');}
 function setPage(page){
  if(!/^[a-zA-Z][a-zA-Z0-9]*$/.test(page))return;
  route.searchParams.set('page',page);route.hash='';if(window.CNCHOME_LIVE)window.CNCHOME_LIVE.page=page;remember();if(ready)conceal();
 }
 window.CNCPageNavigation={setPage,url:()=>route.href};remember();
 function absoluteAction(form){const action=form.getAttribute('action');if(!action||action.startsWith('?'))form.action=new URL(action||route.pathname+route.search,route).href;if(sessionReady)windowSession?.decorateForm(form);}
 document.addEventListener('submit',e=>{if(e.target instanceof HTMLFormElement)absoluteAction(e.target);},true);
 document.addEventListener('click',e=>{const link=e.target.closest('a[href]');if(link?.getAttribute('href').startsWith('?'))link.href=new URL(link.getAttribute('href'),route).href;},true);
 document.addEventListener('DOMContentLoaded',()=>{for(const form of document.forms)absoluteAction(form);ready=true;conceal();});
 if(windowSession)windowSession.ready.then(()=>{sessionReady=true;remember();for(const form of document.forms)absoluteAction(form);if(ready)conceal();}).catch(()=>{});
 window.addEventListener('hashchange',()=>{const page=location.hash.slice(1);if(page)setTimeout(()=>setPage(page),0);});
 window.addEventListener('popstate',e=>{if(e.state?.cncRoute&&e.state.cncRoute!==route.pathname+route.search+route.hash){const target=new URL(e.state.cncRoute,location.origin);if(target.origin===location.origin)location.replace(windowSession?.url(target.href)||target.href);}});
})();
