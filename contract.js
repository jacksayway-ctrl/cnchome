(() => {
  'use strict';
  const dialog = document.getElementById('contract-dialog');
  const canOpen = dialog && typeof dialog.showModal === 'function';
  document.querySelectorAll('[data-contract-open]').forEach(link => link.addEventListener('click', event => {
    if (!canOpen) return;
    event.preventDefault();
    if (!dialog.open) dialog.showModal();
  }));
  document.querySelectorAll('[data-contract-close]').forEach(button => button.addEventListener('click', () => {
    if (canOpen) dialog.close();
  }));
  document.querySelectorAll('[data-contract-print]').forEach(button => button.addEventListener('click', () => window.print()));
  if (canOpen && dialog.hasAttribute('data-auto-open') && !dialog.open) dialog.showModal();
})();

// PHP calculates calendar boundaries; this only refreshes the date fields.
document.querySelectorAll('[data-contract-period-form]').forEach(form=>{
 let sequence=0;const preset=form.querySelector('[data-period-preset]'),start=form.querySelector('[data-period-start]'),end=form.querySelector('[data-period-end]'),message=form.querySelector('[data-period-message]');
 async function update(){const request=++sequence;end.readOnly=!['custom'].includes(preset.value);if(preset.value==='custom')return;if(preset.value==='unlimited'){end.value='';return;}if(!start.value)return;
  const params=new URLSearchParams({role:'admin',calculate:'1',term:preset.value,start:start.value});const employee=form.querySelector('[name="employeeId"]');if(employee?.value)params.set('employeeId',employee.value);
  const days=form.querySelectorAll('[name$="[working]"]');if(days.length){let checked=0;days.forEach((day,i)=>{if(day.checked){checked++;params.append('days[]',['월','화','수','목','금','토','일'][i]);}});if(!checked)params.append('days[]','');}
  try{const response=await fetch('/contracts.php?'+params,{credentials:'same-origin',cache:'no-store'});const data=await response.json();if(request!==sequence)return;if(!response.ok)throw Error(data.error||'계약기간 계산 실패');end.value=data.contractEnd;message.textContent='자동 계산: '+data.contractStart+' ~ '+data.contractEnd;}catch(error){if(request===sequence)message.textContent=error.message;}
 }
 form.addEventListener('change',event=>{if(event.target===preset||event.target===start||event.target.name==='employeeId'||event.target.name.endsWith('[working]'))update();});end.readOnly=preset.value!=='custom';
});
