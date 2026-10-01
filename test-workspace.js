(function(){
'use strict';
const live=window.CNCHOME_LIVE;if(!live||!(live.isTestAccount??/^user[1-6]$/.test(live.user.username||''))||live.user.role!=='employee'||!window.HRWorkspace){delete window.CNCEmployeeTestState;return;}
const workspace=window.HRWorkspace,oldHandles=workspace.handles,oldRender=workspace.render,oldChrome=workspace.chrome;
const pages=['home','sales','attendance','as'];let data=null,busy=false,error='',attendanceExpanded=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const table=(heads,rows)=>'<div class="scroll"><table><thead><tr>'+heads.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
const render=page=>{
 const title='테스트 직원 · '+({home:'홈',sales:'실적',attendance:'출결',as:'A/S'}[page]);
 const message='<p class="notice">가상 기능 테스트 자료입니다. 변경 사항은 테스트 계정에 저장됩니다. 실제 실적·지급 대상이 아닙니다.</p>'+(error?'<p role="alert">'+esc(error)+'</p>':'');
 const top='<h2>'+title+'</h2>'+message;
 if(page==='attendance')return '<details class="test-attendance-disclosure" data-test-attendance '+(attendanceExpanded?'open':'')+'><summary><span>'+title+'</span><small>'+(data?data.state.attendance.length+'일':'불러오는 중')+'</small></summary><div class="test-attendance-body">'+message+(data?table(['날짜','상태'],data.state.attendance.slice().reverse().map(r=>[r.date,r.status].map(esc))):'<p>테스트 자료를 불러오는 중입니다.</p>')+'</div></details>';
 if(!data)return top+'<p>테스트 자료를 불러오는 중입니다.</p>';
 const {sales,attendance}=data.state;const normal=sales.filter(r=>r.status==='정상').length,pending=sales.filter(r=>r.status==='가접수').length,as=sales.filter(r=>r.status==='A/S').length;
 if(page==='home')return top+table(['전체 접수','정상','가접수','A/S','출결 내역'],[[sales.length+'건',normal+'건',pending+'건',as+'건',attendance.length+'일']])+'<p>실적 메뉴에서 접수 상태 변경, A/S 메뉴에서 해결 처리, 홈에서 출근 버튼으로 출근을 기록할 수 있습니다.</p><a href="#payslips">급여 명세서 확인·수정요청 테스트 →</a><p class="sub">급여 명세서는 저장 시점의 정상 접수·출결을 반영한 가상 예시입니다. 이후 실적 변경은 그레이드 화면에 반영되며 명세서는 관리자 재산정 시 갱신됩니다.</p>';
 const rows=sales.filter(r=>page!=='as'||r.status==='A/S').slice().reverse();
 return top+table(['접수일','가상 고객','접수 코드','상품','상태','테스트 변경'],rows.map(r=>[r.date,r.name,r.carrier,r.kind,r.status].map(esc).concat('<select aria-label="'+esc(r.name)+' 접수 상태" data-test-status="'+r.id+'" '+(busy?'disabled':'')+'>'+['정상','가접수','A/S'].map(s=>'<option '+(r.status===s?'selected':'')+'>'+s+'</option>').join('')+'</select>')))+(rows.length?'':'<p>처리할 내역이 없습니다.</p>');
};
workspace.handles=page=>pages.includes(page)||oldHandles(page);
workspace.render=page=>pages.includes(page)?window.CNCEmployeePages[page]()+render(page):oldRender(page);
workspace.chrome=()=>{oldChrome();if(pages.includes(location.hash.slice(1)||live.page||'home')){const el=document.querySelector('#live-page-status');if(el)el.textContent='테스트 직원 전용 · 가상 실적·출결 DB 연결';}};
function refresh(){window.dispatchEvent(new HashChangeEvent('hashchange'));}
async function request(body){busy=true;error='';refresh();try{const response=await fetch('/test-api.php',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':live.csrf},...(body?{body:JSON.stringify({...body,revision:data.revision})}:{})});const result=await response.json();if(!response.ok)throw Error(result.error);data=result;window.CNCEmployeeTestState=result.state;}catch(e){error=e.message;}finally{busy=false;refresh();}}
document.addEventListener('change',e=>{if(e.target.matches('[data-test-status]')&&!busy)request({action:'status',id:Number(e.target.dataset.testStatus),status:e.target.value});});
document.addEventListener('toggle',e=>{if(e.target.matches('[data-test-attendance]'))attendanceExpanded=e.target.open;},true);
request();
})();
