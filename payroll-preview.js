(function () {
  'use strict';
  const E = window.TMPayroll;
  const $ = id => document.getElementById(id);
  const money = n => new Intl.NumberFormat('ko-KR').format(n) + '원';
  const percent = n => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(n * 100) + '%';
  const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const n = id => {
    const el = $(id);
    if (el.value === '' || !el.checkValidity()) throw new Error(el.labels?.[0]?.textContent.trim() + ': 입력값을 확인하세요.');
    return Number(el.value);
  };
  const table = (headers, rows) => '<div class="table-scroll"><table><thead><tr>' + headers.map(h => '<th>' + escape(h) + '</th>').join('') + '</tr></thead><tbody>' + rows.map(row => '<tr>' + row.map(cell => '<td>' + escape(cell) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  function numeric(id, value, label) { return '<input type="number" id="' + id + '" aria-label="' + label + '" min="0" max="100000000" step="1" required value="' + value + '">'; }
  function seed() {
    $('segments').innerHTML = ['보험 · 현재표', '화장품 · 현재표'].map((label, i) => '<tr><td>' + label + '</td>' + [['count', i ? 65 : 45], ['minutes', i ? 3600 : 2400], ['period', 6000], ['general', 6000], ['baseMinutes', i ? 3600 : 2400], ['base', 12000]].map(([key, value]) => '<td>' + numeric('s' + i + '-' + key, value, label + ' ' + ({ count: '정상 실적', minutes: '부서 인정시간', period: '기간 전체 인정시간', general: '기간 전체 일반직 인정시간', baseMinutes: '해당 부서 일반직 인정시간', base: '기본시급' }[key])) + '</td>').join('') + '</tr>').join('');
    $('monthly-tiers').innerHTML = [[0, 0, 0], [50, 13000, 100000], [100, 15000, 200000]].map((values, i) => '<tr>' + values.map((value, k) => '<td>' + numeric('t' + i + '-' + k, value, '월 표 ' + (i + 1) + '행 ' + ['기준 건수', '시급', '달성수당'][k]) + '</td>').join('') + '</tr>').join('');
  }
  let autoFingerprint = null;
  function calculate(event) {
    try {
      if (!$('payroll-form').checkValidity()) throw new Error('날짜와 숫자의 입력 범위를 확인하세요.');
      const monthlyTable = [0, 1, 2].map(i => ({ threshold: n('t' + i + '-0'), hourly: n('t' + i + '-1'), allowance: n('t' + i + '-2') }));
      const details = [0, 1].map(i => E.segment({ period: 'monthly', count: n('s' + i + '-count'), table: monthlyTable, extraRate: n('extra-rate'), departmentMinutes: n('s' + i + '-minutes'), periodMinutes: n('s' + i + '-period'), wholePeriodMinutes: n('whole-minutes'), generalMinutes: n('s' + i + '-general') }));
      const totalDepartmentMinutes = n('s0-minutes') + n('s1-minutes');
      if (totalDepartmentMinutes > n('whole-minutes')) throw new Error('부서별 인정시간 합계가 월 전체 인정시간을 초과합니다.');
      if ([0, 1].some(i => n('s' + i + '-baseMinutes') > Math.min(n('s' + i + '-general'), n('s' + i + '-minutes')))) throw new Error('해당 부서 일반직 시간은 부서 시간과 기간 전체 일반직 시간 이하여야 합니다.');
      const base = E.hourlyBase(details.map((d, i) => ({ label: i ? '화장품' : '보험', minutes: n('s' + i + '-baseMinutes'), baseHourly: n('s' + i + '-base'), gradeHourly: d.gradeHourly })));
      const dailyEntry = { count: n('daily-count'), paid: n('daily-paid'), table: [{ threshold: 6, allowance: 5000 }, { threshold: 8, allowance: 10000 }, { threshold: 10, allowance: 15000 }] };
      const day = E.daily(dailyEntry);
      const weekMonth = E.weeklyPayrollMonth($('week-start').value);
      const weekly = E.segment({ period: 'weekly', count: n('weekly-count'), table: [{ threshold: 30, allowance: 30000 }, { threshold: 35, allowance: 40000 }, { threshold: 40, allowance: 50000 }], departmentMinutes: 1800, periodMinutes: 1800, wholePeriodMinutes: 1800 });
      const weekInMonth = weekMonth === $('month').value;
      const deductions = $('deduction-state').value === 'pending' ? null : $('deduction-state').value === 'none' ? [] : [{ name: '세금', amount: n('tax') }, { name: '보험료', amount: n('insurance') }];
      const delta = n('adjustment');
      const fingerprint = JSON.stringify({ base: base.amount, allowances: details.map(d => d.allowance), week: weekInMonth ? weekly.allowance : 0, day });
      if (autoFingerprint !== null && fingerprint !== autoFingerprint) $('adjustment-reviewed').checked = false;
      autoFingerprint = fingerprint;
      const result = E.payroll({ basic: base.amount, allowances: [...details.map(d => d.achievement), ...details.map(d => d.extra), weekInMonth ? weekly.allowance : 0], dailyEntries: [dailyEntry], deductions, adjustments: delta ? [{ delta, reason: $('adjustment-reason').value }] : [], prepaid: n('prepaid') });
      const issues = E.finalizationIssues({ month: $('month').value, today: $('today').value, result, unresolvedAs: n('pending-as'), adjustmentsReviewed: !delta || $('adjustment-reviewed').checked });
      $('daily-result').innerHTML = table(['전체 인정', '현금 기지급', '급여 추가'], [[money(day.recognized), money(day.paid), money(day.unpaid)]]);
      $('weekly-result').innerHTML = '<p class="calc-value">' + money(weekly.allowance) + ' · ' + escape(weekMonth) + ' 급여 귀속</p><p class="hint">' + (weekInMonth ? '선택 월 급여에 포함했습니다.' : '선택 월과 귀속 월이 달라 이번 합계에서 제외했습니다.') + '</p>';
      $('payroll-output').innerHTML = '<div class="metrics"><div class="metric"><span>월 기본급 · 원 미만 한 번 버림</span><strong>' + money(result.basic) + '</strong></div><div class="metric"><span>수당·보정 포함 세전 총액</span><strong>' + money(result.gross) + '</strong></div><div class="metric primary"><span>기지급액 차감 후 예상 실지급액</span><strong>' + (result.net === null ? '공제액 미입력' : money(result.net)) + '</strong></div></div><div class="panel"><h3>계산 근거</h3>' + table(['부서', '실적', '부서 비율', '적용 시급', '인정시간', '달성수당', '초과수당'], details.map((d, i) => [i ? '화장품' : '보험', d.count + '건', percent(d.departmentShare), money(base.details[i].hourly), base.details[i].minutes + '분', money(d.achievement), money(d.extra)])) + table(['세전 총액', '공제 합계', '일수당 기지급', '퇴사자 별도 기지급', '보정 차액'], [[money(result.gross), result.deductionTotal === null ? '계산 대기' : money(result.deductionTotal), money(result.dailyPaid), money(result.prepaid), money(result.adjustment)]]) + (delta ? '<p>보정 사유: ' + escape($('adjustment-reason').value) + '</p>' : '') + '</div>';
      const labels = { MONTH_OPEN: '월 종료 후에만 월 급여 확정 가능', DEDUCTIONS_PENDING: '공제액 입력 또는 공제 없음 확인 필요', NEGATIVE_NET: '실지급액이 음수이므로 공제·보정 재검토 필요', AS_PENDING: '해당 급여에 영향을 주는 A/S 차감 결정 필요', ADJUSTMENTS_PENDING: '변경된 자동 계산액 기준으로 보정 재확인 필요', MANAGEMENT_ALLOWANCE_PENDING: '관리직 수당 입력 또는 없음 확인 필요', MINIMUM_WAGE_PENDING: '계약·임금 구성 기준으로 최저임금 검증 필요', MINIMUM_WAGE_FAILED: '최저임금 미달 수정 필요', WAGE_RULES_PENDING: '미정 임금 산식의 문서 검토 필요' };
      $('finalization-issues').innerHTML = issues.map(issue => '<li>' + labels[issue] + '</li>').join('');
      $('calculation-error').textContent = '';
    } catch (error) {
      $('calculation-error').textContent = error.message;
      $('payroll-output').replaceChildren();
      $('daily-result').replaceChildren(); $('weekly-result').replaceChildren();
      $('finalization-issues').innerHTML = '<li>입력 오류를 해결한 뒤 다시 계산하세요.</li>';
    }
  }
  function management() {
    try {
      const r = E.managementMonthly({ monthly: n('management-salary'), calendarDays: n('calendar-days'), employedDays: n('employed-days'), switched: $('switched').value === 'yes', monthlyScheduledDays: n('monthly-scheduled'), employedScheduledDays: n('employed-scheduled') });
      $('management-result').textContent = money(n('management-salary')) + ' × ' + percent(r.calendarShare) + ' × ' + percent(r.modeShare) + ' = ' + money(r.raw) + ' (최종 기본급 합산 전)';
    } catch (error) { $('management-result').textContent = error.message; }
  }
  function team() {
    try {
      const bonuses = ['a', 'b'].map(id => E.teamBonus({ count: n('team-' + id + '-count'), share: n('team-' + id + '-share') / 100, table: [{ threshold: 50, allowance: 100000 }, { threshold: 100, allowance: 200000 }], extraThreshold: 120, extraRate: 1000 }));
      $('team-result').textContent = 'A팀 ' + money(bonuses[0].total) + ' + B팀 ' + money(bonuses[1].total) + ' = ' + money(bonuses[0].total + bonuses[1].total);
    } catch (error) { $('team-result').textContent = error.message; }
  }
  $('payroll-form').addEventListener('input', calculate);
  $('payroll-form').addEventListener('change', calculate);
  $('management-form').addEventListener('input', management);
  $('team-form').addEventListener('input', team);
  document.querySelectorAll('form').forEach(form => form.addEventListener('submit', event => event.preventDefault()));
  $('reset').addEventListener('click', () => { $('payroll-form').reset(); autoFingerprint = null; seed(); calculate(); });
  let rules = [];
  function renderRules() {
    const query = $('rule-search').value.trim().toLocaleLowerCase('ko');
    const filtered = rules.filter(rule => [rule.id, rule.section, rule.item, rule.rule].join(' ').toLocaleLowerCase('ko').includes(query));
    $('rule-status').textContent = '전체 ' + rules.length + '개 중 ' + filtered.length + '개 · 최신 답변 기준';
    $('rule-list').innerHTML = filtered.slice(0, 30).map(rule => '<article class="rule"><small>' + escape(rule.id + ' · ' + rule.section) + '</small><strong>' + escape(rule.item) + '</strong><p>' + escape(rule.rule) + '</p></article>').join('') + (filtered.length > 30 ? '<p class="hint">앞의 30개를 표시합니다. 검색어로 좁히거나 전체 문서를 확인하세요.</p>' : '');
  }
  $('rule-search').addEventListener('input', renderRules);
  fetch('./docs/payroll-requirements.json').then(response => { if (!response.ok) throw new Error('load'); return response.json(); }).then(data => { rules = data.rules; renderRules(); }).catch(() => { $('rule-status').textContent = '기준을 불러오지 못했습니다. 웹 서버에서 열거나 전체 문서 링크로 확인하세요.'; });
  seed(); calculate(); management(); team();
})();
