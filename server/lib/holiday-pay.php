<?php
declare(strict_types=1);
// Company-agreed inclusive hourly pay: 5 parts base pay + 1 part weekly support.
// No 15-hour or full-attendance gate is applied to this voluntary support rule.
function hr_holiday_split(int|float $rate,int $minutes,array $weeks,string $month): array {
    hr_assert(preg_match('/^\d{4}-\d{2}$/D',$month)===1&&hr_day($month.'-01'),'귀속 월을 확인해 주세요.');
    hr_assert(array_is_list($weeks)&&count($weeks)<=6,'주별 인정시간을 입력해 주세요.');
    $last=(new DateTimeImmutable($month.'-01'))->modify('last day of this month')->format('Y-m-d');
    $seen=[];$sum=0;
    foreach($weeks as $row){
        hr_assert(is_array($row)&&is_string($row['weekStart']??null)&&hr_day($row['weekStart']),'주 시작일을 확인해 주세요.');
        $start=$row['weekStart'];$date=new DateTimeImmutable($start);
        hr_assert($date->format('N')==='1'&&$start<=$last&&$date->modify('+6 days')->format('Y-m-d')>=$month.'-01'&&!isset($seen[$start]),'중복되거나 귀속 월에 속하지 않는 주입니다.');
        $seen[$start]=true;$sum+=hr_int($row['minutes']??null,10080);
    }
    hr_assert($sum===$minutes,'주별 인정시간 합계가 총 인정시간과 다릅니다.');
    usort($weeks,fn($a,$b)=>strcmp($a['weekStart'],$b['weekStart']));
    $rows=[];$running=0;$previousGross=0;$previousBase=0;
    foreach($weeks as $row){
        $running+=$row['minutes'];$gross=(int)round($rate*$running/60);$base=(int)round($rate*$running/72);
        $weekGross=$gross-$previousGross;$weekBase=$base-$previousBase;
        $rows[]=['weekStart'=>$row['weekStart'],'minutes'=>$row['minutes'],'base'=>$weekBase,'holiday'=>$weekGross-$weekBase,'gross'=>$weekGross];
        $previousGross=$gross;$previousBase=$base;
    }
    return ['baseRate'=>$rate/1.2,'holidayRate'=>$rate-$rate/1.2,'base'=>$previousBase,'holiday'=>$previousGross-$previousBase,'workGross'=>$previousGross,'weeklyBreakdown'=>$rows];
}
