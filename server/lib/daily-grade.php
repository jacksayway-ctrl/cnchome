<?php
declare(strict_types=1);
require_once __DIR__.'/grade-summary.php';

function daily_grade_confirm(array $user,array $in): void {
    if(($user['role']??'')!=='employee')throw new HRForbidden('본인의 수령 확인만 저장할 수 있습니다.');
    $date=$in['date']??'';$milestone=$in['milestone']??null;$amount=$in['amount']??null;
    hr_assert($date===hr_today(),'오늘 일 그레이드만 수령 확인할 수 있습니다.');
    hr_assert(is_int($milestone)&&$milestone>0&&is_int($amount)&&$amount>0,'수령 확인할 건수와 금액을 확인해 주세요.');
    $d=db();$d->beginTransaction();
    try {
        // Serialize confirmations for this account; a repeated click never pays twice.
        $q=$d->prepare('SELECT id FROM app_users WHERE id=? FOR UPDATE');$q->execute([$user['id']]);
        $q=$d->prepare('SELECT amount FROM daily_grade_receipts WHERE employee_id=? AND performance_date=? AND milestone=?');$q->execute([$user['id'],$date,$milestone]);
        if($q->fetchColumn()!==false){$d->commit();return;}
        $q=$d->prepare("SELECT p.published_snapshot FROM hr_payroll p JOIN hr_employees e ON e.id=p.employee_id WHERE e.user_id=? AND p.month=? AND p.status IN ('published','confirmed') FOR UPDATE");$q->execute([$user['id'],substr($date,0,7)]);
        if($raw=$q->fetchColumn()){$published=json_decode($raw,true,512,JSON_THROW_ON_ERROR);$grade=$published['calculation']['gradeSnapshot']??null;hr_assert(!$grade||$date>($grade['asOf']??''),'이 날짜의 일그레이드는 게시된 급여에 반영되어 있습니다. 별도 지급하려면 먼저 명세서 수정을 요청해 주세요.');}
        $summary=grade_summary_snapshot($user,$date);$daily=$summary['daily'];
        hr_assert($daily['eligible']&&$daily['target']!==null,'일 그레이드 지급 대상을 확인해 주세요.');
        hr_assert($milestone>=$daily['target']&&$milestone<=$daily['count'],'본인이 달성한 건수만 수령 확인할 수 있습니다.');
        hr_assert($amount===$daily['perCase'],'지급 기준이 변경됐습니다. 새로고침 후 금액을 확인해 주세요.');
        $q=$d->prepare('INSERT INTO daily_grade_receipts(employee_id,performance_date,milestone,amount,department) VALUES(?,?,?,?,?)');
        $q->execute([$user['id'],$date,$milestone,$amount,$user['department']]);
        $d->commit();
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
function daily_grade_admin(array $user,string $date): array {
    if(($user['role']??'')!=='admin')throw new HRForbidden('관리자만 직원별 총액을 조회할 수 있습니다.');
    hr_assert(hr_day($date)&&$date<=hr_today(),'조회 날짜를 확인해 주세요.');
    $q=db()->prepare("SELECT id,username,display_name,role,department,active FROM app_users WHERE role='employee' AND (active=1 OR id IN (SELECT employee_id FROM daily_grade_receipts WHERE performance_date=?)) ORDER BY display_name,id");$q->execute([$date]);$users=$q->fetchAll();$rows=[];
    foreach($users as $employee){
        $s=grade_summary_snapshot($employee,$date);$daily=$s['daily'];
        if(!$daily['eligible']&&!$daily['receipts'])continue;
        $rows[]=['employeeId'=>(int)$employee['id'],'name'=>$employee['display_name'],'department'=>$employee['department'],'isTest'=>$s['isTest'],'count'=>$daily['count'],'earned'=>$daily['amount'],'received'=>$daily['paid'],'receipts'=>$daily['receipts']];
    }
    return ['date'=>$date,'rows'=>$rows];
}
