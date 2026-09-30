(()=>{'use strict';
const context=window.CNCHOME_LIVE||(()=>{const node=document.getElementById('membership-admin-context');if(!node)return null;try{return JSON.parse(node.textContent)}catch(e){return null}})();
if(context?.user?.role!=='admin')return;
let busy=false,lastToken='',closedToken='',toast=null;
const storageKey='cnc-membership-alert-'+context.user.id+'-'+context.csrf;
try{closedToken=sessionStorage.getItem(storageKey)||''}catch(e){}
function clear(){toast?.remove();toast=null;}
async function load(){
 if(busy)return;busy=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch('/membership-notification.php?role=admin',{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!response.ok)return;
  const data=await response.json();if(!Number.isSafeInteger(data.pendingCount)||data.pendingCount<0||typeof data.token!=='string')return;
  if(!data.pendingCount){clear();lastToken='';return;}
  if(data.token===closedToken){clear();return;}if(data.token===lastToken&&toast)return;
  clear();lastToken=data.token;toast=document.createElement('aside');toast.className='membership-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');
  const heading=document.createElement('strong');heading.textContent='직원 등록 승인 대기 '+data.pendingCount+'건';
  const text=document.createElement('p');text.textContent='로그인 승인을 기다리는 신청이 있습니다.';
  const actions=document.createElement('div'),link=document.createElement('a'),close=document.createElement('button');link.href='/memberships.php?role=admin';link.textContent='승인 목록 보기';close.type='button';close.textContent='닫기';close.setAttribute('aria-label','직원 등록 승인 알림 닫기');
  close.addEventListener('click',()=>{closedToken=data.token;try{sessionStorage.setItem(storageKey,closedToken)}catch(e){}clear();});actions.append(link,close);toast.append(heading,text,actions);document.body.append(toast);
 }catch(e){}finally{clearTimeout(timer);busy=false;}
}
load();setInterval(()=>{if(!document.hidden)load()},15000);addEventListener('focus',load);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
})();
