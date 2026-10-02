(function(global){
 'use strict';
 const live=global.CNCHOME_LIVE;if(!live||live.user.role!=='employee')return;
 const testAccount=live.isTestAccount??/^user[1-6]$/.test(live.user.username||'');
 let data=null,error='',loading=false;
 const names=['workdays','daily','weekly','monthly'];
 function set(name,value,title){const el=global.document.getElementById('tm-head-'+name);if(el){el.textContent=value;el.title=title||'';}}
 function render(){
  const root=global.document.querySelector('.header-grades');if(!root)return;
  if(!data){for(const name of names)set(name,error?'조회 실패':'불러오는 중',error);root.dataset.state=error?'error':'loading';return;}
  root.dataset.state='ready';
  for(const name of ['daily','weekly','monthly']){const item=global.document.getElementById('tm-head-'+name)?.closest('.header-grade-item');if(item)item.style.display=data.gradeAvailable===false||data.gradeVisibility?.[name]===false?'none':'';}
  const prefix=data.isTest?'테스트 계정의 가상 DB 실적 · ':'';
  root.setAttribute('aria-label',(data.isTest?'테스트 실적 · ':'본인 실적 · ')+data.date+' 영업일 및 그레이드 현황');
  set('workdays',data.workdays.total+'일 / '+data.workdays.elapsed+'일','이번 달 전체 최대 영업일 / 오늘까지 진행된 영업일 · 관리자 영업일 달력 기준 · 입사일과 무관');
  if(data.gradeAvailable===false)return;
  const day=data.daily,week=data.weekly,month=data.monthly;
  const won=n=>Number(n||0).toLocaleString('ko-KR')+'원';
  const tierMoney=t=>t?(t.hourly?'시급 '+won(t.hourly)+(t.amount?' · 수당 '+won(t.amount):''):won(t.amount)):'기준 미등록';
  const tierProgress=(current,next)=>next?(current&&current.min>0?current.min+'건 구간 → ':'목표 ')+next.min+'건 · '+tierMoney(next):current?'최고 구간 · '+tierMoney(current):'지급 기준 없음';
  set('daily',day.count+'건 / '+(!day.eligible?'별도 기준':!data.policyRegistered||day.amount==null?'기준 미등록':'누적 '+won(day.amount)),prefix+'오늘 본인 정상 실적 / 달성한 건별 지급액의 누적 합계 · '+day.target+'건부터 '+day.paidCount+'건 × '+won(day.perCase)+' · 수령 '+won(day.paid)+' · 다음 '+day.nextTarget+'건 달성 시 +'+won(day.perCase)+' · '+data.date);
  if(!data.general){set('weekly','별도 기준','팀장·관리자는 일반직원 주그레이드 대상이 아닙니다.');set('monthly',month.count+'건 · 별도 기준','팀장·관리자는 일반직원 월그레이드 대상이 아닙니다.');return;}
  set('weekly',!data.policyRegistered?week.count+'건 · 기준 미등록':!data.scheduleRegistered?'근무정보 미등록':(week.basis==='average'?'평균 ':'')+(week.value??0)+'건 / '+won(week.amount),prefix+week.start+' ~ '+week.end+' · 월~금 5일 기준 · 정상 '+week.count+'건 ÷ 이번 주 근무가능일 '+(week.availableDays??'미등록')+'일 · 현재 실적과 적용일 비율로 계산한 금액 · '+(week.complete?'주간 집계 완료':'이번 주 진행 중')+' · 다음 목표 '+tierProgress(week.currentTier,week.nextTier));
  const next=month.nextTier,current=month.currentTier;
  set('monthly',month.count+'건 / '+(!data.policyRegistered?'기준 미등록':(month.range||'구간 없음')+(next?' → '+next.min+'건 · '+tierMoney(next):current?' · 최고 구간 · '+tierMoney(current):'')),prefix+'이번 달 본인 정상 실적 · 현재 구간 '+tierMoney(current)+' · 다음 구간 진입 건수와 해당 시급·수당 · 월 급여 총액 아님'+(data.policyDate?' · '+data.policyDate+' 시작 기준':''));
 }
 async function load(){
  if(loading)return;loading=true;
  try{const response=await global.fetch('/grade-summary-api.php',{credentials:'same-origin',cache:'no-store'});const result=await response.json();if(!response.ok)throw Error(result.error||'조회 실패');if(!result.daily||!result.weekly||!result.monthly||!result.workdays)throw Error('조회 결과를 확인해 주세요.');if(result.isTest&&!testAccount)throw Error('본인 실적 정보를 다시 확인해 주세요.');const before=JSON.stringify(live.gradeVisibility?.[live.user.department]);data=result;error='';if(result.gradeVisibility){live.gradeVisibility={...live.gradeVisibility,[live.user.department]:result.gradeVisibility};if(before!==JSON.stringify(result.gradeVisibility))global.dispatchEvent(new global.Event('cnc:grade-visibility-updated'));}}
  catch(e){data=null;error=e.message;}finally{loading=false;render();global.dispatchEvent(new global.Event('cnc:grade-summary-updated'));}
 }
 global.GradeHeader={render,load,getState:()=>({data,error})};render();load();
 global.setInterval(()=>{if(!global.document.hidden)load();},5000);
 global.addEventListener('focus',load);global.addEventListener('cnc:sales-changed',load);
 global.document.addEventListener('visibilitychange',()=>{if(!global.document.hidden)load();});
 global.addEventListener('storage',event=>{if(event.key==='cnchome.sales.changed')load();});
})(window);
