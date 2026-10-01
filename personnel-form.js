(()=>{
 'use strict';
 for(const form of document.querySelectorAll('.personnel-form,.membership-profile form')){
  const address=form.querySelector('[name="profile[address]"],[name="address"]');
  if(address){
   const control=document.createElement('div'),list=document.createElement('div'),status=document.createElement('small');
   control.className='personnel-address-control';list.id='personnel-address-options';list.className='personnel-address-options';list.hidden=true;list.dataset.placeOptions='';list.setAttribute('role','listbox');list.setAttribute('aria-label','주소 지역 검색 결과');
   status.id='personnel-address-status';status.dataset.placeStatus='';status.textContent='초성 검색 예: ㅇㅂㅂ → 인천광역시 부평구 부평동. 도로명·건물번호는 이어서 입력하세요.';
   address.before(control);control.append(address,list,status);address.dataset.personnelAddress='';address.autocomplete='off';
   for(const [name,value] of Object.entries({role:'combobox','aria-autocomplete':'list','aria-expanded':'false','aria-controls':list.id,'aria-describedby':status.id}))address.setAttribute(name,value);
   window.ConsultationLocation?.attach(form);
  }
  const amount=form.querySelector('[name="profile[payAmount]"]'),payType=form.querySelector('[name="profile[payType]"]'),output=form.querySelector('[data-personnel-pay-split]');
  function split(){if(!output)return;const total=Number(amount.value),money=value=>value.toLocaleString('ko-KR',{maximumFractionDigits:2})+'원';output.textContent=payType.value==='월급제'?'월 기본급 '+money(total):'시급 '+money(total/1.2)+' + 주휴수당 '+money(total-total/1.2)+' = '+money(total);}
  amount?.addEventListener('input',split);payType?.addEventListener('change',split);split();
  const contract=form.querySelector('[name="profile[contractType]"]');
  contract?.addEventListener('change',()=>{if(!contract.value)window.alert('계약 구분이 선택되지 않았습니다. 계약 구분을 선택해 주세요.');else if(contract.value==='무기계약')window.alert('기간의 정함 없음이 선택되었습니다. 계약 종료일 없이 저장됩니다.');});
 }
})();
