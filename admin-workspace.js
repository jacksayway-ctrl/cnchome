(function (global) {
  'use strict';
  const pages = {
    adminPayroll: ['급여·지급 관리', '공제 확인부터 확정·명세서 공개·지급까지 순서대로 검토합니다.'],
    adminDaily: ['TM 일 그레이드', '매일 0건부터 별도 집계합니다. 급여·주휴수당에 합산하거나 차감하지 않습니다.'],
    adminDailyHistory: ['일 그레이드 지급 내역', 'TM 직원의 날짜별 지급 기록만 별도로 확인합니다.'],
    adminCorrections: ['정정·별도 정산', '정정 요청에 답변하고 차액의 지급 내역을 관리합니다.'],
    adminContracts: ['근로계약 관리', '직원별 계약 조건과 서명 대기 상태를 확인합니다.'],
    adminLeave: ['연차·휴가 관리', '발생분·사용분·잔여분과 사용기한을 확인합니다.'],
    adminPermissions: ['계정·권한 관리', '직책과 별개로 업무별 관리 권한을 지정합니다.'],
    adminAudit: ['변경 이력', '누가 어떤 사유로 변경했는지 전후 내용을 확인합니다.'],
    adminNotifications: ['알림 센터', '승인 요청, 실적 변동, 급여 처리 알림을 확인합니다.'],
    adminChecklist: ['운영 점검', '처리할 업무와 준비가 필요한 항목을 한곳에서 확인합니다.'],
    adminAttendance: ['출결 승인', '승인 조건을 확인하고 가능한 신청만 일괄 처리합니다.'],
    adminAs: ['A/S 검토·처리', '문제별 담당자·차감 결정·해결 상태를 관리합니다.']
  };
  const TODAY = '2026-10-15';
  const clone = value => JSON.parse(JSON.stringify(value));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => Number(n).toLocaleString('ko-KR') + '원';
  const sum = xs => xs.reduce((a,b) => a+b, 0);
  function seed(people) {
    const staff = people.map((p,i) => ({id:'staff-'+i, name:p.name, team:p.team, role:p.role||'상담원'}));
    return {staff, actor:'admin-owner', serial:10, calendars:{2026:{confirmed:false,days:[]},2027:{confirmed:false,days:[]}},
      leaves:staff.map(p=>({employee:p.id,lots:[{id:'leave-'+p.id,granted:8,used:2,expires:'2026-12-31'}]})),
      attendance:[
        {id:'AT-1',employee:'staff-0',kind:'연차',date:'2026-10-19',start:'10:00',end:'17:00',reason:'개인 일정',status:'대기'},
        {id:'AT-2',employee:'staff-1',kind:'외출',date:'2026-10-19',start:'14:00',end:'14:21',reason:'은행 업무',status:'대기'},
        {id:'AT-3',employee:'staff-1',kind:'조퇴',date:'2026-10-19',start:'14:10',end:'17:00',reason:'개인 일정',status:'대기'}
      ],
      cases:[{id:'RC-001',employee:'staff-0',blocked:false,issues:[
        {id:'AS-1',owner:'staff-0',reason:'상담 내용 재확인',decision:'대기',status:'진행',notes:[]},
        {id:'AS-2',owner:'staff-1',reason:'방문 일정 확인',decision:'없음',status:'진행',notes:[]}
      ]}],
      payroll:[0,1,2].map((i)=>({id:'PAY-'+i,employee:'staff-'+i,month:'2026-09',base:1500000+i*100000,allowance:180000,deductions:70000,confirmedDeductions:i===2,wageReviewed:false,adjustmentReviewed:true,status:'미확정',published:false,prepaid:0,snapshot:null,paidDate:null})),
      daily:[{id:'D-1',employee:'staff-0',date:'2026-09-22',amount:10000,paid:0},{id:'D-2',employee:'staff-1',date:'2026-09-22',amount:15000,paid:15000,paidDate:'2026-09-22'}],
      requests:[{id:'CR-1',employee:'staff-2',text:'보험료 공제액 입력 오류 확인 요청',status:'접수',reply:''}],
      settlements:[{id:'ST-1',employee:'staff-2',title:'퇴사자 별도 정산 · 예시',gross:200000,tax:10000,payments:[],reason:'확정된 별도 정산금 예시'}],
      contracts:[{id:'CT-1',employee:'staff-0',start:'2026-09-01',end:'2027-08-31',pay:'기본시급 12,000원 · 예시',status:'서명 대기',kind:'전자',file:false},{id:'CT-2',employee:'staff-1',start:'2026-09-01',end:'',pay:'기본시급 12,000원 · 예시',status:'초안',kind:'종이',file:false}],
      accounts:[{id:'admin-owner',name:'최고관리자 · 예시',highest:true,payroll:true,attendance:true,active:true},{id:'admin-payroll',name:'급여 담당 · 예시',highest:false,payroll:true,attendance:false,active:true},{id:'admin-attendance',name:'출결 담당 · 예시',highest:false,payroll:false,attendance:true,active:true}],
      audit:[],notifications:[],feedback:[]};
  }
  function actorName(s){return s.accounts.find(a=>a.id===s.actor)?.name || s.actor;}
  function staffName(s,id){return s.staff.find(p=>p.id===id)?.name || s.accounts.find(p=>p.id===id)?.name || id;}
  function log(s,area,target,before,after,reason){s.audit.unshift({id:'LOG-'+(++s.serial),at:new Date().toISOString(),actor:actorName(s),area,target,before:clone(before),after:clone(after),reason});}
  function notify(s,to,text,page){s.notifications.unshift({id:'N-'+(++s.serial),to,text,page,read:false});}
  function leaveRemaining(s,employee,date=TODAY){return sum((s.leaves.find(l=>l.employee===employee)?.lots||[]).filter(l=>l.expires>=date).map(l=>l.granted-l.used));}
  function minutes(time){const [h,m]=time.split(':').map(Number);return h*60+m;}
  function unpaidMinutes(r){if(r.kind==='연차')return 0;const a=Math.max(600,minutes(r.start)),b=Math.min(1020,minutes(r.end));const lunch=Math.max(0,Math.min(b,780)-Math.max(a,720));return Math.floor(Math.max(0,b-a-lunch)/10)*10;}
  function approveAttendance(s,ids){
    const selected=s.attendance.filter(r=>ids.includes(r.id)).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
    const results=[];
    for(const r of selected){
      let reason='';
      if(r.status!=='대기')reason='이미 처리된 신청';
      else if(r.employee===s.actor)reason='본인 신청은 다른 관리자가 처리해야 합니다.';
      else if(s.attendance.some(x=>x.id!==r.id&&x.employee===r.employee&&x.date===r.date&&x.status==='승인'&&minutes(x.start)<minutes(r.end)&&minutes(r.start)<minutes(x.end)))reason='승인된 출결 시간과 중복';
      else if(r.kind==='연차'&&leaveRemaining(s,r.employee,r.date)<1)reason='사용 가능한 연차 부족';
      if(reason){results.push({id:r.id,ok:false,reason});continue;}
      const before=clone(r);
      if(r.kind==='연차'){
        const lot=s.leaves.find(x=>x.employee===r.employee).lots.filter(l=>l.expires>=r.date&&l.used<l.granted).sort((a,b)=>a.expires.localeCompare(b.expires))[0];
        lot.used++;r.leaveLot=lot.id;
      }
      r.status='승인';r.unpaid=unpaidMinutes(r);log(s,'출결',r.id,before,r,'출결 승인');notify(s,staffName(s,r.employee),r.date+' '+r.kind+' 승인','adminAttendance');results.push({id:r.id,ok:true,reason:'승인'});
    }
    s.feedback=results.map(r=>r.id+' · '+r.reason);return results;
  }
  function updateAs(s,caseId,issueId,action,value,reason){
    if(!reason.trim())throw Error('변경 사유를 입력해 주세요.');
    const c=s.cases.find(c=>c.id===caseId), issue=c?.issues.find(i=>i.id===issueId);if(!issue)throw Error('A/S를 찾을 수 없습니다.');
    if(issue.status!=='진행')throw Error('이미 완료 또는 취소된 A/S입니다.');
    const before=clone(c),wasDeduct=issue.decision==='차감';
    if(action==='decision'){
      if(!['차감','없음'].includes(value))throw Error('차감 여부를 선택해 주세요.');
      issue.decision=value;if(value==='차감')c.blocked=true;
    }else if(action==='complete'){
      if(issue.decision==='대기')throw Error('차감 여부를 먼저 결정해 주세요.');issue.status='완료';
    }else if(action==='cancel')issue.status='취소';
    else if(action==='note')issue.notes.push({text:reason,actor:actorName(s)});
    else if(action==='assign'){
      const original=s.staff.find(p=>p.id===c.employee), next=s.staff.find(p=>p.id===value);
      if(!next||next.team!==original?.team)throw Error('해당 상품 부서의 직원을 선택해 주세요.');issue.owner=value;
    }else throw Error('지원하지 않는 변경입니다.');
    const active=c.issues.filter(i=>i.status!=='취소');
    if(active.every(i=>i.status==='완료'))c.blocked=false;
    // A withdrawn erroneous deduction has no remaining basis. Completed valid issues
    // continue to latch the deduction until all other valid issues are resolved.
    if(wasDeduct&&(action==='cancel'||(action==='decision'&&value==='없음'))&&!active.some(i=>i.decision==='차감'))c.blocked=false;
    log(s,'A/S',caseId+'/'+issueId,before,c,reason);
    if(before.blocked!==c.blocked)notify(s,staffName(s,c.employee),caseId+' 실적 '+(c.blocked?'차감':'복구')+' · '+reason,'adminAs');
    return c;
  }
  function payrollAmounts(s,p){
    if(p.snapshot)return p.snapshot;
    const gross=p.base+p.allowance;
    return {base:p.base,allowance:p.allowance,gross,deductions:p.deductions,prepaid:p.prepaid,net:gross-p.deductions-p.prepaid};
  }
  function payrollIssues(s,p){
    const result=[],[y,m]=p.month.split('-').map(Number),payYear=m===12?y+1:y;
    if(p.month>=TODAY.slice(0,7))result.push('월 종료 전');
    if([...new Set([y,payYear])].some(y=>!s.calendars[y]?.confirmed))result.push('공휴일 달력 확인 필요');
    if(!p.confirmedDeductions)result.push('공제액 확인 필요');
    if(!p.wageReviewed)result.push('임금 기준 검토 필요');
    if(!p.adjustmentReviewed)result.push('보정 재확인 필요');
    if(s.cases.some(c=>c.employee===p.employee&&c.issues.some(i=>i.status==='진행'&&i.decision==='대기')))result.push('A/S 차감 검토 대기');
    if(payrollAmounts(s,p).net<0)result.push('실지급액 음수');
    return result;
  }
  function payrollTransition(s,ids,action,date=TODAY){
    const results=[];
    for(const p of s.payroll.filter(p=>ids.includes(p.id))){
      let why='';const before=clone(p);
      if(action==='confirm')why=p.status!=='미확정'?'이미 확정됨':payrollIssues(s,p).join(' · ');
      else if(action==='publish')why=p.status!=='확정'?'확정된 미지급 급여만 공개할 수 있습니다.':p.published?'이미 공개됨':'';
      else if(action==='paid')why=p.status!=='확정'?'확정된 미지급 급여만 처리할 수 있습니다.':!p.published?'명세서 공개 필요':!date||date>TODAY?'실제 지급일을 확인해 주세요.':'';
      else why='지원하지 않는 처리';
      if(why){results.push({id:p.id,ok:false,reason:why});continue;}
      if(action==='confirm'){p.snapshot=clone(payrollAmounts(s,p));p.status='확정';}
      if(action==='publish'){p.published=true;notify(s,staffName(s,p.employee),p.month+' 급여명세서 공개','adminPayroll');}
      if(action==='paid'){p.status='지급 완료';p.paidDate=date;}
      log(s,'급여',p.id,before,p,'예시 '+({confirm:'확정',publish:'공개',paid:'전액 지급 또는 0원 확인'}[action]));results.push({id:p.id,ok:true,reason:p.status+(p.published?' · 공개됨':'')});
    }
    s.feedback=results.map(r=>r.id+' · '+r.reason);return results;
  }
  function setPermission(s,id,values,reason){
    if(!reason.trim())throw Error('변경 사유를 입력해 주세요.');
    const a=s.accounts.find(a=>a.id===id);if(!a)throw Error('계정을 찾을 수 없습니다.');
    if(a.highest&&a.active&&(!values.highest||!values.active)&&!s.accounts.some(x=>x.id!==id&&x.highest&&x.active))throw Error('활성 최고관리자를 최소 한 명 유지해야 합니다.');
    const before=clone(a);Object.assign(a,values);log(s,'권한',id,before,a,reason);
  }
  let state,bridge,currentPage,ui={query:{},status:{},selected:{},year:'2026'};
  const btn=(label,action,id='',extra='')=>`<button type="button" class="secondary" data-aw="${esc(action)}" data-id="${esc(id)}" ${extra}>${esc(label)}</button>`;
  const link=(label,page)=>`<button type="button" class="secondary" data-page="${page}">${esc(label)} →</button>`;
  const badge=(text,tone='')=>`<span class="aw-badge ${tone}">${esc(text)}</span>`;
  const card=(title,body)=>`<section class="panel"><h3>${esc(title)}</h3>${title==='월 급여 검토'?btn('예시 급여대장 XLSX','payroll-export'):''}${body}</section>`;
  const table=(heads,rows)=>`<div class="aw-scroll"><table><thead><tr>${heads.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${heads.length}" class="aw-empty">해당하는 내역이 없습니다.</td></tr>`}</tbody></table></div>`;
  const field=(label,name,value='',type='text',attrs='')=>`<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
  const reasonField=()=>'<label class="full">사유 / 답변<textarea name="reason" required maxlength="500" rows="3"></textarea></label>';
  const check=(label,name,checked=false)=>`<label class="aw-check"><input type="checkbox" name="${name}" ${checked?'checked':''}>${esc(label)}</label>`;
  const select=(label,name,options,value)=>`<label>${esc(label)}<select name="${name}">${options.map(([v,t])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
  const personOptions=()=>state.staff.map(p=>[p.id,p.name]);
  function form(kind,id,content,label='예시에 반영'){return `<form data-aw-form="${kind}" data-id="${esc(id)}" class="aw-form"><div class="fields">${content}</div><p class="aw-form-error" role="alert"></p><button class="action" type="submit">${esc(label)}</button></form>`;}
  function modal(title,content){bridge.open(title,`<div class="aw"><p class="sub">예시 데이터로 동작을 확인합니다. 실제 정보는 입력하지 마세요.</p>${content}</div>`);}
  function selection(id){return `<input type="checkbox" data-aw-select="${esc(id)}" aria-label="${esc(id)} 선택" ${(ui.selected[currentPage]||[]).includes(id)?'checked':''}>`;}
  function filterBar(statuses=[]){return `<form data-aw-form="search" class="aw-toolbar"><label>검색<input name="query" value="${esc(ui.query[currentPage]||'')}" placeholder="직원 이름 또는 관리번호"></label>${select('상태','status',[['','전체'],...statuses.map(s=>[s,s])],ui.status[currentPage]||'')}<button class="secondary" type="submit">조회</button></form>`;}
  function match(r,status=r.status){const q=(ui.query[currentPage]||'').toLowerCase();return (!q||[r.id,staffName(state,r.employee),r.text||''].join(' ').toLowerCase().includes(q))&&(!ui.status[currentPage]||ui.status[currentPage]===status);}
  function metrics(items){return `<div class="aw-metrics">${items.map(([label,value,detail])=>`<div><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail||'')}</small></div>`).join('')}</div>`;}
  function wrapper(title,desc,html){return `<div class="aw"><div class="aw-heading"><div><p class="aw-eyebrow">TM OFFICE · ADMIN</p><h2>${esc(title)}</h2><p class="sub">${esc(desc)}</p></div>${badge('업무 미리보기','blue')}</div><p class="aw-notice">예시 기준일 ${TODAY} · 모든 이름·금액은 가상 자료입니다. 이 화면의 변경은 새로고침하면 초기화되며 실제 승인·지급·서명·권한에는 반영되지 않습니다.</p>${state.feedback.length?`<div class="aw-feedback" role="status">${state.feedback.map(esc).join('<br>')}</div>`:''}${html}</div>`;}
  function home(){
    syncStaff();
    const pending=state.attendance.filter(r=>r.status==='대기').length,as=state.cases.flatMap(c=>c.issues).filter(i=>i.status==='진행'&&i.decision==='대기').length;
    return `<div class="aw aw-hub"><div class="aw-heading"><div><p class="aw-eyebrow">관리자 업무함</p><h2>먼저 확인할 업무</h2><p class="sub">새 관리자 업무 예시 · ${TODAY} 기준 · 새로고침 시 초기화</p></div>${link('운영 점검','adminChecklist')}</div><div class="aw-task-grid">${[[pending+'건','출결 승인 대기','중복 시간·잔여 연차 확인','adminAttendance'],[as+'건','A/S 차감 검토','검토 대기 건은 급여 확정 차단','adminAs'],[state.payroll.filter(p=>p.status==='미확정').length+'명','급여 검토','공제·달력·임금 기준 확인','adminPayroll'],[state.contracts.filter(c=>c.status==='서명 대기').length+'건','계약 서명 대기','계약 조건과 진행 상황 확인','adminContracts']].map(([n,t,h,p])=>`<button class="aw-task" type="button" data-page="${p}"><span>${t}</span><strong>${n}</strong><small>${h} →</small></button>`).join('')}</div><div class="aw-shortcuts">${link('TM 일 그레이드','adminDaily')}${link('정정·정산','adminCorrections')}${link('알림 '+state.notifications.filter(n=>!n.read).length,'adminNotifications')}${link('변경 이력','adminAudit')}</div></div>`;
  }
  function payrollPage(){
    const rows=state.payroll.filter(p=>match(p)).map(p=>{const a=payrollAmounts(state,p),issues=p.status==='미확정'?payrollIssues(state,p):[];return [selection(p.id),esc(staffName(state,p.employee)),p.month,money(a.gross),money(a.deductions),`<strong>${money(a.net)}</strong>`,badge(p.status,p.status==='지급 완료'?'green':'')+' '+(p.published?badge('공개','blue'):''),issues.length?`<span class="aw-warning">${issues.map(esc).join('<br>')}</span>`:'검토 완료',btn('상세·검토','payroll-detail',p.id)];});
    return metrics([['급여 귀속 월','2026년 9월','검토용 금액 예시'],['미확정',state.payroll.filter(p=>p.status==='미확정').length+'명'],['실지급액 합계',money(sum(state.payroll.map(p=>payrollAmounts(state,p).net)))]])+card('월 급여 검토',`<p class="sub">금액은 고정 예시입니다. 실적별 산식은 <a href="./payroll.html">급여 계산 검토</a>에서 별도로 확인할 수 있습니다.</p>${filterBar(['미확정','확정','지급 완료'])}<div class="aw-toolbar">${btn('표시된 직원 전체 선택','select-visible')}${btn('선택 확정','payroll-bulk','confirm')}${btn('선택 명세서 공개','payroll-bulk','publish')}${btn('선택 지급 완료','payroll-bulk','paid')}</div>${table(['선택','직원','귀속 월','세전','공제','실지급액','상태','확정 전 확인','관리'],rows)}<p class="sub">가능한 직원만 일괄 처리하고 제외 사유를 표시합니다. 명세서 공개 후에만 지급 완료할 수 있습니다.</p>`);
  }
  function koreaDay(now=new Date()){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
  function isTm(p){return ['상담원','TM','TM 직원'].includes(p?.role);}
  function dailyView(s,employee,date=koreaDay()){
    const eligible=isTm(s.staff.find(p=>p.id===employee));
    const d=eligible?s.daily.find(d=>d.employee===employee&&d.date===date):null;
    return {employee,date,eligible,count:d?.count||0,amount:d?.amount||0,paid:d?.paid||0,id:d?.id||''};
  }
  function recordDaily(s,employee,date,count,amount){
    if(!isTm(s.staff.find(p=>p.id===employee)))throw Error('TM 상담원만 일 그레이드 대상입니다.');
    if(date!==koreaDay())throw Error('오늘 실적만 집계할 수 있습니다. 날짜를 다시 확인해 주세요.');
    if(!Number.isSafeInteger(count)||count<0||!Number.isSafeInteger(amount)||amount<0||(count===0&&amount!==0))throw Error('실적과 달성 금액을 확인해 주세요.');
    let d=s.daily.find(d=>d.employee===employee&&d.date===date);if(d?.paid)throw Error('지급 완료된 기록은 유지합니다.');
    const before=d?clone(d):{};if(!d){d={id:'D-'+(++s.serial),employee,date,paid:0};s.daily.push(d);}Object.assign(d,{count,amount});log(s,'TM 일 그레이드',d.id,before,d,'당일 집계 · 급여 제외');return d;
  }
  function payDaily(s,id,date){
    const d=s.daily.find(d=>d.id===id);if(!d||!isTm(s.staff.find(p=>p.id===d.employee)))throw Error('TM 상담원 지급 건만 처리할 수 있습니다.');
    if(d.paid||d.amount<=0)throw Error('이미 지급했거나 지급할 금액이 없습니다.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||date>koreaDay()||date<d.date)throw Error('실제 지급일을 확인해 주세요.');
    const before=clone(d);d.paid=d.amount;d.paidDate=date;log(s,'TM 일 그레이드',id,before,d,'전액 지급 · 급여와 별도');
  }
  function dailyPage(){const date=koreaDay();return card('오늘 TM 일 그레이드 · '+date,`${link('지급 내역 조회','adminDailyHistory')}${table(['TM 직원','당일 실적','당일 달성액','지급액','관리'],state.staff.filter(isTm).map(p=>{const d=dailyView(state,p.id,date);return [esc(p.name),d.count+'건',money(d.amount),money(d.paid),d.paid?badge('지급 완료','green'):btn('당일 집계 입력','daily-edit',p.id)+(d.amount?btn('전액 지급 기록','daily-pay',d.id):'')];}))}<p class="sub">한국 시간 자정마다 새 날짜의 실적·금액을 0부터 표시합니다. 이전 기록은 지급 내역에 보존하며 이월하지 않습니다. 예시 집계 입력은 실제 접수와 연결되지 않았습니다. 현재 일 그레이드표의 가장 높은 달성 구간 금액만 적용하며 급여·주휴수당·명세서·급여대장에는 반영하지 않습니다.</p>`);}
  function dailyHistoryPage(){return card('날짜별 별도 지급 기록',`${link('오늘 집계','adminDaily')}${filterBar(['미지급','지급 완료'])}${table(['TM 직원','실적일','달성액','실제 지급액','지급일','상태'],state.daily.filter(d=>isTm(state.staff.find(p=>p.id===d.employee))&&match(d,d.paid?'지급 완료':'미지급')).map(d=>[esc(staffName(state,d.employee)),d.date,money(d.amount),money(d.paid),d.paidDate||'—',d.paid?badge('지급 완료','green'):btn('별도 지급 기록','daily-pay',d.id)]))}<p class="sub">미지급액도 급여로 넘기지 않습니다. 과거 기록은 새 날짜의 집계에 영향을 주지 않습니다.</p>`);}

  function attendancePage(){return metrics([['승인 대기',state.attendance.filter(r=>r.status==='대기').length+'건'],['승인',state.attendance.filter(r=>r.status==='승인').length+'건'],['무급 처리','건별 10분 내림','점심시간 제외']])+card('신청 검토',`${filterBar(['대기','승인','반려','취소'])}<div class="aw-toolbar">${btn('표시된 신청 전체 선택','select-visible')}${btn('선택 승인','attendance-bulk')}${link('연차 잔여분','adminLeave')}</div>${table(['선택','직원','구분','사용일·시간','사유','상태','무급','관리'],state.attendance.filter(r=>match(r)).map(r=>[selection(r.id),esc(staffName(state,r.employee)),r.kind,r.date+'<br>'+r.start+'–'+r.end,esc(r.reason),badge(r.status,r.status==='승인'?'green':''),r.unpaid===undefined?'승인 후 계산':r.unpaid+'분',r.status==='대기'?btn('검토','attendance-review',r.id):r.status==='승인'?btn('승인 취소','attendance-cancel',r.id):'—']))}<p class="sub">본인 신청 승인과 승인 시간 중복을 차단합니다. 연차는 사용일이 빠른 순서로 잔여 범위까지 승인하고 나머지는 대기로 남깁니다.</p>`);}
  function leavePage(){return card('직원별 연차 잔여분',`${filterBar()}${table(['직원','발생','사용','잔여','가장 빠른 사용기한','관리'],state.leaves.filter(l=>match({...l,id:l.employee})).map(l=>[esc(staffName(state,l.employee)),sum(l.lots.map(x=>x.granted))+'일',sum(l.lots.map(x=>x.used))+'일',leaveRemaining(state,l.employee)+'일',l.lots.filter(x=>x.used<x.granted).map(x=>x.expires).sort()[0]||'—',btn('초기 발생분 추가','leave-add',l.employee)]))}<p class="sub">현재 잔여분은 등록된 예시 발생분과 승인 사용분입니다. 근속기간에 따른 법정 자동 발생 계산은 아직 연결되지 않았습니다.</p>${link('출결 승인','adminAttendance')}`);}
  function asPage(){return card('A/S 검토 목록',`<div class="aw-toolbar">${btn('A/S 추가','as-add')}${filterBar(['진행','완료','취소'])}</div>${state.cases.map(c=>`<div class="aw-case"><div class="aw-heading"><h3>${esc(c.id)} · ${esc(staffName(state,c.employee))}</h3>${badge(c.blocked?'현재 실적 차감':'현재 실적 인정',c.blocked?'amber':'green')}</div>${table(['A/S','사유','담당자','차감 결정','상태','관리'],c.issues.filter(i=>match({id:i.id,employee:i.owner,text:i.reason,status:i.status})).map(i=>[esc(i.id),esc(i.reason),esc(staffName(state,i.owner)),badge(i.decision,i.decision==='대기'?'amber':''),badge(i.status),btn('상세·처리','as-detail',c.id+'/'+i.id)]))}</div>`).join('')}<p class="sub">등록만으로 차감하지 않습니다. 차감 후에는 모든 유효 A/S가 완료되어야 복구합니다. 유일한 차감 원인이 오류로 취소된 경우는 즉시 복구합니다. 확정 급여는 유지합니다.</p>`);}
  function correctionsPage(){return card('급여 정정 요청',`${filterBar(['접수','검토 중','처리 완료','반려'])}${table(['관리번호','직원','내용','상태','답변','관리'],state.requests.filter(r=>match(r)).map(r=>[r.id,esc(staffName(state,r.employee)),esc(r.text),badge(r.status),esc(r.reply||'답변 대기'),['접수','검토 중'].includes(r.status)?btn('검토·답변','correction-review',r.id):'—']))}`)+card('별도 정산 내역',`${table(['관리번호','직원','구분','실정산액','누적 지급','잔액 / 초과 지급','관리'],state.settlements.map(s=>{const total=s.gross-s.tax,paid=sum(s.payments.map(p=>p.amount)),rest=total-paid;return [s.id,esc(staffName(state,s.employee)),esc(s.title),money(total),money(paid),total<0?'반환 대상 '+money(-total):rest<0?'초과 지급 '+money(-rest):money(rest),btn('지급·이력','settlement-detail',s.id)];}))}<p class="sub">과지급·반환 금액은 표시하며 실제 반환 진행은 시스템 밖에서 관리합니다. 지급 입력 오류는 사유를 남겨 수정·취소합니다.</p>`);}
  function contractsPage(){return card('계약 목록',`${btn('계약 조건 등록','contract-add')}${filterBar(['초안','서명 대기','종이 서명 확인'])}${table(['직원','기간','임금 조건','서명 방식','상태','관리'],state.contracts.filter(c=>match(c)).map(c=>[esc(staffName(state,c.employee)),c.start+' ~ '+(c.end||'기간의 정함 없음'),esc(c.pay),c.kind,badge(c.status)+(c.status==='종이 서명 확인'&&!c.file?'<br>'+badge('서명본 미등록','amber'):''),btn('조건·진행 확인','contract-detail',c.id)]))}<p class="sub">서명 요청의 상태 흐름만 확인하는 예시입니다. 실제 전자서명, 서명본 보관과 계약서 PDF 생성은 연결되지 않았습니다.</p>`);}
  function permissionPage(){return card('관리 권한',`${table(['계정','최고관리자','급여','출결','이용 상태','관리'],state.accounts.map(a=>[esc(a.name),a.highest?'허용':'—',a.highest||a.payroll?'허용':'—',a.highest||a.attendance?'허용':'—',badge(a.active?'사용 중':'중지',a.active?'green':''),btn('권한 설정','permission-edit',a.id)]))}<p class="sub">현재 화면은 최고관리자 역할의 설정 예시입니다. 실제 로그인 권한을 부여하거나 차단하지 않습니다.</p>`)+card('권한 기준',table(['업무','처리 권한'],[['최고관리자 지정·회수 / 계약 관리','최고관리자'],['급여·그레이드·정상 접수·A/S·실적 이전','최고관리자 · 급여 관리자'],['출결 승인·증빙 조회','최고관리자 · 출결 관리자'],['팀원 급여 조회','팀장 권한만으로는 조회 불가'],['재입사 계정','새 계정 발급 · 이전 관리자 권한 승계 없음']])) ;}
  function auditPage(){const q=ui.query[currentPage]||'';return card('최근 변경 이력',`${filterBar()}${table(['시각','작업자','분야','대상','사유','전후 내역'],state.audit.filter(a=>[a.area,a.target,a.actor,a.reason].join(' ').includes(q)).map(a=>[new Date(a.at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}),esc(a.actor),esc(a.area),esc(a.target),esc(a.reason),btn('변경 비교','audit-detail',a.id)]))}<p class="sub">이 화면에서 수행한 예시 작업의 이력입니다. 운영 서버의 영구 감사 기록은 아닙니다.</p>`);}
  function notificationsPage(){return card('업무 알림',`${btn('모두 읽음','notify-read-all')}${table(['읽음','수신 대상','내용','바로가기'],state.notifications.map(n=>[n.read?'읽음':badge('새 알림','blue'),esc(n.to),esc(n.text),btn('확인','notify-open',n.id)]))}`);}
  function checklistPage(){const list=[['출결 검토',state.attendance.filter(r=>r.status==='대기').length+'건 대기','adminAttendance'],['A/S 차감 결정',state.cases.flatMap(c=>c.issues).filter(i=>i.status==='진행'&&i.decision==='대기').length+'건 대기','adminAs'],['2026년 공휴일 달력',state.calendars[2026].confirmed?'확인 완료':'확인 필요','adminSettings'],['급여 확정 조건',state.payroll.filter(p=>p.status==='미확정'&&payrollIssues(state,p).length).length+'명 확인 필요','adminPayroll'],['계약서 서명 대기',state.contracts.filter(c=>c.status==='서명 대기').length+'건','adminContracts'],['급여 정정 요청',state.requests.filter(r=>['접수','검토 중'].includes(r.status)).length+'건','adminCorrections']];return card('오늘의 운영 점검',table(['항목','현재 상태','처리'],list.map(([a,b,c])=>[a,b,link('확인',c)])))+card('운영 전 준비',`<p>실제 직원별 임금·그레이드표·계약서와 공휴일 달력을 등록해야 합니다.</p><ul><li>주휴 포함 시급 구분 산식과 미사용 연차수당 기준 임금: 문서 검토 대기</li><li>실제 로그인·권한 검사·영구 저장·파일 보관: 운영 서버 연결 대기</li><li>퇴직급여 제도·연차사용촉진: 기존 결정 대기 유지</li></ul><a href="./docs/PAYROLL_IMPLEMENTATION.md">전체 구현 현황</a>`);}
  function settings(){const y=ui.year,c=state.calendars[y];return `<div class="aw">${card('공휴일 달력 확인',`<p class="sub">예시 달력입니다. 실제 공휴일 정보가 사전 등록된 상태가 아닙니다. 연도별 등록 내용 확인을 마쳐야 급여 확정할 수 있습니다.</p><div class="aw-toolbar"><label>연도<select data-aw-year><option ${y==='2026'?'selected':''}>2026</option><option ${y==='2027'?'selected':''}>2027</option></select></label>${badge(c.confirmed?'확인 완료':'확인 대기',c.confirmed?'green':'amber')}${btn('휴일 등록','holiday-add',y)}${btn('예시 달력 확인 완료','calendar-confirm',y)}</div>${table(['날짜','휴일명','관리'],c.days.map(d=>[d.date,esc(d.name),btn('삭제','holiday-remove',y+'/'+d.date)]))}<p class="sub">확인 후 날짜를 추가·삭제하면 재확인 상태로 바뀝니다.</p>`)}${card('운영 바로가기',`<div class="aw-shortcuts">${link('계정·권한','adminPermissions')}${link('변경 이력','adminAudit')}${link('운영 점검','adminChecklist')}${link('알림 센터','adminNotifications')}</div>`)}</div>`;}
  function staffLinks(){return `<div class="aw">${card('인사·급여 업무',`<div class="aw-shortcuts">${link('근로계약','adminContracts')}${link('연차·휴가','adminLeave')}${link('급여·지급','adminPayroll')}${link('계정·권한','adminPermissions')}</div><p class="sub">직원 등록·팀 배정과 계약·급여·권한을 구분해 관리합니다.</p>`)}</div>`;}
  const renderers={adminPayroll:payrollPage,adminDaily:dailyPage,adminDailyHistory:dailyHistoryPage,adminAttendance:attendancePage,adminLeave:leavePage,adminAs:asPage,adminCorrections:correctionsPage,adminContracts:contractsPage,adminPermissions:permissionPage,adminAudit:auditPage,adminNotifications:notificationsPage,adminChecklist:checklistPage};
  function syncStaff(){
    if(!bridge)return;
    bridge.employees.forEach((p,i)=>{const id='staff-'+i,existing=state.staff.find(s=>s.id===id);if(existing){existing.name=p.name;existing.team=p.team;existing.role=p.role||'상담원';}else{state.staff.push({id,name:p.name,team:p.team,role:p.role||'상담원'});state.leaves.push({employee:id,lots:[]});}});
  }
  function render(page){syncStaff();if(currentPage!==page)state.feedback=[];currentPage=page;const [title,desc]=pages[page];return wrapper(title,desc,renderers[page]());}
  function refresh(message){bridge.render();if(message)bridge.toast(message+' · 예시 화면');}
  function getFormValues(form){return new FormData(form);}
  function openAction(action,id){
    if(action==='payroll-export'){
      const rows=[['예시 급여대장 · 실제 지급용 아님'],['직원','귀속 월','기본급','주·월 수당','세전 총액','공제','별도 기지급','실지급액','상태']];
      for(const p of state.payroll){const a=payrollAmounts(state,p);rows.push([staffName(state,p.employee),p.month,a.base,a.allowance,a.gross,a.deductions,a.prepaid,a.net,p.status]);}
      global.AdminXlsx.download(rows,'예시_급여대장_2026-09.xlsx');log(state,'내보내기','급여대장',{}, {rows:state.payroll.length},'예시 XLSX 다운로드');bridge.toast('예시 급여대장을 다운로드했습니다.');return;
    }
    if(action==='payroll-detail'){
      const p=state.payroll.find(p=>p.id===id),a=payrollAmounts(state,p);
      modal(staffName(state,p.employee)+' · '+p.month+' 급여',table(['기본급','주·월 수당','실지급액'],[[money(a.base),money(a.allowance),money(a.net)]])+(p.status==='미확정'?form('payroll-review',id,field('공제 합계(원)','deductions',p.deductions,'number','min="0" step="1" required')+check('공제액 또는 공제 없음 확인','deductionsChecked',p.confirmedDeductions)+check('예시 임금 기준 검토 완료','wageReviewed',p.wageReviewed)+check('기존 보정 내역 재확인','adjustmentReviewed',p.adjustmentReviewed),'검토 내용 반영'):`<p>${esc(p.status)} · ${p.published?'공개':'미공개'} · 확정 금액 보존</p>`));return;
    }
    if(action==='payroll-bulk'){
      const ids=ui.selected[currentPage]||[];if(!ids.length)throw Error('처리할 직원을 선택해 주세요.');
      if(id==='paid'){modal('선택 직원 지급 확인',form('payroll-paid','',field('실제 지급일','date',TODAY,'date',`required max="${TODAY}"`)+check('선택 직원에게 전액 지급했거나 지급할 금액이 없음을 확인합니다.','paidConfirmed'),'예시 지급 완료'));return;}
      payrollTransition(state,ids,id);refresh();return;
    }
    if(action==='daily-edit'){const d=dailyView(state,id);modal('오늘 TM 실적 입력 · 예시',form('daily-edit',id,field('집계일','date',koreaDay(),'date','required readonly')+field('오늘 정상 실적','count',d.count,'number','min="0" step="1" required')+'<p>현재 일 그레이드표의 최고 달성 구간 금액을 자동 적용합니다. 표의 달성수당이 0원이면 지급액도 0원입니다. 급여·주휴수당에는 반영되지 않습니다.</p>','당일 집계 반영'));return;}
    if(action==='daily-pay'){const d=state.daily.find(d=>d.id===id);modal('일수당 전액 지급',`<p>${esc(staffName(state,d.employee))} · ${d.date} · ${money(d.amount)}</p>`+form('daily-pay',id,field('실제 지급일','date',koreaDay(),'date',`required max="${koreaDay()}" min="${d.date}"`)+check('해당 일수당 전액을 지급했음을 확인합니다.','paidConfirmed')));return;}
    if(action==='attendance-bulk'){const ids=ui.selected[currentPage]||[];if(!ids.length)throw Error('신청을 선택해 주세요.');approveAttendance(state,ids);refresh();return;}
    if(action==='attendance-review'||action==='attendance-cancel'){
      const r=state.attendance.find(r=>r.id===id);
      modal('출결 신청 검토',`<p>${esc(staffName(state,r.employee))} · ${r.date} ${r.start}–${r.end} · ${r.kind}</p><p>${esc(r.reason)}</p>`+form('attendance',id,select('처리','action',action==='attendance-cancel'?[['cancel','승인 취소']]:[['approve','승인'],['reject','반려']],'approve')+reasonField()));return;
    }
    if(action==='leave-add'){modal('확인된 초기 연차 등록',form('leave-add',id,field('발생 일수','days','1','number','required min="1" max="100" step="1"')+field('사용기한','expires','2026-12-31','date',`required min="${TODAY}"`)+reasonField()));return;}
    if(action==='as-add'){modal('A/S 등록',form('as-add','',select('대상 접수','case',state.cases.map(c=>[c.id,c.id+' · '+staffName(state,c.employee)]),state.cases[0].id)+field('문제 내용','text','','text','required maxlength="100"')));return;}
    if(action==='as-detail'){
      const [cid,iid]=id.split('/'),c=state.cases.find(c=>c.id===cid),i=c.issues.find(i=>i.id===iid),team=state.staff.find(p=>p.id===c.employee)?.team;
      modal(cid+' · '+iid,`<p>${esc(i.reason)} · ${esc(i.status)} · 차감 결정 ${esc(i.decision)}</p>${i.notes.map(n=>`<p>${esc(n.actor)}: ${esc(n.text)}</p>`).join('')}`+(i.status==='진행'?form('as-update',id,select('처리','action',[['decision','차감 결정'],['note','경과 메모 추가'],['assign','담당자 변경'],['complete','정상 처리 완료'],['cancel','등록 오류 취소']],'decision')+select('차감 여부','decision',[['차감','차감'],['없음','차감 없음']],i.decision)+select('담당자','owner',state.staff.filter(p=>p.team===team).map(p=>[p.id,p.name]),i.owner)+reasonField()):'<p>완료·취소 이력을 보존합니다.</p>'));return;
    }
    if(action==='correction-review'){const r=state.requests.find(r=>r.id===id);modal('급여 정정 검토',`<p>${esc(r.text)}</p>`+form('correction',id,select('처리 상태','status',[['검토 중','검토 중'],['처리 완료','처리 완료'],['반려','반려']],r.status)+field('세전 정정 차액','gross',0,'number','step="1" required')+field('공제 조정액','tax',0,'number','step="1" required')+reasonField()));return;}
    if(action==='settlement-detail'){
      const s=state.settlements.find(s=>s.id===id),total=s.gross-s.tax,paid=sum(s.payments.map(p=>p.amount));
      modal('별도 정산 지급 기록',`<p>${esc(s.title)} · ${esc(staffName(state,s.employee))}</p><p>실정산액 ${money(total)} · 누적 지급 ${money(paid)}</p>${table(['지급일','금액','정정'],s.payments.map(p=>[p.date,money(p.amount),btn('입력 오류 정정','payment-edit',s.id+'/'+p.id)]))}`+(total>0?form('settlement-pay',id,field('실제 지급일','date',TODAY,'date',`required max="${TODAY}"`)+field('실제 지급액','amount',Math.max(0,total-paid),'number','required min="1" step="1"')+reasonField()) : '<p>반환 대상 금액과 사유를 기록합니다. 실제 반환은 시스템 밖에서 관리합니다.</p>'));return;
    }
    if(action==='payment-edit'){const [sid,pid]=id.split('/'),s=state.settlements.find(s=>s.id===sid),p=s.payments.find(p=>p.id===pid);modal('정산 지급 입력 오류 정정',form('payment-edit',id,field('정정 지급일','date',p.date,'date',`required max="${TODAY}"`)+field('정정 금액 · 취소는 0원','amount',p.amount,'number','required min="0" step="1"')+reasonField()));return;}
    if(action==='contract-add'){modal('계약 조건 등록',form('contract-add','',select('직원','employee',personOptions(),state.staff[0].id)+field('계약 시작일','start',TODAY,'date','required')+field('계약 종료일 · 무기계약은 공란','end','','date')+field('임금 조건 요약','pay','','text','required maxlength="200"')+select('서명 방식','kind',[['전자','전자'],['종이','종이']],'전자')));return;}
    if(action==='contract-detail'){const c=state.contracts.find(c=>c.id===id);modal('계약 조건·진행',`<p>${esc(staffName(state,c.employee))} · ${c.start} ~ ${c.end||'기간의 정함 없음'}</p><p>${esc(c.pay)}</p><p>${badge(c.status)} · ${c.kind}</p>`+(c.status==='초안'?form('contract-request',id,check('예시 회사 측 검토를 마쳤습니다.','reviewed'),'서명 요청 흐름 확인'):c.kind==='종이'&&c.status==='서명 대기'?form('contract-paper',id,check('종이 서명을 확인한 상황을 예시로 표시합니다.','reviewed'),'종이 서명 확인 표시'):'<p>직원 서명·서명본 등록은 운영 서버 연결 후 제공됩니다.</p>'));return;}
    if(action==='permission-edit'){const a=state.accounts.find(a=>a.id===id);modal(a.name+' 권한',form('permission',id,check('최고관리자','highest',a.highest)+check('급여 관리','payroll',a.payroll)+check('출결 관리','attendance',a.attendance)+check('계정 사용','active',a.active)+reasonField()));return;}
    if(action==='audit-detail'){const a=state.audit.find(a=>a.id===id);modal('변경 전후 비교',`<p>${esc(a.reason)}</p><div class="aw-compare"><section><h3>변경 전</h3><pre>${esc(JSON.stringify(a.before,null,2))}</pre></section><section><h3>변경 후</h3><pre>${esc(JSON.stringify(a.after,null,2))}</pre></section></div>`);return;}
    if(action==='holiday-add'){modal(id+'년 예시 휴일 등록',form('holiday-add',id,field('날짜','date',id+'-01-01','date',`required min="${id}-01-01" max="${id}-12-31"`)+field('휴일명','name','','text','required maxlength="50"')));return;}
    if(action==='holiday-remove'){const [year,date]=id.split('/'),c=state.calendars[year],before=clone(c);c.days=c.days.filter(d=>d.date!==date);c.confirmed=false;log(state,'공휴일',id,before,c,'예시 휴일 삭제 · 재확인 필요');refresh('달력을 재확인해 주세요.');return;}
    if(action==='calendar-confirm'){const c=state.calendars[id],before=clone(c);c.confirmed=true;log(state,'공휴일',id,before,c,'예시 달력 확인');refresh('예시 달력 확인 완료');return;}
    if(action==='notify-read-all'){state.notifications.forEach(n=>n.read=true);refresh();return;}
    if(action==='notify-open'){const n=state.notifications.find(n=>n.id===id);n.read=true;global.location.hash=n.page;refresh();return;}
    if(action==='select-visible'){ui.selected[currentPage]=[...document.querySelectorAll('[data-aw-select]')].map(e=>e.dataset.awSelect);refresh();return;}
  }
  function handleForm(f){
    const data=getFormValues(f),kind=f.dataset.awForm,id=f.dataset.id,reason=String(data.get('reason')||'').trim(),num=name=>{const n=Number(data.get(name));if(!Number.isSafeInteger(n))throw Error('금액·일수는 정수로 입력해 주세요.');return n;};
    if(f.querySelector('[name="reason"]')&&!reason)throw Error('공백이 아닌 사유를 입력해 주세요.');
    if(kind==='search'){ui.query[currentPage]=String(data.get('query')||'');ui.status[currentPage]=String(data.get('status')||'');ui.selected[currentPage]=[];bridge.render();return;}
    if(kind==='payroll-review'){
      const p=state.payroll.find(p=>p.id===id);if(p.status!=='미확정')throw Error('미확정 급여만 수정할 수 있습니다.');const before=clone(p),deductions=num('deductions');if(deductions<0)throw Error('공제 합계는 0원 이상이어야 합니다.');
      Object.assign(p,{deductions,confirmedDeductions:data.has('deductionsChecked'),wageReviewed:data.has('wageReviewed'),adjustmentReviewed:data.has('adjustmentReviewed')});log(state,'급여 검토',id,before,p,'예시 공제·임금 기준 검토');
    }else if(kind==='payroll-paid'){
      if(!data.has('paidConfirmed'))throw Error('실제 지급 여부를 확인해 주세요.');payrollTransition(state,ui.selected.adminPayroll||[],'paid',String(data.get('date')));
    }else if(kind==='daily-pay'){
      const d=state.daily.find(d=>d.id===id);if(d.paid)throw Error('이미 지급한 일수당입니다.');

      if(!data.has('paidConfirmed'))throw Error('실제 지급을 확인해 주세요.');payDaily(state,id,String(data.get('date')));
    }else if(kind==='daily-edit'){
      recordDaily(state,id,String(data.get('date')),num('count'),bridge.dailyAward(num('count')));
    }else if(kind==='attendance'){
      const r=state.attendance.find(r=>r.id===id),action=data.get('action');if(r.employee===state.actor)throw Error('본인 신청은 다른 관리자가 처리해야 합니다.');
      if(action==='approve'){const result=approveAttendance(state,[id])[0];if(!result?.ok)throw Error(result?.reason||'처리할 신청이 없습니다.');}
      else {if(!reason)throw Error('사유가 필요합니다.');const before=clone(r);if(action==='cancel'){if(r.status!=='승인')throw Error('승인된 신청만 취소할 수 있습니다.');if(r.date<TODAY)throw Error('이미 사용한 휴가는 별도 출결 정정이 필요합니다.');const lot=state.leaves.find(l=>l.employee===r.employee)?.lots.find(l=>l.id===r.leaveLot);if(lot)lot.used--;r.status='취소';}else{if(r.status!=='대기')throw Error('대기 신청만 반려할 수 있습니다.');r.status='반려';}r.reply=reason;log(state,'출결',id,before,r,reason);notify(state,staffName(state,r.employee),r.kind+' '+r.status+' · '+reason,'adminAttendance');}
    }else if(kind==='leave-add'){
      const days=num('days'),expires=String(data.get('expires'));if(days<1||days>100||expires<TODAY)throw Error('일수와 사용기한을 확인해 주세요.');const l=state.leaves.find(l=>l.employee===id),before=clone(l);l.lots.push({id:'LOT-'+(++state.serial),granted:days,used:0,expires});log(state,'연차',id,before,l,reason);
    }else if(kind==='as-add'){
      const c=state.cases.find(c=>c.id===data.get('case')),before=clone(c);c.issues.push({id:'AS-'+(++state.serial),owner:c.employee,reason:String(data.get('text')).trim(),decision:'대기',status:'진행',notes:[]});log(state,'A/S',c.id,before,c,'문제별 A/S 등록');notify(state,'급여 관리자 전체',c.id+' A/S 차감 검토 필요','adminAs');
    }else if(kind==='as-update'){
      const [cid,iid]=id.split('/'),action=String(data.get('action'));updateAs(state,cid,iid,action,String(data.get(action==='assign'?'owner':'decision')||''),reason);
    }else if(kind==='correction'){
      const r=state.requests.find(r=>r.id===id);if(!['접수','검토 중'].includes(r.status))throw Error('이미 처리된 요청입니다.');if(!reason)throw Error('직원에게 전달할 답변을 입력해 주세요.');const status=String(data.get('status')),gross=num('gross'),tax=num('tax');if(!['검토 중','처리 완료','반려'].includes(status))throw Error('처리 상태를 확인해 주세요.');const before=clone(r);r.status=status;r.reply=reason;
      if(r.status==='처리 완료'){state.settlements.push({id:'ST-'+(++state.serial),employee:r.employee,title:r.id+' 정정 차액',gross,tax,payments:[],reason});}
      log(state,'급여 정정',id,before,r,reason);notify(state,staffName(state,r.employee),id+' '+r.status+' · '+reason,'adminCorrections');
    }else if(kind==='settlement-pay'){
      const s=state.settlements.find(s=>s.id===id),amount=num('amount'),date=String(data.get('date'));if(amount<=0||s.gross-s.tax<=0||date>TODAY)throw Error('지급 금액과 날짜를 확인해 주세요.');const before=clone(s);s.payments.push({id:'PM-'+(++state.serial),amount,date});log(state,'별도 정산',id,before,s,reason);if(sum(s.payments.map(p=>p.amount))>s.gross-s.tax)state.feedback=['실제 지급액을 기록했습니다. 초과 지급 금액을 확인해 주세요.'];
    }else if(kind==='payment-edit'){
      const [sid,pid]=id.split('/'),s=state.settlements.find(s=>s.id===sid),p=s.payments.find(p=>p.id===pid),amount=num('amount'),date=String(data.get('date'));if(amount<0||date>TODAY)throw Error('금액·날짜를 확인해 주세요.');const before=clone(s);Object.assign(p,{amount,date});log(state,'정산 지급 정정',id,before,s,reason);
    }else if(kind==='contract-add'){
      const start=String(data.get('start')),end=String(data.get('end'));if(end&&end<start)throw Error('종료일은 시작일 이후여야 합니다.');const c={id:'CT-'+(++state.serial),employee:String(data.get('employee')),start,end,pay:String(data.get('pay')),kind:String(data.get('kind')),status:'초안',file:false};state.contracts.push(c);log(state,'근로계약',c.id,{},c,'예시 계약 조건 등록');
    }else if(kind==='contract-request'||kind==='contract-paper'){
      if(!data.has('reviewed'))throw Error('확인 항목을 선택해 주세요.');const c=state.contracts.find(c=>c.id===id),before=clone(c);if(kind==='contract-request'&&c.status!=='초안')throw Error('초안만 요청할 수 있습니다.');if(kind==='contract-paper'&&(c.kind!=='종이'||c.status!=='서명 대기'))throw Error('종이 서명 대기 계약만 처리할 수 있습니다.');c.status=kind==='contract-request'?'서명 대기':'종이 서명 확인';log(state,'근로계약',id,before,c,'계약 진행 예시');notify(state,staffName(state,c.employee),id+' '+c.status,'adminContracts');
    }else if(kind==='permission'){
      setPermission(state,id,{highest:data.has('highest'),payroll:data.has('payroll'),attendance:data.has('attendance'),active:data.has('active')},reason);
    }else if(kind==='holiday-add'){
      const date=String(data.get('date')),name=String(data.get('name')).trim(),c=state.calendars[id];if(!date.startsWith(id+'-')||!name||c.days.some(d=>d.date===date))throw Error('연도와 중복 날짜를 확인해 주세요.');const before=clone(c);c.days.push({date,name});c.days.sort((a,b)=>a.date.localeCompare(b.date));c.confirmed=false;log(state,'공휴일',date,before,c,'휴일 추가 · 재확인 필요');
    }else return;
    bridge.close();refresh('변경 내용을 반영했습니다.');
  }
  function init(options){
    bridge=options;state=seed(options.employees);
    const root=options.root;
    let lastDay=koreaDay();setInterval(()=>{const day=koreaDay();if(day!==lastDay){lastDay=day;bridge.render();}},1000);
    root.addEventListener('click',e=>{const b=e.target.closest('[data-aw]');if(!b)return;try{openAction(b.dataset.aw,b.dataset.id);}catch(error){bridge.toast(error.message);}});
    root.addEventListener('change',e=>{if(e.target.matches('[data-aw-select]')){const ids=new Set(ui.selected[currentPage]||[]);e.target.checked?ids.add(e.target.dataset.awSelect):ids.delete(e.target.dataset.awSelect);ui.selected[currentPage]=[...ids];}if(e.target.matches('[data-aw-year]')){ui.year=e.target.value;bridge.render();}});
    root.addEventListener('submit',e=>{const f=e.target.closest('[data-aw-form]');if(!f)return;e.preventDefault();if(!f.reportValidity())return;try{handleForm(f);}catch(error){const out=f.querySelector('[role="alert"]');if(out)out.textContent=error.message;else bridge.toast(error.message);}});
  }
  const api={pages,init,render,home,settings,staffLinks,core:{koreaDay,isTm,dailyView,recordDaily,payDaily,seed,approveAttendance,updateAs,payrollAmounts,payrollIssues,payrollTransition,setPermission,leaveRemaining,unpaidMinutes},getState:()=>clone(state),todayDaily:(id='staff-0')=>dailyView(state,id)};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else global.AdminWorkspace=api;
})(typeof window!=='undefined'?window:globalThis);
