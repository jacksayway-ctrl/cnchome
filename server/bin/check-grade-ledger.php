<?php
// Financial regression checks use only synthetic records and no production DB.
declare(strict_types=1);
require_once __DIR__.'/../lib/grade-ledger.php';
function gl_check(bool $condition,string $message): void {if(!$condition)throw new RuntimeException($message);}
$p=grade_zero_policy();$p['dailyCash']=['start'=>6,'perCase'=>5000];$p['weekly'][0]['achievement']=10000;$p['monthly'][0]['achievement']=20000;
$new=$p;$new['weekly'][0]['achievement']=30000;$new['monthly'][0]['achievement']=40000;
$records=grade_forecast_records('2026-09',176);$entries=[['date'=>'2020-01-01','policy'=>$p],['date'=>'2026-09-16','policy'=>$new]];
$r=grade_ledger('2026-09',$records,$entries);
gl_check($r['monthly']===30000,'11 old + 11 new business days prorate monthly once');
gl_check($r['weekly']===72000,'full week 10k + 10k + split week 22k + 30k');
gl_check($r['daily']===330000&&$r['total']===$r['base']+$r['monthly']+$r['weekly']+$r['daily'],'daily weekly monthly all included exactly once');
$split=array_values(array_filter($r['weeks'],fn($w)=>$w['start']==='2026-09-14'))[0];gl_check(array_column($split['parts'],'bonus')===[4000,18000],'effective Wednesday: old two fifths and new three fifths');
$entries[]=['date'=>'2026-10-01','policy'=>array_replace($p,['dailyCash'=>['start'=>6,'perCase'=>999]])];gl_check(grade_ledger('2026-09',$records,$entries)['daily']===$r['daily'],'future rule never changes earlier daily payment');
$entries[]=['date'=>'2026-09-16','savedAt'=>'9999','policy'=>$p];gl_check(grade_ledger('2026-09',$records,$entries)['monthly']===20000,'same effective date latest version wins');
$hire=grade_ledger('2026-09',$records,[['date'=>'2020-01-01','policy'=>$new]],['startDate'=>'2026-09-16']);gl_check($hire['monthly']===20000,'mid-month hire prorates monthly days');
$leader=grade_ledger('2026-09',$records,[['date'=>'2020-01-01','policy'=>$new]],['role'=>'팀장']);gl_check($leader['daily']+$leader['weekly']+$leader['monthly']===0,'leader excluded from ordinary employee grades');
$boundary=grade_forecast_records('2026-10',176);$oct=grade_ledger('2026-10',$boundary,[['date'=>'2020-01-01','policy'=>$p]]);gl_check($oct['weeks'][0]['included']&&$oct['weeks'][0]['start']==='2026-09-28','month boundary week belongs to Friday month');
$missing=grade_ledger('2026-10',array_values(array_filter($boundary,fn($row)=>$row['date']!=='2026-09-28')),[['date'=>'2020-01-01','policy'=>$p]]);gl_check(!$missing['weeks'][0]['included'],'missing adjoining month record stays pending');
$odd=$p;$odd['monthly'][0]['achievement']=10001;$part=grade_ledger('2026-09',$records,[['date'=>'2020-01-01','policy'=>$odd],['date'=>'2026-09-08','policy'=>$odd],['date'=>'2026-09-16','policy'=>$odd]]);gl_check($part['monthly']===10001&&array_sum(array_column($part['parts'],'bonus'))===10001,'round combined period once and assign residual');
$r['dailyReceived']=300000;$r['asOf']='2026-09-29';
$input=['month'=>'2026-09','minutes'=>360,'weeklyMinutes'=>[['weekStart'=>'2026-09-07','minutes'=>360]],'weeklyStatutory'=>[['weekStart'=>'2026-09-07','amount'=>0,'method'=>'가상 계산']],'holidayInclusive'=>true,'statementVersion'=>1,'payday'=>'2026-10-15','periodStart'=>'2026-09-01','periodEnd'=>'2026-09-30','allowanceItems'=>[['label'=>'이전 그레이드','kind'=>'grade','amount'=>999999,'method'=>'old'],['label'=>'식대','kind'=>'other','amount'=>10000,'method'=>'약정']],'deductionItems'=>[['label'=>'공제 예시','kind'=>'other','amount'=>1000,'method'=>'가상']],'allowance'=>0,'deductions'=>1000];
$once=grade_payroll_input($input,$r);$twice=grade_payroll_input($once,$r);gl_check($once===$twice&&$once['allowance']===$r['dailyReceived']+$r['weekly']+$r['monthly']+10000,'repeated saves replace old grade entries without duplication');
$c=hr_calculate(['payAmount'=>15000,'payType'=>'시급제'],$once);gl_check($c['prepaidDaily']===300000&&$c['net']===$c['gross']-1000-300000,'only confirmed daily advances reduce net payment');
gl_check($c['gross']===90000+300000+72000+30000+10000&&$c['net']===201000,'weekly plus monthly paid together, daily cash excluded from payday net');
gl_check($c['dailyGradeSettlement']==='cash'&&$c['gradeSnapshot']['dailyOutstanding']===30000,'unreceived daily grade remains a separate cash liability');
$summary=pay_statement_summary($c);gl_check($summary['workPay']===90000&&$summary['daily']===300000&&$summary['dailyPaid']===300000&&$summary['weekly']===72000&&$summary['monthly']===30000&&$summary['other']===10000,'saved summary displays each actual payroll component');
foreach([0,330000,350000] as $paid){
    $g=array_replace($r,['dailyReceived'=>$paid]);$next=hr_calculate(['payAmount'=>15000,'payType'=>'시급제'],grade_payroll_input($once,$g));
    gl_check($next['net']===201000&&$next['prepaidDaily']===$paid,'no, full or higher past cash receipts never alter payday amount');
    gl_check($next['gradeSnapshot']['dailyOutstanding']===max(0,330000-$paid),'pending cash never becomes a monthly payment or negative liability');
}
$tampered=$once;$tampered['prepaidDaily']++;try{hr_calculate(['payAmount'=>15000,'payType'=>'시급제'],$tampered);throw new RuntimeException('Mismatched daily advance accepted');}catch(InvalidArgumentException $e){}
$manual=$input;$manual['deductionItems'][0]['label']='일그레이드 선지급';try{grade_payroll_input($manual,$r);throw new RuntimeException('Manual duplicate advance accepted');}catch(InvalidArgumentException $e){}
$old=$once;unset($old['dailyGradeSettlement']);foreach($old['allowanceItems'] as &$item)if($item['kind']==='gradeDaily')$item['amount']=$r['daily'];unset($item);$old['allowance']=array_sum(array_column($old['allowanceItems'],'amount'));
$legacy=hr_calculate(['payAmount'=>15000,'payType'=>'시급제'],$old);gl_check($legacy['net']===231000&&!isset($legacy['dailyGradeSettlement']),'historical inputs retain their original calculation mode');
try{grade_ledger('2026-09',[$records[0],$records[0]],$entries);throw new RuntimeException('Duplicate record accepted');}catch(InvalidArgumentException $e){}
echo "PASS: effective-date proration, weekly/monthly stacking, separate daily cash settlement, receipt-only advances, pending cash, repeated saves, saved summaries and historical preservation.\n";
