(()=>{
 'use strict';
 if(window.CNCAdminSaveConfirm)return;
 const nativeData=document.getElementById('native-session-data');
 let role=window.CNCHOME_LIVE?.user?.role||document.documentElement.dataset.cncRole;
 if(!role&&nativeData){try{role=JSON.parse(nativeData.textContent).user?.role;}catch(_){}}
 if(role!=='admin')return;
 const approvedForms=new WeakSet(),approvedButtons=new WeakSet();
 let dialog=null,resolveConfirmation=null,busy=false;
 const normalize=value=>(value||'').replace(/\s+/g,' ').trim();
 function setupDialog(){
  if(dialog)return;
  dialog=document.createElement('dialog');dialog.className='cnc-admin-save-confirm';
  dialog.setAttribute('aria-labelledby','cnc-admin-save-confirm-title');
  dialog.setAttribute('aria-describedby','cnc-admin-save-confirm-message');
  const title=document.createElement('h2');title.id='cnc-admin-save-confirm-title';title.textContent='변경 내용 저장 확인';
  const message=document.createElement('p');message.id='cnc-admin-save-confirm-message';
  const actions=document.createElement('div');actions.className='cnc-admin-save-confirm-actions';
  for(const [value,label] of [['cancel','취소'],['save','저장']]){
   const button=document.createElement('button');button.type='button';button.textContent=label;
   button.className=value==='save'?'primary':'secondary';
   if(value==='cancel')button.autofocus=true;
   button.addEventListener('click',()=>dialog.close(value));actions.append(button);
  }
  dialog.append(title,message,actions);document.body.append(dialog);
  dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close('cancel');});
  dialog.addEventListener('close',()=>{
   const resolve=resolveConfirmation;resolveConfirmation=null;busy=false;
   if(resolve)resolve(dialog.returnValue==='save');
  });
 }
 function request(label,note=''){
  if(busy)return Promise.resolve(false);
  setupDialog();busy=true;
  dialog.querySelector('p').textContent=(note?note+'\n\n':'')+(normalize(label)?normalize(label)+' 내용을 저장하시겠습니까?':'변경한 내용을 저장하시겠습니까?');
  dialog.returnValue='';
  return new Promise(resolve=>{resolveConfirmation=resolve;dialog.showModal();});
 }
 window.CNCAdminSaveConfirm={request};
 function mutationLabel(label){return /저장|확정|적용|등록|승인|반려|회수|개정|게시|수정\s*요청/.test(label);}
 function mutatingButton(button){
  if(button.closest('.cnc-admin-save-confirm')||button.disabled)return false;
  if(button.matches('[data-page],[data-aw-page],[data-aw-section],[data-print],[data-window-close],[data-grade-history-view],[data-grade-load],[data-grade-cancel],[data-grade-back]'))return false;
  if(button.matches('[data-checkin-late]'))return false;
  if(button.matches('[data-grade-save-period],[data-grade-confirm]'))return true;
  const action=button.dataset.action||'';
  if(['staff-add','intake','close','notice','notice-detail','policy-client-edit','intake-code-edit'].includes(action))return false;
  for(const attribute of button.attributes){
   if(attribute.name.startsWith('data-')&&attribute.name.endsWith('-action')&&/(?:^|[-_])(?:save|confirm|apply|approve|reject|publish|register|update|issue|withdraw|hold)(?:$|[-_]|[A-Z])/.test(attribute.value))return true;
  }
  const label=normalize(button.textContent||button.value);
  return mutationLabel(label)&&!/취소|돌아가|불러오기|기준 보기|미리보기.*보기/.test(label);
 }
 window.addEventListener('click',event=>{
  const button=event.target instanceof Element?event.target.closest('button,input[type=submit],input[type=button]'):null;
  if(!button)return;
  if(approvedButtons.has(button)){approvedButtons.delete(button);return;}
  if(button.form&&button.type==='submit')return; // Confirm only once, after native form validation.
  if(!mutatingButton(button))return;
  event.preventDefault();event.stopImmediatePropagation();
  const label=normalize(button.textContent||button.value);
  request(label).then(save=>{
   if(!save||!button.isConnected||button.disabled)return;
   approvedButtons.add(button);button.click();approvedButtons.delete(button);
  });
 },true);
 window.addEventListener('submit',event=>{
  const form=event.target;
  if(!(form instanceof HTMLFormElement)||form.closest('.cnc-admin-save-confirm'))return;
  if(approvedForms.has(form)){approvedForms.delete(form);return;}
  if(form.id==='tm-grade-form'||form.id==='tm-grade-preview-form')return; // Existing grade review leads to its final confirm button.
  const action=new URL(form.action,location.href);
  if(action.origin!==location.origin||/\/(?:logout|login)\.php$/.test(action.pathname))return;
  const submitter=event.submitter;
  const label=normalize(submitter?.textContent||submitter?.value||form.querySelector('button[type=submit],input[type=submit]')?.textContent);
  if(form.method.toLowerCase()!=='post'&&!mutationLabel(label))return;
  event.preventDefault();event.stopImmediatePropagation();
  const contract=form.querySelector('[name="profile[contractType]"]');
  if(contract&&!contract.value){window.alert('계약 구분이 선택되지 않았습니다. 계약 구분을 선택해 주세요.');contract.focus();return;}
  const note=contract?.value==='무기계약'?'기간의 정함 없음으로 저장됩니다. 계약 종료일이 없는 계약인지 확인해 주세요.':'';
  request(label,note).then(save=>{
   if(!save||!form.isConnected||(submitter&&(!submitter.isConnected||submitter.disabled)))return;
   approvedForms.add(form);
   try{form.requestSubmit(submitter||undefined);}finally{approvedForms.delete(form);}
  });
 },true);
})();
