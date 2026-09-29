<?php
// Financial regression checks use only synthetic records and no production DB.
declare(strict_types=1);
require_once __DIR__.'/../lib/grade-estimates.php';
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
// The current automatic mode prepays every achieved daily grade, regardless of old click records.
foreach([0,10000,350000] as $confirmed){
    $automatic=array_replace($r,['dailySettlement'=>'automatic','dailyReceived'=>$confirmed,'dailyConfirmedReceipts'=>$confirmed]);
    $autoInput=grade_payroll_input($input,$automatic);$auto=hr_calculate(['payAmount'=>15000,'payType'=>'시급제'],$autoInput);
    gl_check($auto['dailyGradeSettlement']==='cash-auto'&&$auto['prepaidDaily']===330000&&$auto['gradeSnapshot']['dailyReceived']===330000&&$auto['gradeSnapshot']['dailyOutstanding']===0,'automatic daily advance equals full earned amount without receipt dependency');
    gl_check($auto['net']===201000&&$auto['gross']===532000,'automatic daily amount appears once in gross and once as advance, never in payday net');
    gl_check($autoInput===grade_payroll_input($autoInput,$automatic),'repeated automatic calculation is idempotent');
}
$autoInput['gradeSnapshot']['daily']++;try{hr_calculate(['payAmount'=>15000,'payType'=>'시급제'],$autoInput);throw new RuntimeException('Automatic amount mismatch accepted');}catch(InvalidArgumentException $e){}
foreach([10=>25000,15=>50000,30=>125000] as $count=>$amount){$day=grade_ledger('2026-09',[['date'=>'2026-09-21','count'=>$count,'hours'=>6]],[['date'=>'2020-01-01','policy'=>$p]]);gl_check($day['daily']===$amount&&$day['dailyDetails'][0]['amount']===$amount,'daily cumulative amount has no ten-case or display-column cap');}
try{grade_ledger('2026-09',[$records[0],$records[0]],$entries);throw new RuntimeException('Duplicate record accepted');}catch(InvalidArgumentException $e){}
// Exercise the exact request calculator used by the PHP endpoint, including its preview basis.
$criteria=grade_zero_policy();$criteria['dailyCash']=['start'=>6,'perCase'=>5000];
$criteria['weekly']=[['min'=>0,'max'=>8,'hourly'=>0,'achievement'=>0,'extraStart'=>null,'extra'=>0]];
for($i=0;$i<20;$i++)$criteria['weekly'][]=['min'=>8+$i,'max'=>$i===19?null:9+$i,'hourly'=>0,'achievement'=>30000+5000*$i,'extraStart'=>null,'extra'=>0];
foreach([[100,15000,0,100,0,0],[110,15000,0,100,5000,105],[120,16000,50000,110,5000,115],[130,16000,100000,120,5000,125],[140,16000,200000,130,10000,135],[150,17000,300000,140,10000,145],[160,17000,400000,150,10000,155],[170,17000,500000,160,10000,165],[null,18000,600000,170,10000,175]] as $row){
    $criteria['monthlyReference'][]=array_combine(['max','hourly','achievement','threshold','extra','example'],$row);
}
$calendar=['2026-09-23'=>false]; // 21 working days; one four-day week.
$request=['month'=>'2026-09','date'=>'2026-09-29','policy'=>$criteria,'counts'=>[175],'basis'=>'full-month'];
$forecast=grade_estimates($request,[],$calendar,true);$full=$forecast['rows'][0];
gl_check($forecast['days']===21&&$forecast['hours']===126&&$forecast['basis']==='full-month','criteria examples cover the entire saved business calendar');
gl_check(array_count_values(array_column($full['dailyDetails'],'count'))===[9=>7,8=>14]&&$full['count']===175,'175 real cases distribute as seven nine-case days plus fourteen eight-case days');
gl_check($full['daily']===350000&&$full['weekly']===114000&&$full['monthly']===650000,'daily 7×20k+14×15k, weekly 3×30k+24k, monthly 600k+5×10k');
gl_check($full['base']===2268000&&$full['total']===3382000&&$full['salary']===3032000,'126 hours at 18k plus all grades; payday subtracts exactly 350k daily advance');
foreach(grade_forecast_records('2026-09',175,$calendar) as $row)gl_check(is_int($row['count']),'normal receipt estimates remain whole cases, including adjacent-month days');
$effective=grade_estimates(array_replace($request,['basis'=>'effective','preview'=>true]),[],$calendar,true)['rows'][0];
gl_check($effective['daily']===30000&&$effective['weekly']===0&&$effective['monthly']===61905,'actual effective-date preview still uses two new-policy business days, not a retroactive full month');
$sameMonth=grade_estimates(array_replace($request,['date'=>'2026-09-01']),[],$calendar,true)['rows'][0];
gl_check($full===$sameMonth,'criteria comparison does not shrink when the effective date moves to month-end');
$seven=$request;$seven['policy']['dailyCash']['start']=7;
gl_check(grade_estimates($seven,[],$calendar,true)['rows'][0]['daily']===245000,'configured seven-case threshold is honored: 7×15k+14×10k');
$samples=grade_estimates($request+['dailySamples'=>true],[],$calendar,true)['samples'];
gl_check($samples[0]['count']===210&&$samples[0]['daily']===525000&&$samples[0]['weekly']===152000,'ten cases/day means 21 daily awards and three full plus one four-fifths weekly award');
gl_check($samples[5]['count']===315&&$samples[5]['daily']===1050000&&$samples[5]['weekly']===247000,'fifteen cases/day accumulates each daily award and the correct 65k weekly tier');
foreach($samples as $sample)gl_check($sample['gradeTotal']-$sample['daily']===$sample['paydayGrade']&&$sample['paydayGrade']===$sample['weekly']+$sample['monthly'],'sample totals stack weekly and monthly and deduct daily cash once');
foreach([0,105,175,210,315] as $count){$g=grade_estimates(array_replace($request,['counts'=>[$count]]),[],$calendar,true)['rows'][0];gl_check($g['count']===$count&&$g['total']===$g['base']+$g['daily']+$g['weekly']+$g['monthly']&&$g['salary']===$g['total']-$g['daily'],'every displayed performance row balances exactly');}
foreach([['basis'=>'full-month'],['fixed'=>true],['preview'=>true],['dailySamples'=>true]] as $adminMode){try{grade_estimates(array_replace($request,['basis'=>'effective'],$adminMode),[],$calendar,false);throw new RuntimeException('Employee accepted admin estimate mode');}catch(InvalidArgumentException $e){}}
$readOnly=grade_estimates(array_replace($request,['basis'=>'effective']),[['date'=>'2000-01-01','policy'=>grade_zero_policy()]],$calendar,false)['rows'][0];
gl_check($readOnly['daily']===0&&$readOnly['weekly']===0&&$readOnly['monthly']===0,'employee forecast uses persisted history instead of a supplied policy');
echo "PASS: full-month criteria and exact 175/21-day totals, whole-case forecasts, daily advance deduction, effective-date preservation, five-day weekly/monthly stacking, estimate permissions and repeated saves.\n";
