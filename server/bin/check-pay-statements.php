<?php
// Pure calculation tests: no production database or live payroll records.
declare(strict_types=1);
require_once __DIR__.'/../lib/hr.php';
function ps_check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
function ps_reject(callable $fn,string $message): void {try{$fn();}catch(InvalidArgumentException $e){return;}throw new RuntimeException('Unexpected success: '.$message);}
$profile=['payType'=>'시급제','payAmount'=>15000];
$input=['month'=>'2026-09','minutes'=>360,'weeklyMinutes'=>[['weekStart'=>'2026-09-07','minutes'=>360]],'holidayInclusive'=>true,'allowance'=>0,'deductions'=>0,'statementVersion'=>1,'payday'=>'2026-09-30','periodStart'=>'2026-09-01','periodEnd'=>'2026-09-30','allowanceItems'=>[],'deductionItems'=>[],'weeklyStatutory'=>[['weekStart'=>'2026-09-07','amount'=>0,'method'=>'법정 주휴 비대상 확인; 회사 약정수당 지급']],'agreementConfirmed'=>true];
$c=hr_calculate($profile,$input);
ps_check($c['base']===75000&&$c['companySupport']===15000&&$c['statutoryHoliday']===0&&$c['net']===90000,'six-hour first week keeps 15000 per hour');
ps_check($c['baseRate']===12500.0&&$c['holidayRate']===2500.0,'contract hourly split is 12500 plus 2500 within 15000');
$regular=$input;$regular['minutes']=1800;$regular['weeklyMinutes'][0]['minutes']=1800;$regular['weeklyStatutory'][0]=['weekStart'=>'2026-09-07','amount'=>75000,'method'=>'소정 30시간 ÷ 5일 × 기본시급 12500원'];
$fullWeek=hr_calculate($profile,$regular);ps_check($fullWeek['base']===375000&&$fullWeek['statutoryHoliday']===75000&&$fullWeek['companySupport']===0&&$fullWeek['net']===450000,'full week statutory holiday is already inside 30 times 15000');
$oddMinutes=$input;$oddMinutes['minutes']=62;$oddMinutes['weeklyMinutes']=[['weekStart'=>'2026-09-07','minutes'=>31],['weekStart'=>'2026-09-14','minutes'=>31]];
$odd=hr_calculate($profile,$oddMinutes);ps_check($odd['base']+$odd['holiday']===15500&&array_sum(array_column($odd['weeklyBreakdown'],'gross'))===15500,'minute and week rounding preserves inclusive hourly total');
pay_statement_publish_check($c);
$high=$input;$high['weeklyStatutory'][0]['amount']=30000;$high['weeklyStatutory'][0]['method']='월 경계 주의 확정 주휴수당 30000원, 전월 중복 지급 없음';
$c=hr_calculate($profile,$high);
ps_check($c['net']===105000&&$c['companySupport']===0&&$c['statutoryHoliday']===30000,'statutory excess increases total, never capped at target');
ps_check(pay_statement_summary($c)['workPay']===90000&&pay_statement_summary($c)['workAdjustment']===15000,'statutory adjustment distinguished from 15000 hourly work pay');
ps_check($c['weeklyBreakdown'][0]['gross']===$c['gross'],'weekly and monthly gross agree');
$largeDeduction=$high;$largeDeduction['deductions']=100000;$largeDeduction['deductionItems']=[['label'=>'검증용 공제','amount'=>100000,'method'=>'격리된 테스트의 합계 검증','kind'=>'other']];
ps_check(hr_calculate($profile,$largeDeduction)['net']===5000,'deductions validated against final statutory-inclusive gross');
$largeDeduction['deductions']=105001;$largeDeduction['deductionItems'][0]['amount']=105001;ps_reject(fn()=>hr_calculate($profile,$largeDeduction),'final gross still bounds deductions');
$unknown=$input;$unknown['weeklyStatutory'][0]['amount']=null;
ps_reject(fn()=>pay_statement_publish_check(hr_calculate($profile,$unknown)),'unknown entitlement cannot publish');
$unagreed=$input;$unagreed['agreementConfirmed']=false;
ps_reject(fn()=>pay_statement_publish_check(hr_calculate($profile,$unagreed)),'split needs prior agreement check');
$noMethod=$input;$noMethod['weeklyStatutory'][0]['method']='';
ps_reject(fn()=>pay_statement_publish_check(hr_calculate($profile,$noMethod)),'zero statutory amount still needs reason for worked week');
$zeroWork=$input;$zeroWork['minutes']=0;$zeroWork['weeklyMinutes'][0]['minutes']=0;$zeroWork['weeklyStatutory'][0]['amount']=10000;$zeroWork['weeklyStatutory'][0]['method']='';
ps_reject(fn()=>pay_statement_publish_check(hr_calculate($profile,$zeroWork)),'entitlement in zero-work boundary week still needs method');
$itemized=$input;$itemized['allowance']=10000;$itemized['allowanceItems']=[['label'=>'성과수당','amount'=>10000,'method'=>'유효 실적 2건 × 5000원','kind'=>'grade']];$itemized['deductions']=500;$itemized['deductionItems']=[['label'=>'소득세','amount'=>500,'method'=>'적용 간이세액표에 따른 원천징수','kind'=>'other']];
$c=hr_calculate($profile,$itemized);ps_check($c['gross']===100000&&$c['net']===99500,'itemized additions and deductions');pay_statement_publish_check($c);
$tampered=$itemized;$tampered['allowanceItems'][0]['amount']=10001;ps_reject(fn()=>hr_calculate($profile,$tampered),'item amount cannot differ from total');
$missing=$itemized;$missing['deductionItems'][0]['method']='';ps_reject(fn()=>pay_statement_publish_check(hr_calculate($profile,$missing)),'deduction basis is mandatory');
$overtime=$input;$overtime['overtimeMinutes']=60;ps_reject(fn()=>pay_statement_publish_check(hr_calculate($profile,$overtime)),'overtime hours require separate allowance');
$legacyInput=['minutes'=>120,'allowance'=>1000,'deductions'=>500];$legacy=hr_calculate($profile,$legacyInput);
ps_check($legacy['base']===30000&&$legacy['net']===30500&&!isset($legacy['statementVersion']),'legacy 15000 basic wage preserved');
ps_check(pay_statement_enrich($profile,[],$legacy)===$legacy,'legacy metadata and amounts unchanged');
pay_statement_publish_check($legacy);
echo "PASS: itemized wage statements, short-week company support, statutory excess, publication checks, item sums, deductions and legacy preservation.\n";

ps_check(payroll_record_department(['calculation'=>['department'=>'insurance']],['team'=>'health'])==='insurance','saved payroll stays in original department after an employee transfer');
ps_check(payroll_record_department(['published_snapshot'=>['department'=>'cosmetics']],['team'=>'insurance'])==='cosmetics','published department takes precedence over current employee team');
ps_check(payroll_record_department([],['team'=>'health'])==='health','legacy payroll remains visible under existing employee team');
ps_check(payroll_record_department([])==='insurance','legacy records with no team default to insurance');
ps_reject(fn()=>management_department('all'),'unknown department is never treated as an unscoped write');
echo "PASS: payroll department attribution and invalid scope rejection.\n";

$rank=pay_statement_summary(array_replace($c,['allowanceItems'=>[['label'=>'직급수당','amount'=>100000,'kind'=>'rankAllowance','method'=>'부장 수당'],['label'=>'기타','amount'=>20000,'kind'=>'other','method'=>'기타']]]));ps_check($rank['rank']===100000&&$rank['other']===20000,'job-rank allowance is summarized separately without duplicating other allowances');
