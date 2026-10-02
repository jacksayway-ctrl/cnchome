(function(global){
 'use strict';
 const active=new WeakMap();

 function inputValue(form,name,value){const input=form.elements.namedItem(name);if(input&&'value' in input){input.value=String(value??'');if('defaultValue' in input)input.defaultValue=input.value;}}
 function radioValue(form,name,value){
  const inputs=[...form.querySelectorAll('input[type="radio"]')].filter(input=>input.name===name);
  for(const input of inputs)input.checked=input.defaultChecked=input.value===String(value??'');
  return inputs.some(input=>input.checked);
 }
 function extraRadio(container,name,value,label){
  const option=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name=name;input.value=value;input.checked=input.defaultChecked=true;option.append(input,' '+label);container.append(option);return input;
 }
 function hidden(form,name,value){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=String(value??'');form.append(input);return input;}
 function field(label,control){const wrapper=document.createElement('label');wrapper.className='receipt-admin-field';wrapper.append(document.createTextNode(label),control);return wrapper;}
 function mount(host,force=false,options={}){
  if(active.has(host)&&!force)return;
  const target=host.querySelector('[data-intake-edit-form]'),data=host.querySelector('[data-intake-edit-data]'),nativeHidden=host.querySelector('[data-intake-edit-hidden]');
  if(!target||!data||!nativeHidden||!global.ReceiptForm||!global.IntakeDetails)return;
  let payload;try{payload=JSON.parse(data.content.textContent);}catch(_){target.textContent='접수 정보를 불러오지 못했습니다. 새로고침해 주세요.';return;}
  const record=payload.record;if(!record||!/^(?:\d+|test:\d+:\d+)$/.test(record.id)||!/^\d{4}-\d{2}-\d{2}$/.test(record.date))return;
  const action=new URL(host.dataset.intakeEditUrl,global.CNCPageUrl||location.href);if(action.origin!==location.origin||action.pathname!=='/intake.php')return;
  // Keep the live search node and its IME/request state across receipt resets.
  const search=host.closest('[data-intake-detail-panel]')?.querySelector('[data-intake-side-search]');
  search?.remove();
  active.get(host)?.();
  target.innerHTML=global.ReceiptForm.markup({admin:true,editing:true,idPrefix:'receipt-edit-'+record.id,staff:[],user:{display_name:record.counselorName},counselorNames:payload.counselorNames||[]});
  const form=target.querySelector('form');form.method='post';form.action=action.href;form.classList.add('intake-form');form.dataset.intakeEditForm='';if(options.submit)form.removeAttribute('data-sales-form');
  form.append(nativeHidden.content.cloneNode(true));
  for(const name of ['customer','consultationTime','consultationPlace','visitSchedule','carrier','callAvailability'])inputValue(form,name,record[name]);
  const counselor=form.elements.counselorName;
  if(!record.counselorName){counselor.required=false;counselor.options[0].textContent='미입력';}
  const owner=document.createElement('small');owner.className='receipt-owner-original';owner.textContent='담당 직원: '+record.employee;form.querySelector('.receipt-counselor').append(owner);
  const storedTime=document.createElement('input');storedTime.type='time';storedTime.name='consultationTime';storedTime.dataset.receiptClock='';storedTime.className='receipt-stored-time';storedTime.value=record.consultationTime;storedTime.defaultValue=storedTime.value;storedTime.setAttribute('aria-label','상담 시간');form.elements.consultationTime.remove();form.querySelector('[data-receipt-clock]').replaceWith(storedTime);
  const date=form.querySelector('[data-receipt-date]');date.value=record.date.slice(5).replace('-','');date.defaultValue=date.value;date.readOnly=true;date.tabIndex=-1;
  const fullPhone=!/^010-?\d{4}-?\d{4}$/.test(record.phone),phone=form.querySelector('[data-receipt-phone]');
  phone.value=fullPhone?record.phone:record.phone.replace(/\D/g,'').slice(3);phone.defaultValue=phone.value;
  if(fullPhone){form.dataset.receiptFullPhone='true';form.querySelector('.receipt-phone > span')?.remove();phone.maxLength=15;phone.pattern='[0-9-]{9,15}';phone.placeholder='전화번호';phone.setAttribute('aria-label','전화번호');}
  const birthday=/^(\d{4})-(\d{2})-(\d{2})$/.exec(record.birthDate),parts=birthday?birthday.slice(1):[record.birthYear&&record.birthYear!=='0'?record.birthYear:'','',''];
  const birthInputs=['year','month','day'].map((part,index)=>{const input=form.querySelector('[data-receipt-birth-'+part+']');input.value=parts[index];input.defaultValue=input.value;input.required=!!birthday;return input;});
  const birthDate=hidden(form,'birthDate',record.birthDate);birthDate.disabled=!birthday;
  function syncBirth(){
   const values=['birthYear','birthMonth','birthDay'].map(name=>form.elements[name].value),changed=birthInputs.some((input,index)=>input.value!==String(parts[index]));
   const complete=values.every(Boolean),needed=!!birthday||changed;
   for(const input of birthInputs)input.required=needed;
   birthDate.disabled=!needed&&!complete;birthDate.value=complete?values[0]+'-'+values[1].padStart(2,'0')+'-'+values[2].padStart(2,'0'):'';
  }
  if(!radioValue(form,'gender',record.gender))extraRadio(form.querySelector('.receipt-gender'),'gender','','미입력').tabIndex=-1;
  if(!radioValue(form,'premiumBand',record.premiumBand))extraRadio(form.querySelector('.receipt-premium'),'premiumBand','','미입력');
  const call=form.querySelector('[data-receipt-calltime]'),callMatch=/^(오전|오후)(?:\s+(.*))?$/.exec(record.callAvailability);
  radioValue(form,'receiptPeriod',callMatch?.[1]||'');call.value=callMatch?.[2]||(!callMatch?record.callAvailability:'');call.defaultValue=call.value;
  radioValue(form,'note','한화');
  const kinds=document.createElement('div');kinds.className='receipt-kind-options';kinds.setAttribute('role','radiogroup');kinds.setAttribute('aria-label','일반 또는 실버 선택');
  for(const [value,label] of [['general','일반'],['silver','실버']]){
   const choice=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name='insuranceKind';input.value=value;choice.append(input,' '+label);kinds.append(choice);
  }
  form.querySelector('[data-receipt-product]').replaceWith(kinds);
  form.querySelector('.receipt-note').removeAttribute('aria-describedby');
  const adminFields=document.createElement('div');adminFields.className='receipt-admin-controls';
  const status=document.createElement('select');status.name='status';
  for(const [value,label] of [['pending','접수 전환'],['normal','정상 접수'],['as','A/S']])status.add(new Option(label,value,value===record.status,value===record.status));
  const reason=document.createElement('input');reason.name='reason';reason.maxLength=500;reason.value=record.reason;reason.defaultValue=reason.value;reason.placeholder='수정 사유 (선택)';
  adminFields.append(field('접수 상태',status));if(!options.submit)adminFields.append(field('수정 사유 (선택)',reason));form.querySelector('.receipt-grid').after(adminFields);
  form.querySelector('.receipt-save').textContent='변경 내용 저장';form.querySelector('.receipt-save').dataset.receiptPointerSave='';
  const reset=form.querySelector('.receipt-reset');reset.type='button';reset.textContent='되돌리기';reset.addEventListener('click',()=>options.reset?options.reset():mount(host,true,options));
  function close(){if(options.close){options.close();return;}const row=host.closest('[data-intake-detail]');const toggle=row?.previousElementSibling?.querySelector('[data-intake-toggle]');if(toggle)toggle.click();else host.closest('details')?.removeAttribute('open');}
  const detachReceipt=global.ReceiptForm.attach(form,{originalDate:record.date,originalCallAvailability:record.callAvailability,phoneMode:fullPhone?'full':'mobile',autofocus:false,close});
  global.ConsultationLocation?.attach(form);
  const detachDetails=global.IntakeDetails.attach(form,{team:()=>record.team});
  form.addEventListener('input',syncBirth);form.addEventListener('change',syncBirth);form.addEventListener('submit',syncBirth);syncBirth();
  if(options.submit)form.addEventListener('submit',event=>{event.preventDefault();event.stopPropagation();syncBirth();if(form.reportValidity())options.submit(form);});
  global.CNCWindowSession?.decorateForm(form);
  if(search){const header=form.querySelector('.receipt-header');header.classList.add('receipt-management-header');header.querySelector('.receipt-input-mode').before(search);}
  if(force)host.dispatchEvent(new CustomEvent('intake:editor-reset',{bubbles:true}));
  active.set(host,()=>{detachReceipt?.();if(typeof detachDetails==='function')detachDetails();});
 }
 function hydrate(root=document){for(const host of root.querySelectorAll('[data-intake-edit-host]'))mount(host);}
 global.AdminIntakeEdit={hydrate,mount,dispose(host){active.get(host)?.();active.delete(host);}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>hydrate(),{once:true});else hydrate();
})(window);
