<?php
declare(strict_types=1);
require_once __DIR__.'/grade-ledger.php';
class GradeRevisionConflict extends RuntimeException {}
function grade_save_settings(array $user,array $input): array {
    if(($user['role']??'')!=='admin')throw new HRForbidden('관리자만 저장할 수 있습니다.');
    hr_assert(in_array($input['department']??null,['insurance','cosmetics','health'],true)&&valid_day($input['date']??null)&&is_int($input['revision']??null),'부서·적용일·변경 버전을 확인해 주세요.');
    $period=$input['period']??'all';hr_assert(in_array($period,['all','daily','weekly','monthly'],true),'저장할 그레이드를 확인해 주세요.');
    hr_assert(is_array($input['policy']??null),'입력한 기준을 확인해 주세요.');$d=db();$d->beginTransaction();
    try {
        $revision=(int)$d->query('SELECT revision FROM grade_revision WHERE id=1 FOR UPDATE')->fetchColumn();
        if($revision!==$input['revision'])throw new GradeRevisionConflict('다른 관리자가 기준을 변경했습니다. 수정값을 따로 기록한 뒤 새로고침하여 최신 기준을 확인해 주세요.');
        $base=grade_empty_policy();foreach(grade_history($input['department']) as $entry)if($entry['date']<=$input['date'])$base=$entry['policy'];
        $policy=$period==='all'?normalize_policy($input['policy']):grade_merge_period($base,$input['policy'],$period);
        $stored=$policy+['savedPeriod'=>$period];
        $q=$d->prepare('INSERT INTO grade_versions(department,effective_date,actor_id,actor_name,policy) VALUES(?,?,?,?,?)');$q->execute([$input['department'],$input['date'],$user['id'],$user['display_name'],hr_json($stored)]);
        $d->exec('UPDATE grade_revision SET revision=revision+1 WHERE id=1');$d->commit();
        return ['department'=>$input['department'],'date'=>$input['date'],'period'=>$period,'policy'=>$policy];
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
