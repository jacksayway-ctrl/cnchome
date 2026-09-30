(function(){
'use strict';
const dialog=document.getElementById('cnc-login-notice');
if(!dialog)return;
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
const key='cnc-login-notice-'+dialog.dataset.userRole+'-'+dialog.dataset.userId+'-'+dialog.dataset.noticeVersion;
try{if(localStorage.getItem(key)===today()){dialog.remove();return;}}catch(e){}
const skipToday=dialog.querySelector('[data-login-notice-today]');
const picture=dialog.querySelector('.cnc-login-notice-image');
const showCopy=()=>dialog.classList.add('cnc-login-notice-image-unavailable');
picture.addEventListener('error',showCopy,{once:true});
if(picture.complete&&!picture.naturalWidth)showCopy();
dialog.querySelectorAll('[data-login-notice-close]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
dialog.addEventListener('close',()=>{if(skipToday?.checked)try{localStorage.setItem(key,today());}catch(e){}document.body.classList.remove('cnc-login-notice-open');});
document.body.classList.add('cnc-login-notice-open');
dialog.showModal();
})();
