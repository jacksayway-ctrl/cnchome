(()=>{'use strict';
const role=window.CNCHOME_LIVE?.user?.role;
if(!['employee','admin'].includes(role))return;
const admin=role==='admin',teams={insurance:'보험팀',cosmetics:'화장품팀',health:'건강보조식품팀'};
let rows=[],busy=false,queued=null,index,feedback='',loadError='',loaded=false,composingInput=null;
const expanded=new Set(),drafts=new Map(),filters={employee:'',scope:'all',query:''};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function evaluatedRows(){
 const core=window.IntakeDetails?.core;
 if(core&&!index)try{index=core.placeIndex(window.KoreaRegionCatalog);}catch(e){/* Pending records remain visible while location data is unavailable. */}
 const year=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Seoul'}).format(new Date()));
 return rows.map(r=>{const birth=Number((r.birthDate||'').slice(0,4)||r.birthYear),age=birth?year-birth+1:null,kind=age===null?r.kind:age<=60?'general':age<=70?'silver':null;let result={items:[],text:window.PolicySync?.error?'정책 조회 실패 · 최신 정책을 다시 불러와 주세요.':'정책 확인 중'};
  if(core&&index&&!(window.PolicySync?.error&&!window.PolicySync?.snapshot))try{result=core.assess(window.PolicySync?.snapshot,window.PolicyRegionRules,core.resolveLocation((r.consultationPlace||'').replace(/^\[테스트\]\s*/,''),index),kind,'');}catch(e){}
  return {r,result,kind,codes:core?core.availableCodes(result.items):[]};
 }).sort((a,b)=>Number(b.codes.length>0)-Number(a.codes.length>0)||a.r.date.localeCompare(b.r.date)||a.r.id.localeCompare(b.r.id,undefined,{numeric:true}));
}
function filteredRows(evaluated){
 if(!admin)return evaluated;
 const words=filters.query.trim().toLocaleLowerCase('ko-KR').split(/\s+/).filter(Boolean),phoneOnly=/^[0-9 -]+$/.test(filters.query.trim()),digits=filters.query.replace(/\D/g,'');
 return evaluated.filter(({r})=>{
  if(filters.employee&&String(r.employeeId)!==filters.employee)return false;
  if(filters.scope!=='all'&&Boolean(r.isTest)!==(filters.scope==='test'))return false;
  const text=[r.customer,r.phone,r.consultationPlace,r.employee,r.carrier,teams[r.team]||r.team].join(' ').toLocaleLowerCase('ko-KR');
  return words.every(word=>text.includes(word))||(phoneOnly&&digits!==''&&String(r.phone||'').replace(/\D/g,'').includes(digits));
 });
}
function filterMarkup(){
 if(!admin)return '';
 const employees=[...new Map(rows.map(r=>[String(r.employeeId),{id:String(r.employeeId),name:r.employee||'직원명 미입력',team:teams[r.team]||r.team||''}])).values()].sort((a,b)=>a.name.localeCompare(b.name,'ko')||a.id.localeCompare(b.id,undefined,{numeric:true}));
 if(filters.employee&&!employees.some(p=>p.id===filters.employee))employees.push({id:filters.employee,name:'선택한 직원 (현재 가접수 없음)',team:''});
 return `<div class="pending-intake-filters" role="group" aria-label="가접수 조회 조건"><label>담당 직원<select data-pending-filter="employee"><option value="">전체 직원</option>${employees.map(p=>`<option value="${esc(p.id)}" ${filters.employee===p.id?'selected':''}>${esc(p.name)}${p.team?' · '+esc(p.team):''}</option>`).join('')}</select></label><label>자료 구분<select data-pending-filter="scope">${[['all','전체 (테스트 포함)'],['real','운영 자료'],['test','테스트 자료']].map(([value,label])=>`<option value="${value}" ${filters.scope===value?'selected':''}>${label}</option>`).join('')}</select></label><label class="pending-intake-search">고객·연락처·직원·상담 지역<input type="search" maxlength="80" data-pending-filter="query" value="${esc(filters.query)}" placeholder="검색어를 입력해 주세요."></label><button type="button" class="secondary" data-pending-filter-reset>초기화</button></div>`;
}
function adminActions(r){
 const params=new URLSearchParams({role:'admin',month:r.date.slice(0,7),scope:r.isTest?'test':'real',id:r.id,popup:'1'});
 const queue=new URLSearchParams({role:'admin',month:r.date.slice(0,7),scope:r.isTest?'test':'real',employee:String(r.employeeId)});
 return `<div class="pending-intake-actions pending-intake-admin-actions"><a class="action" href="/intake.php?${esc(params.toString())}" target="_blank" rel="noopener">접수 상세·수정 새창</a>${r.recallPending?`<a class="secondary" href="/intake.php?${esc(queue.toString())}#recall-confirmations" target="_blank" rel="noopener">정상접수 확인표</a>`:''}</div><p class="pending-intake-feedback">접수 상세에서 내용을 수정하거나 상태를 처리할 수 있습니다.</p>`;
}
function employeeForm(r,codes){
 const draft=drafts.get(r.id)||{};
 return `<form class="pending-intake-form" data-pending-id="${esc(r.id)}"><label>메모 이어쓰기<textarea name="memo" maxlength="500" required placeholder="통화 결과나 다음 연락 내용을 입력해 주세요.">${esc(draft.memo||'')}</textarea></label><label>재콜 접수 코드<select name="carrier">${codes.length?codes.map(c=>`<option value="${esc(c.label)}" ${(draft.carrier||r.carrier)===c.label?'selected':''}>${esc(c.label)}</option>`).join(''):'<option value="">접수 가능한 정책 없음</option>'}</select></label><div class="pending-intake-actions"><button type="submit" class="secondary" name="action" value="memo" ${busy?'disabled':''}>메모 추가</button><button type="submit" name="action" value="recall" ${busy||!codes.length||r.recallPending?'disabled':''}>${r.recallPending?'관리자 확인 대기':'재콜 수정'}</button></div></form><p class="pending-intake-feedback">메모는 기존 기록 뒤에 추가됩니다. 재콜 수정은 관리자 정상접수 확인표로 전달됩니다.</p>`;
}
function rowMarkup({r,result,kind,codes},i){
 const isOpen=expanded.has(r.id),detailId='pending-detail-'+i;
 return `<tr class="pending-intake-row" data-pending-toggle="${esc(r.id)}" aria-expanded="${isOpen}"><td>${esc(r.date)}${admin&&r.isTest?'<br><span class="pending-intake-test">테스트</span>':''}</td>${admin?`<td>${esc(r.employee||'직원명 미입력')}</td><td>${esc(teams[r.team]||r.team||'부서 미입력')}</td>`:''}<td><strong>${esc(r.customer)}</strong></td><td>${esc(r.consultationPlace||'지역 미입력')}</td><td><span class="pending-intake-status ${codes.length?'available':'unavailable'}">${codes.length?'접수 가능':'확인 필요'}</span><br><small>${esc(codes.map(c=>c.label).join(' · ')||result.text)}</small></td><td>${r.recallPending?'관리자 확인 대기':'가접수'}</td><td><button type="button" class="pending-intake-toggle" aria-expanded="${isOpen}" aria-controls="${detailId}" aria-label="${esc(r.customer)} 상세 ${isOpen?'접기':'펼치기'}">${isOpen?'접기':'펼치기'}</button></td></tr>
 <tr id="${detailId}" class="pending-intake-detail" ${isOpen?'':'hidden'}><td colspan="${admin?8:6}"><div class="pending-intake-meta"><span>연락처 <strong>${esc(r.phone||'미입력')}</strong></span><span>생년월일 ${esc(r.birthDate||r.birthYear||'미입력')}</span><span>상담 시간 ${esc(r.consultationTime||'미입력')}</span><span>접수 코드 ${esc(r.carrier||'미입력')}</span><span>${kind==='silver'?'실버':kind==='general'?'일반':'연령 확인 필요'}</span></div><div class="pending-note-history"><strong>상담 메모</strong><p>${esc(r.note||'기존 메모가 없습니다.')}</p>${(r.memoHistory||[]).map(n=>`<article><small>${esc(n.at)} · ${esc(n.actor)} · ${n.action==='recall'?'재콜 수정':'메모 추가'}</small><p>${esc(n.memo)}</p></article>`).join('')}</div>${admin?adminActions(r):employeeForm(r,codes)}</td></tr>`;
}
function render(force=false){
 const refresh=document.querySelector('[data-pending-refresh]');if(refresh)refresh.disabled=busy;
 const el=document.querySelector('[data-pending-list]'),active=document.activeElement;
 if(!el||(!force&&((el.contains(active)&&active.matches('textarea,select'))||(composingInput&&el.contains(composingInput)))))return;
 const focusedFilter=el.contains(active)?active.dataset.pendingFilter:null,selection=focusedFilter==='query'?[active.selectionStart,active.selectionEnd]:null;
 const evaluated=filteredRows(evaluatedRows()),possible=evaluated.filter(x=>x.codes.length).length;
 const empty=loadError?'가접수 조회를 완료하지 못했습니다. 새로고침을 눌러 다시 확인해 주세요.':loaded?(admin?'현재 조회 조건에 해당하는 가접수가 없습니다.':'현재 본인의 가접수가 없습니다.'):(admin?'직원별 가접수를 불러오는 중입니다.':'본인 가접수를 불러오는 중입니다.');
 el.innerHTML=filterMarkup()+'<p>현재 적용 정책에 접수 가능한 건 우선 · 최초 접수일이 오래된 순서입니다. 행을 누르면 상세내용과 상담 메모가 펼쳐집니다.</p><div class="pending-intake-meta"><strong>가접수 '+(loaded?evaluated.length+'건':loadError?'조회 실패':'조회 중')+'</strong>'+(admin&&loaded?'<span>전체 '+rows.length+'건</span>':'')+'<span>접수 가능 '+possible+'건</span><span>확인 대기 '+evaluated.filter(x=>x.r.recallPending).length+'건</span></div><p class="pending-intake-feedback" role="status">'+esc(feedback)+'</p>'+(loadError?'<p class="pending-intake-error" role="alert">'+esc(loadError)+'</p>':'')+'<div class="scroll"><table class="pending-intake-table"><thead><tr><th>최초 접수일</th>'+(admin?'<th>담당 직원</th><th>부서</th>':'')+'<th>고객명</th><th>상담 지역</th><th>현재 정책</th><th>처리 상태</th><th>상세</th></tr></thead><tbody>'+evaluated.map(rowMarkup).join('')+(!evaluated.length?'<tr><td colspan="'+(admin?8:6)+'">'+esc(empty)+'</td></tr>':'')+'</tbody></table></div>';
 if(focusedFilter){const control=el.querySelector('[data-pending-filter="'+focusedFilter+'"]');if(control){control.focus({preventScroll:true});if(selection)control.setSelectionRange(...selection);}}
}
async function load(body){
 if(admin&&body)return;
 const el=document.querySelector('[data-pending-list]');if(busy){if(body){queued=body;el?.querySelectorAll('button[type="submit"]').forEach(b=>b.disabled=true);}return;}busy=true;if(body)el?.querySelectorAll('button[type="submit"]').forEach(b=>b.disabled=true);
 const refresh=document.querySelector('[data-pending-refresh]');if(refresh)refresh.disabled=true;
 const controller=new AbortController(),timer=body?null:setTimeout(()=>controller.abort(),45000);
 try{const response=await fetch('/pending-intakes.php?role='+encodeURIComponent(role),{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json','X-CSRF-Token':window.CNCHOME_LIVE.csrf},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(data.error||(response.status===401?'로그인 상태를 확인한 뒤 다시 접속해 주세요.':'가접수 조회에 실패했습니다.'));if(!Array.isArray(data.records))throw Error('가접수 응답을 확인하지 못했습니다. 다시 조회해 주세요.');rows=data.records;loaded=true;loadError='';if(body){const draft=drafts.get(body.id);if(!draft||(draft.memo===body.memo&&draft.carrier===body.carrier))drafts.delete(body.id);feedback=body.action==='memo'?'메모를 기존 기록에 이어 저장했습니다.':'재콜 수정 내용을 관리자 정상접수 확인표로 전달했습니다.';}}
 catch(e){loadError=e.name==='AbortError'?'가접수 조회 시간이 초과됐습니다. 새로고침을 눌러 주세요.':e.message;}finally{clearTimeout(timer);busy=false;render(!!body);if(queued){const next=queued;queued=null;load(next);}}
}
document.addEventListener('click',e=>{
 if(e.target.closest('[data-pending-refresh]')){load();return;}
 if(admin&&e.target.closest('[data-pending-filter-reset]')){Object.assign(filters,{employee:'',scope:'all',query:''});render(true);return;}
 const row=e.target.closest('[data-pending-toggle]');if(!row)return;
 const id=row.dataset.pendingToggle,on=!expanded.has(id);if(on)expanded.add(id);else expanded.delete(id);row.setAttribute('aria-expanded',String(on));const button=row.querySelector('button');button.setAttribute('aria-expanded',String(on));button.textContent=on?'접기':'펼치기';button.setAttribute('aria-label',(rows.find(r=>r.id===id)?.customer||'고객')+' 상세 '+(on?'접기':'펼치기'));row.nextElementSibling.hidden=!on;
});
function capture(e){
 const filter=e.target.closest('[data-pending-filter]');
 if(admin&&filter){if(e.type==='input'&&filter.tagName==='SELECT')return;if(e.isComposing)return;filters[filter.dataset.pendingFilter]=filter.value;render(true);return;}
 if(admin)return;const f=e.target.closest('[data-pending-id]');if(f)drafts.set(f.dataset.pendingId,{memo:f.elements.memo.value,carrier:f.elements.carrier.value});
}
document.addEventListener('input',capture);document.addEventListener('change',capture);
document.addEventListener('compositionstart',e=>{if(e.target.matches('[data-pending-filter="query"]'))composingInput=e.target;});
document.addEventListener('compositionend',e=>{if(e.target===composingInput)composingInput=null;if(e.target.matches('[data-pending-filter="query"]'))capture(e);});
document.addEventListener('submit',e=>{const f=e.target.closest('[data-pending-id]');if(!f)return;e.preventDefault();if(admin)return;const r=rows.find(r=>r.id===f.dataset.pendingId),action=e.submitter?.value||'memo';if(!r||!f.reportValidity())return;load({id:r.id,revision:r.revision,action,memo:f.elements.memo.value,carrier:f.elements.carrier.value});});
function mount(){const el=document.querySelector('[data-pending-list]');if(el&&!el.dataset.loaded){el.dataset.loaded='1';render();load();}}
const observer=new MutationObserver(mount);const main=document.getElementById('tm-main');if(main)observer.observe(main,{childList:true,subtree:true});window.PolicySync?.subscribe(()=>render());mount();setInterval(()=>{if(!document.hidden&&document.querySelector('[data-pending-panel]'))load();},15000);
})();
document.addEventListener('toggle',e=>{if(e.target.matches?.('.region-map-disclosure')&&e.target.open)window.dispatchEvent(new Event('resize'));},true);
