<?php
declare(strict_types=1);
require_once __DIR__.'/grade-ledger.php';

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
        $rows[]=grade_ledger($month,grade_forecast_records($month,$count,$calendar),$entries,[],$calendar);
    }
    return ['month'=>$month,'days'=>count($dates),'hours'=>count($dates)*6,'basis'=>$basis,'rows'=>$rows]+($selected?['policy'=>$policy,'effectiveDate'=>$selected['date']]:[]);
}
