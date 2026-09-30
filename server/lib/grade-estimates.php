<?php
declare(strict_types=1);
require_once __DIR__.'/grade-ledger.php';

/** Fixed eight-case reference: average per day or total according to the saved basis. */
function grade_estimate_minimum_weekly(array $policy): array {
    return ['count'=>8,'amount'=>(int)grade_evaluate($policy,'weekly',$policy['weeklyBasis']==='average'?40:8,5)['bonus']];
}

/** Display-only floor for a whole zero daily/weekly component in monthly criteria examples. */
function grade_estimate_minimums(array $grade,array $policy): array {
    $dailyRate=grade_evaluate($policy,'daily',7)['bonus'];$weekly=grade_estimate_minimum_weekly($policy);
    $minimum=[
        'daily'=>['applied'=>false,'originalAmount'=>$grade['daily'],'unitAmount'=>$dailyRate,'minimumCount'=>7,'days'=>count($grade['dailyDetails'])],
        'weekly'=>['applied'=>false,'originalAmount'=>$grade['weekly'],'unitAmount'=>$weekly['amount'],'minimumCount'=>$weekly['count'],'weeklyBasis'=>$policy['weeklyBasis'],'includedDays'=>array_sum(array_column(array_filter($grade['weeks'],fn($week)=>$week['included']),'days'))]
    ];
    if($grade['general']&&$grade['daily']===0&&$dailyRate>0&&$grade['dailyDetails']){
        foreach($grade['dailyDetails'] as &$day){
            // Preserve actual sample counts: this amount is a comparison floor, not an earned award.
            $day['floorApplied']=true;$day['originalAmount']=$day['amount'];$day['minimumCount']=7;$day['minimumPaidCount']=max(0,7-$policy['dailyCash']['start']+1);$day['amount']=$dailyRate;
        }unset($day);
        $grade['daily']=array_sum(array_column($grade['dailyDetails'],'amount'));$minimum['daily']['applied']=true;
    }
    if($grade['general']&&$grade['weekly']===0&&$weekly['amount']>0&&$minimum['weekly']['includedDays']>0){
        foreach($grade['weeks'] as &$week){
            if(!$week['included'])continue;
            $week['floorApplied']=true;$week['originalBonus']=$week['bonus'];$week['minimumCount']=$weekly['count'];
            foreach($week['parts'] as &$part){
                $part['floorApplied']=true;$part['originalFullBonus']=$part['fullBonus'];$part['originalBonus']=$part['bonus'];$part['minimumCount']=$weekly['count'];
                $part['fullBonus']=$weekly['amount'];$part['bonus']=$part['fullBonus']*$part['ratio'];
            }unset($part);
            $week['bonus']=grade_round_parts($week['parts']);
        }unset($week);
        $grade['weekly']=array_sum(array_column(array_filter($grade['weeks'],fn($week)=>$week['included']),'bonus'));$minimum['weekly']['applied']=true;
    }
    $grade['salary']=$grade['base']+$grade['monthly']+$grade['weekly'];$grade['total']=$grade['salary']+$grade['daily'];$grade['minimumGrade']=$minimum;
    return $grade;
}

/** Criteria examples use one policy for the entire month; payroll previews retain effective dates. */
function grade_estimates(array $input,array $history,array $calendar,bool $admin): array {
    $month=$input['month']??substr(hr_today(),0,7);
    hr_assert(is_string($month),'월을 확인해 주세요.');
    $dates=grade_dates($month,$calendar);
    $basis=$input['basis']??'effective';
    hr_assert(in_array($basis,['effective','full-month'],true),'예상액 계산 기준을 확인해 주세요.');
    $fixed=($input['fixed']??false)===true;$preview=($input['preview']??false)===true;
    if($preview)hr_assert($admin&&valid_day($input['date']??null),'적용일을 확인해 주세요.');
    $selected=null;
    if(!$admin&&($basis==='full-month'||$fixed)){
        // The endpoint supplies only this employee's department history. Never trust a client policy.
        if($fixed){
            $id=bounded($input['historyId']??null,1);
            foreach($history as $entry)if((int)($entry['id']??0)===$id)$selected=$entry;
            hr_assert($selected!==null,'선택한 부서의 이전 기준을 확인할 수 없습니다.');
        }else{
            usort($history,fn($a,$b)=>strcmp($a['date'],$b['date'])?:strcmp($a['savedAt']??'',$b['savedAt']??'')?:($a['id']??0)<=>($b['id']??0));
            foreach($history as $entry)if($entry['date']<=hr_today())$selected=$entry;
            hr_assert($selected!==null,'현재 적용 중인 지급 기준이 없습니다. 관리자에게 기준 등록을 요청해 주세요.');
        }
        $policy=normalize_policy($fixed?($selected['savedPolicy']??$selected['policy']):$selected['policy']);
    }else{$policy=normalize_policy($input['policy']??null);}
    $entries=$history;
    if($preview){
        $entries=grade_preview_entries($entries,$input['date'],$policy);
    }
    if($basis==='full-month'||$fixed){
        $entries=[['date'=>'2000-01-01','policy'=>$policy]];$basis='full-month';
    }
    if(($input['dailySamples']??false)===true){
        hr_assert($admin,'관리자 계산 예시입니다.');
        return grade_sample_estimates($month,$entries,$calendar)+['basis'=>$basis];
    }
    $counts=$input['counts']??[];
    hr_assert(is_array($counts)&&array_is_list($counts)&&count($counts)<=20,'예상 실적을 확인해 주세요.');
    $rows=[];
    foreach($counts as $count){
        bounded($count);
        $grade=grade_ledger($month,grade_forecast_records($month,$count,$calendar),$entries,[],$calendar);
        $rows[]=$basis==='full-month'?grade_estimate_minimums($grade,$policy):$grade;
    }
    return ['month'=>$month,'days'=>count($dates),'hours'=>count($dates)*6,'basis'=>$basis,'rows'=>$rows]+($selected?['policy'=>$policy,'effectiveDate'=>$selected['date']]:[]);
}
