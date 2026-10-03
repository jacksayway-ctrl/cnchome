(()=>{
 'use strict';
 function start(){
  const toolbar=document.querySelector('[data-intake-month-toolbar]');
  if(!toolbar)return;
  const menu=document.querySelector('.nf-subpages>.nf-subpage-links');
  if(menu){
   const row=document.createElement('div');row.className='intake-subpage-month-row';
   menu.before(row);row.append(menu,toolbar);
  }
  const form=toolbar.querySelector('[data-intake-month-form]');
  form?.querySelector('input[name=month]')?.addEventListener('change',()=>{
   if(form.reportValidity())form.requestSubmit();
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
