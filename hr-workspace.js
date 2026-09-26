(function(global){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Number(n||0).toLocaleString('ko-KR')+'원';
const labels={draft:'작성 중',published:'직원 확인 대기',requested:'수정요청',confirmed:'확정'};
const teams={insurance:'보험팀',cosmetics:'화장품팀',health:'식품팀'};
const routes=['adminStaff','adminStaffRegister','adminPayroll','adminBank','adminCorrections','payslips'];
let bridge,store,dialog,busy=false,filter='';
const live=()=>global.CNCHOME_LIVE,admin=()=>live()?.user.role==='admin';
const today=()=>store?.today||new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date());
const employee=id=>store.employees.find(e=>e.id===Number(id));
const payroll=id=>store.payroll.find(e=>e.id===Number(id));
const input=(label,name,value='',type='text',attrs='')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
const select=(label,name,options,value)=>`<label>${label}<select name="${name}">${options.map(([v,t])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
const button=(text,action,id='',cls='secondary')=>`<button type="button" class="${cls}" data-hr="${action}" data-id="${id}">${text}</button>`;
const table=(heads,rows)=>`<div class="hr-table"><table><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(v=>`<td>${v}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${heads.length}">등록된 내역이 없습니다.</td></tr>`}</tbody></table></div>`;
const section=(title,body)=>`<fieldset><legend>${title}</legend><div class="hr-fields">${body}</div></fieldset>`;
const stateTag=p=>`<span class="hr-state ${esc(p.status)}">${labels[p.status]}</span>`;
function termEnd(start,term){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start))return '';
 const d=new Date(start+'T00:00:00Z');if(!Number.isFinite(d.getTime()))return '';
 if(term==='week'){d.setUTCDate(d.getUTCDate()+6);return d.toISOString().slice(0,10);}
 const m={month:1,quarter:3,year:12,twoYears:24}[term];if(!m)return '';
 const day=d.getUTCDate(),end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+m+1,0)),max=end.getUTCDate();
 return new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth(),day>max?max:day-1)).toISOString().slice(0,10);
}
function open(title,body){dialog.innerHTML=`<div class="hr-dialog-top"><h2>${title}</h2>${button('닫기','close')}</div><div class="hr-paper">${body}</div>`;dialog.showModal();dialog.scrollTop=0;}
function message(error){const el=dialog.open?dialog.querySelector('[role=alert]'):bridge.root.querySelector('#hr-page-error');if(el)el.textContent=error.message;else bridge.toast(error.message);}
async function api(body){
 const response=await fetch('/hr-api.php',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json','X-CSRF-Token':live().csrf}:{},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json();if(!response.ok)throw Error(data.error||'처리하지 못했습니다.');store=data;return data;
}
function toolbar(title,actions=''){return `<div class="row"><h2>${title}</h2><div class="hr-inline">${actions}${button('새로고침','refresh')}</div></div><p id="hr-page-error" class="hr-error" role="alert"></p>`;}
function staffList(){return toolbar('직원 목록',button('＋ 직원 등록','new','','action'))+`<p class="sub">실제 등록 ${store.employees.length}명 · 사번은 등록 시 자동 발급됩니다. 테스트 직원은 실제 직원과 구분해 사용하세요.</p>`+table(['사번 / 이름','소속 / 직책','연락처','기본급여','로그인','관리'],store.employees.map(e=>[esc(e.employeeNo)+'<br><strong>'+esc(e.profile.name)+'</strong>',esc(teams[e.profile.team])+' / '+esc(e.profile.role),esc(e.profile.phone),esc(e.profile.payType)+' '+money(e.profile.payAmount),e.userId?'연결됨':'미연결',button('상세·수정','edit',e.id)]));}
function staffForm(id){
 const e=employee(id),p=e?.profile||{},date=today(),days=p.workDays||['월','화','수','목','금'];
 open(e?'직원 정보 수정':'직원 등록 · 기본 양식',`<form data-hr-form="staff" data-id="${e?.id||0}" data-revision="${e?.revision||0}"><p class="hr-muted">씨앤씨 인사기록 · 필수 항목 * · 사번 ${esc(e?.employeeNo||'cnc'+date.replaceAll('-','')+' + 자동 순번')}</p><div class="hr-sheet">
 ${section('기본정보',input('이름 *','name',p.name||'','text','required maxlength="60"')+input('연락처 *','phone',p.phone||'','tel','required maxlength="20"')+input('생년월일','birthDate',p.birthDate||'','date')+input('이메일','email',p.email||'','email','maxlength="120"')+`<div class="hr-span hr-inline">${button('주소 검색','address')}<span class="hr-muted">검색 후 상세주소를 입력하세요.</span></div>`+input('우편번호','postcode',p.postcode||'')+input('기본주소','address',p.address||'','text','maxlength="240"')+`<div class="hr-span">${input('상세주소','addressDetail',p.addressDetail||'','text','maxlength="240"')}</div><div id="hr-postcode" class="hr-span" hidden></div>`)}
 ${section('소속·근무 조건',select('소속 *','team',Object.entries(teams),p.team||'insurance')+select('직책 *','role',['상담원','팀장','관리자'].map(v=>[v,v]),p.role||'상담원')+input('입사일 *','startDate',p.startDate||date,'date','required')+select('재직 상태','employment',['재직','휴직','퇴사'].map(v=>[v,v]),p.employment||'재직')+input('퇴사일','endDate',p.endDate||'','date')+select('유급 주휴일','weeklyHoliday',[['토','토요일'],['일','일요일']],p.weeklyHoliday||'일')+`<div class="hr-span hr-inline">근무요일 ${['월','화','수','목','금'].map(v=>`<label><input type="checkbox" name="workDays" value="${v}" ${days.includes(v)?'checked':''}>${v}</label>`).join('')}</div>`+input('근무장소','workplace',p.workplace||'')+input('담당업무','duties',p.duties||''))}
 ${section('급여·지급 계좌',select('급여 방식','payType',[['시급제','시급제'],['월급제','월급제']],p.payType||'시급제')+input('기본 시급 / 월 기본급 (원) *','payAmount',p.payAmount??15000,'number','required min="1" max="1000000000" step="1"')+input('임금 적용일','wageEffective',p.wageEffective||date,'date')+input('은행명','bank',p.bank||'','text','maxlength="50"')+input('계좌번호','accountNumber',p.accountNumber||'','text','inputmode="numeric" maxlength="40"')+input('예금주','accountHolder',p.accountHolder||p.name||'','text','maxlength="60"'))}
 ${section('계약·비고',`<div class="hr-span hr-inline hr-terms">${[['week','교육 1주'],['month','1개월'],['quarter','3개월'],['year','1년'],['twoYears','2년']].map(([v,t])=>`<label><input type="radio" name="contractTerm" value="${v}" ${p.contractTerm===v?'checked':''}>${t}</label>`).join('')}${button('기간 선택 해제','clear-term')}</div>`+input('계약 개시일','contractStart',p.contractStart||date,'date')+input('계약 종료일','contractEnd',p.contractEnd||'','date')+select('계약 구분','contractType',[['무기계약','기간의 정함 없음'],['기간제','기간제']],p.contractType||'무기계약')+`<label class="hr-span">관리 메모<textarea name="memo" maxlength="1000" rows="2">${esc(p.memo||'')}</textarea></label><p class="hr-span hr-muted">기간을 선택하면 개시일 기준 종료일을 자동 계산합니다. 종료일은 마지막 계약일입니다.</p>`)}
 <fieldset class="hr-span"><legend>직원 로그인 연결</legend>${e?.userId?'<p class="hr-muted">직원 계정이 연결되어 있습니다. 직책 선택으로 관리자 권한이 부여되지는 않습니다.</p>':`<div class="hr-fields">${select('기존 직원 계정 연결','accountId',[['','선택 안 함'],...store.accounts.map(a=>[a.id,a.username+' · '+a.display_name])],'')}${input('또는 새 직원 비밀번호 (12자 이상)','password','','password','minlength="12" maxlength="72" autocomplete="new-password"')}<p class="hr-span hr-muted">새 계정 아이디는 자동 발급 사번입니다. 두 항목을 비우면 계정 없이 인사정보만 저장합니다.</p></div>`}</fieldset>
 </div><p class="hr-error" role="alert"></p><div class="hr-actions"><button class="action" type="submit">${e?'변경 저장':'직원 등록'}</button>${button('취소','close')}<span class="hr-muted">저장하면 DB에 반영됩니다.</span></div></form>`);
}
function sortedRows(){return [...store.payroll].sort((a,b)=>(b.status==='confirmed')-(a.status==='confirmed')||(b.confirmed_at||'').localeCompare(a.confirmed_at||'')||b.month.localeCompare(a.month)||b.id-a.id);}
function payrollList(){
 const rows=sortedRows().filter(p=>!filter||p.status===filter);
 return toolbar('급여·지급 관리',button('＋ 이번 달 급여 작성','pay-new','','action'))+`<p class="sub">기본액 자동 계산 → 관리자 게시 → 직원 확인 또는 수정요청 → 확정. 확정된 직원이 먼저 표시됩니다.</p><div class="hr-inline">${[['','전체'],...Object.entries(labels)].map(([v,l])=>button(l,'filter',v,filter===v?'action':'secondary')).join('')}</div>`+table(['귀속 월','직원','실지급액','상태','직원 확인일','관리'],rows.map(p=>[p.month,esc(employee(p.employee_id)?.profile.name),money(p.calculation.net),stateTag(p),esc(p.confirmed_at? p.confirmed_at.slice(0,19)+' UTC':'—'),button('상세','pay-detail',p.id)]));
}
function bankList(){return toolbar('직원 지급 계좌')+table(['사번','직원','은행','계좌번호','예금주','관리'],store.employees.map(e=>[esc(e.employeeNo),esc(e.profile.name),esc(e.profile.bank),esc(e.profile.accountNumber),esc(e.profile.accountHolder),button('수정','edit',e.id)]));}
function payslips(){
 const rows=sortedRows(),current=rows.filter(p=>p.month===today().slice(0,7)),history=rows.filter(p=>p.month<today().slice(0,7));
 const row=p=>[p.month,money(p.calculation.gross),money(p.calculation.deductions),`<strong>${money(p.calculation.net)}</strong>`,stateTag(p),button('명세서 보기','pay-detail',p.id)];
 return toolbar('가지급명세서')+'<p class="sub">관리자가 게시한 본인 명세서만 표시됩니다. 확인하면 확정되며, 확정 내역과 지난달 내역은 수정할 수 없습니다.</p><h3>이번 달 명세서</h3>'+table(['귀속 월','지급 합계','공제','실지급액','상태','확인'],current.map(row))+'<h3 style="margin-top:24px">이전 기록 · 조회 전용</h3>'+table(['귀속 월','지급 합계','공제','실지급액','상태','조회'],history.map(row));
}
function scheduledMinutes(e){const p=e.profile,start=p.startDate||today(),end=p.endDate||'9999-12-31',month=today().slice(0,7),d=new Date(month+'-01T00:00:00Z'),days=['일','월','화','수','목','금','토'];let n=0;while(d.toISOString().slice(0,7)===month){const day=d.toISOString().slice(0,10);if(day>=start&&day<=end&&(p.workDays||[]).includes(days[d.getUTCDay()]))n+=360;d.setUTCDate(d.getUTCDate()+1);}return n;}
function payForm(id){
 const p=payroll(id),e=p?employee(p.employee_id):store.employees[0];if(!e)throw Error('직원을 먼저 등록해 주세요.');
 const c=p?.calculation||{minutes:scheduledMinutes(e),allowance:0,deductions:0,note:''};
 open('이번 달 급여 산정',`<form data-hr-form="pay" data-id="${p?.id||0}" data-revision="${p?.revision||0}"><div class="hr-fields">${select('직원','employeeId',store.employees.filter(x=>!p||x.id===e.id).map(x=>[x.id,x.profile.name+' · '+x.employeeNo]),e.id)}${input('귀속 월','month',p?.month||today().slice(0,7),'month','readonly required')}${input('인정 근로시간 (분) *','minutes',c.minutes,'number','required min="0" max="44640" step="1"')}${input('수당 합계 (원)','allowance',c.allowance,'number','required min="0" max="1000000000" step="1"')}${input('공제 합계 (원)','deductions',c.deductions,'number','required min="0" max="1000000000" step="1"')}<label class="hr-span">산정·수정 메모<textarea name="note" rows="2" maxlength="1000">${esc(c.note)}</textarea></label></div><p class="hr-muted">기본급은 등록 시급 × 인정시간(분) ÷ 60으로 계산합니다. 월급제는 등록 월 기본급을 적용합니다. 신규 시간은 근무요일·입퇴사일에 따른 월 예정시간(1일 6시간)입니다. 출결·휴일·주휴·성과수당·세금은 자동 연동되지 않으므로 게시 전 실제 시간과 수당·공제를 검토해 주세요.</p><div id="hr-calc-preview"></div><p class="hr-error" role="alert"></p><div class="hr-actions"><button class="action">계산하여 저장</button>${button('취소','close')}</div></form>`);previewCalculation();
}
function previewCalculation(){const f=dialog.querySelector('[data-hr-form="pay"]');if(!f)return;const e=employee(f.elements.employeeId.value);if(!e)return;const base=e.profile.payType==='월급제'?e.profile.payAmount:Math.round(e.profile.payAmount*Number(f.elements.minutes.value)/60),net=base+Number(f.elements.allowance.value)-Number(f.elements.deductions.value);dialog.querySelector('#hr-calc-preview').innerHTML=`<div class="hr-summary"><div>등록 기준<strong>${money(e.profile.payAmount)}</strong></div><div>기본급<strong>${money(base)}</strong></div><div>실지급액<strong>${money(net)}</strong></div></div>`;}
function payDetail(id){
 const p=payroll(id);if(!p)throw Error('명세서를 찾을 수 없습니다.');const snap=p.published_snapshot,c=admin()?p.calculation:snap.calculation,locked=p.status==='confirmed'||p.month!==today().slice(0,7);
 const e=employee(p.employee_id),name=snap?.name||e?.profile.name;
 let controls='';
 if(!locked&&admin())controls=p.status==='draft'?button('수정','pay-edit',id)+button('직원에게 게시','publish',id,'action'):p.status==='requested'?button('수정요청 반영','pay-edit',id,'action'):'<p>직원 확인을 기다리고 있습니다.</p>';
 if(!locked&&!admin()&&p.status==='published')controls=`<form data-hr-form="confirm" data-id="${id}" data-revision="${p.revision}"><label><input type="checkbox" name="reviewed" required> 지급 항목과 금액을 확인했습니다.</label><button class="action">확인 · 확정</button></form><form data-hr-form="request" data-id="${id}" data-revision="${p.revision}"><label>수정요청 메모<textarea name="note" required maxlength="1000" rows="2" style="width:100%"></textarea></label><button class="secondary">수정요청 보내기</button></form>`;
 const events=p.events||[],eventNames={publish:'관리자 게시',request:'직원 수정요청',confirm:'직원 확인 · 확정',savePayroll:'관리자 산정 저장'};
 open('가지급명세서 · '+esc(p.month),`<div class="row"><h3>${esc(name)} · ${esc(snap?.employeeNo||e?.employeeNo)}</h3>${stateTag(p)}</div><div class="hr-summary"><div>지급 합계<strong>${money(c.gross)}</strong></div><div>공제 합계<strong>${money(c.deductions)}</strong></div><div>실지급액<strong>${money(c.net)}</strong></div></div>${table(['항목','산정 내역'],[['기본급',money(c.base)],['급여 기준',esc(c.payType)+' · '+money(c.rate)],['인정시간',c.minutes+'분'],['수당',money(c.allowance)],['공제',money(c.deductions)],['산정 메모',esc(c.note)],['지급 계좌',esc([snap?.bank||e?.profile.bank,snap?.accountNumber||e?.profile.accountNumber,snap?.accountHolder||e?.profile.accountHolder].filter(Boolean).join(' / '))]])}<p class="hr-muted">${locked?'확정 또는 지난달 내역입니다. 조회만 가능합니다.':'확정은 직원의 명세서 확인 상태이며, 실제 이체 완료를 뜻하지 않습니다.'}</p><div class="hr-actions">${controls}</div><p class="hr-error" role="alert"></p><h3 style="margin-top:22px">처리·이전 게시 기록</h3>${table(['처리 시각 (한국)','내용','메모','게시 금액'],events.map(v=>[esc(new Date(v.created_at.replace(' ','T')+'Z').toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})),eventNames[v.event]||esc(v.event),esc(v.note),v.snapshot?.calculation?money(v.snapshot.calculation.net):'—']))}`);
}
async function addressSearch(){
 const box=dialog.querySelector('#hr-postcode');box.hidden=false;box.style.height='420px';box.textContent='주소 검색을 불러오는 중입니다…';
 try{
 if(!(global.kakao?.Postcode||global.daum?.Postcode))await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';s.onload=resolve;s.onerror=()=>{s.remove();reject(Error('주소 검색 연결을 확인해 주세요. 주소를 직접 입력할 수도 있습니다.'));};document.head.append(s);});
 const Postcode=global.kakao?.Postcode||global.daum?.Postcode;box.textContent='';new Postcode({oncomplete:data=>{const f=dialog.querySelector('form');f.elements.postcode.value=data.zonecode;f.elements.address.value=data.userSelectedType==='R'?data.roadAddress:data.jibunAddress;box.hidden=true;f.elements.addressDetail.focus();},width:'100%',height:'100%'}).embed(box);
 }catch(e){box.hidden=true;throw e;}
}
async function action(name,id){
 if(name==='close'){dialog.close();return;}if(name==='new'){staffForm();return;}if(name==='edit'){staffForm(id);return;}
 if(name==='address'){await addressSearch();return;}if(name==='clear-term'){const f=dialog.querySelector('form');f.querySelectorAll('[name="contractTerm"]').forEach(x=>x.checked=false);f.elements.contractType.value='무기계약';f.elements.contractEnd.value='';return;}
 if(name==='refresh'){await api();bridge.render();return;}if(name==='filter'){filter=id;bridge.render();return;}
 if(name==='pay-new'||name==='pay-edit'){payForm(id);return;}if(name==='pay-detail'){payDetail(id);return;}
 if(name==='publish'){const p=payroll(id);await api({action:'publish',id:p.id,revision:p.revision});payDetail(id);bridge.render();bridge.toast('직원에게 명세서를 게시했습니다.');}
}
async function submit(f){
 const data=new FormData(f),kind=f.dataset.hrForm,id=Number(f.dataset.id),revision=Number(f.dataset.revision);let body;
 if(kind==='staff'){
 const profile=Object.fromEntries(data);delete profile.password;delete profile.accountId;profile.workDays=data.getAll('workDays');profile.payAmount=Number(data.get('payAmount'));profile.contractTerm=data.get('contractTerm')||'';
 body={action:'saveStaff',id,revision,profile,password:data.get('password')||'',accountId:Number(data.get('accountId')||0)};
 }else if(kind==='pay')body={action:'savePayroll',id,revision,employeeId:Number(data.get('employeeId')),month:data.get('month'),calculation:{minutes:Number(data.get('minutes')),allowance:Number(data.get('allowance')),deductions:Number(data.get('deductions')),note:data.get('note')},note:data.get('note')};
 else body={action:kind,id,revision,note:data.get('note')||'',reviewed:data.has('reviewed')};
 await api(body);dialog.close();bridge.render();bridge.toast(kind==='confirm'?'확정되었습니다.':kind==='request'?'관리자에게 수정요청을 보냈습니다.':'저장했습니다.');
}
const employeePages=['home','attendance','sales','as','myInfo'];
function employeeHome(){
 const e=store.employees[0],p=e?.profile||{},pending=store.payroll.filter(r=>r.status==='published'&&r.month===today().slice(0,7)).length;
 return toolbar('직원 홈')+`<section class="panel"><h2>${esc(p.name||live().user.display_name)}님, 안녕하세요.</h2><p>${esc(teams[p.team]||teams[live().user.department])} · ${esc(p.role||'직원')} · ${esc(today())}</p><div class="hr-summary"><div>재직 상태<strong>${esc(p.employment||'정보 등록 대기')}</strong></div><div>확인할 명세서<strong>${pending}건</strong></div><div>확정 명세서<strong>${store.payroll.filter(r=>r.status==='confirmed').length}건</strong></div></div></section><section class="panel"><h3>업무 바로가기</h3><div class="hr-inline">${[['regions','접수 가능지역'],['attendance','출결'],['sales','실적'],['grade','그레이드'],['as','A/S'],['payslips','가지급명세서'],['myInfo','내 정보']].map(([route,title])=>`<button class="secondary" type="button" data-page="${route}">${title}</button>`).join('')}</div></section><section class="panel"><h3>확인 안내</h3><p>${pending?'새로 게시된 가지급명세서가 있습니다. 금액을 확인하거나 수정요청 메모를 남겨 주세요.':'새로 확인할 가지급명세서가 없습니다.'}</p><p class="sub">직원정보·그레이드·게시 명세서는 저장된 정보를 표시합니다. 출결·실적·A/S 기록은 현재 연결 준비 중입니다.</p></section>`;
}
function employeeInfo(){const e=store.employees[0],p=e?.profile;if(!p)return toolbar('내 정보')+'<p>아직 연결된 직원정보가 없습니다. 관리자에게 문의해 주세요.</p>';
 return toolbar('내 정보')+table(['항목','등록 내용'],[['사번',esc(e.employeeNo)],['이름',esc(p.name)],['소속 / 직책',esc(teams[p.team])+' / '+esc(p.role)],['연락처',esc(p.phone)],['이메일',esc(p.email||'미등록')],['입사일',esc(p.startDate)],['근무요일 / 주휴일',esc((p.workDays||[]).join('·'))+' / '+esc(p.weeklyHoliday)],['급여 기준',esc(p.payType)+' '+money(p.payAmount)],['지급 계좌',esc([p.bank,p.accountNumber,p.accountHolder].filter(Boolean).join(' / ')||'미등록')],['주소',esc([p.address,p.addressDetail].filter(Boolean).join(' ')||'미등록')],['계약 개시일',esc(p.contractStart||'미등록')],['계약 종료일',esc(p.contractEnd||'기간의 정함 없음')]])+'<p class="sub">정보 변경이 필요하면 관리자에게 요청해 주세요.</p>';
}
function employeePending(page){const p=store.employees[0]?.profile,titles={attendance:'출결',sales:'실적',as:'A/S'},heads={attendance:['날짜','출근','퇴근','상태'],sales:['접수일','상품','정상 실적','처리 상태'],as:['접수일','내용','처리 상태']};return toolbar(titles[page])+`<section class="panel"><h3>${titles[page]} 기록 연결 준비 중</h3><p>아직 실제 ${titles[page]} 기록이 연결되지 않았습니다. 업무 내역은 관리자에게 확인해 주세요.</p>${page==='attendance'&&p?`<p class="sub">등록 근무요일: ${esc((p.workDays||[]).join('·'))} · 입사일: ${esc(p.startDate)}</p>`:''}</section>`+table(heads[page],[]);}
function handles(page){return !!live()&&(routes.includes(page)||(!admin()&&employeePages.includes(page)));}
function render(page){if(!store)return '<p>직원 정보를 불러오지 못했습니다. 새로고침해 주세요.</p>';if(!admin())return page==='home'?employeeHome():page==='myInfo'?employeeInfo():['attendance','sales','as'].includes(page)?employeePending(page):payslips();if(page==='adminBank')return bankList();if(page==='adminPayroll')return payrollList();if(page==='adminCorrections'){const old=filter;filter='requested';const result=payrollList();filter=old;return result;}return staffList();}
function chrome(){if(!live())return;const el=bridge.root.querySelector('#live-page-status'),page=global.location.hash.slice(1);if(el&&handles(page))el.textContent='직원·급여 DB 연결됨 · 게시한 본인 명세서만 직원에게 표시됩니다.';const btn=bridge.root.querySelector('[data-page="payslips"]');if(btn)btn.hidden=admin();if(el&&!admin()){if(['attendance','sales','as'].includes(page))el.textContent='실제 업무 기록 연결 준비 중';else if(page==='regions')el.textContent='접수 가능지역 참고 화면 · 최신 운영 기준은 관리자에게 확인해 주세요.';else if(page==='home'||page==='myInfo'||!page)el.textContent='본인 직원정보와 게시된 급여 명세서를 확인합니다.';}}
function init(options){
 if(!live())return;bridge=options;store=live().hr||{employees:[],payroll:[],accounts:[],today:today()};
 dialog=document.createElement('dialog');dialog.className='hr-dialog';dialog.setAttribute('aria-label','직원·급여 관리');bridge.root.append(dialog);
 if(!admin()){const b=document.createElement('button');b.type='button';b.dataset.page='payslips';b.textContent='가지급명세서';bridge.root.querySelector('aside nav').append(b);const info=document.createElement('button');info.type='button';info.dataset.page='myInfo';info.textContent='내 정보';bridge.root.querySelector('aside nav').append(info);}
 bridge.root.addEventListener('click',async ev=>{
 const registration=ev.target.closest('[data-page="adminStaffRegister"]'),b=ev.target.closest('[data-hr]');if(!registration&&!b)return;ev.preventDefault();ev.stopImmediatePropagation();
 if(busy)return;busy=true;try{if(registration){global.location.hash='adminStaffRegister';staffForm();}else{b.disabled=true;await action(b.dataset.hr,b.dataset.id);}}catch(e){message(e);}finally{busy=false;if(b?.isConnected)b.disabled=false;}
 },true);
 bridge.root.addEventListener('submit',async ev=>{const f=ev.target.closest('[data-hr-form]');if(!f)return;ev.preventDefault();ev.stopImmediatePropagation();if(busy||!f.reportValidity())return;busy=true;const buttons=f.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);try{await submit(f);}catch(e){message(e);}finally{busy=false;buttons.forEach(b=>b.disabled=false);}},true);
 dialog.addEventListener('input',ev=>{previewCalculation();if(ev.target.matches('[name="contractStart"],[name="contractTerm"]')){const f=ev.target.form,t=f.querySelector('[name="contractTerm"]:checked')?.value;if(t&&f.elements.contractStart.value){f.elements.contractEnd.value=termEnd(f.elements.contractStart.value,t);f.elements.contractType.value='기간제';}}});
 setInterval(async()=>{if(busy||dialog.open||!handles(global.location.hash.slice(1)))return;try{const old=JSON.stringify(store);await api();if(old!==JSON.stringify(store))bridge.render();}catch(e){/* Keep the last loaded view; explicit refresh shows connection errors. */}},30000);
 dialog.addEventListener('change',ev=>{if(ev.target.matches('[name="employeeId"]')){ev.target.form.elements.minutes.value=scheduledMinutes(employee(ev.target.value));previewCalculation();}if(ev.target.matches('[name="contractType"]')&&ev.target.value==='무기계약'){ev.target.form.querySelectorAll('[name="contractTerm"]').forEach(x=>x.checked=false);ev.target.form.elements.contractEnd.value='';}});
}
const apiExport={init,handles,render,chrome,termEnd};if(typeof module!=='undefined'&&module.exports)module.exports=apiExport;else global.HRWorkspace=apiExport;
})(typeof window!=='undefined'?window:globalThis);
