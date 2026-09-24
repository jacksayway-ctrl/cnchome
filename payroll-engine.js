/* Confirmed company rules. Pure calculations; no authentication or legal certification. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TMPayroll = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const LIMIT = 1000000000000;
  function number(value, name, { integer = false, signed = false } = {}) {
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > LIMIT || (!signed && value < 0) || (integer && !Number.isSafeInteger(value))) {
      throw new RangeError(name + ': 올바른 ' + (signed ? '' : '0 이상의 ') + (integer ? '정수' : '숫자') + '를 입력하세요.');
    }
    return value;
  }
  const amount = (value, name = '금액') => number(value, name, { integer: true });
  const minutes = (value, name = '인정시간(분)') => number(value, name, { integer: true });
  const round = value => Math.round(value + Number.EPSILON * Math.abs(value));
  function ratio(part, total) {
    number(part, '비율 분자'); number(total, '비율 분모');
    if (total <= 0 || part > total) throw new RangeError('비율의 분모는 양수이고 분자 이상이어야 합니다.');
    return part / total;
  }
  function tiers(input) {
    if (!Array.isArray(input)) throw new TypeError('그레이드표를 확인하세요.');
    let previous = -1;
    return input.map(row => {
      amount(row.threshold, '기준 건수'); amount(row.allowance, '달성수당'); amount(row.hourly ?? 0, '시급');
      if (row.threshold <= previous) throw new RangeError('기준 건수는 중복 없이 오름차순으로 입력하세요.');
      previous = row.threshold;
      return { ...row, hourly: row.hourly ?? 0 };
    });
  }
  function adjustedThreshold(threshold, share) {
    return threshold === 0 ? 0 : Math.max(1, round(threshold * share));
  }
  function selectTier(table, count, share = 1) {
    amount(count, '정상 실적');
    return tiers(table).filter(row => count >= adjustedThreshold(row.threshold, share)).at(-1) || null;
  }
  function daily({ count, table = [], paid = 0 }) {
    amount(paid, '정정 반영 기지급액');
    const earned = selectTier(table, count)?.allowance ?? 0;
    const recognized = Math.max(earned, paid);
    return { earned, paid, recognized, unpaid: recognized - paid };
  }
  function segment({ period, count, table = [], extraRate = 0, departmentMinutes, periodMinutes, wholePeriodMinutes, generalMinutes = periodMinutes }) {
    if (!['weekly', 'monthly'].includes(period)) throw new RangeError('주·월 그레이드만 기간 비율을 적용합니다.');
    minutes(departmentMinutes); minutes(periodMinutes); minutes(wholePeriodMinutes); minutes(generalMinutes); amount(extraRate, '초과 단가'); amount(count, '정상 실적');
    if (departmentMinutes > periodMinutes || generalMinutes > periodMinutes || periodMinutes > wholePeriodMinutes) throw new RangeError('부서·일반직·기간 인정시간의 합계 범위를 확인하세요.');
    const noTime = wholePeriodMinutes > 0 && periodMinutes === 0;
    const departmentShare = wholePeriodMinutes === 0 ? 1 : (periodMinutes ? departmentMinutes / periodMinutes : 0);
    const roleShare = wholePeriodMinutes === 0 ? 1 : (periodMinutes ? generalMinutes / periodMinutes : 0);
    const rows = tiers(table);
    const tier = noTime ? null : selectTier(rows, count, departmentShare);
    const top = rows.at(-1);
    const threshold = top ? adjustedThreshold(top.threshold, departmentShare) : null;
    const achievement = tier ? round(tier.allowance * departmentShare * roleShare) : 0;
    const extraCount = period === 'monthly' && !noTime && top ? Math.max(0, count - threshold) : 0;
    const extra = round(extraCount * extraRate * departmentShare * roleShare);
    return { period, count, departmentShare, roleShare, tier, topThreshold: threshold, achievement, extraCount, extra, allowance: achievement + extra, gradeHourly: tier?.hourly ?? 0, noTime };
  }
  // Integer minute × integer won rates keep the monthly floor exact, even across many segments.
  function hourlyBase(parts) {
    let numerator = 0n;
    const details = parts.map(part => {
      minutes(part.minutes); amount(part.baseHourly, '기본시급'); amount(part.gradeHourly ?? 0, '그레이드 시급');
      const hourly = Math.max(part.baseHourly, part.gradeHourly ?? 0);
      const value = BigInt(part.minutes) * BigInt(hourly);
      numerator += value;
      return { ...part, hourly, raw: Number(value) / 60 };
    });
    const result = Number(numerator / 60n);
    amount(result, '월 기본급 합계');
    return { amount: result, details };
  }
  function unpaidMinutes(events) {
    return events.reduce((sum, event) => {
      minutes(event.minutes, '출결 변동 시간');
      return sum + (event.approved && !event.paid ? Math.floor(event.minutes / 10) * 10 : 0);
    }, 0);
  }
  function managementMonthly({ monthly, employedDays, calendarDays, switched = false, monthlyScheduledDays, employedScheduledDays, unpaid = 0, deductionHourly = 0 }) {
    amount(monthly, '월 기본급'); minutes(unpaid, '무급 시간'); amount(deductionHourly, '차감용 시급');
    amount(employedDays, '재직 일수'); amount(calendarDays, '월 달력 일수');
    const calendarShare = ratio(employedDays, calendarDays);
    let modeShare = 1;
    if (switched) {
      amount(monthlyScheduledDays, '월급제 예정 근무일수'); amount(employedScheduledDays, '재직기간 예정 근무일수');
      modeShare = ratio(monthlyScheduledDays, employedScheduledDays);
    }
    // Retain fractional values for final monthly basic-pay floor, including hourly-mode pay.
    const raw = monthly * calendarShare * modeShare - unpaid * deductionHourly / 60;
    return { raw, calendarShare, modeShare };
  }
  function managementAllowance({ monthly, employedDays, calendarDays }) {
    amount(monthly); amount(employedDays); amount(calendarDays);
    return round(monthly * ratio(employedDays, calendarDays));
  }
  function teamBonus({ count, table, extraThreshold, extraRate, share }) {
    amount(count); amount(extraThreshold); amount(extraRate); number(share, '담당 비율');
    if (share > 1) throw new RangeError('각 팀의 담당 비율은 0~100%입니다.');
    const achievement = selectTier(table, count)?.allowance ?? 0;
    const extra = Math.max(0, count - extraThreshold) * extraRate;
    return { achievement: round(achievement * share), extra: round(extra * share), total: round(achievement * share) + round(extra * share) };
  }
  function payroll({ basic, allowances = [], dailyEntries = [], deductions = null, adjustments = [], prepaid = 0 }) {
    amount(basic, '월 기본급'); amount(prepaid, '퇴사자 별도 기지급액');
    const allowanceTotal = allowances.reduce((sum, n) => sum + amount(n, '수당'), 0);
    const days = dailyEntries.map(daily);
    const dailyTotal = days.reduce((sum, d) => sum + d.recognized, 0);
    const dailyPaid = days.reduce((sum, d) => sum + d.paid, 0);
    const adjustment = adjustments.reduce((sum, a) => {
      if (!a.reason || !a.reason.trim()) throw new RangeError('보정 사유가 필요합니다.');
      return sum + number(a.delta, '보정 차액', { integer: true, signed: true });
    }, 0);
    const gross = basic + allowanceTotal + dailyTotal + adjustment;
    const deductionTotal = deductions === null ? null : deductions.reduce((sum, d) => sum + amount(d.amount, '공제액'), 0);
    return { basic, allowanceTotal, dailyTotal, dailyPaid, dailyUnpaid: dailyTotal - dailyPaid, adjustment, gross, deductionTotal, prepaid, net: deductionTotal === null ? null : gross - deductionTotal - dailyPaid - prepaid };
  }
  function validDate(date) {
    return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date + 'T00:00:00Z')) && new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date;
  }
  function finalizationIssues({ month, today, result, unresolvedAs = 0, adjustmentsReviewed = true, managementAllowanceReviewed = true, minimumWageStatus = 'pending', wageRulesReviewed = false }) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !validDate(today)) throw new RangeError('급여월과 검토일을 확인하세요.');
    amount(unresolvedAs, 'A/S 검토 대기 건수');
    const issues = [];
    if (today.slice(0, 7) <= month) issues.push('MONTH_OPEN');
    if (result.net === null) issues.push('DEDUCTIONS_PENDING');
    if (result.net !== null && result.net < 0) issues.push('NEGATIVE_NET');
    if (unresolvedAs) issues.push('AS_PENDING');
    if (!adjustmentsReviewed) issues.push('ADJUSTMENTS_PENDING');
    if (!managementAllowanceReviewed) issues.push('MANAGEMENT_ALLOWANCE_PENDING');
    if (minimumWageStatus !== 'passed') issues.push(minimumWageStatus === 'failed' ? 'MINIMUM_WAGE_FAILED' : 'MINIMUM_WAGE_PENDING');
    if (!wageRulesReviewed) issues.push('WAGE_RULES_PENDING');
    return issues;
  }
  function settlement({ grossDelta, deductionDelta, payments }) {
    number(grossDelta, '정정 세전 차액', { signed: true, integer: true });
    number(deductionDelta, '공제 조정액', { signed: true, integer: true });
    const due = grossDelta - deductionDelta;
    if (due < 0) throw new RangeError('회수 방향 정산은 처리 기준 확정 후 지원합니다.');
    const paid = payments.reduce((sum, p) => sum + amount(p.amount, '실제 지급액'), 0);
    return { due, paid, balance: due - paid, remaining: Math.max(0, due - paid), overpaid: Math.max(0, paid - due) };
  }
  function weeklyPayrollMonth(weekMonday) {
    if (!validDate(weekMonday)) throw new RangeError('주 시작일을 확인하세요.');
    const date = new Date(weekMonday + 'T00:00:00Z');
    if (date.getUTCDay() !== 1) throw new RangeError('주 시작일은 월요일입니다.');
    date.setUTCDate(date.getUTCDate() + 4);
    return date.toISOString().slice(0, 7);
  }
  return Object.freeze({ daily, segment, hourlyBase, unpaidMinutes, managementMonthly, managementAllowance, teamBonus, payroll, finalizationIssues, settlement, weeklyPayrollMonth });
});
