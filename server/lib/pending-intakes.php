<?php
declare(strict_types=1);
require_once __DIR__.'/intake-management.php';

function pending_intake_authorize(array $user,bool $write=false): void {
    $role=$user['role']??'';
    if(!in_array($role,['employee','admin'],true))throw new HRForbidden('가접수 조회 권한이 없습니다.');
    if($write&&$role!=='employee')throw new HRForbidden('상담 메모와 재콜 요청은 직원 본인만 등록할 수 있습니다. 관리자 수정은 접수관리를 이용해 주세요.');
}

// The regions page keeps every pending month visible; employee ownership is enforced in SQL.
function pending_intake_snapshot(array $user): array {
    pending_intake_authorize($user);$admin=$user['role']==='admin';$d=db();$params=$admin?[]:[$user['id']];$rows=[];
    $q=$d->prepare("SELECT s.*,u.display_name AS employee_name,c.consultation_time,c.consultation_place,c.premium_band,b.birth_date FROM sales_records s JOIN app_users u ON u.id=s.employee_id LEFT JOIN sales_consultation_details c ON c.sale_id=s.id LEFT JOIN sales_birth_details b ON b.sale_id=s.id WHERE s.status='pending'".($admin?'':' AND s.employee_id=?'));
    $q->execute($params);
    foreach($q->fetchAll() as $r){$id=(string)$r['id'];$rows[$id]=['id'=>$id,'date'=>$r['first_date'],'employeeId'=>(int)$r['employee_id'],'employee'=>$r['employee_name'],'team'=>$r['department'],'customer'=>$r['customer_name'],'carrier'=>$r['carrier'],'kind'=>$r['insurance_kind'],'status'=>'pending','revision'=>(int)$r['revision'],'isTest'=>(bool)$r['is_test'],'phone'=>$r['phone'],'address'=>$r['address'],'birthYear'=>(int)$r['birth_year'],'birthDate'=>$r['birth_date']??'','note'=>$r['note'],'consultationTime'=>$r['consultation_time']??'','consultationPlace'=>$r['consultation_place']??'','premiumBand'=>$r['premium_band']??'','memoHistory'=>[],'recallPending'=>false];}
    $q=$d->prepare('SELECT t.state,t.revision,u.id,u.display_name,u.department FROM test_employee_data t JOIN app_users u ON u.id=t.user_id'.($admin?'':' WHERE u.id=?'));
    $q->execute($params);
    foreach($q->fetchAll() as $r){
        $state=json_decode($r['state'],true,512,JSON_THROW_ON_ERROR);
        foreach($state['sales']??[] as $sale){
            if(($sale['status']??'')!=='가접수')continue;$id='test:'.$r['id'].':'.$sale['id'];
            $rows[$id]=['id'=>$id,'date'=>$sale['date'],'employeeId'=>(int)$r['id'],'employee'=>$r['display_name'],'team'=>$r['department'],'customer'=>$sale['name'],'carrier'=>$sale['carrier']??'','kind'=>($sale['kind']??'')==='실버'?'silver':'general','status'=>'pending','revision'=>(int)$r['revision'],'isTest'=>true,'phone'=>$sale['phone']??'','address'=>$sale['address']??'','birthDate'=>$sale['birthDate']??'','birthYear'=>(int)substr($sale['birthDate']??'',0,4),'note'=>$sale['note']??'','consultationTime'=>$sale['consultationTime']??'','consultationPlace'=>$sale['consultationPlace']??'','premiumBand'=>$sale['premiumBand']??'','memoHistory'=>[],'recallPending'=>false];
        }
    }
    // Read history only for the authorized records and bound placeholder counts for large lists.
    foreach(array_chunk(array_keys($rows),400) as $ids){
        $q=$d->prepare("SELECT e.record_key,e.action,e.reason,e.created_at,u.display_name AS actor FROM intake_management_events e JOIN app_users u ON u.id=e.actor_id WHERE e.action IN ('memo','recall') AND e.record_key IN (".implode(',',array_fill(0,count($ids),'?')).') ORDER BY e.id ASC');$q->execute($ids);
        foreach($q->fetchAll() as $event)$rows[$event['record_key']]['memoHistory'][]=['action'=>$event['action'],'memo'=>$event['reason'],'at'=>intake_time($event['created_at']),'actor'=>$event['actor']];
        $outstanding=intake_outstanding_recalls($ids);foreach($ids as $id)$rows[$id]['recallPending']=isset($outstanding[$id]);
    }
    $rows=array_values($rows);usort($rows,fn($a,$b)=>strcmp($a['date'],$b['date'])?:strnatcmp($a['id'],$b['id']));return ['records'=>$rows];
}
