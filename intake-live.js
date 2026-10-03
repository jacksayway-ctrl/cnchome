(()=>{
 'use strict';
 const root=document.querySelector('[data-intake-live]');if(!root)return;
 const form=root.querySelector('[data-live-filters]'),body=root.querySelector('[data-live-rows]'),status=root.querySelector('[data-live-status]');
 const teams={insurance:'보험',cosmetics:'화장품',health:'건강보조식품'},labels={pending:'가접수',normal:'정상접수',as:'A/S'},shortLabels={pending:'가',normal:'정',as:'AS'};
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const calendar=root.querySelector('[data-live-calendar]'),calendarInput=root.querySelector('[data-live-calendar-month]'),calendarBody=root.querySelector('[data-live-calendar-days]'),calendarMessage=root.querySelector('[data-live-calendar-message]');
 function currentKoreaMonth(){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit'}).formatToParts(new Date());return parts.find(p=>p.type==='year').value+'-'+parts.find(p=>p.type==='month').value;}
 const amount=value=>Math.max(0,Math.floor(Number(value)||0)),number=value=>amount(value).toLocaleString('ko-KR');
 let page=1,pages=1,selected='',paused=false,busy=false,queued=false,version=0,latest=0,signature='',typing=false,timer,seen=false,inputUntil=0;
 let calendarMonth=currentKoreaMonth(),calendarSignature='',renderedCalendarMonth='';calendarInput.value=calendarMonth;
 const fresh=new Set();
 function filterChanged(){version++;page=1;latest=0;seen=false;fresh.clear();signature='';root.querySelector('[data-live-arrivals]').hidden=true;load(true);}
 function changeCalendarMonth(month){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month<'2000-01'||month>'2100-12'){calendarInput.value=calendarMonth;return;}
  if(month===calendarMonth)return;calendarMonth=month;calendarInput.value=month;version++;calendarSignature='';renderedCalendarMonth='';calendarBody.replaceChildren();root.querySelector('[data-live-calendar-totals]').replaceChildren();calendarBody.setAttribute('aria-busy','true');calendarMessage.textContent='실적 달력을 불러오는 중입니다.';load(true);
 }
 function shiftCalendarMonth(offset){
  let [year,month]=calendarMonth.split('-').map(Number);month+=offset;if(month<1){year--;month=12;}if(month>12){year++;month=1;}if(year<2000||year>2100)return;changeCalendarMonth(String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0'));
 }
 function drawCalendar(data){
  if(!data||data.month!==calendarMonth)return;
  const next=JSON.stringify(data);calendarBody.setAttribute('aria-busy','false');calendarMessage.textContent='';if(next===calendarSignature)return;
  const [year,month]=data.month.split('-').map(Number),first=new Date(0);first.setFullYear(year,month-1,1);first.setHours(12,0,0,0);
  const last=new Date(0);last.setFullYear(year,month,0);last.setHours(12,0,0,0);const daysInMonth=last.getDate(),offset=first.getDay(),byDate=new Map((data.days||[]).map(day=>[day.date,day]));
  root.querySelector('[data-live-calendar-totals]').innerHTML=Object.entries(teams).map(([key,label])=>{const counts=data.totals?.[key]||{};return `<div class="intake-live-calendar-total"><strong>${esc(label)}</strong>${Object.entries(labels).map(([state,title])=>`<span class="${state}">${title} <b>${number(counts[state])}</b>건</span>`).join('')}</div>`;}).join('');
  let cells='';for(let index=0;index<Math.ceil((offset+daysInMonth)/7)*7;index++){
   const day=index-offset+1;if(index%7===0)cells+='<tr>';
   if(day<1||day>daysInMonth)cells+='<td class="intake-live-calendar-outside"></td>';
   else{
    const date=data.month+'-'+String(day).padStart(2,'0'),record=byDate.get(date)||{},isFuture=date>data.today,isToday=date===data.today;
    const entries=isFuture?'':Object.entries(teams).map(([key,label])=>{const counts=record[key]||{};if(!Object.keys(labels).some(state=>amount(counts[state])>0))return '';return `<div class="intake-live-calendar-department"><strong>${esc(label)}</strong><div class="intake-live-calendar-counts">${Object.entries(labels).map(([state,title])=>`<span class="${state}${amount(counts[state])===0?' intake-live-calendar-zero':''}" aria-label="${esc(label+' '+title+' '+number(counts[state])+'건')}" title="${esc(title+' '+number(counts[state])+'건')}"><small>${shortLabels[state]}</small><b>${number(counts[state])}</b></span>`).join('')}</div></div>`;}).join('');
    cells+=`<td class="${isToday?'intake-live-calendar-today':''}${isFuture?' intake-live-calendar-future':''}"><time class="intake-live-calendar-date" datetime="${esc(date)}" aria-label="${esc(date+(isToday?' 오늘':''))}">${day}</time>${entries}</td>`;
   }
   if(index%7===6)cells+='</tr>';
  }
  calendarBody.innerHTML=cells;calendarSignature=next;renderedCalendarMonth=data.month;calendar.setAttribute('aria-label',year+'년 '+month+'월 부서별 실적 달력');
 }
 function draw(data){
  drawCalendar(data.calendar);
  const next=JSON.stringify(data.records);if(next!==signature){
   for(const row of data.records)if(seen&&Number(row.id)>latest)fresh.add(row.id);
   const focused=document.activeElement?.closest('[data-live-record]')?.dataset.liveRecord;
   body.innerHTML=data.records.length?data.records.map(r=>`<tr class="${fresh.has(r.id)?'intake-live-new':''}"><td>${esc(r.receivedAt||'—')}</td><td>${esc(r.date)}</td><td>${esc(teams[r.department]||r.department)}</td><td>${esc(r.employee)}</td><td><strong>${esc(r.customer)}</strong>${fresh.has(r.id)?'<span class="intake-live-new-badge">새 접수</span>':''}</td><td>${esc(r.phone)}</td><td>${esc(r.region||'—')}</td><td><span class="intake-status ${esc(r.status)}">${esc(labels[r.status]||r.status)}</span></td><td><a href="${esc(r.url)}" data-live-record="${esc(r.id)}">보기·수정</a></td></tr>`).join(''):'<tr><td colspan="9">조회 조건에 맞는 접수가 없습니다.</td></tr>';
   if(focused)body.querySelector('[data-live-record="'+CSS.escape(focused)+'"]')?.focus({preventScroll:true});signature=next;
  }
  for(const button of root.querySelectorAll('[data-live-filter]')){const key=button.dataset.liveFilter;button.setAttribute('aria-pressed',String(key===selected));button.querySelector('strong').textContent=(key?data.counts[key]:Object.values(data.counts).reduce((a,b)=>a+b,0)).toLocaleString('ko-KR');}
  page=data.page;pages=data.pages;root.querySelector('[data-live-pagination]').textContent=page+' / '+pages+' 페이지 · '+data.total.toLocaleString('ko-KR')+'건';
  root.querySelector('[data-live-page=prev]').disabled=page<=1;root.querySelector('[data-live-page=next]').disabled=page>=pages;
  if(data.newCount>0){const notice=root.querySelector('[data-live-arrivals]');notice.hidden=false;notice.textContent='새 접수 '+data.newCount+'건이 들어왔습니다.'+(page>1?' 첫 페이지에서 확인하세요.':'');}
  latest=Math.max(latest,data.latestId);seen=true;status.textContent=(paused?'자동 갱신 일시정지 · ':'5초마다 자동 갱신 · ')+'마지막 확인 '+data.checkedAt;
 }
 async function load(force=false){
  if(busy){if(force)queued=true;return;}
  if(!force&&(paused||document.hidden||typing||Date.now()<inputUntil))return;
  busy=true;const requestVersion=version,controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  const params=new URLSearchParams({role:'admin',team:form.elements.team.value,q:form.elements.q.value.trim(),status:selected,p:String(page),after:String(latest),calendarMonth});
  try{
   const response=await fetch('/intake-live-api.php?'+params,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
   const data=await response.json();if(!response.ok)throw Error(data.error||'접수 목록을 불러오지 못했습니다.');
   if(requestVersion===version)draw(data);
  }catch(error){if(requestVersion===version){status.textContent=error.name==='AbortError'?'응답 지연 · 다시 확인 중입니다.':error.message;calendarBody.setAttribute('aria-busy','false');if(renderedCalendarMonth!==calendarMonth)calendarMessage.textContent='실적 달력을 불러오지 못했습니다. 지금 새로고침을 눌러 다시 확인하세요.';}}
  finally{clearTimeout(timeout);busy=false;if(queued){queued=false;load(true);}}
 }
 form.addEventListener('submit',e=>{e.preventDefault();clearTimeout(timer);filterChanged();});
 form.addEventListener('reset',()=>{setTimeout(()=>{selected='';filterChanged();},0);});
 form.elements.team.addEventListener('change',filterChanged);
 form.elements.q.addEventListener('compositionstart',()=>{typing=true;clearTimeout(timer);version++;});
 form.elements.q.addEventListener('compositionend',()=>{typing=false;clearTimeout(timer);timer=setTimeout(filterChanged,300);});
 form.elements.q.addEventListener('input',()=>{inputUntil=Date.now()+600;version++;clearTimeout(timer);if(!typing)timer=setTimeout(filterChanged,300);});
 calendarInput.addEventListener('change',()=>changeCalendarMonth(calendarInput.value));
 root.addEventListener('click',event=>{
  const target=event.target.closest('button,a');if(!target)return;
  if(target.hasAttribute('data-live-refresh'))load(true);
  if(target.hasAttribute('data-live-calendar-prev'))shiftCalendarMonth(-1);
  if(target.hasAttribute('data-live-calendar-next'))shiftCalendarMonth(1);
  if(target.hasAttribute('data-live-calendar-today'))changeCalendarMonth(currentKoreaMonth());
  if(target.hasAttribute('data-live-pause')){paused=!paused;target.setAttribute('aria-pressed',String(paused));target.textContent=paused?'자동 갱신 다시 시작':'자동 갱신 일시정지';if(paused)status.textContent='자동 갱신 일시정지';else load(true);}
  if(target.hasAttribute('data-live-filter')){selected=target.dataset.liveFilter;filterChanged();}
  if(target.hasAttribute('data-live-page')){page=Math.max(1,Math.min(pages,page+(target.dataset.livePage==='prev'?-1:1)));version++;load(true);}
  if(target.hasAttribute('data-live-record')&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey){event.preventDefault();const child=window.open(target.href,'cnc-intake-management','popup,width='+Math.min(1360,screen.availWidth)+',height='+Math.min(920,screen.availHeight)+',resizable=yes,scrollbars=yes');if(child)child.focus();else location.assign(target.href);}
 });
 window.addEventListener('focus',()=>load());window.addEventListener('cnc:sales-changed',()=>load());
 window.addEventListener('storage',e=>{if(e.key==='cnchome.sales.changed')load();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});
 setInterval(()=>load(),5000);load(true);
})();
