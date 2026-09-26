(function(){
'use strict';
const bar=document.createElement('div');bar.className='cnc-session-bar';bar.setAttribute('aria-label','로그인 계정');
const name=document.createElement('span'),error=document.createElement('span'),button=document.createElement('button');
error.setAttribute('role','alert');button.type='button';button.textContent='로그아웃';button.dataset.cncLogout='';
bar.append(name,error,button);document.body.prepend(bar);
let authenticated=!!window.CNCHOME_LIVE;
async function session(){const r=await fetch('/session-api.php',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('로그인 상태를 확인하지 못했습니다. 다시 눌러 주세요.');return r.json();}
function login(){location.assign('/login.php');}
function display(s){authenticated=s.authenticated;name.textContent=s.authenticated?(s.name||'로그인 중'):'';button.textContent=s.authenticated?'로그아웃':'로그인';}
if(window.CNCHOME_LIVE)display({authenticated:true,name:window.CNCHOME_LIVE.user.display_name});
else {button.disabled=true;session().then(display).catch(()=>{error.textContent='로그인 상태 확인 필요';}).finally(()=>button.disabled=false);}
button.addEventListener('click',async()=>{
 if(button.disabled)return;button.disabled=true;error.textContent='';
 try{
  const s=await session();if(!s.authenticated){login();return;}
  const data=new URLSearchParams({csrf:s.csrf});
  const r=await fetch('/logout.php',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:data});
  if(!r.ok)throw Error('로그아웃하지 못했습니다. 다시 눌러 주세요.');
  try{localStorage.setItem('cnc-session-logout',String(Date.now()));}catch(_){}
  login();
 }catch(e){error.textContent=e.message;button.disabled=false;}
});
window.addEventListener('storage',e=>{if(e.key==='cnc-session-logout'&&authenticated)login();});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
})();
