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
$ownHistory=[['id'=>18,'date'=>'2099-01-01','policy'=>grade_zero_policy()],['id'=>17,'date'=>hr_today(),'policy'=>$criteria],['id'=>16,'date'=>'2000-01-01','policy'=>$seven['policy']]];
$employee=grade_estimates(array_replace($request,['policy'=>null,'date'=>'2099-01-01']),$ownHistory,$calendar,false);
gl_check($employee['rows'][0]===$full&&$employee['effectiveDate']===hr_today(),'employee full-month totals equal admin totals using the current saved policy, regardless of client policy/date or future entries');
$previous=grade_estimates($request+['fixed'=>true,'historyId'=>16],$ownHistory,$calendar,false);
gl_check($previous['rows'][0]['daily']===245000&&$previous['effectiveDate']==='2000-01-01','employee can read the selected immutable policy from their department history');
try{grade_estimates($request+['fixed'=>true,'historyId'=>999],$ownHistory,$calendar,false);throw new RuntimeException('Unknown or other-department history accepted');}catch(InvalidArgumentException $e){}
// Monthly criteria replace only a whole zero daily/weekly component with its first payable tier.
$zeroRequest=array_replace($request,['counts'=>[0]]);
$minimum=grade_estimates($zeroRequest,[],$calendar,true)['rows'][0];
gl_check($minimum['daily']===105000&&$minimum['weekly']===114000&&$minimum['base']===1890000&&$minimum['monthly']===0,'21-day comparison uses 21 first daily awards and three full plus one four-fifths first weekly award');
gl_check($minimum['minimumGrade']['daily']['applied']&&$minimum['minimumGrade']['weekly']['applied']&&$minimum['minimumGrade']['daily']['originalAmount']===0&&$minimum['minimumGrade']['weekly']['originalAmount']===0,'comparison floors record original amounts and both applied flags');
gl_check($minimum['total']===2109000&&$minimum['salary']===2004000&&$minimum['total']-$minimum['daily']===$minimum['salary'],'minimum awards reconcile with gross and daily-advance-excluded payday');
foreach($minimum['dailyDetails'] as $day)gl_check($day['count']===0&&$day['paidCount']===0&&$day['amount']===5000&&$day['originalAmount']===0&&$day['floorApplied'],'daily detail preserves sample counts while identifying the display-only minimum');
gl_check(array_sum(array_column($minimum['dailyDetails'],'amount'))===$minimum['daily'],'minimum daily details sum to the displayed component');
foreach($minimum['weeks'] as $week){
    gl_check($week['count']==0&&$week['bonus']===array_sum(array_column($week['parts'],'bonus')),'weekly details preserve sample counts and parts reconcile');
    gl_check($week['included']?($week['floorApplied']&&$week['originalBonus']===0):!isset($week['floorApplied']),'only included payroll weeks receive a comparison minimum');
}
gl_check(array_sum(array_column(array_filter($minimum['weeks'],fn($week)=>$week['included']),'bonus'))===$minimum['weekly'],'included weekly details sum to the displayed component');
$minimum22=grade_estimates($zeroRequest,[],[],true)['rows'][0];
gl_check($minimum22['days']===22&&$minimum22['daily']===110000&&$minimum22['weekly']===120000&&$minimum22['total']===2210000,'22-day sample includes 22 daily minimums and four full payable weekly minimums');
$partialRequest=array_replace($request,['counts'=>[110]]);$partial=grade_estimates($partialRequest,[],$calendar,true)['rows'][0];
gl_check($partial['daily']===25000&&!$partial['minimumGrade']['daily']['applied']&&$partial['weekly']===114000&&$partial['minimumGrade']['weekly']['applied'],'a nonzero daily aggregate retains zero days unchanged while a zero weekly aggregate gets its minimum');
gl_check(!$full['minimumGrade']['daily']['applied']&&!$full['minimumGrade']['weekly']['applied'],'earned nonzero daily and weekly examples keep their calculated totals');
$trustedMinimum=grade_estimates(array_replace($zeroRequest,['policy'=>grade_zero_policy()]),$ownHistory,$calendar,false)['rows'][0];
gl_check($trustedMinimum===$minimum,'admin and employee minimum examples match using the employee trusted saved policy');
$disabled=grade_estimates(array_replace($zeroRequest,['policy'=>grade_zero_policy()]),[],$calendar,true)['rows'][0];
gl_check($disabled['daily']===0&&$disabled['weekly']===0&&!$disabled['minimumGrade']['daily']['applied']&&!$disabled['minimumGrade']['weekly']['applied'],'disabled all-zero policies never invent a paid grade');
$extraPolicy=$criteria;$extraPolicy['weekly']=[['min'=>0,'max'=>8,'hourly'=>0,'achievement'=>0,'extraStart'=>null,'extra'=>0],['min'=>8,'max'=>10,'hourly'=>0,'achievement'=>0,'extraStart'=>9,'extra'=>7000],['min'=>10,'max'=>null,'hourly'=>0,'achievement'=>1000,'extraStart'=>null,'extra'=>0]];
$extraMinimum=grade_estimates(array_replace($zeroRequest,['policy'=>$extraPolicy]),[],$calendar,true)['rows'][0];
gl_check($extraMinimum['weekly']===26600&&$extraMinimum['minimumGrade']['weekly']['minimumCount']===9&&$extraMinimum['minimumGrade']['weekly']['unitAmount']===7000,'first payable extra-only tier wins by its threshold, not a later lower money amount');
$actualZero=grade_ledger('2026-09',grade_forecast_records('2026-09',0,$calendar),[['date'=>'2000-01-01','policy'=>$criteria]],[],$calendar);
$effectiveZero=grade_estimates(array_replace($zeroRequest,['basis'=>'effective','preview'=>true]),[],$calendar,true)['rows'][0];
gl_check($actualZero['daily']===0&&$actualZero['weekly']===0&&$effectiveZero['daily']===0&&$effectiveZero['weekly']===0&&!isset($effectiveZero['minimumGrade']),'actual payroll ledger and effective-date preview never receive the comparison floor');
echo "PASS: matching admin/employee full-month totals, trusted employee policy/history selection, exact 175/21-day totals, daily advance deduction, effective-date preservation, five-day weekly/monthly stacking and repeated saves.\n";

// Personal totals must use each earned hourly tier, including effective-date splits.
foreach([17000,18000] as $rate){
    $policy=grade_zero_policy($rate);
    $ledger=grade_ledger('2026-09',$records,[['date'=>'2020-01-01','policy'=>$policy]],['payAmount'=>15000]);
    $ledger+=['asOf'=>'2026-09-30','dailyReceived'=>0,'dailyOutstanding'=>0];
    $totals=grade_personal_totals_from_ledger($ledger,['payAmount'=>15000]);
    gl_check($totals['rate']===$rate&&$totals['workPay']===132*$rate,'personal hourly tier changes work pay');
    gl_check($totals['total']===$totals['workPay']+$totals['daily']+$totals['weekly']+$totals['monthly'],'grade-adjusted totals reconcile');
    gl_check(grade_personal_totals_from_ledger($ledger,['payType'=>'월급제','payAmount'=>3000000])['workPay']===3000000,'fixed monthly salary preserved');
}
$ledger=grade_ledger('2026-09',$records,[['date'=>'2020-01-01','policy'=>grade_zero_policy(17000)],['date'=>'2026-09-16','policy'=>grade_zero_policy(18000)]],['payAmount'=>15000]);
gl_check($ledger['base']===2310000,'effective rates weighted by actual hours');
$ledger=grade_ledger('2026-09',$records,[['date'=>'2020-01-01','policy'=>grade_zero_policy(17000)]],['payAmount'=>19000]);
gl_check($ledger['base']===2508000,'contract hourly floor preserved');
foreach([17000,18000] as $hourly){
    $g=grade_ledger('2026-09',grade_forecast_records('2026-09',175),[['date'=>'2000-01-01','policy'=>grade_zero_policy($hourly)]],['payAmount'=>15000]);
    $c=hr_calculate(['payType'=>'시급제','payAmount'=>15000],['minutes'=>7920,'allowance'=>0,'deductions'=>0,'gradeSnapshot'=>$g]);
    gl_check($c['base']===132*$hourly,'saved payroll uses earned grade hourly rate');
}

// Moving range boundaries must not leave examples in a higher hourly tier.
$shifted=$criteria;foreach($shifted['monthlyReference'] as $i=>&$row)if($row['max']!==null)$row['max']-=20;unset($row);
$shifted=normalize_policy($shifted);
foreach($shifted['monthlyReference'] as $i=>$row){$min=$i?$shifted['monthlyReference'][$i-1]['max']+1:0;gl_check($row['example']>=$min&&($row['max']===null||$row['example']<=$row['max']),'comparison example belongs to displayed range');}
$lower=grade_ledger('2026-09',grade_forecast_records('2026-09',$shifted['monthlyReference'][7]['example']),[['date'=>'2000-01-01','policy'=>$shifted]]);
$upper=grade_ledger('2026-09',grade_forecast_records('2026-09',$shifted['monthlyReference'][8]['example']),[['date'=>'2000-01-01','policy'=>$shifted]]);
gl_check($lower['base']===2244000&&$upper['base']===2376000,'141-150 tier at 17k differs from 151-plus tier at 18k for 132 hours');
