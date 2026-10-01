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
 const route=()=>new URL(global.location.href).searchParams.get('page')||live()?.page;
 function handles(page){return !!live()&&(admin()?['adminHome','adminPerformance'].includes(page):['sales','as'].includes(page))}
 const active=()=>handles(route());
 const allRows=()=>store?.month===month?(store.records||[]).filter(r=>!!r.isTest===showTest):[];
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
 function render(page){
  const ready=store?.month===month,records=rows().filter(r=>page!=='as'||r.status==='as');
  const title=admin()?(page==='adminHome'?'관리자 홈 · 업무현황':'실적 관리'):page==='as'?'나의 A/S':'나의 실적';
  const testAvailable=showTest||store?.records?.some(r=>r.isTest);
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
 async function request(body){
  if(loading||busy)return;const version=++requestVersion,requestedMonth=month;loading=true;if(body)busy=true;
  try{
   const response=await global.fetch('/sales-api.php?month='+encodeURIComponent(requestedMonth),{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':live().csrf},...(body?{body:JSON.stringify(body)}:{})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'접수 내역을 불러오지 못했습니다.');if(version!==requestVersion||month!==requestedMonth)return;
   if(!store)showTest=!admin()&&data.isTestAccount===true;
   const changed=JSON.stringify(store?.records)!==JSON.stringify(data.records)||store?.month!==data.month||!!error;store=data;error='';lastFetch=new Date().toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul'});
   if(body){if(body.action==='create'){const form=bridge.root.querySelector('.receipt-form');if(form)global.ReceiptForm.saved(form);else bridge.close();}bridge.toast('접수 상태를 저장했습니다.');global.dispatchEvent(new global.Event('cnc:sales-changed'));try{global.localStorage.setItem('cnchome.sales.changed',String(Date.now()))}catch(e){}}
   busy=false;if(changed||body)redraw();else {const el=bridge.root.querySelector('[data-sales-sync]');if(el)el.textContent='5초마다 자동 갱신 · 마지막 확인 '+lastFetch;}
  }catch(e){error=e.message;if(body){const target=bridge.root.querySelector('[data-sales-error]');if(target)target.textContent=error;bridge.toast(error)}redraw();}
  finally{loading=false;busy=false;if(month!==requestedMonth)request();}
 }
 function intake(){
  if(!live())return false;
  const own=live().user.department;
  bridge.open('접수증',global.ReceiptForm.markup({admin:admin(),staff:store?.staff||[],user:live().user}));
  const form=bridge.root.querySelector('[data-sales-form]');global.ReceiptForm.attach(form,{close:bridge.close});
  global.ConsultationLocation?.attach(form);global.IntakeDetails?.attach(form,{admin:admin(),team:()=>admin()?form.elements.employeeId.selectedOptions[0]?.dataset.team:own});return true;
 }
 function setMonth(value){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))return;month=value;selected=value===today().slice(0,7)?today():value+'-01';if(!weekAnchor.startsWith(month))weekAnchor=selected;requestVersion++;redraw();request();}
 function init(options){
  if(!live())return;bridge=options;showTest=false;
  try{const value=global.localStorage.getItem('tm-performance-week-start');if(value!==null&&/^[0-6]$/.test(value))weekStart=Number(value)}catch(e){}
  bridge.root.addEventListener('click',e=>{const b=e.target.closest('[data-sales-week]');if(!b)return;const d=new Date(weekAnchor+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+Number(b.dataset.salesWeek)*7);weekAnchor=d.toISOString().slice(0,10);if(!weekAnchor.startsWith(month))setMonth(weekAnchor.slice(0,7));else redraw()});
  bridge.root.addEventListener('change',e=>{if(e.target.hasAttribute('data-sales-week-date')&&e.target.value){weekAnchor=e.target.value;if(!weekAnchor.startsWith(month))setMonth(weekAnchor.slice(0,7));else redraw()}if(e.target.hasAttribute('data-sales-week-start')){weekStart=Number(e.target.value);try{global.localStorage.setItem('tm-performance-week-start',String(weekStart))}catch(e){}redraw()}});
  bridge.root.addEventListener('click',e=>{const b=e.target.closest('[data-sales-new],[data-sales-refresh],[data-sales-month],[data-sales-day]');if(!b)return;if(b.hasAttribute('data-sales-new'))intake();else if(b.hasAttribute('data-sales-refresh'))request();else if(b.dataset.salesMonth){const d=new Date(month+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+Number(b.dataset.salesMonth));setMonth(d.toISOString().slice(0,7))}else{selected=b.dataset.salesDay;selectedTeam=b.dataset.salesTeam;salesDetailsOpen=true;redraw()}});
  bridge.root.addEventListener('change',e=>{const el=e.target;if(el.hasAttribute('data-sales-month-input'))setMonth(el.value);if(el.hasAttribute('data-sales-test')){showTest=el.checked;redraw()}if(el.dataset.salesStatus){const row=store?.records.find(r=>r.id===el.dataset.salesStatus);if(row)request({action:'status',id:row.id,revision:row.revision,status:el.value})}});

  bridge.root.addEventListener('submit',e=>{const f=e.target.closest('[data-sales-form]');if(!f)return;e.preventDefault();if(!f.reportValidity()||busy||loading)return;const data=Object.fromEntries(new FormData(f));request({...data,employeeId:Number(data.employeeId),birthYear:Number(data.birthYear),action:'create',requestKey:f.dataset.requestKey})});
  global.addEventListener('storage',e=>{if(e.key==='cnchome.sales.changed'&&active())request()});global.addEventListener('focus',()=>{if(active())request()});global.addEventListener('hashchange',()=>{if(active())request()});
  global.setInterval(()=>{if(!global.document.hidden&&active())request()},5000);request();
 }
 const api={init,handles,render,intake,chrome,core:{counts,daily,ageKind,weekDates}};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.SalesWorkspace=api;
})(typeof window!=='undefined'?window:globalThis);
