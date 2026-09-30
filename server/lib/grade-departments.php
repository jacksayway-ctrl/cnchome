<?php
declare(strict_types=1);
/** Existing criteria belong to insurance; other teams require an explicitly scoped new save. */
function grade_department_owns(string $department,array $policy): bool {
    return $department==='insurance'||(($policy['departmentScope']??null)===$department&&($policy['departmentScopeVersion']??null)===1);
}
function grade_department_fields(array $policy,string $department): array {
    if($department!=='insurance')foreach(['monthlyReference','monthlyManualVersion','weeklyAuto','weeklyDraftVersion','weeklyStartEightVersion'] as $key)unset($policy[$key]);return $policy;
}
function grade_employee_available(array $user,array $entries,string $today): bool {
    if(($user['role']??'')==='admin'||($user['department']??'')==='insurance')return true;
    foreach($entries as $entry)if(($entry['department']??$user['department'])===$user['department']&&$entry['date']<=$today)return true;return false;
}

function grade_department_empty(string $department): array {
    $policy=grade_empty_policy($department==='insurance'?15000:0);if($department!=='insurance')$policy['dailyCash']['start']=1;return $policy;
}
