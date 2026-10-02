<?php
declare(strict_types=1);
require_once __DIR__.'/hr.php';

class GradeVisibilityConflict extends RuntimeException {}
function grade_visibility_for(array $user): array {
    if(!in_array($user['role']??'', ['admin','employee'],true))throw new HRForbidden('그레이드 조회 권한이 없습니다.');
    $admin=$user['role']==='admin';
    $q=db()->prepare('SELECT department,daily,weekly,monthly,revision FROM grade_visibility'.($admin?'':' WHERE department=?'));
    $q->execute($admin?[]:[$user['department']]);$result=[];
    foreach($q->fetchAll() as $row)$result[$row['department']]=['daily'=>(bool)$row['daily'],'weekly'=>(bool)$row['weekly'],'monthly'=>(bool)$row['monthly'],'revision'=>(int)$row['revision']];
    return $result;
}
function grade_visibility_save(array $user,array $input): array {
    if(($user['role']??'')!=='admin')throw new HRForbidden('관리자만 노출 설정을 저장할 수 있습니다.');
    hr_assert(is_string($input['department']??null)&&isset(management_departments()[$input['department']]),'부서를 확인해 주세요.');
    hr_assert(is_int($input['revision']??null)&&$input['revision']>=0,'변경 버전을 확인해 주세요.');
    foreach(['daily','weekly','monthly'] as $period)hr_assert(is_bool($input[$period]??null),'보임/숨김을 선택해 주세요.');
    $d=db();$d->beginTransaction();
    try{
        $q=$d->prepare('UPDATE grade_visibility SET daily=?,weekly=?,monthly=?,revision=revision+1,actor_id=?,updated_at=CURRENT_TIMESTAMP WHERE department=? AND revision=?');
        $q->execute([(int)$input['daily'],(int)$input['weekly'],(int)$input['monthly'],$user['id'],$input['department'],$input['revision']]);
        if($q->rowCount()!==1)throw new GradeVisibilityConflict('다른 관리자가 노출 설정을 변경했습니다. 페이지를 새로고침한 뒤 다시 저장해 주세요.');
        $result=grade_visibility_for($user);$d->commit();return $result;
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
