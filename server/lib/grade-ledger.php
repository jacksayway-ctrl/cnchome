<?php
declare(strict_types=1);
require_once __DIR__.'/grade-departments.php';
require_once __DIR__.'/hr.php';
require_once __DIR__.'/policy.php';
require_once __DIR__.'/business-calendar.php';
require_once __DIR__.'/sales-performance.php';

function grade_dates(string $month,array $calendar=[]): array {return business_calendar_workdays($month,$calendar);}
function grade_week(string $date): array {$d=new DateTimeImmutable($date);$d=$d->modify('-'.((int)$d->format('N')-1).' days');return array_map(fn($i)=>$d->modify('+'.$i.' days')->format('Y-m-d'),range(0,4));}
function grade_zero_policy(int $rate=15000): array {return grade_empty_policy($rate);}
function grade_evaluate(array $p,string $period,float $count,int $days=5): array {
    if($period==='daily')return ['hourly'=>0,'bonus'=>max(0,(int)floor($count)-(int)$p['dailyCash']['start']+1)*(int)$p['dailyCash']['perCase']];
    $reference=$period==='monthly'&&isset($p['monthlyReference']);$average=$period==='weekly'&&$p['weeklyBasis']==='average';$value=$average?$count/max(1,$days):$count;$lower=0;
    foreach($reference?$p['monthlyReference']:$p[$period] as $row){$min=$reference?$lower:$row['min'];$max=$row['max'];
        if(($reference||$value>=$min)&&($max===null||($average?$value<$max:$value<=$max))){$units=$reference?max(0,$value-$row['threshold']):($row['extraStart']===null?0:max(0,floor($value)-$row['extraStart']+1));return ['hourly'=>(int)$row['hourly'],'bonus'=>$row['achievement']+$units*$row['extra']];}$lower=$max===null?$lower:$max+1;
    }return ['hourly'=>0,'bonus'=>0];
}
function grade_round_parts(array &$parts): int {$raw=0;$previous=0;foreach($parts as &$part){$raw+=$part['bonus'];$rounded=(int)round($raw);$part['bonus']=$rounded-$previous;$previous=$rounded;}unset($part);return $previous;}
/** One tier per whole period, weighted by effective scheduled days; daily cash appears once. */
function grade_ledger(string $month,array $records,array $entries,array $profile=[],array $calendar=[]): array {
    $dates=grade_dates($month,$calendar);$start=$profile['startDate']??'';$end=$profile['endDate']??'';$workDays=$profile['workDays']??['월','화','수','목','금'];$names=['월','화','수','목','금','토','일'];
    $eligible=fn($date)=>(!$start||$date>=$start)&&(!$end||$date<=$end)&&(in_array($names[(int)(new DateTimeImmutable($date))->format('N')-1]??'',$workDays,true)||(!isset($profile['workDays'])&&($calendar[$date]??false)));
    $scheduled=fn($date)=>$eligible($date)&&business_calendar_is_workday($date,$calendar);
    $general=!in_array($profile['role']??'상담원',['팀장','관리자','관리직'],true);$default=grade_zero_policy((int)($profile['payAmount']??15000));
    usort($entries,fn($a,$b)=>strcmp($a['date'],$b['date'])?:strcmp($a['savedAt']??'',$b['savedAt']??'')?:($a['id']??0)<=>($b['id']??0));
    $at=function($date)use($entries,$default){$p=$default;$since='미등록';foreach($entries as $entry){if($entry['date']>$date)break;$p=$entry['policy'];$since=$entry['date'];}return [$p,$since];};
    $ledger=[];foreach($records as $r){hr_assert(hr_day($r['date'])&&!isset($ledger[$r['date']]),'날짜별 실적 중복 또는 형식을 확인해 주세요.');hr_assert(is_numeric($r['count'])&&$r['count']>=0&&$r['count']<=1000000&&is_numeric($r['hours'])&&$r['hours']>=0&&$r['hours']<=24,'실적·시간 범위를 확인해 주세요.');if($eligible($r['date']))$ledger[$r['date']]=$r;}
    $monthlyRows=array_filter($ledger,fn($r)=>str_starts_with($r['date'],$month));$count=array_sum(array_column($monthlyRows,'count'));$hours=array_sum(array_column($monthlyRows,'hours'));$base=0;$monthRaw=0;$daily=0;$parts=[];
    $partDates=array_values(array_unique(array_merge($dates,array_keys($monthlyRows))));sort($partDates);
    foreach($partDates as $date){if(!$eligible($date))continue;[$p,$since]=$at($date);$result=grade_evaluate($p,'monthly',$count);$key=$since.':'.hash('sha256',hr_json($p['monthlyReference']??$p['monthly']));
        if(!isset($parts[$key]))$parts[$key]=['start'=>$date,'end'=>$date,'effective'=>$since,'days'=>0,'hours'=>0,'hourly'=>($profile['payType']??'시급제')==='시급제'?max((int)($profile['payAmount']??15000),$result['hourly']):$result['hourly'],'fullBonus'=>$general?$result['bonus']:0,'bonus'=>0];
        $parts[$key]['end']=$date;$parts[$key]['days']+=business_calendar_is_workday($date,$calendar)?1:0;$parts[$key]['hours']+=(float)($ledger[$date]['hours']??0);
    }
    foreach($parts as &$part){$part['ratio']=$part['days']/max(1,count($dates));$part['bonus']=$part['fullBonus']*$part['ratio'];$monthRaw+=$part['bonus'];$base+=$part['hours']*$part['hourly'];}unset($part);
    $dailyDetails=[];
    foreach($monthlyRows as $r)if($general){
        [$p,$since]=$at($r['date']);$amount=grade_evaluate($p,'daily',(float)$r['count'])['bonus'];$daily+=$amount;
        $dailyDetails[]=['date'=>$r['date'],'count'=>$r['count'],'start'=>$p['dailyCash']['start'],'perCase'=>$p['dailyCash']['perCase'],'paidCount'=>max(0,(int)floor($r['count'])-$p['dailyCash']['start']+1),'amount'=>$amount,'effective'=>$since];
    }
    usort($dailyDetails,fn($a,$b)=>strcmp($a['date'],$b['date']));
    $weeks=[];$weekly=0;$seen=[];
    foreach(grade_dates($month) as $date){$week=grade_week($date);if(isset($seen[$week[0]]))continue;$seen[$week[0]]=true;$days=array_values(array_filter($week,$scheduled));$wc=0;$missing=[];$groups=[];
        foreach($days as $day){$wc+=(float)($ledger[$day]['count']??0);if(!isset($ledger[$day]))$missing[]=$day;}
        foreach($days as $day){[$p,$since]=$at($day);$key=$since.':'.hash('sha256',hr_json([$p['weeklyBasis'],$p['weekly']]));$g=grade_evaluate($p,'weekly',$wc,count($days));if(!isset($groups[$key]))$groups[$key]=['start'=>$day,'end'=>$day,'effective'=>$since,'days'=>0,'fullBonus'=>$general?$g['bonus']:0];$groups[$key]['end']=$day;$groups[$key]['days']++;}
        $bonus=0;foreach($groups as &$g){$g['ratio']=$g['days']/5;$g['bonus']=$g['fullBonus']*$g['ratio'];$bonus+=$g['bonus'];}unset($g);
        $included=substr($week[4],0,7)===$month&&!$missing&&count($days)>0;$bonus=grade_round_parts($groups);if($included)$weekly+=$bonus;
        $weeks[]=['start'=>$week[0],'end'=>$week[4],'count'=>$wc,'average'=>$days?$wc/count($days):0,'days'=>count($days),'included'=>$included,'missing'=>$missing,'bonus'=>$bonus,'parts'=>array_values($groups),'payrollMonth'=>substr($week[4],0,7)];
    }
    $base=(int)floor($base);$monthly=grade_round_parts($parts);$daily=(int)round($daily);return ['month'=>$month,'count'=>$count,'hours'=>$hours,'days'=>count($dates),'base'=>$base,'daily'=>$daily,'weekly'=>$weekly,'monthly'=>$monthly,'salary'=>$base+$monthly+$weekly,'total'=>$base+$monthly+$weekly+$daily,'parts'=>array_values($parts),'weeks'=>$weeks,'dailyDetails'=>$dailyDetails,'general'=>$general];
}
function grade_history(string $department): array {
    $q=db()->prepare('SELECT id,effective_date AS date,saved_at AS savedAt,policy FROM grade_versions WHERE department=? ORDER BY effective_date,id');$q->execute([$department]);$entries=[];
    foreach($q->fetchAll() as $row){$row['policy']=json_decode($row['policy'],true,512,JSON_THROW_ON_ERROR);if(grade_department_owns($department,$row['policy']))$entries[]=$row;}
    return grade_resolve_entries($entries,$department==='insurance'?null:grade_department_empty($department));
}

function grade_forecast_records(string $month,int $count,array $calendar=[]): array {
    $days=grade_dates($month,$calendar);$size=count($days);if(!$size){hr_assert($count===0,'선택한 월에 영업일이 없습니다. 영업일 달력을 먼저 확인해 주세요.');return [];}$rows=[];foreach($days as $i=>$day)$rows[$day]=['date'=>$day,'count'=>intdiv($count,$size)+($i<$count%$size?1:0),'hours'=>6];
    // Complete boundary weeks with whole-case estimates at the same daily average.
    foreach([grade_week($days[0]),grade_week(end($days))] as $week){
        $adjacent=array_values(array_filter($week,fn($day)=>!isset($rows[$day])&&business_calendar_is_workday($day,$calendar)));
        $length=count($adjacent);if(!$length)continue;$estimated=(int)round($count/$size*$length);
        foreach($adjacent as $i=>$day)$rows[$day]=['date'=>$day,'count'=>intdiv($estimated,$length)+($i<$estimated%$length?1:0),'hours'=>6];
    }
    return array_values($rows);
}
function grade_daily_sample_records(string $month,int $dailyCount,array $calendar=[]): array {
    hr_assert($dailyCount>=0&&$dailyCount<=1000000,'하루 정상 접수 건수를 확인해 주세요.');$dates=grade_dates($month,$calendar);if(!$dates)return [];
    $dates=array_values(array_unique(array_merge($dates,grade_week($dates[0]),grade_week(end($dates)))));sort($dates);
    return array_values(array_map(fn($date)=>['date'=>$date,'count'=>$dailyCount,'hours'=>6],array_filter($dates,fn($date)=>business_calendar_is_workday($date,$calendar))));
}
function grade_sample_estimates(string $month,array $entries,array $calendar=[]): array {
    $samples=[];foreach(range(10,15) as $count){$g=grade_ledger($month,grade_daily_sample_records($month,$count,$calendar),$entries,[],$calendar);$samples[]=['perDay'=>$count,'count'=>$g['count'],'daily'=>$g['daily'],'weekly'=>$g['weekly'],'monthly'=>$g['monthly'],'gradeTotal'=>$g['daily']+$g['weekly']+$g['monthly'],'paydayGrade'=>$g['weekly']+$g['monthly']];}
    return ['month'=>$month,'days'=>count(grade_dates($month,$calendar)),'samples'=>$samples];
}
function grade_employee_context(array $employee,string $month): array {
    $uid=(int)($employee['userId']??0);$p=$employee['profile'];$counts=[];$hours=[];$days=grade_dates($month);$from=grade_week($days[0])[0];$through=min(hr_today(),grade_week(end($days))[4]);$d=db();
    $q=$d->prepare("SELECT username,display_name,role FROM app_users WHERE id=?");$q->execute([$uid]);$test=cnc_test_user($q->fetch()?:[]);
    $counts=sales_performance_counts($uid,$p['team'],$test,$from,$through);
    // Ordinary employees never read fixture receipts or attendance, even if a stale fixture row exists.
    if($test){$q=$d->prepare('SELECT state FROM test_employee_data WHERE user_id=?');$q->execute([$uid]);$raw=$q->fetchColumn();if($raw){$state=json_decode($raw,true,512,JSON_THROW_ON_ERROR);foreach($state['attendance']??[] as $a)if($a['out']&&$a['date']>=$from&&$a['date']<=$through){$start=strtotime($a['date'].' '.$a['in']);$end=strtotime($a['date'].' '.$a['out']);$hours[$a['date']]=max(0,($end-$start)/3600-1);}}}
    $rows=[];for($date=$from;$date<=$through;$date=(new DateTimeImmutable($date))->modify('+1 day')->format('Y-m-d'))if((int)(new DateTimeImmutable($date))->format('N')<=5)$rows[]=['date'=>$date,'count'=>$counts[$date]??0,'hours'=>$hours[$date]??0];
    $history=grade_history($p['team']);
    $result=grade_ledger($month,$rows,$history,$p,business_calendar_rules($month));$q=$d->prepare('SELECT COALESCE(SUM(amount),0) FROM daily_grade_receipts WHERE employee_id=? AND performance_date>=? AND performance_date<=?');$q->execute([$uid,$month.'-01',(new DateTimeImmutable($month.'-01'))->format('Y-m-t')]);
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
    $d=db();$owns=!$d->inTransaction();if($owns)$d->beginTransaction();
    try{$result=grade_personal_totals_from_ledger(grade_employee_context($employee,$month),$employee['profile']);if($owns)$d->commit();return $result;}
    catch(Throwable $e){if($owns&&$d->inTransaction())$d->rollBack();throw $e;}
}
function grade_personal_totals_from_ledger(array $grade,array $profile): array {
    $month=$grade['month'];$contractRate=(int)($profile['payAmount']??15000);
    $rates=array_values(array_unique(array_column($grade['parts'],'hourly')));
    $rate=count($rates)===1?$rates[0]:null;
    $base=($profile['payType']??'시급제')==='월급제'?$contractRate:$grade['base'];
    $payday=$base+$grade['weekly']+$grade['monthly'];
    $weeks=array_values(array_filter($grade['weeks'],fn($week)=>$week['start']<=$grade['asOf']));
    $weeklyAccrued=array_sum(array_column(array_filter($weeks,fn($week)=>$week['payrollMonth']===$month),'bonus'));
    return ['month'=>$month,'asOf'=>$grade['asOf'],'count'=>$grade['count'],'hours'=>$grade['hours'],'rate'=>$rate,'contractRate'=>$contractRate,'payType'=>$profile['payType']??'시급제','workDetails'=>$grade['parts'],'workPay'=>$base,'daily'=>$grade['daily'],'weekly'=>$grade['weekly'],'weeklyAccrued'=>$weeklyAccrued,'gradeTotal'=>$grade['daily']+$weeklyAccrued+$grade['monthly'],'monthly'=>$grade['monthly'],'dailyPaid'=>$grade['dailyReceived'],'dailyPending'=>$grade['dailyOutstanding'],'total'=>$payday+$grade['daily'],'payday'=>$payday,'dailyDetails'=>$grade['dailyDetails'],'weeklyDetails'=>$weeks];
}
