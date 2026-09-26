(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./grade-calendar.js'),require('./grade-numbers.js'));
  else root.GradeCalendarPreview=factory(root.GradeCalendar,root.GradeNumbers);
})(typeof globalThis!=='undefined'?globalThis:this,function(C,N){
  'use strict';
  function create(api){
    const key='tm-office-grade-calendar-preview-v1',root=api.root,esc=api.escape,money=api.money;
    let month='2026-09',role='general',mode='aggregate',ledger={},configs={},notice='';
    try{const saved=JSON.parse(api.storage?.getItem(key)||'null');if(saved?.version===1){for(const [department,rows] of Object.entries(saved.ledger||{})){ledger[department]={};for(const row of Object.values(rows))ledger[department][C.validateRecord(row).date]=row;}configs=saved.configs||{};}}catch{ledger={};configs={};notice='이전 입력 예시를 읽지 못했습니다. 날짜별 실적을 다시 확인해 주세요.';}
    const department=()=>api.department();
    const values=()=>{
      const saved=configs[department()+':'+month];
      if(saved){try{C.distribute(month,N.parse(saved.count),N.parse(saved.days),N.parse(saved.hours));return saved;}catch{if(saved.count===''||saved.days===''||saved.hours==='')return saved;}}
      return {count:'150',days:String(Math.min(22,C.workdays(month).length)),hours:'6'};
    };
    const rows=()=>ledger[department()]||(ledger[department()]={});
    function save(){try{api.storage?.setItem(key,JSON.stringify({version:1,ledger,configs}));notice='';}catch{notice='입력값을 저장하지 못했습니다. 현재 화면에서는 계산할 수 있습니다.';}}
    function ensureMonth(){if(!Object.keys(rows()).some(date=>date.startsWith(month))){const v=values();for(const row of C.distribute(month,N.parse(v.count),N.parse(v.days),N.parse(v.hours)))rows()[row.date]=row;}}
    function dates(){const current=C.workdays(month),start=C.week(current[0]).start,out=[];for(let date=start;date<=current.at(-1);date=C.shift(date,1)){if(C.workdays(date.slice(0,7)).includes(date))out.push(date);}return out;}
    function recordTable(){return `<details class="grade-date-records"><summary>날짜별 실적·시간 / 이전 달에서 이어진 주 입력</summary><p class="sub">월 합계 입력은 월~금에 나눈 예상치입니다. 날짜별 값을 수정하면 해당 날짜의 실적으로 계산합니다. 이전 달 날짜의 빈칸은 실제 실적과 시간을 입력해 주세요. 실적이 없으면 0건·0시간을 입력합니다.</p><div class="scroll"><table><thead><tr><th>날짜</th><th>정상 실적 (건)</th><th>근무시간</th><th>주수당 귀속 월</th></tr></thead><tbody>${dates().map(date=>{const row=rows()[date],previous=!date.startsWith(month);return `<tr${previous?' class="grade-carryover-row"':''}><td>${date}${previous?' · 이전 달':''}</td><td><input type="text" inputmode="decimal" data-grade-number min="0" max="1000000" step="0.5" data-grade-record-date="${date}" data-grade-record-field="count" aria-label="${date} 정상 실적" value="${row?N.format(row.count):''}" placeholder="미입력"></td><td><input type="text" inputmode="decimal" data-grade-number min="0" max="24" step="0.5" data-grade-record-date="${date}" data-grade-record-field="hours" aria-label="${date} 근무시간" value="${row?N.format(row.hours):''}" placeholder="미입력"></td><td>${C.week(date).payrollMonth}</td></tr>`;}).join('')}</tbody></table></div></details>`;}
    function html(){
      ensureMonth();const v=values();
      return `<section class="panel" id="tm-grade-calendar-preview"><h2>일반직원 · 날짜별 급여 계산</h2><p class="sub">주그레이드는 월~금 한 주에 한 번 합산합니다. 월말에 걸친 주는 다음 달 급여로 이어집니다. 주·월 그레이드는 급여에 포함하고, 팀장은 별도 서식을 사용합니다.</p><form id="tm-grade-preview-form"><div class="grade-preview-fields"><label>급여 귀속 월<input id="tm-grade-preview-month" type="month" min="2000-01" max="2099-12" required value="${month}"></label><label>대상 직책<select id="tm-grade-preview-role"><option value="general" ${role==='general'?'selected':''}>일반직원</option><option value="leader" ${role==='leader'?'selected':''}>팀장 · 별도 서식</option></select></label><label>입력 방식<select id="tm-grade-preview-mode"><option value="aggregate" ${mode==='aggregate'?'selected':''}>월 합계로 예상 계산</option><option value="daily" ${mode==='daily'?'selected':''}>날짜별 실적으로 계산</option></select></label><label>그레이드<select id="tm-grade-preview-period"><option value="aggregate">합산</option></select></label><label>정상 실적 (월 합계)<input id="tm-grade-preview-count" type="text" inputmode="decimal" data-grade-number min="0" max="1000000" step="0.5" required value="${esc(N.format(v.count))}" ${mode==='daily'?'disabled':''}></label><label>근무일 (일)<input id="tm-grade-preview-days" type="text" inputmode="decimal" data-grade-number min="1" max="${C.workdays(month).length}" step="1" required value="${esc(N.format(v.days))}" ${mode==='daily'?'disabled':''}></label><label>시간 (하루 근무시간)<input id="tm-grade-preview-hours" type="text" inputmode="decimal" data-grade-number min="0.5" max="24" step="0.5" required value="${esc(N.format(v.hours))}" ${mode==='daily'?'disabled':''}></label></div>${recordTable()}<button type="submit" class="action" data-grade-preview-confirm>확인</button></form><div id="tm-grade-preview-result" aria-live="polite"><p class="sub">확인 버튼을 누르면 적용 시작일과 날짜별 실적으로 계산합니다.</p></div><p class="sub">급여(세전) = 기간별 근로 급여 + 주그레이드 + 월그레이드. 일그레이드는 별도 현금이며 ‘일그레이드 포함 합계’에서만 더합니다. 이 입력 예시는 현재 브라우저에 보관되어 다음 달 계산으로 이어집니다.</p>${notice?`<p role="status">${esc(notice)}</p>`:''}</section>`;
    }
    function replace(){const container=root.querySelector('#tm-grade-calendar-preview');if(container)container.outerHTML=html();}
    function readInputs(){
      const field=name=>root.querySelector('#tm-grade-preview-'+name);
      const monthField=field('month'),m=monthField?.value;if(monthField&&!m)throw Error('급여 귀속 월을 선택해 주세요.');if(m&&m!==month){C.monthDates(m);month=m;mode=configs[department()+':'+month]?.mode||'aggregate';return;}
      role=field('role')?.value||role;mode=field('mode')?.value||mode;
      const count=field('count'),days=field('days'),hours=field('hours');
      if(count&&days&&hours&&mode==='aggregate')configs[department()+':'+month]={count:N.raw(count.value),days:N.raw(days.value),hours:N.raw(hours.value),mode};
    }
    function collect(){
      if(!root.querySelectorAll)return;
      const pairs=new Map();for(const el of root.querySelectorAll('[data-grade-record-date]')){const date=el.dataset.gradeRecordDate;if(!pairs.has(date))pairs.set(date,{});pairs.get(date)[el.dataset.gradeRecordField]=el.value;}
      for(const [date,pair] of pairs){if(mode==='aggregate'&&date.startsWith(month))continue;if(pair.count===''&&pair.hours===''){delete rows()[date];continue;}if(pair.count===''||pair.hours==='')throw Error(date+'의 실적과 근무시간을 모두 입력해 주세요.');rows()[date]=C.validateRecord({date,count:N.parse(pair.count),hours:N.parse(pair.hours),role:'general'});}
    }
    function resultHtml(r){
      if(!r.eligible)return `<div class="notice" data-grade-role-excluded>${esc(r.reason)} 일반직원 급여에 합산하지 않습니다.</div>`;
      const rates=r.rates.length? r.rates.map(money).join(' / '):'근무시간 없음';
      const pending=r.weeks.filter(w=>w.payrollMonth===month&&w.missing.length);
      const weeklyRows=r.weeks.map(w=>[w.start+' ~ '+w.end,N.format(w.count)+'건',w.payrollMonth,w.carryover?'다음 달로 이월':w.missing.length?'미입력 날짜 확인 필요':w.fromPreviousMonth?'이전 달에서 연결 · 이번 급여 합산':'이번 급여 합산',w.missing.length?'집계 중':money(w.bonus)]);
      return api.table(['정상 실적','일그레이드 (별도 현금)','주그레이드','월그레이드','시급','근무일','시간 (총)'],[[N.format(r.count)+'건',money(r.daily),money(r.weekly),money(r.monthly.bonus),rates,N.format(r.days)+'일',N.format(r.hours)+'시간']])+`<p>기간별 근로 급여: <strong>${money(r.base)}</strong></p><p>월그레이드: 목표달성수당 ${money(r.monthly.achievement)} + 실적수당 ${money(r.monthly.extra)}</p><p class="notice" data-grade-final-amount><strong>최종 예상액 (세전): ${money(r.salary)} / 일그레이드 포함 합계: ${money(r.total)}</strong></p><div class="notice" data-grade-calculation-amount><strong class="grade-calculation-title">총 계산 금액</strong><p class="grade-calculation-formula">정상실적 × 50,000원 − 일그레이드 포함 지급액(세전)</p><p class="grade-calculation-values"><span>${r.count.toLocaleString('ko-KR')}건 × 50,000원</span><span>− ${money(r.total)}</span><span>= <strong>${money(r.calculationAmount)}</strong></span></p></div>${pending.length?`<p class="notice" data-grade-week-pending>미입력 날짜가 있는 ${pending.length}개 주는 주수당 합계에서 보류했습니다. 날짜별 입력에서 ${pending.flatMap(w=>w.missing).join(', ')} 실적과 시간을 입력해 주세요.</p>`:''}<h3>주그레이드 · 급여 귀속 내역</h3>${api.table(['집계 기간 (월~금)','정상 실적','급여 귀속 월','처리','주수당'],weeklyRows)}<details><summary>변경일 전후 계산 근거</summary><p class="sub">수정 중 기준은 ${esc(api.effectiveDate())}부터 적용합니다. 변경 전 날짜는 이전 기준을 유지합니다. 주중에 표가 바뀌면 기간별 계산액을 한 주수당으로 합쳐 한 번 반영합니다.</p><h3>주그레이드 적용 기간</h3>${api.table(['주 시작','기준 적용 기간','실적','평균 산정일','계산 수당'],r.weeks.flatMap(w=>w.segments.map(s=>[w.start,s.start+' ~ '+s.end,N.format(s.count)+'건',N.format(s.days)+'일',money(s.bonus)])))}<h3>월그레이드 적용 기간</h3>${api.table(['적용 기간','정상 실적','시간','시급','월수당'],r.monthly.segments.map(s=>[s.start+' ~ '+s.end,N.format(s.count)+'건',N.format(s.hours)+'시간',money(s.hourly),money(s.bonus)]))}</details>`;
    }
    function update(calculate=false){
      const target=root.querySelector('#tm-grade-preview-result');if(!target)return;
      try{
        readInputs();
        if(!calculate){target.innerHTML='<p class="sub">확인 버튼을 누르면 현재 입력값과 적용일 기준으로 다시 계산합니다.</p>';return;}
        if(role!=='general'){target.innerHTML=resultHtml({eligible:false,reason:'팀장은 별도 서식으로 설정합니다.'});return;}
        const policy=api.policy(),error=api.validate(policy);if(error)throw Error(error);if(!C.validDate(api.effectiveDate()))throw Error('그레이드 적용 시작일을 확인해 주세요.');
        collect();
        if(mode==='aggregate'){const v=values();for(const id of ['count','days','hours']){const el=root.querySelector('#tm-grade-preview-'+id);if(el&&(el.value===''||!el.checkValidity()))throw Error('정상 실적·근무일·시간을 올바르게 입력해 주세요.');}for(const row of C.distribute(month,N.parse(v.count),N.parse(v.days),N.parse(v.hours)))rows()[row.date]=row;}
        const result=C.calculate({month,records:Object.values(rows()),entries:[...api.entries(),{date:api.effectiveDate(),savedAt:'9999',department:department(),policy}],defaults:api.defaults(),department:department(),role,evaluate:api.evaluate,signature:api.signature});
        if(mode==='daily')configs[department()+':'+month]={...values(),mode};
        save();target.innerHTML=resultHtml(result)+(notice?`<p role="status">${esc(notice)}</p>`:'');
        const details=root.querySelector('.grade-date-records');if(details){const opened=details.open;details.outerHTML=recordTable();root.querySelector('.grade-date-records').open=opened;}
      }catch(error){target.textContent=error.message;}
    }
    root.addEventListener('input',event=>{
      const el=event.target;
      if(el.dataset?.gradeRecordDate){mode='daily';const select=root.querySelector('#tm-grade-preview-mode');if(select)select.value=mode;for(const id of ['count','days','hours']){const field=root.querySelector('#tm-grade-preview-'+id);if(field)field.disabled=true;}update(false);}
      else if(el.id?.startsWith('tm-grade-preview-')&&el.id!=='tm-grade-preview-month')update(false);
    });
    root.addEventListener('change',event=>{if(['tm-grade-preview-month','tm-grade-preview-role','tm-grade-preview-mode'].includes(event.target.id)){try{if(event.target.id==='tm-grade-preview-month'){collect();if(mode==='aggregate'){const v=values();for(const row of C.distribute(month,N.parse(v.count),N.parse(v.days),N.parse(v.hours)))rows()[row.date]=row;}configs[department()+':'+month]={...values(),mode};save();}readInputs();replace();}catch(error){const target=root.querySelector('#tm-grade-preview-result');if(target)target.textContent=error.message;}}});
    return {html,update};
  }
  return {create};
});
