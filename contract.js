document.querySelectorAll('[data-contract-print]').forEach(button=>button.addEventListener('click',()=>{const row=button.closest('[data-contract-detail]');if(row){document.body.classList.add('contract-print-one');row.classList.add('contract-print-target');}window.print();}));
window.addEventListener('afterprint',()=>{document.body.classList.remove('contract-print-one');document.querySelectorAll('.contract-print-target').forEach(row=>row.classList.remove('contract-print-target'));});
function contractToggle(row){const detail=document.getElementById(row.dataset.contractToggle);if(!detail)return;detail.hidden=!detail.hidden;row.setAttribute('aria-expanded',String(!detail.hidden));}
function contractWindow(link,event){if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;const popup=window.open(link.href,'_blank','popup,width=950,height=950,scrollbars=yes,resizable=yes');if(popup){popup.opener=null;event.preventDefault();popup.focus();}}
document.addEventListener('click',event=>{
 const row=event.target.closest('[data-contract-toggle]');if(row&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();contractToggle(row);return;}
 const link=event.target.closest('[data-contract-window]');if(link){contractWindow(link,event);return;}
 const windowRow=event.target.closest('[data-contract-window-row]');if(windowRow&&!event.target.closest('a,button,input,select'))windowRow.querySelector('[data-contract-window]')?.click();
});
document.addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;const row=event.target.closest('[data-contract-toggle],[data-contract-window-row]');if(!row||event.target!==row)return;event.preventDefault();if(row.dataset.contractToggle)contractToggle(row);else row.querySelector('[data-contract-window]')?.click();});

// PHP calculates calendar boundaries; this only refreshes the date fields.
document.querySelectorAll('[data-contract-period-form]').forEach(form=>{
 let sequence=0;const preset=form.querySelector('[data-period-preset]'),start=form.querySelector('[data-period-start]'),end=form.querySelector('[data-period-end]'),message=form.querySelector('[data-period-message]');
 async function update(){const request=++sequence;end.readOnly=!['custom'].includes(preset.value);if(preset.value==='custom')return;if(preset.value==='unlimited'){end.value='';return;}if(!start.value)return;
  const params=new URLSearchParams({role:'admin',calculate:'1',term:preset.value,start:start.value});const employee=form.querySelector('[name="employeeId"]');if(employee?.value)params.set('employeeId',employee.value);
  const days=form.querySelectorAll('[name$="[working]"]');if(days.length){let checked=0;days.forEach((day,i)=>{if(day.checked){checked++;params.append('days[]',['월','화','수','목','금','토','일'][i]);}});if(!checked)params.append('days[]','');}
  const templateDays=form.querySelectorAll('[data-template-workday]');if(templateDays.length){const selected=[...templateDays].filter(day=>day.checked);if(!selected.length)params.append('days[]','');else selected.forEach(day=>params.append('days[]',day.value));}
  try{const response=await fetch('/contracts.php?'+params,{credentials:'same-origin',cache:'no-store'});const data=await response.json();if(request!==sequence)return;if(!response.ok)throw Error(data.error||'계약기간 계산 실패');end.value=data.contractEnd;message.textContent='자동 계산: '+data.contractStart+' ~ '+data.contractEnd;}catch(error){if(request===sequence)message.textContent=error.message;}
 }
 form.addEventListener('change',event=>{if(event.target===preset||event.target===start||event.target.name==='employeeId'||event.target.name.endsWith('[working]')||event.target.matches('[data-template-workday]'))update();});end.readOnly=preset.value!=='custom';
});
document.querySelector('[data-contract-filter]')?.addEventListener('change',event=>{const form=event.currentTarget;if(event.target.name==='team')form.elements.employeeId.value='0';form.requestSubmit();});
