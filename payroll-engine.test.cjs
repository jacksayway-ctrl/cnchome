const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('./payroll-engine.js');
const table = [{ threshold: 50, hourly: 13000, allowance: 100000 }, { threshold: 100, hourly: 15000, allowance: 200000 }];
const month = overrides => E.segment({ period: 'monthly', count: 45, table, extraRate: 1000, departmentMinutes: 2400, periodMinutes: 6000, wholePeriodMinutes: 6000, ...overrides });
test('department share adjusts threshold, achievement and extra rate; top boundary excluded', () => {
  const r = month();
  assert.equal(r.topThreshold, 40); assert.equal(r.achievement, 80000); assert.equal(r.extraCount, 5); assert.equal(r.extra, 2000);
  assert.equal(month({ count: 40 }).extra, 0);
});
test('highest tier only, no average days and no weekly extra', () => {
  const r = month({ period: 'weekly' });
  assert.equal(r.allowance, 80000); assert.equal(r.extra, 0);
});
test('role share changes money but not threshold or grade hourly', () => {
  const r = month({ generalMinutes: 3000 });
  assert.equal(r.topThreshold, 40); assert.equal(r.achievement, 40000); assert.equal(r.extra, 1000); assert.equal(r.gradeHourly, 15000);
});
test('zero whole-period hours use actual counts without proportional adjustment', () => {
  const r = month({ departmentMinutes: 0, periodMinutes: 0, wholePeriodMinutes: 0, count: 105 });
  assert.equal(r.achievement, 200000); assert.equal(r.extra, 5000);
});
test('zero table subperiod within a nonzero month pays no allowance', () => {
  const r = month({ departmentMinutes: 0, periodMinutes: 0, wholePeriodMinutes: 6000, count: 105 });
  assert.equal(r.allowance, 0); assert.equal(r.noTime, true);
});
test('positive thresholds cannot become zero after rounding', () => {
  const settings = { table: [{ threshold: 1, allowance: 10000 }], departmentMinutes: 1, periodMinutes: 100, wholePeriodMinutes: 100 };
  assert.equal(month({ ...settings, count: 0 }).achievement, 0);
  assert.equal(month({ ...settings, count: 1 }).achievement, 100);
});
test('table-version subperiods retain full thresholds and sum achieved allowances', () => {
  const first = month({ count: 100, departmentMinutes: 3000, periodMinutes: 3000 });
  const second = month({ count: 50, departmentMinutes: 3000, periodMinutes: 3000 });
  assert.equal(first.achievement + second.achievement, 300000);
});
test('allowance rounding occurs after rate × count × shares, not at the unit price', () => {
  const r = month({ table: [{ threshold: 1, allowance: 0 }], extraRate: 1, departmentMinutes: 1, periodMinutes: 3, wholePeriodMinutes: 3, count: 3 });
  assert.equal(r.extra, 1);
});
test('basic hourly floor applies once across segments and protects base rate', () => {
  const r = E.hourlyBase([{ minutes: 1, baseHourly: 10000, gradeHourly: 9000 }, { minutes: 1, baseHourly: 10000, gradeHourly: 10000 }]);
  assert.equal(r.amount, 333); assert.equal(r.details[0].hourly, 10000);
});
test('no grade table falls back to employee base and no allowance', () => {
  const r = month({ table: [] });
  assert.equal(r.allowance, 0); assert.equal(r.gradeHourly, 0);
  assert.equal(E.hourlyBase([{ minutes: 60, baseHourly: 12000, gradeHourly: r.gradeHourly }]).amount, 12000);
});
test('paid daily allowance survives A/S and transfers; increase goes to payroll', () => {
  const dayTable = [{ threshold: 6, allowance: 5000 }, { threshold: 8, allowance: 10000 }];
  assert.deepEqual(E.daily({ count: 0, table: dayTable, paid: 10000 }), { earned: 0, paid: 10000, recognized: 10000, unpaid: 0 });
  assert.equal(E.daily({ count: 8, table: dayTable, paid: 5000 }).unpaid, 5000);
  assert.equal(E.daily({ count: 100, table: dayTable }).recognized, 10000);
});
test('unpaid time is floored per approved unpaid event', () => {
  assert.equal(E.unpaidMinutes([{ minutes: 21, approved: true, paid: false }, { minutes: 9, approved: true, paid: false }, { minutes: 31, approved: false, paid: false }, { minutes: 25, approved: true, paid: true }]), 20);
});
test('monthly management joining uses calendar days; switching also uses employed scheduled days', () => {
  const input = { monthly: 3000000, employedDays: 18, calendarDays: 30 };
  assert.equal(E.managementMonthly(input).raw, 1800000);
  assert.equal(E.managementMonthly({ ...input, switched: true, monthlyScheduledDays: 5, employedScheduledDays: 12 }).raw, 750000);
  assert.equal(E.managementMonthly({ ...input, employedDays: 30, switched: true, monthlyScheduledDays: 10, employedScheduledDays: 20 }).raw, 1500000);
  assert.equal(E.managementAllowance({ monthly: 200000, employedDays: 15, calendarDays: 30 }), 100000);
});
test('manager unpaid deduction does not alter separate allowance', () => {
  assert.equal(E.managementMonthly({ monthly: 3000000, employedDays: 15, calendarDays: 30, unpaid: 120, deductionHourly: 15000 }).raw, 1470000);
});
test('team excess threshold is independent from tier and each team allows 100 percent', () => {
  const r = E.teamBonus({ count: 150, table, extraThreshold: 120, extraRate: 1000, share: 0.5 });
  assert.equal(r.total, 115000);
  assert.throws(() => E.teamBonus({ count: 150, table, extraThreshold: 120, extraRate: 1000, share: 1.1 }));
});
test('daily and leaver prepayments are deducted once and missing deductions remain null', () => {
  const input = { basic: 1000000, dailyEntries: [{ count: 8, table: [{ threshold: 8, allowance: 10000 }], paid: 8000 }], prepaid: 200000 };
  assert.equal(E.payroll(input).net, null);
  const r = E.payroll({ ...input, deductions: [{ amount: 100000 }] });
  assert.equal(r.gross, 1010000); assert.equal(r.net, 702000);
});
test('signed corrections accumulate and require reasons', () => {
  assert.equal(E.payroll({ basic: 100000, adjustments: [{ delta: 10000, reason: '오류 정정' }, { delta: -5000, reason: '중복 정정' }], deductions: [] }).net, 105000);
  assert.throws(() => E.payroll({ basic: 1, adjustments: [{ delta: 1, reason: '' }] }));
});
test('negative net and independent finalization gates are all reported', () => {
  const result = E.payroll({ basic: 100, deductions: [{ amount: 200 }] });
  assert.deepEqual(E.finalizationIssues({ month: '2026-09', today: '2026-09-30', result, unresolvedAs: 1, adjustmentsReviewed: false }), ['MONTH_OPEN', 'NEGATIVE_NET', 'AS_PENDING', 'ADJUSTMENTS_PENDING', 'MINIMUM_WAGE_PENDING', 'WAGE_RULES_PENDING']);
  assert.deepEqual(E.finalizationIssues({ month: '2026-09', today: '2026-10-01', result: { net: 0 }, wageRulesReviewed: true, minimumWageStatus: 'passed' }), []);
});
test('cross-month weekly bonus belongs to Friday month, not Sunday or workday ratio', () => {
  assert.equal(E.weeklyPayrollMonth('2026-09-28'), '2026-10');
  assert.equal(E.weeklyPayrollMonth('2026-07-27'), '2026-07');
  assert.throws(() => E.weeklyPayrollMonth('2026-09-29'));
});
test('separate settlement keeps actual overpayment and shows excess', () => {
  assert.deepEqual(E.settlement({ grossDelta: 100000, deductionDelta: 10000, payments: [{ amount: 40000 }, { amount: 60000 }] }), { due: 90000, paid: 100000, balance: -10000, remaining: 0, overpaid: 10000 });
});
test('invalid numbers, unsorted tiers and impossible hours do not produce payable results', () => {
  for (const count of [NaN, -1, 1.5, Infinity, '10']) assert.throws(() => month({ count }));
  assert.throws(() => month({ departmentMinutes: 7000 }));
  assert.throws(() => month({ table: [table[1], table[0]] }));
  assert.throws(() => E.managementMonthly({ monthly: 1000, calendarDays: 0, employedDays: 0 }));
});
