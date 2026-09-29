(function(global){
 'use strict';
 const live=global.CNCHOME_LIVE;if(!live||live.user.role!=='employee')return;
 let data=null,error='',loading=false;
 const names=['workdays','daily','weekly','monthly'];
 function set(name,value,title){const el=global.document.getElementById('tm-head-'+name);if(el){el.textContent=value;el.title=title||'';}}
 function render(){
  const root=global.document.querySelector('.header-grades');if(!root)return;
  if(!data){for(const name of names)set(name,error?'조회 실패':'불러오는 중',error);root.dataset.state=error?'error':'loading';return;}
  root.dataset.state='ready';
  const prefix=data.isTest?'테스트 계정의 가상 DB 실적 · ':'';
  root.setAttribute('aria-label',(data.isTest?'테스트 실적 · ':'본인 실적 · ')+data.date+' 영업일 및 그레이드 현황');
  set('workdays',data.scheduleRegistered?data.workdays.total+'일 / '+data.workdays.elapsed+'일':'근무정보 미등록','이번 달 근무 가능일 / 오늘까지 진행일 · 인사정보의 근무요일·입사일·퇴사일 기준 · 별도 공휴일·회사 휴무일 제외 전');
  const counts=data.daily.count+'건',week=data.weekly;
  set('daily',data.policyRegistered?data.daily.count+' / '+(data.daily.target??'—')+'건':counts+' · 기준 미등록',prefix+'오늘 정상접수 / 일그레이드 시작 건수 · '+data.date);
  if(!data.general){set('weekly','별도 기준','팀장·관리자는 일반직원 주그레이드 대상이 아닙니다.');set('monthly',data.monthly.count+'건 · 별도 기준','팀장·관리자는 일반직원 월그레이드 대상이 아닙니다.');return;}
  set('weekly',!data.policyRegistered?week.count+'건 · 기준 미등록':!data.scheduleRegistered?'근무정보 미등록':week.target===null?'지급 기준 없음':(week.basis==='average'?'평균 ':'')+(week.value??0)+' / '+week.target+'건',prefix+week.start+' ~ '+week.end+' · 정상 '+week.count+'건 / 근무 가능 '+(week.availableDays??'미등록')+'일 · 현재 실적 / 목표 · 한 주 전체 근무 가능일 기준(입사일 반영)');
  set('monthly',data.monthly.count+'건 · '+(data.monthly.range||'기준 미등록'),prefix+'이번 달 본인 정상접수 · 현재 적용 구간'+(data.policyDate?' · '+data.policyDate+' 시작 기준':''));
 }
 async function load(){
  if(loading)return;loading=true;
  try{const response=await global.fetch('/grade-summary-api.php',{credentials:'same-origin',cache:'no-store'});const result=await response.json();if(!response.ok)throw Error(result.error||'조회 실패');if(!result.daily||!result.weekly||!result.monthly||!result.workdays)throw Error('조회 결과를 확인해 주세요.');data=result;error='';}
  catch(e){data=null;error=e.message;}finally{loading=false;render();global.dispatchEvent(new global.Event('cnc:grade-summary-updated'));}
 }
 global.GradeHeader={render,load,getState:()=>({data,error})};render();load();
 global.setInterval(()=>{if(!global.document.hidden)load();},5000);
 global.addEventListener('focus',load);global.addEventListener('cnc:sales-changed',load);
 global.document.addEventListener('visibilitychange',()=>{if(!global.document.hidden)load();});
 global.addEventListener('storage',event=>{if(event.key==='cnchome.sales.changed')load();});
})(window);
