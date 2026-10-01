(function(global){
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const clock=()=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date());
 const popup=()=>new URL(global.CNCPageUrl||global.location.href).searchParams.get('intakeWindow')==='1';
 function markup({admin,staff,user}){
  const date=today(),owner=(admin?'<select id="receipt-owner" name="employeeId" required aria-label="담당 직원"><option value="">담당 직원 선택</option>'+staff.map(row=>'<option value="'+row.id+'" data-team="'+esc(row.team)+'">'+esc(row.name)+'</option>').join('')+'</select>':'')+'<input id="receipt-counselor" name="counselorName" maxlength="100" value="한윤희" required aria-label="상담원 이름" autocomplete="off">';
  return `<form class="receipt-form" data-sales-form data-intake-admin="${admin}" data-request-key="${global.crypto.randomUUID()}">
   <div class="receipt-header"><div><h2 id="receipt-title">접수증</h2><p>저장하면 가접수로 등록됩니다.</p></div><label class="receipt-input-mode">입력 모드<select data-receipt-input-mode aria-label="문자 입력 모드"><option value="ko" selected>한글 자동</option><option value="en">기본 자판</option></select></label></div>
   <input type="hidden" name="date" value="${date}"><input type="hidden" name="consultationTime" value="${clock().slice(0,5)}"><input type="hidden" name="phone"><input type="hidden" name="birthYear"><input type="hidden" name="birthMonth"><input type="hidden" name="birthDay"><input type="hidden" name="carrier"><input type="hidden" name="callAvailability">
   <div class="receipt-grid">
    <label class="receipt-label" for="receipt-counselor">상담원</label><div class="receipt-value receipt-counselor">${owner}</div><label class="receipt-label" for="receipt-date">날짜 / 시간</label><div class="receipt-value receipt-date"><input id="receipt-date" data-receipt-date inputmode="numeric" maxlength="4" pattern="[0-9]{4}" value="" required placeholder="MMDD" autocomplete="off" aria-label="접수일 월일 네 자리" aria-describedby="receipt-date-preview"><small><output id="receipt-date-preview" data-receipt-date-preview for="receipt-date" aria-label="변환된 접수일 YYMMDD" aria-live="polite">YYMMDD</output> · <time data-receipt-clock>${clock()}</time></small></div>
    <label class="receipt-label" for="receipt-customer">신청자 성함</label><div class="receipt-value"><input id="receipt-customer" name="customer" maxlength="100" placeholder="신청자 이름" required autocomplete="off"></div><label class="receipt-label" for="receipt-phone">전화번호</label><div class="receipt-value receipt-phone"><span>010 -</span><input id="receipt-phone" data-receipt-phone type="tel" inputmode="numeric" maxlength="13" pattern="[0-9]{4}-?[0-9]{4}" placeholder="0000-0000" required aria-label="전화번호 010 뒤 여덟 자리" autocomplete="off"></div>
    <label class="receipt-label" for="receipt-birth-year">생년월일</label><div class="receipt-value receipt-birth"><div><input id="receipt-birth-year" data-receipt-birth-year inputmode="numeric" maxlength="4" pattern="[0-9]{2}|[0-9]{4}" placeholder="80" required aria-label="출생연도 두 자리 또는 네 자리" autocomplete="bday-year"><span>년</span><input data-receipt-birth-month inputmode="numeric" maxlength="2" pattern="[0-9]{1,2}" placeholder="01" required aria-label="태어난 월" autocomplete="bday-month"><span>월</span><input data-receipt-birth-day inputmode="numeric" maxlength="2" pattern="[0-9]{1,2}" placeholder="01" required aria-label="태어난 일" autocomplete="bday-day"><span>일</span></div><small>생년·월 두 자리 입력 시 자동 이동 · 80 → 1980</small></div><span class="receipt-label" id="receipt-gender">성별</span><div class="receipt-value receipt-gender" role="radiogroup" aria-labelledby="receipt-gender"><label><input type="radio" name="gender" value="남"> 남</label><label><input type="radio" name="gender" value="여" checked> 여</label></div>
    <label class="receipt-label" for="receipt-place">지역(동)</label><div class="receipt-value receipt-region"><div class="sales-place-control"><input id="receipt-place" name="consultationPlace" maxlength="500" placeholder="예: 신림동 또는 ㅅㄹㄷ" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="receipt-place-options" aria-describedby="receipt-place-status"><div id="receipt-place-options" class="sales-place-options" data-place-options role="listbox" aria-label="지역 검색 결과" hidden></div></div><small id="receipt-place-status" data-place-status aria-live="polite">한글 초성 검색 적용</small></div>
    <label class="receipt-label" for="receipt-call">통화 가능시간</label><div class="receipt-value receipt-call"><div class="receipt-period" role="radiogroup" aria-label="통화 가능시간 오전·오후 선택"><label><input type="radio" name="receiptPeriod" data-receipt-period value="오전"> 오전</label><label><input type="radio" name="receiptPeriod" data-receipt-period value="오후" checked> 오후</label></div><input id="receipt-call" data-receipt-calltime maxlength="194" placeholder="시간 선택 입력 · 예: 11시 경"></div><label class="receipt-label" for="receipt-visit">방문</label><div class="receipt-value"><input id="receipt-visit" name="visitSchedule" maxlength="500" value="주민센터" placeholder="방문 일정 또는 장소"></div>
    <span class="receipt-label" id="receipt-premium">월보험료</span><div class="receipt-value receipt-premium" role="radiogroup" aria-labelledby="receipt-premium"><label><input type="radio" name="premiumBand" value="100000" checked> 10만원 이상</label><label><input type="radio" name="premiumBand" value="200000"> 20만원 이상</label><label><input type="radio" name="premiumBand" value="300000"> 30만원 이상</label></div><label class="receipt-label" for="receipt-note">메모</label><div class="receipt-value"><textarea id="receipt-note" name="note" maxlength="1000" rows="2" placeholder="예: 한화 · 상담 내용">한화</textarea></div>
   </div>
   <details class="receipt-policy" data-intake-eligibility data-state="review"><summary data-intake-decision>생년월일과 지역을 입력하면 접수 가능 정책을 확인합니다.</summary><div data-intake-options class="sales-intake-options"></div>${admin?'<label>접수 코드 <select data-carrier-choice aria-label="가능한 접수 코드 선택"><option value="">가능 코드 자동 선택</option></select></label>':''}<p data-sales-age></p></details>
   <div hidden><input data-age-number readonly><output data-age-kind></output></div><p class="receipt-feedback" data-sales-error role="status" aria-live="polite"></p>
   <div class="receipt-actions"><button type="submit" class="receipt-save">저장</button><button type="reset" class="receipt-reset">초기화</button><button type="button" class="receipt-close" data-receipt-close>종료</button></div>
  </form>`;
 }
 function attach(form,{close}){
  const dialog=form.closest('dialog'),fields=form.elements,date=form.querySelector('[data-receipt-date]'),datePreview=form.querySelector('[data-receipt-date-preview]'),phone=form.querySelector('[data-receipt-phone]'),birthYear=form.querySelector('[data-receipt-birth-year]'),birthMonth=form.querySelector('[data-receipt-birth-month]'),birthDay=form.querySelector('[data-receipt-birth-day]'),periods=[...form.querySelectorAll('[data-receipt-period]')],callTime=form.querySelector('[data-receipt-calltime]');
  dialog.classList.add('receipt-dialog');dialog.setAttribute('aria-labelledby','receipt-title');
  const birthInsertionAtEnd=new WeakSet();
  function sync(event){
   const input=event?.target;
   // Remember the raw caret before numeric cleanup can move it to the end.
   if(event?.type==='input'&&(input===birthYear||input===birthMonth)&&/^\d+$/.test(input.value)&&input.selectionStart===input.value.length&&input.selectionEnd===input.value.length)birthInsertionAtEnd.add(event);
   const currentDate=today(),value=date.value.replace(/\D/g,'').slice(0,4),full=currentDate.slice(0,4)+'-'+value.slice(0,2)+'-'+value.slice(2),parsed=new Date(full+'T00:00:00Z');date.value=value;
   const calendarValid=/^\d{4}$/.test(value)&&Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===full,valid=calendarValid&&full<=currentDate;
   datePreview.value=!value?'YYMMDD':value.length<4?currentDate.slice(2,4)+value.padEnd(4,'_'):calendarValid?full.slice(2).replace(/-/g,''):'날짜 확인';
   datePreview.dataset.invalid=String(value.length===4&&!calendarValid);
   date.setCustomValidity(valid?'':'접수일을 MMDD 네 자리로 입력해 주세요. 미래 날짜는 입력할 수 없습니다.');fields.date.value=valid?full:today();
   let digits=phone.value.replace(/\D/g,'');if(digits.length===11&&digits.startsWith('010'))digits=digits.slice(3);digits=digits.slice(0,8);phone.value=digits.length>4?digits.slice(0,4)+'-'+digits.slice(4):digits;fields.phone.value=digits?'010-'+digits.slice(0,4)+'-'+digits.slice(4):'';
   if(event?.target.matches('[data-receipt-period]')&&event.target.checked)for(const option of periods)if(option!==event.target)option.checked=false;
   const period=periods.find(option=>option.checked)?.value||'',time=callTime.value.trim();
   periods[0].setCustomValidity(time&&!period?'통화 가능시간의 오전 또는 오후를 선택해 주세요.':'');callTime.setCustomValidity('');fields.callAvailability.value=[period,time].filter(Boolean).join(' ');
   for(const input of [birthYear,birthMonth,birthDay])input.value=input.value.replace(/\D/g,'').slice(0,input.maxLength);
   const year=/^\d{2}$/.test(birthYear.value)?'19'+birthYear.value:/^\d{4}$/.test(birthYear.value)?birthYear.value:'';
   fields.birthYear.value=year;fields.birthMonth.value=birthMonth.value;fields.birthDay.value=birthDay.value;
   const birthDate=year+'-'+birthMonth.value.padStart(2,'0')+'-'+birthDay.value.padStart(2,'0'),birthValue=new Date(birthDate+'T00:00:00Z');
   const complete=year&&birthMonth.value&&birthDay.value,birthValid=complete&&Number(year)>=1900&&Number.isFinite(birthValue.getTime())&&birthValue.toISOString().slice(0,10)===birthDate&&birthDate<=fields.date.value;
   birthDay.setCustomValidity(complete&&!birthValid?'올바른 생년월일을 입력해 주세요.':'');
  }
  function normalizeCallTime(){const value=callTime.value.normalize('NFKC').trim();if(/^\d+$/.test(value))callTime.value=value+' 시경';sync();}
  callTime.addEventListener('blur',normalizeCallTime);form.addEventListener('submit',normalizeCallTime,true);
  birthYear.addEventListener('blur',()=>{if(/^\d{2}$/.test(birthYear.value)){birthYear.value='19'+birthYear.value;birthYear.dispatchEvent(new Event('change',{bubbles:true}));}});
  form.addEventListener('input',sync,true);form.addEventListener('change',sync,true);
  for(const [input,next,lengths] of [[birthYear,birthMonth,[2,4]],[birthMonth,birthDay,[2]]])input.addEventListener('input',event=>{
   if(!birthInsertionAtEnd.has(event)||!event.inputType?.startsWith('insert')||event.isComposing||global.document.activeElement!==input||!lengths.includes(input.value.length)||input.selectionStart!==input.value.length||input.selectionEnd!==input.value.length)return;
   next.focus();
  });
  const male=form.querySelector('[name="gender"][value="남"]'),female=form.querySelector('[name="gender"][value="여"]');
  function focusGender(input){
   const changed=!input.checked;input.checked=true;input.focus();
   if(changed){input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
  }
  for(const input of [birthDay,male,female])input.addEventListener('keydown',event=>{
   if(event.defaultPrevented||event.key!=='Tab'||event.ctrlKey||event.altKey||event.metaKey||event.isComposing||global.document.activeElement!==input)return;
   const next=input===birthDay?(event.shiftKey?null:male):input===male?(event.shiftKey?birthDay:female):(event.shiftKey?male:null);
   if(!next||next.disabled)return;
   event.preventDefault();if(next===birthDay)next.focus();else focusGender(next);
  });
  form.addEventListener('reset',()=>{for(const input of form.querySelectorAll('input,select,textarea,button[type="submit"]'))input.disabled=false;form.dataset.requestKey=global.crypto.randomUUID();form.removeAttribute('data-saved');form.querySelector('[data-sales-error]').textContent='';delete form.querySelector('[data-sales-error]').dataset.state;global.setTimeout(()=>{date.value='';fields.consultationTime.value=clock().slice(0,5);sync();birthYear.dispatchEvent(new Event('change',{bubbles:true}));date.focus();},0);});
  form.querySelector('[data-receipt-close]').addEventListener('click',()=>{close();if(popup())global.close();});
  const timer=global.setInterval(()=>{form.querySelector('[data-receipt-clock]').textContent=clock();},1000);
  dialog.addEventListener('close',()=>{global.clearInterval(timer);dialog.classList.remove('receipt-dialog');dialog.setAttribute('aria-labelledby','tm-dialog-title');if(popup())global.close();},{once:true});
  global.KoreanInput?.attach(form);sync();date.focus();
 }
 function saved(form){if(!form)return;form.reset();const feedback=form.querySelector('[data-sales-error]');feedback.dataset.state='success';feedback.textContent='가접수로 저장했습니다. 새 접수를 입력해 주세요.';}
 global.ReceiptForm={markup,attach,saved};
})(window);
