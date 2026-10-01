(()=>{'use strict';
const live=window.CNCHOME_LIVE;if(!live||!['employee','admin'].includes(live.user.role))return;
const admin=live.user.role==='admin',teams={insurance:'보험팀',cosmetics:'화장품팀',health:'건강보조식품팀'};
let data=null,loading=false,error='',selectedDate='',requestedDate='',lateOnly=false,notice='';
const painted=new WeakMap();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const route=()=>location.hash.slice(1)||new URL(location.href).searchParams.get('page')||live.page||'home';
const day=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
function employeeMarkup(){
 const done=data?.checkedIn===true;
 const today=esc(data?.today||day());
 return `<div class="checkin-heading"><h3>오늘 출근</h3><time datetime="${today}">${today}</time></div><button type="button" class="action checkin-button ${done?'is-done':''}" data-checkin ${loading||!data||done?'disabled':''}>${done?'출근 완료':loading?'확인 중…':'출근'}</button>${error?`<p class="checkin-error" role="alert">${esc(error)}</p><button type="button" class="secondary" data-checkin-refresh ${loading?'disabled':''}>다시 확인</button>`:''}`;
}
function adminMarkup(){
 const ready=data?.date===selectedDate,all=ready?data.records:[],count=all.filter(r=>r.checkedIn).length,eligible=all.filter(r=>r.checkedIn&&!r.late&&!r.approved).length,late=all.filter(r=>r.late&&!r.approved).length,records=lateOnly?all.filter(r=>r.late&&!r.approved):all;
 return `<div class="checkin-heading"><div><h3>직원 출결 승인</h3></div><div class="checkin-controls"><label>출근일 <input type="date" data-checkin-date value="${esc(selectedDate)}"></label><button type="button" class="secondary" data-checkin-today>오늘</button><button type="button" class="secondary" data-checkin-refresh ${loading?'disabled':''}>새로고침</button></div></div><div class="checkin-approval-actions"><button type="button" class="action" data-checkin-approve-all ${loading||!ready||!eligible?'disabled':''}>정상 출근 일괄 승인 · ${eligible}명</button><button type="button" class="secondary" data-checkin-late aria-pressed="${lateOnly}">지각·늦은 로그인 개별 승인 · ${late}명</button></div><p class="checkin-rule">10:00 이후 출근 기록은 일괄 승인에서 제외합니다. 지각·늦은 로그인은 해당 직원 옆 개별 승인 버튼으로 확인합니다.</p><div class="checkin-summary"><strong>출근 ${ready?count+'명':'조회 중'}</strong><span>미등록 ${ready?all.length-count+'명':'조회 중'}</span><span>승인 완료 ${all.filter(r=>r.approved).length}명</span></div>${notice?`<p role="status">${esc(notice)}</p>`:''}${error?`<p class="checkin-error" role="alert">${esc(error)}</p>`:''}<div class="scroll"><table><thead><tr><th>직원</th><th>부서</th><th>출근일</th><th>출근 시간</th><th>상태</th><th>승인 관리</th></tr></thead><tbody>${records.map(r=>`<tr><td>${esc(r.employee)}${r.isTest?' <small class="checkin-test">테스트</small>':''}</td><td>${esc(teams[r.team]||r.team)}</td><td>${esc(r.date)}</td><td><strong>${esc(r.checkInTime||'—')}</strong></td><td>${r.approved?'승인 완료':r.late?'지각·개별 확인':r.checkedIn?'정상·승인 대기':'미등록'}</td><td>${r.approved?esc(r.approvedBy):r.checkedIn?`<button type="button" class="secondary" data-checkin-approve-one="${r.employeeId}" ${loading?'disabled':''}>개별 승인</button>`:'—'}</td></tr>`).join('')||`<tr><td colspan="6">${ready?(lateOnly?'개별 승인 대기 직원이 없습니다.':'등록된 직원이 없습니다.'):'출근 기록을 불러오는 중입니다.'}</td></tr>`}</tbody></table></div>`;
}
function paint(){
 for(const el of document.querySelectorAll('[data-checkin-panel],[data-admin-checkins]')){
  const html=admin?adminMarkup():employeeMarkup();if(painted.get(el)===html)continue;painted.set(el,html);
  const dateFocused=el.contains(document.activeElement)&&document.activeElement.hasAttribute('data-checkin-date');
  el.innerHTML=html;if(dateFocused)el.querySelector('[data-checkin-date]')?.focus({preventScroll:true});
 }
}
async function load(body){
 if(loading)return;loading=true;error='';requestedDate=selectedDate;paint();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{
  const response=await fetch('/attendance-api.php?role='+live.user.role+(admin?'&date='+encodeURIComponent(requestedDate):''),{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json','X-CSRF-Token':live.csrf},...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'출근 기록을 확인하지 못했습니다.');
  if(!Array.isArray(result.records)||typeof result.today!=='string')throw Error('출근 기록을 다시 확인해 주세요.');
  const changed=JSON.stringify(data)!==JSON.stringify(result);data=result;if(body&&admin)notice=(result.approvedCount||0)+'명의 출결을 승인했습니다.';
  if(changed&&!admin)window.dispatchEvent(new Event('cnc:attendance-changed'));
 }catch(e){error=e.name==='AbortError'?'응답이 지연되었습니다. 다시 확인을 눌러 출근 기록 여부를 확인해 주세요.':e.message;}
 finally{clearTimeout(timer);loading=false;paint();if(admin&&selectedDate!==requestedDate)load();}
}
window.AttendanceWorkspace={homePanel:()=>'<section class="checkin-panel" aria-label="오늘 출근" data-checkin-panel>'+employeeMarkup()+'</section>',records:()=>data?.records||[]};
function mount(){
 const main=document.getElementById('tm-main');if(!main)return;
 if(admin&&route()==='adminAttendance'){selectedDate=selectedDate||day();if(!data&&!loading&&!error)load();}
 if(admin&&route()==='adminAttendance'&&!main.querySelector('[data-admin-checkins]')){const section=document.createElement('section');section.className='panel checkin-admin';section.dataset.adminCheckins='';main.prepend(section);selectedDate=selectedDate||day();load();}
 if(!admin&&main.querySelector('[data-checkin-panel]')&&!data&&!loading&&!error)load();
 paint();
}
document.addEventListener('click',event=>{if(event.target.closest('[data-checkin]')){if(!admin&&!data?.checkedIn&&!loading)load({action:'checkIn'});return;}if(event.target.closest('[data-checkin-refresh]')){load();return;}if(event.target.closest('[data-checkin-today]')){selectedDate=data?.today||day();load();}});
document.addEventListener('click',event=>{if(!admin||loading)return;const one=event.target.closest('[data-checkin-approve-one]');if(one){load({action:'approveOne',date:selectedDate,employeeId:Number(one.dataset.checkinApproveOne)});return;}if(event.target.closest('[data-checkin-approve-all]')){load({action:'approveAll',date:selectedDate});return;}if(event.target.closest('[data-checkin-late]')){lateOnly=!lateOnly;paint();}});
document.addEventListener('change',event=>{if(event.target.matches('[data-checkin-date]')&&/^\d{4}-\d{2}-\d{2}$/.test(event.target.value)){selectedDate=event.target.value;load();}});
const active=()=>admin?route()==='adminAttendance':['home','attendance'].includes(route());
window.addEventListener('focus',()=>{if(active())load();});window.addEventListener('hashchange',()=>{mount();if(active())load();});
new MutationObserver(mount).observe(document.getElementById('tm-main'),{childList:true,subtree:true});
if(!admin)load();mount();setInterval(()=>{if(!document.hidden&&active())load();},60000);
})();
