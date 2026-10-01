(function(global){
 'use strict';
 const labels={pending:'가접수',normal:'정상접수',as:'A/S'},tones={pending:'pending',normal:'received',as:'as'},teams={insurance:'보험팀',cosmetics:'화장품팀',health:'건강보조식품팀'};
 const premiumLabels={'100000':'10만 원 이상','200000':'20만 원 이상','300000':'30만 원 이상'};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 function counts(records){return records.reduce((n,r)=>{if(Object.hasOwn(n,r.status))n[r.status]++;return n},{pending:0,normal:0,as:0})}
 function daily(records,team,date){return counts(records.filter(r=>(!team||r.team===team)&&r.date===date))}
 function ageKind(birthYear,date=today()){const age=Number(date.slice(0,4))-Number(birthYear)+1;return Number.isInteger(age)&&age>0&&age<=70?{age,kind:age<=60?'general':'silver'}:{age,kind:null}}
 function weekDates(anchor,start){const d=new Date(anchor+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()-start+7)%7);return Array.from({length:7},(_,i)=>{const v=new Date(d);v.setUTCDate(v.getUTCDate()+i);return v.toISOString().slice(0,10)})}
 let weekAnchor=today(),weekStart=1;
 let bridge,store=null,error='',busy=false,loading=false,month=today().slice(0,7),selected=today(),selectedTeam='',showTest=false,lastFetch='',requestVersion=0;
 const live=()=>global.CNCHOME_LIVE,admin=()=>live()?.user.role==='admin';
 const testAccount=()=>live()?.isTestAccount??/^user[1-6]$/.test(live()?.user.username||'');
 const canViewTest=()=>admin()||testAccount();
 const weekStorageKey=()=>live()?'cnchome.performanceWeekStart.'+live().user.role+'.'+live().user.id:'tm-performance-week-start';
 const route=()=>new URL(global.location.href).searchParams.get('page')||live()?.page;
 function handles(page){return !!live()&&(admin()?['adminHome','adminPerformance'].includes(page):['home','sales','as'].includes(page))}
 const active=()=>handles(route());
 const allRows=()=>store?.month===month?(store.records||[]).filter(r=>(admin()||Number(r.employeeId)===Number(live().user.id))&&!!r.isTest===(canViewTest()&&showTest)):[];
 const rows=()=>allRows().filter(r=>r.date.startsWith(month));
 const table=(heads,body)=>'<div class="scroll"><table><thead><tr>'+heads.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+body.map(row=>'<tr>'+row.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 const summary=c=>Object.keys(labels).map(key=>'<span class="sales-status-'+tones[key]+'">'+labels[key]+' <strong>'+c[key]+'건</strong></span>').join('');
 function weekly(){
  const dates=weekDates(weekAnchor,weekStart),records=allRows().filter(r=>dates.includes(r.date));
  const groups=[['보험 · 일반',r=>r.team==='insurance'&&r.kind==='general'],['보험 · 실버',r=>r.team==='insurance'&&r.kind==='silver'],['보험 · 미지정',r=>r.team==='insurance'&&!['general','silver'].includes(r.kind)],['화장품',r=>r.team==='cosmetics'],['건강보조식품',r=>r.team==='health'],['전체',()=>true]];
  return '<section class="panel"><h3>상품별 주간 실적</h3><div class="toolbar performance-week-toolbar"><button class="secondary" type="button" data-sales-week="-1">이전 주</button><strong>'+dates[0]+' ~ '+dates[6]+'</strong><button class="secondary" type="button" data-sales-week="1">다음 주</button><label>기준일<input type="date" data-sales-week-date value="'+weekAnchor+'"></label><label>주 시작 요일<select data-sales-week-start>'+['일','월','화','수','목','금','토'].map((x,i)=>'<option value="'+i+'" '+(i===weekStart?'selected':'')+'>'+x+'요일</option>').join('')+'</select></label></div>'+table(['상품',...dates.map(x=>x.slice(5)),'정상접수 합계','가접수','A/S'],groups.map(([name,filter])=>{const rs=records.filter(filter),c=counts(rs);return [name,...dates.map(d=>counts(rs.filter(r=>r.date===d)).normal+'건'),c.normal+'건',c.pending+'건',c.as+'건']}))+'</section>';
 }
 function calendar(team,records){
  const [year,m]=month.split('-').map(Number),first=new Date(Date.UTC(year,m-1,1)).getUTCDay(),days=new Date(Date.UTC(year,m,0)).getUTCDate();
  const employee=!admin(),cellCount=Math.ceil((first+days)/7)*7;
  let cells='';
  for(let index=0;index<cellCount;index++){
   const n=index-first+1,cellDate=new Date(Date.UTC(year,m-1,n)),date=cellDate.toISOString().slice(0,10),outside=date.slice(0,7)!==month;
   if(outside){cells+='<div class="day sales-outside-month" aria-label="'+date+'"><span class="date-number">'+(cellDate.getUTCMonth()+1)+'월 '+cellDate.getUTCDate()+'</span></div>';continue;}
   const c=daily(records,team,date),isToday=date===today(),statusKeys=Object.keys(labels).filter(k=>!employee||(date<=today()&&c[k]>0));
   cells+='<button type="button" class="day sales-live-day '+(date===selected?'active ':'')+(isToday?'team-performance-today':'')+'" data-sales-day="'+date+'" data-sales-team="'+team+'" '+(isToday?'aria-current="date"':'')+' aria-label="'+date+' '+esc(teams[team]||'전체')+' '+(statusKeys.length?statusKeys.map(k=>labels[k]+' '+c[k]+'건').join(' '):'접수 내역 없음')+'"><span class="date-number">'+n+'</span>'+statusKeys.map(k=>'<small class="count sales-status-'+tones[k]+'" data-sales-count="'+k+'">'+labels[k]+' '+c[k]+'건</small>').join('')+'</button>';
  }
  const total=counts(records.filter(r=>!team||r.team===team));
  return '<section class="panel" data-sales-calendar="'+team+'"><h3>'+esc(teams[team]||'전체')+' 실적 달력 · '+esc(month)+'</h3><div class="sales-live-totals">'+summary(total)+'</div><div class="team-performance-scroll"><div class="calendar sales-live-calendar">'+['일','월','화','수','목','금','토'].map(d=>'<div class="weekday">'+d+'</div>').join('')+cells+'</div></div></section>';
 }
 let salesDetailsOpen=false;
 global.document.addEventListener('toggle',e=>{if(e.target.matches?.('[data-sales-details]'))salesDetailsOpen=e.target.open;},true);
 function details(records){
  const list=records.filter(r=>(!selectedTeam||r.team===selectedTeam)&&r.date===selected);
  return '<details class="panel sales-intake-details" data-sales-details '+(salesDetailsOpen?'open':'')+'><summary>'+esc(selected)+' · '+esc(teams[selectedTeam]||'전체')+'접수 내역 · '+list.length+'건</summary>'+(!list.length?'<p class="sub">접수 내역이 없습니다.</p>':table(['담당','고객','접수 코드','상품','상담 시간','상담 장소','현재 납부 보험료','상태'],list.map(r=>[esc(r.employee),esc(r.customer),esc(r.carrier||'—'),r.team==='insurance'?(r.kind==='silver'?'실버 · 61~70세':'일반 · 60세 이하'):esc(teams[r.team]),esc(r.consultationTime||'—'),esc(r.consultationPlace||'—'),esc(premiumLabels[r.premiumBand]||'—'),'<select aria-label="'+esc(r.customer)+' 접수 상태" data-sales-status="'+esc(r.id)+'" '+(busy?'disabled':'')+'>'+Object.keys(labels).map(k=>'<option value="'+k+'" '+(k===r.status?'selected':'')+'>'+labels[k]+'</option>').join('')+'</select>'])))+'</details>';
 }
 let homeStatus=null,homeGraphDay=today(),homeGraphOpen=false;
 function homeGraph(records,ready){
  const date=today(),currentMonth=date.slice(0,7),[year,m]=currentMonth.split('-').map(Number),days=new Date(Date.UTC(year,m,0)).getUTCDate();
  if(!homeGraphDay.startsWith(currentMonth)){homeGraphDay=date;homeGraphOpen=false;}
  const dailyCounts=Array.from({length:days},(_,i)=>counts(records.filter(r=>r.date===currentMonth+'-'+String(i+1).padStart(2,'0'))).normal),total=counts(records),selectedRows=records.filter(r=>r.date===homeGraphDay);
  const width=900,height=260,left=58,right=16,top=32,bottom=38,plotHeight=height-top-bottom,step=(width-left-right)/days,tick=Math.max(1,Math.ceil(Math.max(0,...dailyCounts)/4)),max=tick*4,x=n=>left+(n-.5)*step,y=n=>height-bottom-n/max*plotHeight;
  let grid='';for(let n=0;n<=max;n+=tick)grid+='<line x1="'+left+'" y1="'+y(n)+'" x2="'+(width-right)+'" y2="'+y(n)+'" stroke="#dfe7f1"/><text x="'+(left-10)+'" y="'+(y(n)+5)+'" text-anchor="end" fill="#61738b" font-size="14">'+n+'</text>';
  const bars=dailyCounts.map((count,i)=>count?'<rect x="'+(x(i+1)-step*.28)+'" y="'+y(count)+'" width="'+(step*.56)+'" height="'+(height-bottom-y(count))+'" rx="3" fill="'+(homeGraphDay.endsWith('-'+String(i+1).padStart(2,'0'))?'#1464ec':'#94bdff')+'"><title>'+m+'월 '+(i+1)+'일 정상접수 '+count+'건</title></rect>':'').join('');
  const dates=dailyCounts.map((count,i)=>{const day=i+1,dow=new Date(Date.UTC(year,m-1,day)).getUTCDay();return '<text x="'+x(day)+'" y="'+(height-15)+'" text-anchor="middle" fill="'+(dow===0?'#c52c3d':dow===6?'#2563eb':'#61738b')+'" font-size="12">'+day+'</text>';}).join('');
  const targets=dailyCounts.map((count,i)=>'<rect class="chart-day-target" data-sales-home-day="'+currentMonth+'-'+String(i+1).padStart(2,'0')+'" role="button" tabindex="0" aria-label="'+m+'월 '+(i+1)+'일 정상접수 '+count+'건, 접수 내역 보기" x="'+(x(i+1)-step/2)+'" y="'+top+'" width="'+step+'" height="'+plotHeight+'" fill="transparent"><title>'+m+'월 '+(i+1)+'일 · '+count+'건</title></rect>').join('');
  return '<section class="panel sales-home-graph" aria-busy="'+!ready+'"><h3>'+year+'년 '+m+'월 실적</h3><div class="stats">'+Object.entries(labels).map(([key,label])=>'<div class="stat"><span class="sub">이번 달 '+label+'</span><div class="value">'+total[key]+'건</div></div>').join('')+'</div><p class="sub">'+(ready?'본인 정상접수 · A/S 제외'+(!records.length?' · 등록된 접수 내역이 없습니다.':''):'접수 내역을 불러오는 중입니다.')+'</p><div class="comparison-scroll"><svg class="comparison-chart" viewBox="0 0 '+width+' '+height+'" role="group" aria-label="'+year+'년 '+m+'월 본인 일별 정상접수 그래프"><text x="8" y="18" fill="#61738b" font-size="13">건수</text>'+grid+bars+dates+targets+'</svg></div><div class="legend"><span>'+m+'월 · 날짜</span><span>'+esc(homeGraphDay)+' · 정상접수 '+counts(selectedRows).normal+'건</span></div>'+(homeGraphOpen?'<h3 style="margin-top:18px">'+esc(homeGraphDay)+' 접수 내역 · '+selectedRows.length+'건</h3>'+table(['고객명','전화번호','접수 코드','상태'],selectedRows.length?selectedRows.map(r=>[esc(r.customer),esc(r.phone||'—'),esc(r.carrier||'—'),labels[r.status]]):[['—','—','—','접수 내역 없음']]):'')+'</section>';
 }
 function home(){
  const date=today(),currentMonth=date.slice(0,7),ready=month===currentMonth&&store?.month===currentMonth;
  if(month!==currentMonth)queueMicrotask(()=>setMonth(currentMonth));
  const monthRecords=ready?allRows().filter(r=>r.date.startsWith(currentMonth)):[],records=monthRecords.filter(r=>r.date===date),c=counts(records),selectedRows=homeStatus?records.filter(r=>r.status===homeStatus):[];
  const status=error||(!ready?'본인 접수 내역을 불러오는 중입니다.':'마지막 확인 '+lastFetch+' · '+date+' 본인 접수');
  return '<section class="panel home-overview"><h2>'+esc(live().user.display_name)+'님의 실적관리</h2><div class="home-status-controls" role="group" aria-label="오늘 본인 접수 상태별 목록">'+Object.entries(labels).map(([key,label])=>'<button type="button" class="home-status-button '+({pending:'pink',normal:'green',as:'amber'}[key])+'" data-sales-home-status="'+key+'" aria-pressed="'+(homeStatus===key)+'" aria-controls="sales-home-records" '+(!ready?'disabled':'')+'>'+label+' '+(ready?c[key]+'건':'조회 중')+'</button>').join('')+'</div><p class="sub home-last-check" data-sales-sync>'+esc(status)+'</p>'+(testAccount()&&showTest?'<p class="notice">테스트 계정의 가상 자료입니다. 실제 실적에는 합산하지 않습니다.</p>':'')+(global.AttendanceWorkspace?.homePanel()||'<section class="checkin-panel"><h3>오늘 출근</h3><p class="sub">출근 기록을 불러오는 중입니다.</p></section>')+'</section><div id="sales-home-records" aria-live="polite">'+(homeStatus&&ready?'<section class="panel"><h3>오늘 '+labels[homeStatus]+' · '+selectedRows.length+'건</h3>'+(selectedRows.length?table(['고객명','전화번호','상담 장소','상태'],selectedRows.map(r=>[esc(r.customer),esc(r.phone||'—'),esc(r.consultationPlace||r.address||'—'),labels[r.status]])):'<p class="sub">해당 접수 내역이 없습니다.</p>')+'</section>':'')+'</div>'+homeGraph(monthRecords,ready)+(bridge?.homeGrades?.()||'')+'<section class="panel"><h3>업무 바로가기</h3><div class="hr-inline">'+[['regions','접수 가능지역'],['attendance','출결'],['sales','실적'],['grade','그레이드'],['as','A/S'],['payslips','가지급명세서'],['myInfo','내 정보']].map(([page,label])=>'<button type="button" class="secondary" data-page="'+page+'">'+label+'</button>').join('')+'</div></section>';
 }
 function render(page){
  if(page==='home'&&!admin())return home();
  const ready=store?.month===month,records=rows().filter(r=>page!=='as'||r.status==='as');
  const title=admin()?(page==='adminHome'?'관리자 홈 · 업무현황':'실적 관리'):page==='as'?'나의 A/S':'나의 실적';
  const testAvailable=canViewTest()&&(showTest||store?.records?.some(r=>r.isTest));
  const top=(page==='adminHome'?(global.AdminWorkspace?.home()||''):'')+'<div class="sales-workspace"><div class="sales-page-toolbar" aria-label="실적 조회 및 접수"><h2>'+title+'</h2><div class="sales-month-controls"><button class="secondary" type="button" data-sales-month="-1">이전 달</button><input type="month" aria-label="실적 조회 월" data-sales-month-input value="'+month+'"><button class="secondary" type="button" data-sales-month="1">다음 달</button></div><button class="secondary sales-refresh-button" type="button" data-sales-refresh>새로고침</button>'+(testAvailable?'<label class="sales-test-toggle"><input type="checkbox" data-sales-test '+(showTest?'checked':'')+'><span>테스트 자료 보기</span></label>':'')+'</div><p class="sub" data-sales-sync>'+esc(error||(!ready?'접수 내역을 불러오는 중입니다.':'5초마다 자동 갱신 · 마지막 확인 '+lastFetch))+'</p>'+(showTest?'<p class="notice">테스트 계정의 가상 자료입니다. 실제 실적에는 합산하지 않습니다.</p>':'')+'<p class="sub">최초 접수일 기준 · 상태 변경 시 가접수·정상접수·A/S 건수가 함께 바뀝니다.</p>';
  if(!ready)return top+'</div>';
  const visibleTeams=admin()?Object.keys(teams).filter(t=>t!=='health'||records.some(r=>r.team===t)):[live().user.department];
  return top+'<div class="sales-live-totals">'+summary(counts(records))+'</div>'+(page==='adminPerformance'?weekly():'')+'<div class="team-calendar-stack">'+visibleTeams.map(t=>calendar(t,records)).join('')+'</div>'+details(records)+'</div>';
 }
 function redraw(){if(active())bridge.render()}
 function chrome(){
  if(!bridge)return;
  bridge.root.querySelector('.work')?.classList.toggle('employee-compact-header',!admin());
  bridge.root.querySelector('.work')?.classList.toggle('region-intake-page',route()==='regions');
  if(!active())return;
  const status=bridge.root.querySelector('#live-page-status');if(status)status.textContent=error||(!store?'접수 내역을 불러오는 중입니다.':'저장된 접수 상태를 표시합니다. 변경 즉시 반영 · 다른 화면의 변경은 5초마다 갱신');
  for(const el of bridge.root.querySelectorAll('.work > .sample'))el.hidden=true;
 }
 function confirmDuplicate(form,count){
  return new Promise(resolve=>{
   const dialog=global.document.createElement('dialog');dialog.className='sales-duplicate-dialog cnc-admin-save-confirm';dialog.setAttribute('aria-label','중복 접수 확인');
   dialog.innerHTML='<h2>중복 접수 확인</h2><p>같은 이름과 전화번호의 기존 접수가 '+Number(count)+'건 있습니다.</p><p>저장하면 고객명 뒤에 <strong>(중복)</strong>을 붙여 접수합니다.</p><div class="row"><button type="button" class="secondary" data-duplicate-cancel autofocus>취소</button><button type="button" class="action" data-duplicate-save>저장</button></div>';
   bridge.root.append(dialog);let approved=false;
   dialog.querySelector('[data-duplicate-cancel]').addEventListener('click',()=>dialog.close());dialog.querySelector('[data-duplicate-save]').addEventListener('click',event=>{if(event.detail<1){event.preventDefault();return;}approved=true;dialog.close();});
   dialog.addEventListener('close',()=>{dialog.remove();resolve(approved&&form.isConnected);},{once:true});dialog.showModal();
  });
 }
 async function request(body,submittedForm=null){
  if(loading||busy)return;const version=++requestVersion,requestedMonth=month;loading=true;if(body)busy=true;
  let duplicateRetry=null;const form=body?.action==='create'?submittedForm:null,controls=form?[...form.querySelectorAll('input,select,textarea,button[type="submit"],button[type="reset"]')].map(input=>[input,input.disabled]):[];
  if(form){form.setAttribute('aria-busy','true');delete form.querySelector('[data-sales-error]').dataset.state;form.querySelector('[data-sales-error]').textContent='접수증을 저장하는 중입니다.';for(const [input] of controls)input.disabled=true;}
  const controller=new AbortController(),timeout=global.setTimeout(()=>controller.abort(),30000);
  try{
   const response=await global.fetch('/sales-api.php?month='+encodeURIComponent(requestedMonth),{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json','X-CSRF-Token':live().csrf},...(body?{body:JSON.stringify(body)}:{})});
   const data=await response.json();
   if(response.status===409&&data.duplicate===true&&form){global.clearTimeout(timeout);const approved=await confirmDuplicate(form,data.duplicateCount);if(approved)duplicateRetry={...body,duplicateConfirmed:true};else if(form.isConnected)form.querySelector('[data-sales-error]').textContent='중복 접수 저장을 취소했습니다. 입력 내용을 수정할 수 있습니다.';return;}
   if(!response.ok)throw Error(data.error||'접수 내역을 불러오지 못했습니다.');if(!body&&(version!==requestVersion||month!==requestedMonth))return;
   if(!store)showTest=!admin()&&testAccount()&&data.isTestAccount===true;if(!canViewTest())showTest=false;
   const changed=JSON.stringify(store?.records)!==JSON.stringify(data.records)||store?.month!==data.month||!!error;store=data;global.ReceiptForm?.updateCounselors(bridge.root.querySelector('[data-sales-form]'),data.counselorNames);error='';lastFetch=new Date().toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul'});
   if(body){if(body.action==='create'){if(form?.isConnected&&form.dataset.requestKey===body.requestKey)global.ReceiptForm.saved(form,data.savedReceipt||{});else if(!form)bridge.close();}bridge.toast('접수 상태를 저장했습니다.');global.dispatchEvent(new global.Event('cnc:sales-changed'));try{global.localStorage.setItem('cnchome.sales.changed',String(Date.now()))}catch(e){}}
   busy=false;if(changed||body)redraw();else {const el=bridge.root.querySelector('[data-sales-sync]');if(el)el.textContent='5초마다 자동 갱신 · 마지막 확인 '+lastFetch;}
  }catch(e){error=e.name==='AbortError'?(body?'저장 확인 응답이 지연되었습니다. 같은 입력으로 저장을 다시 눌러 확인해 주세요.':'조회 응답이 지연되었습니다. 잠시 후 다시 확인해 주세요.'):e.message;if(body){const target=form?.isConnected?form.querySelector('[data-sales-error]'):null;if(target)target.textContent=error;bridge.toast(error)}redraw();}
  finally{global.clearTimeout(timeout);if(form){form.removeAttribute('aria-busy');for(const [input,disabled] of controls)if(!form.hasAttribute('data-saved')||input.type==='reset')input.disabled=disabled;if(form.hasAttribute('data-saved')&&form.isConnected&&form.closest('dialog')?.open)form.querySelector('button[type="reset"]')?.focus();}loading=false;busy=false;if(duplicateRetry&&form?.isConnected)request(duplicateRetry,form);else if(month!==requestedMonth)request();}
 }
 function intake(){
  if(!live())return false;
  const own=live().user.department;
  bridge.open('접수증',global.ReceiptForm.markup({admin:admin(),staff:store?.staff||[],user:live().user,counselorNames:store?.counselorNames||[]}));
  const form=bridge.root.querySelector('[data-sales-form]');global.ReceiptForm.attach(form,{close:bridge.close});
  global.ConsultationLocation?.attach(form);global.IntakeDetails?.attach(form,{admin:admin(),team:()=>admin()?form.elements.employeeId.selectedOptions[0]?.dataset.team:own});return true;
 }
 function setMonth(value){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))return;month=value;selected=value===today().slice(0,7)?today():value+'-01';if(!weekAnchor.startsWith(month))weekAnchor=selected;requestVersion++;redraw();request();}
 function init(options){
  if(!live())return;bridge=options;store=null;error='';homeStatus=null;homeGraphDay=today();homeGraphOpen=false;showTest=false;
  try{const value=global.localStorage.getItem(weekStorageKey());if(value!==null&&/^[0-6]$/.test(value))weekStart=Number(value)}catch(e){}
  bridge.root.addEventListener('click',e=>{const b=e.target.closest('[data-sales-home-status]');if(!b)return;homeStatus=homeStatus===b.dataset.salesHomeStatus?null:b.dataset.salesHomeStatus;redraw()});
  function pickHomeDay(target){const b=target.closest('[data-sales-home-day]');if(!b)return;homeGraphDay=b.dataset.salesHomeDay;homeGraphOpen=true;redraw();}
  bridge.root.addEventListener('click',e=>pickHomeDay(e.target));
  bridge.root.addEventListener('keydown',e=>{if(e.target.closest('[data-sales-home-day]')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();pickHomeDay(e.target);}});
  bridge.root.addEventListener('click',e=>{const b=e.target.closest('[data-sales-week]');if(!b)return;const d=new Date(weekAnchor+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+Number(b.dataset.salesWeek)*7);weekAnchor=d.toISOString().slice(0,10);if(!weekAnchor.startsWith(month))setMonth(weekAnchor.slice(0,7));else redraw()});
  bridge.root.addEventListener('change',e=>{if(e.target.hasAttribute('data-sales-week-date')&&e.target.value){weekAnchor=e.target.value;if(!weekAnchor.startsWith(month))setMonth(weekAnchor.slice(0,7));else redraw()}if(e.target.hasAttribute('data-sales-week-start')){weekStart=Number(e.target.value);try{global.localStorage.setItem(weekStorageKey(),String(weekStart))}catch(e){}redraw()}});
  bridge.root.addEventListener('click',e=>{const b=e.target.closest('[data-sales-new],[data-sales-refresh],[data-sales-month],[data-sales-day]');if(!b)return;if(b.hasAttribute('data-sales-new'))intake();else if(b.hasAttribute('data-sales-refresh'))request();else if(b.dataset.salesMonth){const d=new Date(month+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+Number(b.dataset.salesMonth));setMonth(d.toISOString().slice(0,7))}else{selected=b.dataset.salesDay;selectedTeam=b.dataset.salesTeam;salesDetailsOpen=true;redraw()}});
  bridge.root.addEventListener('change',e=>{const el=e.target;if(el.hasAttribute('data-sales-month-input'))setMonth(el.value);if(el.hasAttribute('data-sales-test')){showTest=canViewTest()&&el.checked;redraw()}if(el.dataset.salesStatus){const row=store?.records.find(r=>r.id===el.dataset.salesStatus);if(row)request({action:'status',id:row.id,revision:row.revision,status:el.value})}});

  bridge.root.addEventListener('submit',e=>{const f=e.target.closest('[data-sales-form]');if(!f)return;e.preventDefault();if(!f.reportValidity())return;if(busy||loading){f.querySelector('[data-sales-error]').textContent=busy?'접수 정보를 저장하는 중입니다. 잠시 기다려 주세요.':'기존 접수 내역을 확인 중입니다. 잠시 후 저장을 다시 눌러 주세요.';return;}const data=Object.fromEntries(new FormData(f));request({...data,employeeId:Number(data.employeeId),birthYear:Number(data.birthYear),action:'create',requestKey:f.dataset.requestKey},f)});
  global.addEventListener('storage',e=>{if(e.key==='cnchome.sales.changed'&&active())request()});global.addEventListener('focus',()=>{if(active())request()});global.addEventListener('hashchange',()=>{if(active())request()});
  global.setInterval(()=>{if(!global.document.hidden&&active())request()},5000);request();
 }
 const api={init,handles,render,home,intake,chrome,core:{counts,daily,ageKind,weekDates}};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.SalesWorkspace=api;
})(typeof window!=='undefined'?window:globalThis);
