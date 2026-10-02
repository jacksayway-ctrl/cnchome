(()=>{'use strict';
const role=window.CNCHOME_LIVE?.user?.role;
if(!['employee','admin'].includes(role))return;
const admin=role==='admin',testAccount=window.CNCHOME_LIVE.isTestAccount===true,teams={insurance:'보험팀',cosmetics:'화장품팀',health:'건강보조식품팀'};
let rows=[],busy=false,posting=false,queued=null,index,feedback='',loadError='',loaded=false,composingInput=null;
let listScope=null,listPage=1,counselorNames=[],filterTimer=0;
const sharedEditors=new Map(),lockedControls=new Map();
const pageSize=10,scopeLabels={all:'전체 가접수',today:'오늘 재접수 가능',waiting:'관리자 확인 대기'};
const expanded=new Set(),drafts=new Map(),editDrafts=new Map(),formBases=new Map(),filters={employee:'',scope:'real',query:''};
const editFields=['customer','phone','birthDate','birthYear','carrier','consultationTime','consultationPlace','premiumBand','gender','callAvailability','visitSchedule','counselorName'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fieldValues=r=>Object.fromEntries(editFields.map(key=>[key,String(r[key]??'')]));
const sameFields=(a,b)=>editFields.every(key=>a[key]===b[key]);
const minute=value=>value?String(value).slice(0,16):'작성 시간 미기록';
function ageLabel(values,team){const year=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Seoul'}).format(new Date())),birth=Number(values.birthDate.slice(0,4)||values.birthYear),age=birth?year-birth+1:0;return age>0?age+'세 (세는나이)'+(team==='insurance'?' · '+(age<=60?'일반':age<=70?'실버':'연령 초과'):''):'생년월일 또는 출생연도 입력';}
function evaluatedRows(){
 const core=window.IntakeDetails?.core;
 if(core&&!index)try{index=core.placeIndex(window.KoreaRegionCatalog);}catch(e){/* Pending records remain visible while location data is unavailable. */}
 const now=new Date(),snapshot=window.PolicySync?.snapshot,today=window.PolicyDates?.day(now);
 const todaySnapshot=snapshot?{...snapshot,policies:Object.fromEntries(Object.entries(snapshot.policies||{}).filter(([,policy])=>today&&window.PolicyDates.day(policy.savedAt)===today))}:null;
 const year=Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Seoul'}).format(now));
 return rows.map(r=>{const birth=Number((r.birthDate||'').slice(0,4)||r.birthYear),age=birth?year-birth+1:null,kind=age===null?r.kind:age<=60?'general':age<=70?'silver':null;let result={items:[],text:window.PolicySync?.error?'정책 조회 실패 · 최신 정책을 다시 불러와 주세요.':'정책 확인 중'};
  let todayCodes=[];
  if(core&&index&&!(window.PolicySync?.error&&!snapshot))try{const demo=(admin||testAccount)&&r.isTest&&r.demoPolicy?{...snapshot,clients:[{id:'legacy',label:'테스트 전용'}],codes:[{id:'ga',label:'G/A',aliases:['GA']}],policies:{demo:r.demoPolicy}}:null,recordSnapshot=demo||snapshot,recordToday=demo?{...demo,policies:window.PolicyDates.day(r.demoPolicy.savedAt)===today?demo.policies:{}}:todaySnapshot;const location=core.resolveLocation((r.consultationPlace||'').replace(/^\[테스트\]\s*/,''),index);result=core.assess(recordSnapshot,window.PolicyRegionRules,location,kind,'');if(recordToday&&r.team==='insurance')todayCodes=core.availableCodes(core.assess(recordToday,window.PolicyRegionRules,location,kind,'').items);}catch(e){}
  return {r,result,kind,codes:core?core.availableCodes(result.items):[],todayCodes};
 }).sort((a,b)=>Number(b.todayCodes.length>0)-Number(a.todayCodes.length>0)||Number(b.codes.length>0)-Number(a.codes.length>0)||a.r.date.localeCompare(b.r.date)||a.r.id.localeCompare(b.r.id,undefined,{numeric:true}));
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
 return `<div class="pending-intake-actions pending-intake-admin-actions"><a class="action" href="/intake.php?${esc(params.toString())}" target="_blank" rel="noopener">접수관리 새창</a>${r.recallPending?`<a class="secondary" href="/intake.php?${esc(queue.toString())}#recall-confirmations" target="_blank" rel="noopener">정상접수 확인표</a>`:''}</div>`;
}
function editForm(r,i){
 if(admin)return `<div class="receipt-host" data-pending-receipt="${esc(r.id)}"></div>`;
 const draft=editDrafts.get(r.id),values=draft?.fields||fieldValues(r),revision=draft?.revision??r.revision;
 formBases.set(r.id,{fields:fieldValues(r),revision:r.revision});
 const carrierOptions=[...new Set([r.carrier,...(window.PolicySync?.snapshot?.codes||[]).map(c=>c.label)].filter(Boolean))];
 return `<form class="pending-intake-edit-form" data-pending-edit-id="${esc(r.id)}" data-revision="${revision}"><fieldset ${posting?'disabled':''}><legend>접수내용 수정</legend>
 <label>고객명<input name="customer" maxlength="100" required value="${esc(values.customer)}" autocomplete="off"></label>
 <label>연락처<input name="phone" type="tel" maxlength="15" required pattern="[0-9\\-]{9,15}" value="${esc(values.phone)}" autocomplete="off"></label>
 <label>생년월일<input name="birthDate" type="date" min="1900-01-01" max="${esc(r.date)}" value="${esc(values.birthDate)}"></label>
 <label>출생연도<input name="birthYear" type="number" min="1900" max="${esc(r.date.slice(0,4))}" step="1" required ${values.birthDate?'readonly':''} value="${esc(values.birthYear||'')}"><small>생년월일 입력 시 자동 적용</small></label>
 <label>접수 코드<input name="carrier" maxlength="100" value="${esc(values.carrier)}" list="pending-carriers-${i}" autocomplete="off"><datalist id="pending-carriers-${i}">${carrierOptions.map(c=>`<option value="${esc(c)}"></option>`).join('')}</datalist></label>
 <label>상담 시간<input name="consultationTime" type="time" value="${esc(values.consultationTime)}"></label>
 <label>현재 납부 보험료<select name="premiumBand">${[['','미입력'],['100000','10만 원 이상'],['200000','20만 원 이상'],['300000','30만 원 이상']].map(([value,label])=>`<option value="${value}" ${values.premiumBand===value?'selected':''}>${label}</option>`).join('')}</select></label>
 <label>상담원<input name="counselorName" maxlength="100" value="${esc(values.counselorName)}"></label>
 <label>성별<select name="gender">${[['','미입력'],['남','남'],['여','여']].map(([value,label])=>`<option value="${value}" ${values.gender===value?'selected':''}>${label}</option>`).join('')}</select></label>
 <label>통화 가능시간<input name="callAvailability" maxlength="200" value="${esc(values.callAvailability)}" placeholder="예: 오후 2시~5시"></label>
 <label>방문 일정·장소<input name="visitSchedule" maxlength="500" value="${esc(values.visitSchedule)}"></label>
 <label>현재 나이·구분<output data-pending-age>${esc(ageLabel(values,r.team))}</output></label>
 <label class="pending-intake-wide">상담 장소·지역<input name="consultationPlace" maxlength="500" value="${esc(values.consultationPlace)}" placeholder="시·도, 시·군·구와 상세 상담 장소" autocomplete="off"></label>
 <div class="pending-intake-wide pending-intake-actions"><button type="submit" ${busy?'disabled':''}>수정내용 적용</button><button type="button" class="secondary" data-pending-edit-reset="${esc(r.id)}" ${busy?'disabled':''}>저장내용으로 되돌리기</button><span class="pending-intake-edit-state" data-pending-edit-state>${draft?(revision!==r.revision?'다른 화면에서 내용이 변경되었습니다. 저장내용으로 되돌린 뒤 수정해 주세요.':'수정 중 · 적용하면 저장됩니다.'):r.lastEditAt?'마지막 수정 '+esc(minute(r.lastEditAt)):''}</span></div>
 </fieldset></form>`;
}
function hydratePending(el){
 if(!admin||!window.AdminIntakeEdit)return;
 for(const placeholder of el.querySelectorAll('[data-pending-receipt]')){
  const id=placeholder.dataset.pendingReceipt,r=rows.find(row=>row.id===id);if(!r||!expanded.has(id))continue;
  let entry=sharedEditors.get(id);
  if(!entry){
   const host=document.createElement('div');host.className='receipt-host';host.dataset.pendingReceipt=id;host.dataset.intakeEditUrl='/intake.php';
   const data=document.createElement('template');data.dataset.intakeEditData='';data.content.append(document.createTextNode(JSON.stringify({record:{...r,reason:''},counselorNames})));
   const guards=document.createElement('template');guards.dataset.intakeEditHidden='';
   const target=document.createElement('div');target.dataset.intakeEditForm='';host.append(data,guards,target);
   entry={host};sharedEditors.set(id,entry);placeholder.replaceWith(host);
   window.AdminIntakeEdit.mount(host,false,{reset:()=>{clearShared(id);render(true);load();},close:()=>{document.querySelectorAll('[data-pending-toggle]').forEach(row=>{if(row.dataset.pendingToggle===id)row.click();});},submit:form=>{
    if(posting||busy){form.querySelector('[data-sales-error]').textContent='조회 또는 저장 중입니다. 잠시 후 다시 눌러 주세요.';return;}
    const fields=Object.fromEntries(new FormData(form));
    load({...fields,id,revision:r.revision,action:'edit'});
   }});
  }else if(placeholder!==entry.host)placeholder.replaceWith(entry.host);
  window.ReceiptForm.updateCounselors(entry.host.querySelector('form'),counselorNames);
 }
}
function clearShared(id){const entry=sharedEditors.get(id);if(entry){window.AdminIntakeEdit?.dispose(entry.host);sharedEditors.delete(id);}}
function memoForm(r,codes){
 const draft=drafts.get(r.id)||{};
 return `<form class="pending-intake-form" data-pending-id="${esc(r.id)}" data-revision="${r.revision}"><fieldset ${posting?'disabled':''}><label>메모 이어쓰기<textarea name="memo" maxlength="500" required placeholder="통화 결과나 다음 연락 내용을 입력해 주세요.">${esc(draft.memo||'')}</textarea></label>${admin?'':`<label>재콜 접수 코드<select name="carrier">${codes.length?codes.map(c=>`<option value="${esc(c.label)}" ${(draft.carrier||r.carrier)===c.label?'selected':''}>${esc(c.label)}</option>`).join(''):'<option value="">접수 가능한 정책 없음</option>'}</select></label>`}<div class="pending-intake-actions"><button type="submit" class="secondary" name="action" value="memo" ${busy?'disabled':''}>메모 추가</button>${admin?'':`<button type="submit" name="action" value="recall" ${busy||!codes.length||r.recallPending?'disabled':''}>${r.recallPending?'관리자 확인 대기':'재콜 수정'}</button>`}</div></fieldset></form><p class="pending-intake-feedback">메모는 작성자·날짜·시간과 함께 기존 기록에 추가됩니다.${admin?'':' 재콜 수정은 관리자 정상접수 확인표로 전달됩니다.'}</p>`;
}
function rowMarkup({r,codes,todayCodes},i){
 const isOpen=expanded.has(r.id),detailId='pending-detail-'+i;
 const row=`<tr class="pending-intake-row" data-pending-toggle="${esc(r.id)}" ${admin?'':`aria-expanded="${isOpen}"`}><td>${esc(r.date)}${admin&&r.isTest?'<br><span class="pending-intake-test">테스트</span>':''}</td>${admin?`<td>${esc(r.employee||'직원명 미입력')}</td><td>${esc(teams[r.team]||r.team||'부서 미입력')}</td>`:''}<td><strong>${esc(r.customer)}</strong></td><td>${esc(r.consultationPlace||'지역 미입력')}</td><td>${codes.length?`<span class="pending-intake-status available">${r.demoPolicy?'[테스트] ':''}${todayCodes.length?'오늘 재접수 가능':'기존 정책 가능'}</span><br><small>${esc((todayCodes.length?todayCodes:codes).map(c=>c.label).join(' · '))}</small>`:'<span class="pending-intake-muted">—</span>'}</td><td>${r.recallPending?'관리자 확인 대기':'가접수'}</td><td><button type="button" class="pending-intake-toggle" ${admin?'':`aria-expanded="${isOpen}" aria-controls="${detailId}"`} aria-label="${esc(r.customer)} 상세 ${admin?'새창 열기':isOpen?'접기':'펼치기'}">${admin?'새창':isOpen?'접기':'펼치기'}</button></td></tr>`;
 if(admin)return row;
 return row+`<tr id="${detailId}" class="pending-intake-detail" ${isOpen?'':'hidden'}><td colspan="${admin?8:6}"><div class="pending-intake-meta"><span>최초 접수일 <strong>${esc(r.date)}</strong></span><span>담당 직원 ${esc(r.employee||'미입력')}</span><span>${esc(teams[r.team]||r.team||'')}</span><span>${r.recallPending?'관리자 확인 대기':'가접수'}</span></div>${editForm(r,i)}<div class="pending-note-history"><strong>상담 메모 기록</strong>${r.note?`<article><small>기존 메모 · ${esc(minute(r.originalMemoAt))}</small><p>${esc(r.note)}</p></article>`:''}${(r.memoHistory||[]).map(n=>`<article><small>${esc(minute(n.at))} · ${esc(n.actor)} · ${esc(({recall:'재콜 수정',resubmit:'재접수',edit:'접수내용 수정',hold:'보류',status:'상태 처리',memo:'메모 추가'})[n.action]||'메모')}</small><p>${esc(n.memo)}</p></article>`).join('')}${!r.note&&!r.memoHistory?.length?'<p>등록된 상담 메모가 없습니다.</p>':''}</div>${memoForm(r,codes)}${admin?adminActions(r):''}</td></tr>`;
}
function countMarkup(all,possible,policyReady){
 const cards=[
  ['all',loaded?all.length+'건':loadError?'조회 실패':'조회 중',admin?'전체 직원 · 모든 접수월':'본인 접수 · 모든 접수월'],
  ['today',loaded&&policyReady?possible+'건':window.PolicySync?.error?'정책 조회 실패':'조회 중','오늘 등록 정책의 지역·연령·잔여 수량 비교'+(all.some(({r})=>r.demoPolicy)?' · 테스트 예시 포함':'')],
  ['waiting',loaded?all.filter(x=>x.r.recallPending).length+'건':'조회 중','재콜 요청 후 확인 대기 중']
 ];
 return '<div class="pending-intake-counts'+(admin?' pending-intake-counts-inline':'')+'" aria-label="가접수 집계">'+cards.map(([scope,count,hint])=>{
  const tag=admin?'div':'button',attributes=admin?'':' type="button" data-pending-scope="'+scope+'" aria-expanded="'+(listScope===scope)+'" aria-controls="pending-intake-results" title="'+scopeLabels[scope]+' 목록 '+(listScope===scope?'닫기':'펼치기')+'"'+(posting?' disabled':'');
  return '<'+tag+attributes+(scope==='today'?' class="pending-intake-today"':'')+'><span>'+scopeLabels[scope]+'</span><strong>'+count+'</strong>'+(admin?'<small>'+hint+'</small>':'')+'</'+tag+'>';
 }).join('')+'</div>';
}
function pageMarkup(count,pageCount){
 if(pageCount<=1)return '';
 const start=(listPage-1)*pageSize+1,end=Math.min(listPage*pageSize,count);
 return '<div class="pending-intake-pagination" role="group" aria-label="가접수 목록 페이지"><span>'+start+'~'+end+' / '+count+'건 · '+listPage+'/'+pageCount+'쪽</span><button type="button" class="secondary" data-pending-page="-1" '+(listPage===1||posting?'disabled':'')+'>이전</button><button type="button" class="secondary" data-pending-page="1" '+(listPage===pageCount||posting?'disabled':'')+'>다음</button></div>';
}
function render(force=false){
 const refresh=document.querySelector('[data-pending-refresh]');if(refresh)refresh.disabled=busy;
 const el=document.querySelector('[data-pending-list]'),active=document.activeElement;
 if(!el||posting||(composingInput&&el.contains(composingInput))||(!force&&((el.contains(active)&&active.closest('form')&&active.matches('input,textarea,select'))||(composingInput&&el.contains(composingInput)))))return;
 const focusedFilter=el.contains(active)?active.dataset.pendingFilter:null,focusedScope=el.contains(active)?active.dataset.pendingScope:null,focusedPage=el.contains(active)?active.dataset.pendingPage:null,focusedForm=el.contains(active)?active.closest('form'):null,focusedId=focusedForm?.dataset.pendingEditId||focusedForm?.dataset.pendingId,focusedName=active.name,selection=typeof active.selectionStart==='number'?[active.selectionStart,active.selectionEnd]:null;
 const scroll=el.querySelector('.scroll'),scrollPosition=scroll?[scroll.scrollTop,scroll.scrollLeft]:[0,0];
 const all=evaluatedRows(),evaluated=filteredRows(all),possible=evaluated.filter(x=>x.todayCodes.length>0).length,policyReady=!!(window.PolicySync?.snapshot&&window.IntakeDetails?.core&&index&&!window.PolicySync?.error);
 const picked=admin?evaluated:listScope==='today'?evaluated.filter(x=>x.todayCodes.length>0):listScope==='waiting'?evaluated.filter(x=>x.r.recallPending):evaluated;
 const pageCount=Math.max(1,Math.ceil(picked.length/pageSize));if(!admin)listPage=Math.min(listPage,pageCount);
 const visible=admin?picked:picked.slice((listPage-1)*pageSize,listPage*pageSize),selectedReady=loaded&&(listScope!=='today'||policyReady);
 const empty=loadError?'가접수 조회를 완료하지 못했습니다. 새로고침을 눌러 다시 확인해 주세요.':!loaded?(admin?'직원별 가접수를 불러오는 중입니다.':'본인 가접수를 불러오는 중입니다.'):!admin&&listScope==='today'&&!policyReady?(window.PolicySync?.error?'오늘 정책 조회를 완료하지 못했습니다. 새로고침 후 다시 확인해 주세요.':'오늘 등록 정책을 확인 중입니다.'):!admin&&listScope==='today'?'오늘 정책으로 재접수 가능한 가접수가 없습니다.':!admin&&listScope==='waiting'?'관리자 확인 대기 내역이 없습니다.':admin?'현재 조회 조건에 해당하는 가접수가 없습니다.':'현재 본인의 가접수가 없습니다.';
 let results='';
 if(admin||listScope){
  const table='<div class="scroll"><table class="pending-intake-table"><thead><tr><th>최초 접수일</th>'+(admin?'<th>담당 직원</th><th>부서</th>':'')+'<th>고객명</th><th>상담 지역</th><th>현재 정책</th><th>처리 상태</th><th>상세</th></tr></thead><tbody>'+visible.map(rowMarkup).join('')+(!visible.length?'<tr><td colspan="'+(admin?8:6)+'">'+esc(empty)+'</td></tr>':'')+'</tbody></table></div>';
  const guidance='';
  results=admin?guidance+(loaded?'<div class="pending-intake-meta"><span>현재 조회 '+picked.length+'건</span><span>조회 결과 중 오늘 재접수 가능 '+(policyReady?picked.filter(x=>x.todayCodes.length>0).length+'건':'조회 중')+'</span></div>':'')+table:'<div class="pending-intake-list-heading"><h4>'+scopeLabels[listScope]+' · '+(selectedReady?picked.length+'건':'조회 중')+'</h4>'+pageMarkup(picked.length,pageCount)+'</div>'+guidance+table;
 }
 const rendered=countMarkup(evaluated,possible,policyReady)+filterMarkup()+'<p class="pending-intake-feedback" role="status">'+esc(feedback)+'</p>'+(loadError?'<p class="pending-intake-error" role="alert">'+esc(loadError)+'</p>':'')+(admin?results:'<section id="pending-intake-results" class="pending-intake-results" aria-label="'+(scopeLabels[listScope]||'가접수 목록')+'" '+(listScope?'':'hidden')+'>'+results+'</section>');
 const existingFilters=el.querySelector('.pending-intake-filters');
 if(existingFilters){
  const next=document.createElement('div');next.innerHTML=rendered;
  for(const child of [...el.childNodes])if(child!==existingFilters)child.remove();
  let afterFilters=false;
  for(const child of [...next.childNodes]){
   if(child.nodeType===1&&child.matches('.pending-intake-filters')){afterFilters=true;continue;}
   if(afterFilters)el.append(child);else el.insertBefore(child,existingFilters);
  }
 }else el.innerHTML=rendered;
 hydratePending(el);
 let control;if(focusedScope)control=el.querySelector('[data-pending-scope="'+focusedScope+'"]');else if(focusedPage)control=el.querySelector('[data-pending-page="'+focusedPage+'"]:not(:disabled)')||el.querySelector('[data-pending-page]:not(:disabled)');else if(focusedFilter)control=el.querySelector('[data-pending-filter="'+focusedFilter+'"]');else if(focusedId&&focusedName){const form=Array.from(el.querySelectorAll('form')).find(f=>(focusedForm.dataset.pendingEditId?f.dataset.pendingEditId:f.dataset.pendingId)===focusedId);control=form?.elements[focusedName];}
 if(control){control.focus({preventScroll:true});if(selection&&control.setSelectionRange)control.setSelectionRange(...selection);}
 const nextScroll=el.querySelector('.scroll');if(nextScroll){nextScroll.scrollTop=scrollPosition[0];nextScroll.scrollLeft=scrollPosition[1];}
}
async function load(body){
 if(admin&&body&&body.action==='recall')return;
 const el=document.querySelector('[data-pending-list]');if(body){posting=true;el?.querySelectorAll('[data-pending-receipt] input,[data-pending-receipt] select,[data-pending-receipt] textarea,[data-pending-receipt] button').forEach(control=>{lockedControls.set(control,control.disabled);control.disabled=true;});el?.querySelectorAll('form fieldset,[data-pending-scope],[data-pending-page]').forEach(f=>f.disabled=true);}if(busy){if(body&&!queued)queued=body;return;}busy=true;
 const refresh=document.querySelector('[data-pending-refresh]');if(refresh)refresh.disabled=true;
 const controller=new AbortController(),timer=body?null:setTimeout(()=>controller.abort(),45000);
 try{const response=await fetch('/pending-intakes.php?role='+encodeURIComponent(role),{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json','X-CSRF-Token':window.CNCHOME_LIVE.csrf},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(data.error||(response.status===401?'로그인 상태를 확인한 뒤 다시 접속해 주세요.':'가접수 조회에 실패했습니다.'));if(!Array.isArray(data.records))throw Error('가접수 응답을 확인하지 못했습니다. 다시 조회해 주세요.');rows=data.records.filter(r=>admin||(Number(r.employeeId)===Number(window.CNCHOME_LIVE.user.id)&&Boolean(r.isTest)===testAccount));counselorNames=Array.isArray(data.counselorNames)?data.counselorNames:[];loaded=true;loadError='';if(body?.action==='edit')clearShared(body.id);for(const id of sharedEditors.keys())if(!rows.some(r=>r.id===id))clearShared(id);if(body){if(body.action==='edit')editDrafts.delete(body.id);else drafts.delete(body.id);feedback=body.action==='edit'?(body.status==='normal'?'정상 접수로 전환했습니다.':body.status==='as'?'A/S로 처리했습니다.':''):body.action==='memo'?'작성 날짜·시간과 함께 메모를 추가했습니다.':'재콜 수정 내용을 관리자 정상접수 확인표로 전달했습니다.';}
 for(const r of rows){const draft=editDrafts.get(r.id);if(draft&&sameFields(draft.base,fieldValues(r)))draft.revision=r.revision;}}
 catch(e){loadError=e.name==='AbortError'?'가접수 조회 시간이 초과됐습니다. 새로고침을 눌러 주세요.':e.message;}finally{clearTimeout(timer);busy=false;if(queued){const next=queued;queued=null;load(next);}else{posting=false;for(const [control,disabled] of lockedControls)control.disabled=disabled;lockedControls.clear();render(!!body);if(body&&loadError){const message=sharedEditors.get(body.id)?.host.querySelector('[data-sales-error]');if(message){message.textContent=loadError;message.dataset.state='error';}}}}
}
document.addEventListener('click',e=>{
 if(e.target.closest('[data-pending-refresh]')){load();return;}
 const scope=e.target.closest('[data-pending-scope]');if(scope&&!admin){if(posting||!Object.hasOwn(scopeLabels,scope.dataset.pendingScope))return;listScope=listScope===scope.dataset.pendingScope?null:scope.dataset.pendingScope;listPage=1;expanded.clear();render(true);return;}
 const pageButton=e.target.closest('[data-pending-page]');if(pageButton&&!admin){if(posting)return;listPage=Math.max(1,listPage+Number(pageButton.dataset.pendingPage));expanded.clear();render(true);return;}
 const reset=e.target.closest('[data-pending-edit-reset]');if(reset){editDrafts.delete(reset.dataset.pendingEditReset);feedback='저장된 접수내용을 다시 불러왔습니다.';render(true);load();return;}
 if(admin&&e.target.closest('[data-pending-filter-reset]')){clearTimeout(filterTimer);Object.assign(filters,{employee:'',scope:'real',query:''});document.querySelectorAll('[data-pending-filter]').forEach(input=>{input.value=filters[input.dataset.pendingFilter];});render(true);return;}
 const row=e.target.closest('[data-pending-toggle]');if(!row)return;
 if(admin){
  const record=rows.find(r=>r.id===row.dataset.pendingToggle);if(!record)return;
  const params=new URLSearchParams({role:'admin',month:record.date.slice(0,7),scope:record.isTest?'test':'real',id:record.id,popup:'1'});
  const child=window.open('/intake.php?'+params.toString(),'_blank','width='+Math.min(1360,window.screen.availWidth)+',height='+Math.min(920,window.screen.availHeight)+',resizable=yes,scrollbars=yes');
  if(!child)window.alert('팝업이 차단되었습니다. 이 사이트의 팝업을 허용해 주세요.');return;
 }
 const id=row.dataset.pendingToggle,on=!expanded.has(id);if(on)expanded.add(id);else expanded.delete(id);row.setAttribute('aria-expanded',String(on));const button=row.querySelector('button');button.setAttribute('aria-expanded',String(on));button.textContent=on?'접기':'펼치기';button.setAttribute('aria-label',(rows.find(r=>r.id===id)?.customer||'고객')+' 상세 '+(on?'접기':'펼치기'));row.nextElementSibling.hidden=!on;if(on)hydratePending(row.nextElementSibling);
});
function capture(e){
 const filter=e.target.closest('[data-pending-filter]');
 if(admin&&filter){if(e.type==='input'&&filter.tagName==='SELECT')return;if(e.isComposing||composingInput===filter)return;filters[filter.dataset.pendingFilter]=filter.value;clearTimeout(filterTimer);filterTimer=setTimeout(()=>render(true),150);return;}
 const edit=e.target.closest('[data-pending-edit-id]');if(edit){captureEdit(edit);return;}
 const f=e.target.closest('[data-pending-id]');if(f)drafts.set(f.dataset.pendingId,{memo:f.elements.memo.value,carrier:f.elements.carrier?.value||''});
}
function captureEdit(form){
 const id=form.dataset.pendingEditId,existing=editDrafts.get(id),base=formBases.get(id),values=Object.fromEntries(editFields.map(key=>[key,form.elements[key].value]));
 if(values.birthDate){values.birthYear=values.birthDate.slice(0,4);form.elements.birthYear.value=values.birthYear;}form.elements.birthYear.readOnly=!!values.birthDate;
 const draft={fields:values,revision:existing?.revision??Number(form.dataset.revision),base:existing?.base||base?.fields||fieldValues(rows.find(r=>r.id===id)||{})};editDrafts.set(id,draft);
 const r=rows.find(r=>r.id===id);form.querySelector('[data-pending-age]').textContent=ageLabel(values,r?.team);form.querySelector('[data-pending-edit-state]').textContent=draft.revision!==r?.revision?'다른 화면에서 내용이 변경되었습니다. 저장내용으로 되돌린 뒤 수정해 주세요.':'수정 중 · 적용하면 저장됩니다.';
 return draft;
}
document.addEventListener('input',capture);document.addEventListener('change',capture);
document.addEventListener('compositionstart',e=>{if(e.target.closest('[data-pending-list]'))composingInput=e.target;});
document.addEventListener('compositionend',e=>{if(e.target===composingInput)composingInput=null;if(e.target.matches('[data-pending-filter="query"]'))capture(e);});
document.addEventListener('submit',e=>{const f=e.target.closest('[data-pending-edit-id],[data-pending-id]');if(!f)return;e.preventDefault();if(posting||!f.reportValidity())return;if(f.dataset.pendingEditId){const draft=captureEdit(f);load({id:f.dataset.pendingEditId,revision:draft.revision,action:'edit',...draft.fields});return;}const r=rows.find(r=>r.id===f.dataset.pendingId),action=e.submitter?.value||'memo';if(!r||(admin&&action!=='memo'))return;load({id:r.id,revision:r.revision,action,memo:f.elements.memo.value,carrier:f.elements.carrier?.value||''});});
function mount(){const el=document.querySelector('[data-pending-list]');if(el&&!el.dataset.loaded){el.dataset.loaded='1';render();load();}}
window.addEventListener('cnc:sales-changed',()=>{if(document.querySelector('[data-pending-panel]'))load();});
window.addEventListener('storage',e=>{if(e.key==='cnchome.sales.changed'&&document.querySelector('[data-pending-panel]'))load();});
const observer=new MutationObserver(mount);const main=document.getElementById('tm-main');if(main)observer.observe(main,{childList:true,subtree:true});window.PolicySync?.subscribe(()=>render());mount();setInterval(()=>{if(!document.hidden&&document.querySelector('[data-pending-panel]'))load();},15000);
})();
document.addEventListener('toggle',e=>{if(e.target.matches?.('.region-map-disclosure')&&e.target.open)window.dispatchEvent(new Event('resize'));},true);
