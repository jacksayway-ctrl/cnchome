<?php
declare(strict_types=1);
require_once __DIR__.'/hr.php';
require_once __DIR__.'/policy.php';

function grade_dates(string $month): array {
    hr_assert((bool)preg_match('/^20\d{2}-(0[1-9]|1[0-2])$/D',$month),'귀속 월을 확인해 주세요.');$out=[];
    for($d=new DateTimeImmutable($month.'-01');$d->format('Y-m')===$month;$d=$d->modify('+1 day'))if((int)$d->format('N')<=5)$out[]=$d->format('Y-m-d');return $out;
}
function grade_week(string $date): array {$d=new DateTimeImmutable($date);$d=$d->modify('-'.((int)$d->format('N')-1).' days');return array_map(fn($i)=>$d->modify('+'.$i.' days')->format('Y-m-d'),range(0,4));}
function grade_zero_policy(int $rate=15000): array {$r=['min'=>0,'max'=>null,'hourly'=>0,'achievement'=>0,'extraStart'=>null,'extra'=>0];return ['version'=>1,'weeklyBasis'=>'average','dailyCash'=>['start'=>6,'perCase'=>0],'daily'=>[$r],'weekly'=>[$r],'monthly'=>[array_replace($r,['hourly'=>$rate])]];}
function grade_evaluate(array $p,string $period,float $count,int $days=5): array {
    if($period==='daily')return ['hourly'=>0,'bonus'=>max(0,(int)floor($count)-(int)$p['dailyCash']['start']+1)*(int)$p['dailyCash']['perCase']];
    $reference=$period==='monthly'&&isset($p['monthlyReference']);$average=$period==='weekly'&&$p['weeklyBasis']==='average';$value=$average?$count/max(1,$days):$count;$lower=0;
    foreach($reference?$p['monthlyReference']:$p[$period] as $row){$min=$reference?$lower:$row['min'];$max=$row['max'];
        if(($reference||$value>=$min)&&($max===null||($average?$value<$max:$value<=$max))){$units=$reference?max(0,$value-$row['threshold']):($row['extraStart']===null?0:max(0,floor($value)-$row['extraStart']+1));return ['hourly'=>(int)$row['hourly'],'bonus'=>$row['achievement']+$units*$row['extra']];}$lower=$max===null?$lower:$max+1;
    }return ['hourly'=>0,'bonus'=>0];
}
function grade_round_parts(array &$parts): int {$raw=0;$previous=0;foreach($parts as &$part){$raw+=$part['bonus'];$rounded=(int)round($raw);$part['bonus']=$rounded-$previous;$previous=$rounded;}unset($part);return $previous;}
/** One tier per whole period, weighted by effective scheduled days; daily cash appears once. */
function grade_ledger(string $month,array $records,array $entries,array $profile=[]): array {
    $dates=grade_dates($month);$start=$profile['startDate']??'';$end=$profile['endDate']??'';$workDays=$profile['workDays']??['월','화','수','목','금'];$names=['월','화','수','목','금'];
    $eligible=fn($date)=>(!$start||$date>=$start)&&(!$end||$date<=$end)&&in_array($names[(int)(new DateTimeImmutable($date))->format('N')-1]??'',$workDays,true);
    $general=!in_array($profile['role']??'상담원',['팀장','관리자','관리직'],true);$default=grade_zero_policy((int)($profile['payAmount']??15000));
    usort($entries,fn($a,$b)=>strcmp($a['date'],$b['date'])?:strcmp($a['savedAt']??'',$b['savedAt']??'')?:($a['id']??0)<=>($b['id']??0));
    $at=function($date)use($entries,$default){$p=$default;$since='미등록';foreach($entries as $entry){if($entry['date']>$date)break;$p=$entry['policy'];$since=$entry['date'];}return [$p,$since];};
    $ledger=[];foreach($records as $r){hr_assert(hr_day($r['date'])&&!isset($ledger[$r['date']]),'날짜별 실적 중복 또는 형식을 확인해 주세요.');hr_assert(is_numeric($r['count'])&&$r['count']>=0&&$r['count']<=1000000&&is_numeric($r['hours'])&&$r['hours']>=0&&$r['hours']<=24,'실적·시간 범위를 확인해 주세요.');if($eligible($r['date']))$ledger[$r['date']]=$r;}
    $monthlyRows=array_filter($ledger,fn($r)=>str_starts_with($r['date'],$month));$count=array_sum(array_column($monthlyRows,'count'));$hours=array_sum(array_column($monthlyRows,'hours'));$base=0;$monthRaw=0;$daily=0;$parts=[];
    foreach($dates as $date){if(!$eligible($date))continue;[$p,$since]=$at($date);$result=grade_evaluate($p,'monthly',$count);$key=$since.':'.hash('sha256',hr_json($p['monthlyReference']??$p['monthly']));
        if(!isset($parts[$key]))$parts[$key]=['start'=>$date,'end'=>$date,'effective'=>$since,'days'=>0,'hours'=>0,'hourly'=>$result['hourly'],'fullBonus'=>$general?$result['bonus']:0,'bonus'=>0];
        $parts[$key]['end']=$date;$parts[$key]['days']++;$parts[$key]['hours']+=(float)($ledger[$date]['hours']??0);
    }
    foreach($parts as &$part){$part['ratio']=$part['days']/count($dates);$part['bonus']=$part['fullBonus']*$part['ratio'];$monthRaw+=$part['bonus'];$base+=$part['hours']*$part['hourly'];}unset($part);
    $dailyDetails=[];
    foreach($monthlyRows as $r)if($general){
        [$p,$since]=$at($r['date']);$amount=grade_evaluate($p,'daily',(float)$r['count'])['bonus'];$daily+=$amount;
        $dailyDetails[]=['date'=>$r['date'],'count'=>$r['count'],'start'=>$p['dailyCash']['start'],'perCase'=>$p['dailyCash']['perCase'],'paidCount'=>max(0,(int)floor($r['count'])-$p['dailyCash']['start']+1),'amount'=>$amount,'effective'=>$since];
    }
    usort($dailyDetails,fn($a,$b)=>strcmp($a['date'],$b['date']));
    $weeks=[];$weekly=0;$seen=[];
    foreach($dates as $date){$week=grade_week($date);if(isset($seen[$week[0]]))continue;$seen[$week[0]]=true;$days=array_values(array_filter($week,$eligible));$wc=0;$missing=[];$groups=[];
        foreach($days as $day){$wc+=(float)($ledger[$day]['count']??0);if(!isset($ledger[$day]))$missing[]=$day;}
        foreach($days as $day){[$p,$since]=$at($day);$key=$since.':'.hash('sha256',hr_json([$p['weeklyBasis'],$p['weekly']]));$g=grade_evaluate($p,'weekly',$wc,count($days));if(!isset($groups[$key]))$groups[$key]=['start'=>$day,'end'=>$day,'effective'=>$since,'days'=>0,'fullBonus'=>$general?$g['bonus']:0];$groups[$key]['end']=$day;$groups[$key]['days']++;}
        $bonus=0;foreach($groups as &$g){$g['ratio']=$g['days']/5;$g['bonus']=$g['fullBonus']*$g['ratio'];$bonus+=$g['bonus'];}unset($g);
        $included=substr($week[4],0,7)===$month&&!$missing&&count($days)>0;$bonus=grade_round_parts($groups);if($included)$weekly+=$bonus;
        $weeks[]=['start'=>$week[0],'end'=>$week[4],'count'=>$wc,'average'=>$days?$wc/count($days):0,'days'=>count($days),'included'=>$included,'missing'=>$missing,'bonus'=>$bonus,'parts'=>array_values($groups),'payrollMonth'=>substr($week[4],0,7)];
    }
    $base=(int)floor($base);$monthly=grade_round_parts($parts);$daily=(int)round($daily);return ['month'=>$month,'count'=>$count,'hours'=>$hours,'days'=>count($dates),'base'=>$base,'daily'=>$daily,'weekly'=>$weekly,'monthly'=>$monthly,'salary'=>$base+$monthly+$weekly,'total'=>$base+$monthly+$weekly+$daily,'parts'=>array_values($parts),'weeks'=>$weeks,'dailyDetails'=>$dailyDetails,'general'=>$general];
}
function grade_history(string $department): array {$q=db()->prepare('SELECT id,effective_date AS date,saved_at AS savedAt,policy FROM grade_versions WHERE department=? ORDER BY effective_date,id');$q->execute([$department]);return array_map(function($r){$r['policy']=json_decode($r['policy'],true,512,JSON_THROW_ON_ERROR);return $r;},$q->fetchAll());}
function grade_forecast_records(string $month,int $count): array {
    $days=grade_dates($month);$size=count($days);$rows=[];foreach($days as $i=>$day)$rows[$day]=['date'=>$day,'count'=>intdiv($count,$size)+($i<$count%$size?1:0),'hours'=>6];
    // Adjacent month days are estimates at the same daily average, needed for complete boundary weeks.
    foreach(array_merge(grade_week($days[0]),grade_week(end($days))) as $day)if(!isset($rows[$day]))$rows[$day]=['date'=>$day,'count'=>$count/$size,'hours'=>6];return array_values($rows);
}
function grade_employee_context(array $employee,string $month): array {
    $uid=(int)($employee['userId']??0);$p=$employee['profile'];$counts=[];$hours=[];$days=grade_dates($month);$from=grade_week($days[0])[0];$through=min(hr_today(),grade_week(end($days))[4]);$d=db();
    $q=$d->prepare("SELECT username,display_name,role FROM app_users WHERE id=?");$q->execute([$uid]);$test=cnc_test_user($q->fetch()?:[]);
    $q=$d->prepare("SELECT first_date,COUNT(*) AS amount FROM sales_records WHERE employee_id=? AND department=? AND is_test=? AND status='normal' AND first_date>=? AND first_date<=? GROUP BY first_date");$q->execute([$uid,$p['team'],$test?1:0,$from,$through]);foreach($q->fetchAll() as $r)$counts[$r['first_date']]=(int)$r['amount'];
    $q=$d->prepare('SELECT state FROM test_employee_data WHERE user_id=?');$q->execute([$uid]);$raw=$q->fetchColumn();if($raw&&$test){$state=json_decode($raw,true,512,JSON_THROW_ON_ERROR);foreach($state['sales']??[] as $s)if($s['status']==='정상'&&$s['date']>=$from&&$s['date']<=$through)$counts[$s['date']]=($counts[$s['date']]??0)+1;foreach($state['attendance']??[] as $a)if($a['out']&&$a['date']>=$from&&$a['date']<=$through){$start=strtotime($a['date'].' '.$a['in']);$end=strtotime($a['date'].' '.$a['out']);$hours[$a['date']]=max(0,($end-$start)/3600-1);}}
    $rows=[];for($date=$from;$date<=$through;$date=(new DateTimeImmutable($date))->modify('+1 day')->format('Y-m-d'))if((int)(new DateTimeImmutable($date))->format('N')<=5)$rows[]=['date'=>$date,'count'=>$counts[$date]??0,'hours'=>$hours[$date]??0];
    $result=grade_ledger($month,$rows,grade_history($p['team']),$p);$q=$d->prepare('SELECT COALESCE(SUM(amount),0) FROM daily_grade_receipts WHERE employee_id=? AND performance_date>=? AND performance_date<=?');$q->execute([$uid,$month.'-01',(new DateTimeImmutable($month.'-01'))->format('Y-m-t')]);
    $result['dailyConfirmedReceipts']=(int)$q->fetchColumn();
    $result['dailySettlement']='automatic';$result['dailyReceived']=$result['daily'];$result['dailyOutstanding']=0;$result['asOf']=hr_today();return $result;
}

/** Replace the three grade lines, never accumulate them across repeated saves. */
function grade_payroll_input(array $input,array $grade): array {
    $items=[];foreach($input['allowanceItems']??[] as $item){
        if(in_array($item['kind']??'', ['grade','gradeDaily','gradeWeekly','gradeMonthly'],true)||preg_match('/(?:일|주|월)\s*그레이드/u',$item['label']??''))continue;
        $items[]=$item;
    }
    $automatic=($grade['dailySettlement']??'')==='automatic';
    $dailyPaid=hr_int($automatic?$grade['daily']:($grade['dailyReceived']??0));
    if($automatic)$grade['dailyReceived']=$dailyPaid;
    foreach(['daily'=>['일그레이드 현금 지급 총액','gradeDaily'],'weekly'=>['주그레이드','gradeWeekly'],'monthly'=>['월그레이드','gradeMonthly']] as $key=>[$label,$kind]){
        $amount=$key==='daily'?$dailyPaid:$grade[$key];
        if($amount>0)$items[]=['label'=>$key==='daily'&&$automatic?'일그레이드 자동 선지급 총액':$label,'amount'=>$amount,'kind'=>$kind,'method'=>$key==='daily'?($automatic?'정상 접수로 달성한 건별 금액을 날짜별로 누적. 버튼 확인 없이 전액 수령·선지급 처리하며 같은 금액을 차감하여 급여일에 다시 지급하지 않음.':'당일 현금 수령 확인 기록 합계. 같은 금액을 선지급으로 차감하며 급여일에 다시 지급하지 않음. 미수령액은 별도 현금 정산.'):'본인 기간 전체 실적으로 단일 구간을 정하고 적용일부터 근무가능일 비율로 계산. 주·월 함께 지급.'];
    }
    foreach($input['deductionItems']??[] as $item)hr_assert(!preg_match('/일\s*그레이드|그레이드\s*선지급/u',$item['label']??''),'일그레이드 선지급은 자동 차감합니다. 수동 공제에서 제외해 주세요.');
    $input['allowanceItems']=$items;$input['allowance']=array_sum(array_column($items,'amount'));
    $grade['dailyOutstanding']=max(0,$grade['daily']-$dailyPaid);
    $input['gradeSnapshot']=$grade;$input['prepaidDaily']=$dailyPaid;$input['dailyGradeSettlement']=$automatic?'cash-auto':'cash';return $input;
}
function grade_personal_totals(array $employee,string $month): array {
    $grade=grade_employee_context($employee,$month);$profile=$employee['profile'];
    $rate=(int)($profile['payAmount']??15000);$base=($profile['payType']??'시급제')==='월급제'?$rate:(int)round($grade['hours']*$rate);
    $payday=$base+$grade['weekly']+$grade['monthly'];
    return ['month'=>$month,'asOf'=>$grade['asOf'],'count'=>$grade['count'],'hours'=>$grade['hours'],'rate'=>$rate,'workPay'=>$base,'daily'=>$grade['daily'],'weekly'=>$grade['weekly'],'monthly'=>$grade['monthly'],'dailyPaid'=>$grade['dailyReceived'],'dailyPending'=>$grade['dailyOutstanding'],'total'=>$payday+$grade['daily'],'payday'=>$payday,'dailyDetails'=>$grade['dailyDetails'],'weeklyDetails'=>array_values(array_filter($grade['weeks'],fn($week)=>$week['start']<=$grade['asOf']))];
}
