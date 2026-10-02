<?php
declare(strict_types=1);
require_once __DIR__.'/grade-ledger.php';
require_once __DIR__.'/grade-visibility.php';

// Match the same single-tier rules used by the grade calculator.
function grade_target_tiers(array $rows,float $value,bool $exclusive=false,bool $reference=false): array {
    $current=null;$next=null;$lower=0;
    foreach($rows as $row){
        $min=(int)($row['min']??$lower);$max=$row['max']??null;
        $bonus=static function(float $at)use($row,$reference):int {
            $extra=$reference?max(0,(int)floor($at)-(int)($row['threshold']??0)):(($row['extraStart']??null)===null?0:max(0,(int)floor($at)-(int)$row['extraStart']+1));
            return (int)($row['achievement']??0)+$extra*(int)($row['extra']??0);
        };
        $range=$min===0?($max===null?'전체 구간':number_format($max).'건 '.($exclusive?'미만':'이하')):number_format($min).($max===null?'건 이상':'~'.number_format($max).'건'.($exclusive?' 미만':''));
        $tier=['min'=>$min,'range'=>$range,'hourly'=>(int)($row['hourly']??0),'amount'=>$bonus($min)];
        if($value>=$min&&($max===null||($exclusive?$value<$max:$value<=$max))){$tier['amount']=$bonus($value);$current=$tier;}
        if($min>$value&&$next===null&&($reference||($row['hourly']??0)>0||($row['achievement']??0)>0||($row['extra']??0)>0))$next=$tier;
        $lower=$max===null?$lower:(int)$max+($exclusive?0:1);
    }
    return ['current'=>$current,'next'=>$next];
}

// Personal progress and separate daily allowance only; never team totals or other employees' records.
function grade_progress(array $profile,array $counts,?array $policy,string $today,array $calendar=[]): array {
    $date=new DateTimeImmutable($today);$month=substr($today,0,7);
    $monday=$date->modify('-'.((int)$date->format('N')-1).' days');
    $start=$profile['startDate']??'';$end=$profile['endDate']??'';
    $hasSchedule=hr_day($start)&&is_array($profile['workDays']??null)&&count($profile['workDays'])>0;
    $weekdays=['','월','화','수','목','금','토','일'];
    $eligible=static fn(DateTimeImmutable $day):bool=>$hasSchedule&&$day->format('Y-m-d')>=$start&&(!$end||$day->format('Y-m-d')<=$end)&&in_array($weekdays[(int)$day->format('N')],$profile['workDays'],true);
    $total=0;$elapsed=0;$available=0;$weekly=0;$monthly=0;$weekDates=[];
    for($day=$date->modify('first day of this month');$day->format('Y-m')===$month;$day=$day->modify('+1 day'))if(business_calendar_is_workday($day->format('Y-m-d'),$calendar)){$total++;if($day->format('Y-m-d')<=$today)$elapsed++;}
    for($i=0;$i<5;$i++){
        $day=$monday->modify('+'.$i.' days');$key=$day->format('Y-m-d');$scheduled=$eligible($day)&&business_calendar_is_workday($key,$calendar);$completed=$key<=$today;
        if($scheduled){$available++;if($completed)$weekly+=(int)($counts[$key]??0);}
        $weekDates[]=['date'=>$key,'count'=>$scheduled&&$completed?(int)($counts[$key]??0):null,'scheduled'=>$scheduled,'completed'=>$completed];
    }
    foreach($counts as $key=>$count)if(str_starts_with($key,$month)&&$key<=$today&&(!$start||$key>=$start)&&(!$end||$key<=$end))$monthly+=(int)$count;
    $daily=(!$start||$today>=$start)&&(!$end||$today<=$end)?(int)($counts[$today]??0):0;
    $dailyEligible=in_array($profile['role']??'', ['상담원','TM','TM 직원'], true);
    $cash=$policy['dailyCash']??null;
    $dailyConfigured=is_array($cash)&&is_int($cash['start']??null)&&$cash['start']>=1&&is_int($cash['perCase']??null)&&$cash['perCase']>=0;
    $dailyAmount=$dailyEligible&&$dailyConfigured?max(0,$daily-$cash['start']+1)*$cash['perCase']:null;
    $weeklyTarget=null;foreach($policy['weekly']??[] as $row)if(($row['achievement']??0)>0||($row['extra']??0)>0){$weeklyTarget=$row['min'];break;}
    $average=($policy['weeklyBasis']??'')==='average';$range=null;$lower=0;
    foreach($policy['monthlyReference']??$policy['monthly']??[] as $row){$min=$row['min']??$lower;$max=$row['max'];if($monthly>=$min&&($max===null||$monthly<=$max)){$range=$min===0?($max===null?'전체 구간':number_format($max).'건 이하'):number_format($min).($max===null?'건 이상':'~'.number_format($max).'건');break;}$lower=($max??0)+1;}
    $weekValue=$average?($hasSchedule&&$available>0?$weekly/$available:null):(float)$weekly;
    $weekTiers=$weekValue===null?['current'=>null,'next'=>null]:grade_target_tiers($policy['weekly']??[],$weekValue,$average);
    $monthTiers=grade_target_tiers($policy['monthlyReference']??$policy['monthly']??[],(float)$monthly,false,isset($policy['monthlyReference']));
    return ['date'=>$today,'month'=>$month,'scheduleRegistered'=>$hasSchedule,'policyRegistered'=>$policy!==null,'general'=>!in_array($profile['role']??'',['팀장','관리자','관리직'],true),
        'workdays'=>['total'=>$total,'elapsed'=>$elapsed],
        'daily'=>['count'=>$daily,'target'=>$dailyConfigured?$cash['start']:null,'perCase'=>$dailyConfigured?$cash['perCase']:null,'eligible'=>$dailyEligible,'paidCount'=>$dailyEligible&&$dailyConfigured?max(0,$daily-$cash['start']+1):0,'amount'=>$dailyAmount,'nextTarget'=>$dailyEligible&&$dailyConfigured?max($cash['start'],$daily+1):null,'paid'=>null],
        'weekly'=>['count'=>$weekly,'value'=>$average?($hasSchedule&&$available>0?round($weekly/$available,2):null):$weekly,'target'=>$weeklyTarget,'currentTier'=>$weekTiers['current'],'nextTier'=>$weekTiers['next'],'basis'=>$average?'average':'total','availableDays'=>$hasSchedule?$available:null,'standardDays'=>5,'dates'=>$weekDates,'rules'=>$policy['weekly']??[],'start'=>$monday->format('Y-m-d'),'end'=>$monday->modify('+4 days')->format('Y-m-d')],
        'monthly'=>['count'=>$monthly,'range'=>$range,'currentTier'=>$monthTiers['current'],'nextTier'=>$monthTiers['next']]];
}
function grade_summary_snapshot(array $user,?string $today=null): array {
    if(($user['role']??'')!=='employee')throw new HRForbidden('직원 본인 그레이드만 조회할 수 있습니다.');
    $today=$today??hr_today();hr_assert(hr_day($today),'기준일을 확인해 주세요.');
    $d=db();$ownsTransaction=!$d->inTransaction();if($ownsTransaction)$d->beginTransaction();
    try {
        $q=$d->prepare('SELECT profile FROM hr_employees WHERE user_id=?');$q->execute([$user['id']]);$raw=$q->fetchColumn();$profile=$raw?json_decode($raw,true,512,JSON_THROW_ON_ERROR):[];
        $entries=grade_history($user['department']);$entry=null;foreach($entries as $candidate)if($candidate['date']<=$today)$entry=$candidate;$policy=$entry['policy']??null;
        $date=new DateTimeImmutable($today);$week=$date->modify('-'.((int)$date->format('N')-1).' days')->format('Y-m-d');$from=min(substr($today,0,7).'-01',$week);
        $test=cnc_test_user($user);
        $counts=sales_performance_counts((int)$user['id'],$user['department'],$test,$from,$today);
        $calendar=business_calendar_rules(substr($today,0,7));$result=grade_progress($profile,$counts,$policy,$today,$calendar)+['gradeAvailable'=>$user['department']==='insurance'||$entry!==null,'gradeVisibility'=>grade_visibility_for($user)[$user['department']]??['daily'=>true,'weekly'=>true,'monthly'=>true],'department'=>$user['department'],'isTest'=>$test,'policyDate'=>$entry['date']??null,'fetchedAt'=>gmdate('c')];
        // Use the same effective-date and five-day proration as payroll, with all own normal records.
        $records=[];foreach($result['weekly']['dates'] as $day)if($day['scheduled']&&$day['completed'])$records[]=['date'=>$day['date'],'count'=>$day['count'],'hours'=>0];
        $weekProfile=$profile;if(!$result['scheduleRegistered'])$weekProfile['workDays']=[];
        $ledger=grade_ledger(substr($result['weekly']['end'],0,7),$records,$entries,$weekProfile,$calendar);
        foreach($ledger['weeks'] as $item)if($item['start']===$result['weekly']['start']){
            $result['weekly']['amount']=$item['bonus'];$result['weekly']['parts']=$item['parts'];$result['weekly']['complete']=!$item['missing']&&$item['days']>0;$result['weekly']['payrollMonth']=$item['payrollMonth'];break;
        }
        $q=$d->prepare('SELECT milestone,amount,confirmed_at FROM daily_grade_receipts WHERE employee_id=? AND performance_date=? ORDER BY milestone');$q->execute([$user['id'],$today]);
        $result['daily']['receipts']=array_map(static fn($r)=>['milestone'=>(int)$r['milestone'],'amount'=>(int)$r['amount'],'confirmedAt'=>$r['confirmed_at']],$q->fetchAll());
        // Earned cash is automatically treated as received; old click records remain audit history only.
        $result['daily']['confirmedPaid']=array_sum(array_column($result['daily']['receipts'],'amount'));
        $result['daily']['receiptMode']='automatic';
        $result['daily']['paid']=$result['daily']['amount']??0;
        $result['daily']['pending']=$result['daily']['amount']===null?null:0;
        if($ownsTransaction)$d->commit();return $result;
    }catch(Throwable $e){if($ownsTransaction&&$d->inTransaction())$d->rollBack();throw $e;}
}
