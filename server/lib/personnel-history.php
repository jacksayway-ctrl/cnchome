<?php
declare(strict_types=1);
require_once __DIR__.'/hr.php';

function personnel_history_admin(array $user): void {
    if(($user['role']??'')!=='admin')throw new HRForbidden('인사기록 수정이력은 관리자만 확인할 수 있습니다.');
}
/** Called inside the same transaction and employee row lock as the profile write. */
function personnel_history_append(array $user,?array $before,array $after,string $event): void {
    $d=db();hr_assert($d->inTransaction(),'인사기록 이력은 정보 저장과 함께 처리해야 합니다.');
    hr_assert(in_array($event,['created','confirm','profile','unlock','lock','settings','suspend','resume'],true),'인사기록 작업을 확인해 주세요.');
    $insert=$d->prepare('INSERT INTO hr_personnel_events(employee_id,actor_id,event,revision,snapshot) VALUES(?,?,?,?,?)');
    if($before){
        $q=$d->prepare('SELECT id FROM hr_personnel_events WHERE employee_id=? LIMIT 1');$q->execute([$after['id']]);
        if(!$q->fetch())$insert->execute([$after['id'],$user['id'],'baseline',(int)$before['revision'],hr_json(['employeeNo'=>$before['employee_no'],'profile'=>json_decode($before['profile'],true,512,JSON_THROW_ON_ERROR)])]);
    }
    $insert->execute([$after['id'],$user['id'],$event,(int)$after['revision'],hr_json(['employeeNo'=>$after['employee_no'],'profile'=>json_decode($after['profile'],true,512,JSON_THROW_ON_ERROR)])]);
}
function personnel_history_list(array $user,int $employeeId): array {
    personnel_history_admin($user);
    $q=db()->prepare("SELECT e.id,e.event,e.revision,e.created_at,COALESCE(u.display_name,'회사 기본설정 반영') AS actor_name FROM hr_personnel_events e LEFT JOIN app_users u ON u.id=e.actor_id WHERE e.employee_id=? ORDER BY e.id DESC");
    $q->execute([$employeeId]);return $q->fetchAll();
}
function personnel_history_get(array $user,int $employeeId,int $historyId): array {
    personnel_history_admin($user);
    $q=db()->prepare("SELECT e.*,COALESCE(u.display_name,'회사 기본설정 반영') AS actor_name FROM hr_personnel_events e LEFT JOIN app_users u ON u.id=e.actor_id WHERE e.employee_id=? AND e.id=?");
    $q->execute([$employeeId,$historyId]);$row=$q->fetch();
    if(!$row)throw new HRForbidden('해당 직원의 인사기록 수정이력을 찾을 수 없습니다.');
    $row['snapshot']=json_decode($row['snapshot'],true,512,JSON_THROW_ON_ERROR);return $row;
}
function personnel_history_date(string $timestamp): string {
    return (new DateTimeImmutable($timestamp,new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('Asia/Seoul'))->format('Y-m-d H:i:s');
}
function personnel_history_label(string $event): string {
    return ['baseline'=>'최초 수정 전 기록','created'=>'등록 확정','confirm'=>'수정 확정','profile'=>'직원 기본정보 수정','unlock'=>'직원 수정권한 해제','lock'=>'인사정보 확정 · 수정 잠금','settings'=>'주휴일·급여일 기본설정 반영','suspend'=>'계정 사용중지','resume'=>'계정 사용 재개'][$event]??'인사정보 수정';
}
