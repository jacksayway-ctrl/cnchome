<?php
declare(strict_types=1);
require_once __DIR__.'/grade-summary.php';

function daily_grade_admin(array $user,string $date,?string $department=null): array {
    if(($user['role']??'')!=='admin')throw new HRForbidden('관리자만 직원별 총액을 조회할 수 있습니다.');
    hr_assert(hr_day($date)&&$date<=hr_today(),'조회 날짜를 확인해 주세요.');
    $q=db()->prepare("SELECT id,username,display_name,role,department,active FROM app_users WHERE role='employee' AND (active=1 OR id IN (SELECT employee_id FROM daily_grade_receipts WHERE performance_date=?)) ORDER BY display_name,id");$q->execute([$date]);$users=$q->fetchAll();$rows=[];
    if($department!==null)$department=management_department($department);
    foreach($users as $employee){
        if($department!==null&&$employee['department']!==$department)continue;
        $s=grade_summary_snapshot($employee,$date);$daily=$s['daily'];
        if((!$daily['eligible']||!$s['gradeAvailable'])&&!$daily['receipts'])continue;
        $rows[]=['employeeId'=>(int)$employee['id'],'name'=>$employee['display_name'],'department'=>$employee['department'],'isTest'=>$s['isTest'],'count'=>$daily['count'],'earned'=>$daily['amount'],'received'=>$daily['paid'],'paidCount'=>$daily['paidCount'],'receiptMode'=>'automatic','receipts'=>$daily['receipts']];
    }
    return ['date'=>$date,'rows'=>$rows];
}
