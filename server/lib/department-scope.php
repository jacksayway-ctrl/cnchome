<?php
declare(strict_types=1);

function management_departments(): array {
    return ['insurance'=>'보험','cosmetics'=>'화장품','health'=>'건강보조식품'];
}
function management_department(mixed $value=null): string {
    if($value===null||$value==='')return 'insurance';
    if(!is_string($value)||!array_key_exists($value,management_departments()))throw new InvalidArgumentException('부서를 확인해 주세요.');
    return $value;
}
function management_request_department(): string {
    return management_department($_GET['department']??$_GET['team']??null);
}
function payroll_record_department(array $row,array $profile=[]): string {
    return management_department($row['calculation']['department']??$row['published_snapshot']['department']??$profile['team']??null);
}
