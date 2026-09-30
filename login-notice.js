(function(){
'use strict';
const dialog=document.getElementById('cnc-login-notice');
if(!dialog)return;
const picture=dialog.querySelector('.cnc-login-notice-image');
const showCopy=()=>dialog.classList.add('cnc-login-notice-image-unavailable');
picture.addEventListener('error',showCopy,{once:true});
if(picture.complete&&!picture.naturalWidth)showCopy();
dialog.querySelectorAll('[data-login-notice-close]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
dialog.addEventListener('close',()=>document.body.classList.remove('cnc-login-notice-open'));
document.body.classList.add('cnc-login-notice-open');
dialog.showModal();
})();
