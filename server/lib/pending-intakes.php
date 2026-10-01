<?php
declare(strict_types=1);
require_once __DIR__.'/intake-management.php';

function pending_intake_authorize(array $user,bool $write=false,string $action='recall'): void {
    $role=$user['role']??'';
    if(!in_array($role,['employee','admin'],true))throw new HRForbidden('가접수 조회 권한이 없습니다.');
    if($write&&$role==='admin'&&!in_array($action,['edit','memo'],true))throw new HRForbidden('재콜 요청은 직원 본인만 등록할 수 있습니다. 관리자는 정상접수 확인표에서 처리해 주세요.');
}

/** Validate editable receipt fields; assignment, original date, status and old notes are immutable here. */
function pending_intake_fields(array $in,array $current): array {
    $next=sales_receipt_fields($in,$current);foreach(['customer'=>100,'phone'=>20,'birthDate'=>10,'carrier'=>100,'consultationTime'=>5,'consultationPlace'=>500,'premiumBand'=>6] as $key=>$max)$next[$key]=intake_text($in[$key]??$current[$key]??'',$max);
    hr_assert($next['customer']!=='','고객명을 입력해 주세요.');
    hr_assert((bool)preg_match('/^[0-9-]{9,15}$/D',$next['phone']),'전화번호를 확인해 주세요.');
    hr_assert($next['consultationTime']===''||(bool)preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/D',$next['consultationTime']),'상담 시간을 확인해 주세요.');
    hr_assert(in_array($next['premiumBand'],['','100000','200000','300000'],true),'현재 납부 보험료를 선택해 주세요.');
    if($next['birthDate']!==''){
        hr_assert(hr_day($next['birthDate'])&&$next['birthDate']<=$current['date'],'생년월일은 올바른 날짜이며 최초 접수일 이전이어야 합니다.');
        $next['birthYear']=(int)substr($next['birthDate'],0,4);
    }else{
        $raw=$in['birthYear']??$current['birthYear']??0;
        hr_assert(is_int($raw)||(is_string($raw)&&preg_match('/^\d{4}$/D',$raw)),'출생연도를 확인해 주세요.');$next['birthYear']=(int)$raw;
    }
    hr_assert($next['birthYear']>=1900&&$next['birthYear']<=(int)substr($current['date'],0,4),'출생연도를 확인해 주세요.');
    $next['kind']=$current['team']==='insurance'?sales_kind($next['birthYear'],$current['date']):'';
    return $next;
}

function pending_intake_update(array $user,array $in): void {
    $action=intake_text($in['action']??'recall',10);hr_assert(in_array($action,['edit','memo','recall'],true),'지원하지 않는 작업입니다.');
    pending_intake_authorize($user,true,$action);$admin=$user['role']==='admin';$test=sales_test_user($user);
    $id=intake_text($in['id']??'',60);$revision=intake_number($in['revision']??0);$memo=intake_text($in['memo']??'',500);$carrier=intake_text($in['carrier']??'',100);
    hr_assert($action==='edit'||($memo!==''&&($action!=='recall'||$carrier!=='')),'메모와 재콜 접수 코드를 확인해 주세요.');
    $d=db();$d->beginTransaction();
    try{
        $legacy=preg_match('/^test:(\d+):(\d+)$/D',$id,$match)===1;
        if($legacy){
            $owner=(int)$match[1];if(!$admin&&($owner!==(int)$user['id']||!$test))throw new HRForbidden('본인 접수만 수정할 수 있습니다.');
            $q=$d->prepare('SELECT t.state,t.revision,u.department FROM test_employee_data t JOIN app_users u ON u.id=t.user_id WHERE t.user_id=? FOR UPDATE');$q->execute([$owner]);$stored=$q->fetch();
            hr_assert($stored&&(int)$stored['revision']===$revision,'접수 내용이 변경되었습니다. 저장내용으로 되돌린 뒤 다시 확인해 주세요.');
            $state=json_decode($stored['state'],true,512,JSON_THROW_ON_ERROR);$found=null;
            foreach($state['sales']??[] as $i=>$sale)if((int)$sale['id']===(int)$match[2]){$found=$i;break;}
            hr_assert($found!==null&&$state['sales'][$found]['status']==='가접수','가접수 상태를 다시 확인해 주세요.');$sale=$state['sales'][$found];
            $current=['customer'=>$sale['name'],'phone'=>$sale['phone']??'','birthDate'=>$sale['birthDate']??'','birthYear'=>(int)($sale['birthYear']??substr($sale['birthDate']??'',0,4)),'carrier'=>$sale['carrier']??'','consultationTime'=>$sale['consultationTime']??'','consultationPlace'=>$sale['consultationPlace']??'','premiumBand'=>$sale['premiumBand']??'','gender'=>$sale['gender']??'','callAvailability'=>$sale['callAvailability']??'','visitSchedule'=>$sale['visitSchedule']??'','kind'=>($sale['kind']??'')==='실버'?'silver':'general','date'=>$sale['date'],'team'=>$stored['department']];
        }else{
            hr_assert(ctype_digit($id),'접수 번호를 확인해 주세요.');
            $q=$d->prepare('SELECT * FROM sales_records WHERE id=?'.($admin?'':' AND employee_id=?').' FOR UPDATE');$q->execute($admin?[$id]:[$id,$user['id']]);$stored=$q->fetch();
            if(!$stored||(!$admin&&!$test&&!empty($stored['is_test'])))throw new HRForbidden('수정할 수 있는 접수를 찾을 수 없습니다.');
            hr_assert($stored['status']==='pending'&&(int)$stored['revision']===$revision,'접수 내용이나 상태가 변경되었습니다. 저장내용으로 되돌린 뒤 다시 확인해 주세요.');
            $q=$d->prepare('SELECT consultation_time,consultation_place,premium_band FROM sales_consultation_details WHERE sale_id=?');$q->execute([$id]);$details=$q->fetch();
            $q=$d->prepare('SELECT birth_date FROM sales_birth_details WHERE sale_id=?');$q->execute([$id]);$birthDate=$q->fetchColumn();
            $current=['customer'=>$stored['customer_name'],'phone'=>$stored['phone'],'birthDate'=>$birthDate?:'','birthYear'=>(int)$stored['birth_year'],'carrier'=>$stored['carrier'],'consultationTime'=>$details['consultation_time']??'','consultationPlace'=>$details['consultation_place']??'','premiumBand'=>$details['premium_band']??'','kind'=>$stored['insurance_kind'],'date'=>$stored['first_date'],'team'=>$stored['department']];
            $q=$d->prepare('SELECT gender,call_availability AS callAvailability,visit_schedule AS visitSchedule FROM sales_receipt_details WHERE sale_id=?');$q->execute([$id]);$receiptRow=$q->fetch();$current+=sales_receipt_fields([],$receiptRow?:[]);
        }
        $before=['status'=>'pending'];$after=['status'=>'pending','carrier'=>$carrier,'date'=>$current['date']];
        if($action==='edit'){
            $next=pending_intake_fields($in,$current);$before=[];foreach($next as $key=>$value)$before[$key]=$current[$key];$after=$next;
            hr_assert($before!==$after||$memo!=='','변경한 접수내용이 없습니다.');
            if($legacy){
                foreach(['customer'=>'name','phone'=>'phone','birthDate'=>'birthDate','birthYear'=>'birthYear','carrier'=>'carrier','consultationTime'=>'consultationTime','consultationPlace'=>'consultationPlace','premiumBand'=>'premiumBand','gender'=>'gender','callAvailability'=>'callAvailability','visitSchedule'=>'visitSchedule'] as $key=>$storedKey)$state['sales'][$found][$storedKey]=$next[$key];
                $state['sales'][$found]['kind']=$next['kind']==='silver'?'실버':($next['kind']==='general'?'일반':'');$state['sales'][$found]['editedAt']=gmdate('c');
            }else{
                $q=$d->prepare('UPDATE sales_records SET customer_name=?,phone=?,birth_year=?,insurance_kind=?,carrier=? WHERE id=?');$q->execute([$next['customer'],$next['phone'],$next['birthYear'],$next['kind'],$next['carrier'],$id]);
                if($details){$q=$d->prepare('UPDATE sales_consultation_details SET consultation_time=?,consultation_place=?,premium_band=? WHERE sale_id=?');$q->execute([$next['consultationTime'],$next['consultationPlace'],$next['premiumBand'],$id]);}
                else{$q=$d->prepare('INSERT INTO sales_consultation_details(sale_id,consultation_time,consultation_place,premium_band) VALUES(?,?,?,?)');$q->execute([$id,$next['consultationTime'],$next['consultationPlace'],$next['premiumBand']]);}
                if($receiptRow){$q=$d->prepare('UPDATE sales_receipt_details SET gender=?,call_availability=?,visit_schedule=? WHERE sale_id=?');$q->execute([$next['gender'],$next['callAvailability'],$next['visitSchedule'],$id]);}
                else{$q=$d->prepare('INSERT INTO sales_receipt_details(sale_id,gender,call_availability,visit_schedule) VALUES(?,?,?,?)');$q->execute([$id,$next['gender'],$next['callAvailability'],$next['visitSchedule']]);}
                if($next['birthDate']===''){$q=$d->prepare('DELETE FROM sales_birth_details WHERE sale_id=?');$q->execute([$id]);}
                elseif($birthDate!==false){$q=$d->prepare('UPDATE sales_birth_details SET birth_date=? WHERE sale_id=?');$q->execute([$next['birthDate'],$id]);}
                else{$q=$d->prepare('INSERT INTO sales_birth_details(sale_id,birth_date) VALUES(?,?)');$q->execute([$id,$next['birthDate']]);}
            }
        }
        if($legacy){$q=$d->prepare('UPDATE test_employee_data SET state=?,revision=revision+1 WHERE user_id=?');$q->execute([hr_json($state),$owner]);}
        else{$q=$d->prepare('UPDATE sales_records SET revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE id=?');$q->execute([$id]);}
        intake_audit($id,$user,$action,$before,$after,$memo);$d->commit();
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}

// The regions page keeps every pending month visible; employee ownership is enforced in SQL.
function pending_intake_snapshot(array $user): array {
    pending_intake_authorize($user);$admin=$user['role']==='admin';$test=sales_test_user($user);$d=db();$params=$admin?[]:[$user['id']];$rows=[];
    $q=$d->prepare("SELECT s.*,u.display_name AS employee_name,c.consultation_time,c.consultation_place,c.premium_band,b.birth_date,rd.gender,rd.call_availability,rd.visit_schedule,rd.created_at AS receipt_created_at FROM sales_records s JOIN app_users u ON u.id=s.employee_id LEFT JOIN sales_consultation_details c ON c.sale_id=s.id LEFT JOIN sales_birth_details b ON b.sale_id=s.id LEFT JOIN sales_receipt_details rd ON rd.sale_id=s.id WHERE s.status='pending'".($admin?'':' AND s.employee_id=?'.($test?'':' AND s.is_test=0')));
    $q->execute($params);
    foreach($q->fetchAll() as $r){$id=(string)$r['id'];$rows[$id]=['id'=>$id,'date'=>$r['first_date'],'employeeId'=>(int)$r['employee_id'],'employee'=>$r['employee_name'],'team'=>$r['department'],'customer'=>$r['customer_name'],'carrier'=>$r['carrier'],'kind'=>$r['insurance_kind'],'status'=>'pending','revision'=>(int)$r['revision'],'isTest'=>(bool)$r['is_test'],'phone'=>$r['phone'],'address'=>$r['address'],'birthYear'=>(int)$r['birth_year'],'birthDate'=>$r['birth_date']??'','note'=>$r['note'],'consultationTime'=>$r['consultation_time']??'','consultationPlace'=>$r['consultation_place']??'','premiumBand'=>$r['premium_band']??'','gender'=>$r['gender']??'','callAvailability'=>$r['call_availability']??'','visitSchedule'=>$r['visit_schedule']??'','receivedAt'=>$r['receipt_created_at']??'','memoHistory'=>[],'recallPending'=>false];}
    if($admin||$test){
    $q=$d->prepare('SELECT t.state,t.revision,u.id,u.display_name,u.department FROM test_employee_data t JOIN app_users u ON u.id=t.user_id'.($admin?'':' WHERE u.id=?'));
    $q->execute($params);
    foreach($q->fetchAll() as $r){
        $state=json_decode($r['state'],true,512,JSON_THROW_ON_ERROR);
        foreach($state['sales']??[] as $sale){
            if(($sale['status']??'')!=='가접수')continue;$id='test:'.$r['id'].':'.$sale['id'];
            $rows[$id]=['id'=>$id,'date'=>$sale['date'],'employeeId'=>(int)$r['id'],'employee'=>$r['display_name'],'team'=>$r['department'],'customer'=>$sale['name'],'carrier'=>$sale['carrier']??'','kind'=>($sale['kind']??'')==='실버'?'silver':'general','status'=>'pending','revision'=>(int)$r['revision'],'isTest'=>true,'phone'=>$sale['phone']??'','address'=>$sale['address']??'','birthDate'=>$sale['birthDate']??'','birthYear'=>(int)($sale['birthYear']??substr($sale['birthDate']??'',0,4)),'note'=>$sale['note']??'','consultationTime'=>$sale['consultationTime']??'','consultationPlace'=>$sale['consultationPlace']??'','premiumBand'=>$sale['premiumBand']??'','gender'=>$sale['gender']??'','callAvailability'=>$sale['callAvailability']??'','visitSchedule'=>$sale['visitSchedule']??'','memoHistory'=>[],'recallPending'=>false];
            if(($sale['fixture']??'')==='pending-cards-demo-20261001-v1'&&isset($sale['demoPolicy']))$rows[$id]['demoPolicy']=$sale['demoPolicy'];
        }
    }
    }
    foreach($rows as &$row){$row['originalMemoAt']='';$row['lastEditAt']='';}unset($row);
    // Read history only for the authorized records and bound placeholder counts for large lists.
    foreach(array_chunk(array_keys($rows),400) as $ids){
        $realIds=array_values(array_filter($ids,fn($id)=>ctype_digit((string)$id)));
        if($realIds){$q=$d->prepare("SELECT sale_id,MIN(created_at) AS created_at FROM sales_events WHERE old_status='' AND sale_id IN (".implode(',',array_fill(0,count($realIds),'?')).') GROUP BY sale_id');$q->execute($realIds);foreach($q->fetchAll() as $event)if($event['created_at'])$rows[$event['sale_id']]['originalMemoAt']=intake_time($event['created_at']);}
        $q=$d->prepare("SELECT e.record_key,e.action,e.after_data,e.reason,e.created_at,u.display_name AS actor FROM intake_management_events e JOIN app_users u ON u.id=e.actor_id WHERE e.record_key IN (".implode(',',array_fill(0,count($ids),'?')).') ORDER BY e.id ASC');$q->execute($ids);
        foreach($q->fetchAll() as $event){
            $id=$event['record_key'];$at=$event['created_at']!==''?intake_time($event['created_at']):'';
            if($event['action']==='edit'){$rows[$id]['lastEditAt']=$at;$after=json_decode($event['after_data'],true,512,JSON_THROW_ON_ERROR);if(array_key_exists('note',$after)&&$after['note']===$rows[$id]['note'])$rows[$id]['originalMemoAt']=$at;}
            if($event['reason']!=='')$rows[$id]['memoHistory'][]=['action'=>$event['action'],'memo'=>$event['reason'],'at'=>$at,'actor'=>$event['actor']];
        }
        $outstanding=intake_outstanding_recalls($ids);foreach($ids as $id)$rows[$id]['recallPending']=isset($outstanding[$id]);
    }
    $rows=array_values($rows);usort($rows,fn($a,$b)=>strcmp($a['date'],$b['date'])?:strnatcmp($a['id'],$b['id']));return ['records'=>$rows];
}
