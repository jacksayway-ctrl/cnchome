<?php
declare(strict_types=1);
require_once __DIR__.'/grade-ledger.php';

/** Criteria examples use one policy for the entire month; payroll previews retain effective dates. */
function grade_estimates(array $input,array $history,array $calendar,bool $admin): array {
    $month=$input['month']??substr(hr_today(),0,7);
    hr_assert(is_string($month),'월을 확인해 주세요.');
    $dates=grade_dates($month,$calendar);$policy=normalize_policy($input['policy']??null);
    $basis=$input['basis']??'effective';
    hr_assert(in_array($basis,['effective','full-month'],true),'예상액 계산 기준을 확인해 주세요.');
    $entries=$history;
    if(($input['preview']??false)===true){
        hr_assert($admin&&valid_day($input['date']??null),'적용일을 확인해 주세요.');
        $entries=grade_preview_entries($entries,$input['date'],$policy);
    }
    if($basis==='full-month'||($input['fixed']??false)===true){
        hr_assert($admin,'관리자 기준표 열람 권한이 없습니다.');
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
    return ['month'=>$month,'days'=>count($dates),'hours'=>count($dates)*6,'basis'=>$basis,'rows'=>$rows];
}
