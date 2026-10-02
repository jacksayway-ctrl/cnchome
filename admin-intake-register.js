(function(global){
 'use strict';
 const document=global.document,source=document.getElementById('admin-intake-register-data'),mount=document.querySelector('[data-admin-receipt]');
 if(!source||!mount)return;
 let config;try{config=JSON.parse(source.textContent);}catch(_){mount.textContent='접수 입력창을 불러오지 못했습니다. 새로고침해 주세요.';return;}
 if(config.user?.role!=='admin'||!Array.isArray(config.staff)||!global.ReceiptForm||!global.IntakeDetails)return;
 const teams={insurance:'보험팀',cosmetics:'화장품팀',health:'건강보조식품팀'};
 mount.innerHTML=global.ReceiptForm.markup({admin:true,staff:config.staff,user:config.user,counselorNames:config.counselorNames||[]});
 const form=mount.querySelector('[data-sales-form]'),owner=form.elements.employeeId,counselor=form.elements.counselorName,feedback=form.querySelector('[data-sales-error]');
 form.method='post';form.action='/sales-api.php';global.CNCWindowSession?.decorateForm(form);
 const summary=document.createElement('section');summary.className='admin-intake-staff-summary';summary.setAttribute('aria-label','선택한 직원 접수 현황');
 const staffName=document.createElement('strong'),staffCounts=document.createElement('p'),staffLink=document.createElement('a');
 staffName.dataset.adminStaffName='';staffCounts.dataset.adminStaffCounts='';staffCounts.setAttribute('aria-live','polite');staffLink.dataset.adminStaffList='';staffLink.className='nf-button';staffLink.textContent='선택 직원 접수 목록 보기';summary.append(staffName,staffCounts,staffLink);form.before(summary);
 let busy=false;
 const selectedStaff=()=>config.staff.find(staff=>String(staff.id)===owner.value);
 const month=()=>form.elements.date.value.slice(0,7);
 function listURL(staff=selectedStaff()){
  let target;try{target=new URL(config.listUrl||'/intake.php?role=admin',global.location.href);}catch(_){target=new URL('/intake.php?role=admin',global.location.href);}
  if(target.origin!==global.location.origin||target.pathname!=='/intake.php')target=new URL('/intake.php?role=admin',global.location.href);
  for(const key of ['new','id','detail','popup','export','q','team','from','to','p'])target.searchParams.delete(key);
  target.searchParams.set('role','admin');target.searchParams.set('month',month());target.searchParams.set('status','');target.searchParams.set('scope',staff?.isTest?'test':'real');
  if(staff)target.searchParams.set('employee',String(staff.id));else target.searchParams.delete('employee');
  return global.CNCWindowSession?.url(target.href)||target.href;
 }
 function renderSummary(){
  const staff=selectedStaff();staffLink.hidden=!staff;staffLink.href=listURL(staff);
  staffName.textContent=staff?[staff.name,teams[staff.team]||staff.team,staff.isTest?'테스트 직원':''].filter(Boolean).join(' · '):'담당 직원을 선택해 주세요.';
  staffCounts.textContent=staff?month()+' · 접수 목록에서 이 직원의 가접수·정상접수·A/S 내용을 모두 확인할 수 있습니다.':'직원을 선택하면 해당 직원 명의로 접수를 등록할 수 있습니다.';
 }
 function rememberSelection(){
  const employeeValue=owner.value,counselorValue=counselor.value;
  for(const option of owner.options)option.defaultSelected=option.value===employeeValue;
  counselor.defaultValue=counselorValue;
 }
 function duplicateConfirmation(count){
  return new Promise(resolve=>{
   const dialog=document.createElement('dialog');dialog.className='sales-duplicate-dialog cnc-admin-save-confirm';dialog.setAttribute('aria-label','중복 접수 확인');
   const title=document.createElement('h2'),message=document.createElement('p'),note=document.createElement('p'),actions=document.createElement('div');
   title.textContent='중복 접수 확인';message.textContent='같은 이름과 전화번호의 기존 접수가 '+Number(count)+'건 있습니다.';note.textContent='저장하면 신청자 성함 뒤에 (중복접수)를 붙여 접수합니다.';actions.className='cnc-admin-save-confirm-actions';
   let approved=false;for(const [value,label] of [['cancel','취소'],['save','저장']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.className=value==='save'?'primary':'secondary';button.autofocus=value==='cancel';button.addEventListener('click',event=>{if(value==='save'&&event.detail<1){event.preventDefault();return;}approved=value==='save';dialog.close();});actions.append(button);}
   dialog.append(title,message,note,actions);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();resolve(approved&&form.isConnected);},{once:true});dialog.showModal();
  });
 }
 async function save(body){
  if(busy)return;busy=true;
  const controls=[...form.querySelectorAll('input,select,textarea,button')].map(control=>[control,control.disabled]);
  form.setAttribute('aria-busy','true');delete feedback.dataset.state;feedback.textContent='접수증을 저장하는 중입니다.';for(const [control] of controls)control.disabled=true;
  let saved=false;
  try{
   while(true){
    const controller=new AbortController(),timeout=global.setTimeout(()=>controller.abort(),30000);let response,data;
    try{response=await global.fetch('/sales-api.php?month='+encodeURIComponent(body.date.slice(0,7)),{method:'POST',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json','X-CSRF-Token':config.csrf,'X-CNC-Role':'admin'},body:JSON.stringify(body)});data=await response.json();}finally{global.clearTimeout(timeout);}
    if(response.status===409&&data.duplicate===true&&!body.duplicateConfirmed){
     if(!await duplicateConfirmation(data.duplicateCount)){feedback.textContent='중복 접수 저장을 취소했습니다. 입력 내용을 수정할 수 있습니다.';return;}
     body={...body,duplicateConfirmed:true};continue;
    }
    if(!response.ok)throw new Error(data.error||'접수증을 저장하지 못했습니다. 입력 내용을 확인해 주세요.');
    global.ReceiptForm.updateCounselors(form,data.counselorNames);rememberSelection();
    if(form.isConnected&&form.dataset.requestKey===body.requestKey){global.ReceiptForm.saved(form);feedback.textContent=(body.status==='normal'?'정상 접수':body.status==='as'?'A/S':'가접수')+'로 저장했습니다. 새 접수를 입력해 주세요.';saved=true;}
    global.dispatchEvent(new global.Event('cnc:sales-changed'));try{global.localStorage.setItem('cnchome.sales.changed',String(Date.now()));}catch(_){}
    break;
   }
  }catch(error){feedback.textContent=error.name==='AbortError'?'저장 확인 응답이 지연되었습니다. 같은 입력으로 저장을 다시 눌러 확인해 주세요.':error.message;}
  finally{busy=false;form.removeAttribute('aria-busy');for(const [control,disabled] of controls)control.disabled=disabled;renderSummary();if(saved)global.setTimeout(renderSummary,0);}
 }
 global.ReceiptForm.attach(form,{close:()=>global.location.assign(listURL())});
 global.ConsultationLocation?.attach(form);global.IntakeDetails.attach(form,{admin:true,team:()=>selectedStaff()?.team||''});
 form.querySelector('[data-receipt-close]').textContent='접수 목록';
 owner.addEventListener('change',()=>{rememberSelection();renderSummary();});
 form.addEventListener('input',event=>{if(event.target.matches('[data-receipt-date]'))renderSummary();});
 form.addEventListener('reset',()=>global.setTimeout(renderSummary,0));
 form.addEventListener('submit',event=>{
  event.preventDefault();if(busy||!form.reportValidity())return;
  const values=Object.fromEntries(new FormData(form));rememberSelection();save({...values,employeeId:Number(values.employeeId),birthYear:Number(values.birthYear),action:'create',requestKey:form.dataset.requestKey});
 });
 if(config.employeeId&&config.staff.some(staff=>String(staff.id)===String(config.employeeId))){owner.value=String(config.employeeId);owner.dispatchEvent(new global.Event('change',{bubbles:true}));}else renderSummary();
})(window);
