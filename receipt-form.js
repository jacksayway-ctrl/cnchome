(function(global){
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const clock=()=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date());
 const popup=()=>new URL(global.CNCPageUrl||global.location.href).searchParams.get('intakeWindow')==='1';
 function markup({admin,staff,user}){
  const date=today(),owner=admin?'<select id="receipt-owner" name="employeeId" required><option value="">직원 선택</option>'+staff.map(row=>'<option value="'+row.id+'" data-team="'+esc(row.team)+'">'+esc(row.name)+'</option>').join('')+'</select>':'<output id="receipt-owner">'+esc(user.username==='user1'?'한윤희':user.display_name)+'</output>';
  return `<form class="receipt-form" data-sales-form data-intake-admin="${admin}" data-request-key="${global.crypto.randomUUID()}">
   <div class="receipt-header"><h2 id="receipt-title">접수증</h2><p>상담 및 방문 접수 정보를 입력해 주세요.</p></div>
   <input type="hidden" name="date" value="${date}"><input type="hidden" name="consultationTime" value="${clock().slice(0,5)}"><input type="hidden" name="phone"><input type="hidden" name="birthYear"><input type="hidden" name="birthMonth"><input type="hidden" name="birthDay"><input type="hidden" name="carrier"><input type="hidden" name="callAvailability">
   <div class="receipt-grid">
    <label class="receipt-label" for="receipt-owner">상담원</label><div class="receipt-value">${owner}</div><label class="receipt-label" for="receipt-date">날짜 / 시간</label><div class="receipt-value receipt-date"><input id="receipt-date" data-receipt-date inputmode="numeric" maxlength="4" pattern="[0-9]{4}" value="" required aria-label="접수일 월일 네 자리"><small>MMDD 입력 · <time data-receipt-clock>${clock()}</time></small></div>
    <label class="receipt-label" for="receipt-customer">신청자 성함</label><div class="receipt-value"><input id="receipt-customer" name="customer" maxlength="100" placeholder="신청자 이름" required autocomplete="off"></div><label class="receipt-label" for="receipt-phone">전화번호</label><div class="receipt-value receipt-phone"><span>010 -</span><input id="receipt-phone" data-receipt-phone type="tel" inputmode="numeric" maxlength="13" pattern="[0-9]{4}-?[0-9]{4}" placeholder="0000-0000" required aria-label="전화번호 010 뒤 여덟 자리" autocomplete="off"></div>
    <label class="receipt-label" for="receipt-birth">생년월일</label><div class="receipt-value"><input id="receipt-birth" data-receipt-birth type="date" min="1900-01-01" max="${date}" required autocomplete="bday"></div><span class="receipt-label" id="receipt-gender">성별</span><div class="receipt-value receipt-gender" role="radiogroup" aria-labelledby="receipt-gender"><label><input type="radio" name="gender" value="남"> 남</label><label><input type="radio" name="gender" value="여"> 여</label></div>
    <label class="receipt-label" for="receipt-place">지역(동)</label><div class="receipt-value receipt-region"><div class="sales-place-control"><input id="receipt-place" name="consultationPlace" maxlength="500" placeholder="예: 신림동 또는 ㅅㄹㄷ" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="receipt-place-options" aria-describedby="receipt-place-status"><div id="receipt-place-options" class="sales-place-options" data-place-options role="listbox" aria-label="지역 검색 결과" hidden></div></div><small id="receipt-place-status" data-place-status aria-live="polite">한글 초성 검색 적용</small></div>
    <label class="receipt-label" for="receipt-call">통화 가능시간</label><div class="receipt-value receipt-call"><select data-receipt-period aria-label="통화 가능시간 오전·오후 선택"><option value="">선택</option><option value="오전">오전</option><option value="오후">오후</option></select><input id="receipt-call" data-receipt-calltime maxlength="197" placeholder="예: 2시~5시"></div><label class="receipt-label" for="receipt-visit">방문</label><div class="receipt-value"><input id="receipt-visit" name="visitSchedule" maxlength="500" placeholder="방문 일정 또는 장소"></div>
    <span class="receipt-label" id="receipt-premium">월보험료</span><div class="receipt-value receipt-premium" role="radiogroup" aria-labelledby="receipt-premium"><label><input type="radio" name="premiumBand" value="100000"> 10만원 이상</label><label><input type="radio" name="premiumBand" value="200000"> 20만원 이상</label><label><input type="radio" name="premiumBand" value="300000"> 30만원 이상</label></div><label class="receipt-label" for="receipt-note">메모</label><div class="receipt-value"><textarea id="receipt-note" name="note" maxlength="1000" rows="2" placeholder="예: 한화 · 상담 내용"></textarea></div>
   </div>
   <details class="receipt-policy" data-intake-eligibility data-state="review"><summary data-intake-decision>생년월일과 지역을 입력하면 접수 가능 정책을 확인합니다.</summary><div data-intake-options class="sales-intake-options"></div>${admin?'<label>접수 코드 <select data-carrier-choice aria-label="가능한 접수 코드 선택"><option value="">가능 코드 자동 선택</option></select></label>':''}<p data-sales-age></p></details>
   <div hidden><input data-age-number readonly><output data-age-kind></output></div><p class="receipt-feedback" data-sales-error role="status" aria-live="polite"></p>
   <div class="receipt-actions"><button type="submit" class="receipt-save">저장</button><button type="reset" class="receipt-reset">초기화</button><button type="button" class="receipt-close" data-receipt-close>종료</button></div>
  </form>`;
 }
 function attach(form,{close}){
  const dialog=form.closest('dialog'),fields=form.elements,date=form.querySelector('[data-receipt-date]'),phone=form.querySelector('[data-receipt-phone]'),birth=form.querySelector('[data-receipt-birth]'),period=form.querySelector('[data-receipt-period]'),callTime=form.querySelector('[data-receipt-calltime]');
  dialog.classList.add('receipt-dialog');dialog.setAttribute('aria-labelledby','receipt-title');
  function sync(){
   const value=date.value.replace(/\D/g,'').slice(0,4),full=today().slice(0,4)+'-'+value.slice(0,2)+'-'+value.slice(2),parsed=new Date(full+'T00:00:00Z');date.value=value;
   const valid=/^\d{4}$/.test(value)&&Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===full&&full<=today();
   date.setCustomValidity(valid?'':'접수일을 MMDD 네 자리로 입력해 주세요. 미래 날짜는 입력할 수 없습니다.');fields.date.value=valid?full:today();birth.max=fields.date.value;
   let digits=phone.value.replace(/\D/g,'');if(digits.length===11&&digits.startsWith('010'))digits=digits.slice(3);digits=digits.slice(0,8);phone.value=digits.length>4?digits.slice(0,4)+'-'+digits.slice(4):digits;fields.phone.value=digits?'010-'+digits.slice(0,4)+'-'+digits.slice(4):'';
   period.required=!!callTime.value.trim();fields.callAvailability.value=[period.value,callTime.value.trim()].filter(Boolean).join(' ');
   const parts=birth.value.split('-');fields.birthYear.value=parts[0]||'';fields.birthMonth.value=parts[1]||'';fields.birthDay.value=parts[2]||'';
  }
  form.addEventListener('input',sync,true);form.addEventListener('change',sync,true);
  form.addEventListener('reset',()=>{for(const input of form.querySelectorAll('input,select,textarea,button[type="submit"]'))input.disabled=false;form.dataset.requestKey=global.crypto.randomUUID();form.removeAttribute('data-saved');form.querySelector('[data-sales-error]').textContent='';global.setTimeout(()=>{date.value='';fields.consultationTime.value=clock().slice(0,5);sync();birth.dispatchEvent(new Event('change',{bubbles:true}));fields.customer.focus();},0);});
  form.querySelector('[data-receipt-close]').addEventListener('click',()=>{close();if(popup())global.close();});
  const timer=global.setInterval(()=>{form.querySelector('[data-receipt-clock]').textContent=clock();},1000);
  dialog.addEventListener('close',()=>{global.clearInterval(timer);dialog.classList.remove('receipt-dialog');dialog.setAttribute('aria-labelledby','tm-dialog-title');if(popup())global.close();},{once:true});
  sync();fields.customer.focus();
 }
 function saved(form){if(!form)return;form.dataset.saved='true';for(const input of form.querySelectorAll('input,select,textarea,button[type="submit"]'))input.disabled=true;form.querySelector('[data-sales-error]').textContent='접수증을 저장했습니다. 초기화를 누르면 새 접수를 입력할 수 있습니다.';form.querySelector('button[type="reset"]').focus();}
 global.ReceiptForm={markup,attach,saved};
})(window);
