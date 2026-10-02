<?php
declare(strict_types=1);
/** Proven generator signatures only; never infer provenance from an account or is_test. */
function automatic_sale_fixture(array $sale,array $state): bool {
    $id=(int)($sale['id']??0);if($id<1)return false;
    $batch=$sale['fixture']??'';$name=$sale['name']??'';
    $patterns=[
        'inspection-20260929'=>'/^\[임시 점검\] 고객 '.str_pad((string)$id,3,'0',STR_PAD_LEFT).'$/D',
        'five-test-staff-20260929'=>'/^\[테스트 [2-6]\] 가상고객 '.$id.'$/D',
        'normal-range-20260929-v1'=>'/^\[테스트 10~15건\] 가상고객 '.$id.'$/D',
        'test-inspection-refresh-20260929-v1'=>'/^\[테스트 [1-6]\] 가상고객 '.$id.'$/D',
        'pending-cards-demo-20261001-v1'=>'/^\[테스트\] (?:재접수 가능 예시 [1-3]|관리자 확인 예시 [1-3])$/D',
    ];
    if(isset($patterns[$batch])&&preg_match($patterns[$batch],$name))return true;
    // The original generator had no fixture tag. Require its complete narrow schema and formula.
    if($batch!==''||array_diff(array_keys($sale),['id','date','name','carrier','kind','status']))return false;
    if($name!=='가상고객 '.str_pad((string)$id,3,'0',STR_PAD_LEFT)||($sale['carrier']??'')!==['GA','한화','신한'][$id%3]||($sale['kind']??'')!==($id%4===0?'실버':'일반'))return false;
    $date=$sale['date']??'';if(!preg_match('/^2026-09-\d{2}$/D',$date))return false;
    $day=new DateTimeImmutable($date);if($day->format('Y-m-d')!==$date||(int)$day->format('N')>5)return false;
    $workdays=0;for($n=1;$n<=(int)$day->format('j');$n++)if((int)(new DateTimeImmutable('2026-09-'.str_pad((string)$n,2,'0',STR_PAD_LEFT)))->format('N')<=5)$workdays++;
    return $id>($workdays-1)*5&&$id<=$workdays*5;
}
