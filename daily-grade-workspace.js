(function(global){
 'use strict';
 const live=global.CNCHOME_LIVE;if(!live||live.user.role!=='admin')return;
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=v=>v===null?'기준 미등록':Number(v).toLocaleString('ko-KR')+'원';
 const department=()=>{const value=new URL(global.CNCPageNavigation?.url()||global.location.href).searchParams.get('department')||new URL(global.CNCPageNavigation?.url()||global.location.href).searchParams.get('team');return ['insurance','cosmetics','health'].includes(value)?value:'insurance';};
 let bridge,date=today(),data=null,error='',loading=false;
 const handles=page=>['adminDaily','adminDailyHistory'].includes(page);
 const active=()=>handles(global.location.hash.slice(1)||new URL(global.CNCPageNavigation?.url()||global.location.href).searchParams.get('page')||live.page);
 function render(){
  if(data&&data.department!==department())data=null;
  return '<section class="panel"><h2>직원별 일 그레이드</h2><p class="sub">각 직원의 정상 접수 달성액을 누적 계산합니다. 버튼 확인과 별개로 달성액 전액을 자동 수령·선지급 처리합니다.</p><label>실적일 <input type="date" data-daily-admin-date value="'+date+'" max="'+today()+'"></label><p role="status">'+esc(error||(!data?'불러오는 중입니다.':''))+'</p>'+(!data?'':'<div class="scroll"><table><thead><tr><th>직원</th><th>본인 정상 실적</th><th>달성 총액</th><th>자동 수령·선지급액</th><th>자동 처리 건수</th></tr></thead><tbody>'+data.rows.map(r=>'<tr><td>'+esc(r.name)+(r.isTest?' · 테스트':'')+'</td><td>'+r.count+'건</td><td>'+money(r.earned)+'</td><td>'+money(r.received)+'</td><td>'+r.paidCount+'건'+'</td></tr>').join('')+'</tbody></table></div>')+'<p class="sub">월 급여·주휴수당과 별도 관리합니다. 계좌 이체를 실행하는 기능은 아닙니다.</p></section>';
 }
 async function load(){
  if(loading||!active())return;loading=true;const requested=date,requestedDepartment=department();
  try{const response=await global.fetch('/daily-grade-api.php?date='+encodeURIComponent(requested)+'&department='+department(),{credentials:'same-origin',cache:'no-store',headers:{'X-CNC-Role':'admin'}});const result=await response.json();if(!response.ok)throw Error(result.error||'조회 실패');if(requested===date&&requestedDepartment===department()){data={...result,department:requestedDepartment};error='';}}
  catch(e){if(requested===date&&requestedDepartment===department()){data=null;error=e.message;}}
  finally{loading=false;if(active())bridge.render();if(requested!==date||requestedDepartment!==department())load();}
 }
 function chrome(){if(active()){const status=bridge.root.querySelector('#live-page-status');if(status)status.textContent='개인별 실적·자동 선지급: DB 연결';}}
 function init(options){bridge=options;bridge.root.addEventListener('change',e=>{if(!e.target.matches('[data-daily-admin-date]'))return;date=e.target.value||today();data=null;error='';load();bridge.render();});global.addEventListener('hashchange',load);global.addEventListener('focus',load);global.setInterval(()=>{if(!global.document.hidden)load();},5000);load();}
 global.DailyGradeWorkspace={handles,render,init,chrome};
})(window);
