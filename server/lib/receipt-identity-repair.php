<?php
declare(strict_types=1);
require_once __DIR__.'/hr.php';

/** One historical repair authorized on 2026-10-02; never a general name-to-account mapper. */
function receipt_identity_repair_batch(): string {return 'receipt-identity-repair-20261002-024940-v1';}
function receipt_identity_repair_cutoff(): string {return '2026-10-02 02:58:13.000000';}
function receipt_identity_repair_account_cutoff(): string {return '2026-10-02 02:49:40.000000';}
function receipt_identity_repair_assert(bool $condition,string $reason): void {if(!$condition)throw new RuntimeException($reason);}

function receipt_identity_repair_backup(string $directory,array $snapshot): string {
    receipt_identity_repair_assert(!is_link($directory),'backup_failed');
    if(!is_dir($directory))receipt_identity_repair_assert(mkdir($directory,0700,true),'backup_failed');
    receipt_identity_repair_assert(chmod($directory,0700),'backup_failed');
    $path=$directory.'/receipt-identities-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(6)).'.json';
    $mask=umask(0077);try{$handle=fopen($path,'x');}finally{umask($mask);}
    receipt_identity_repair_assert($handle!==false,'backup_failed');$json=hr_json($snapshot);
    try{
        receipt_identity_repair_assert(chmod($path,0600),'backup_failed');$written=0;
        while($written<strlen($json)){$n=fwrite($handle,substr($json,$written));receipt_identity_repair_assert($n!==false&&$n>0,'backup_failed');$written+=$n;}
        receipt_identity_repair_assert(fflush($handle)&&(!function_exists('fsync')||fsync($handle)),'backup_failed');
    }finally{fclose($handle);}
    clearstatcache(true,$path);
    receipt_identity_repair_assert((fileperms($path)&0777)===0600&&hash_file('sha256',$path)===hash('sha256',$json),'backup_failed');
    return $path;
}

/** A prior successful edit must still describe the complete current receipt, not just its name. */
function receipt_identity_repair_matches(array $row,array $after): bool {
    // Both native management and the former pending editor wrote successful edits into this audit table.
    if(array_key_exists('customer',$after)&&!array_key_exists('customer_name',$after)){
        foreach(['customer'=>'customer_name','birthYear'=>'birth_year','kind'=>'insurance_kind','birthDate'=>'birth_date',
            'consultationTime'=>'consultation_time','consultationPlace'=>'consultation_place','premiumBand'=>'premium_band'] as $from=>$to){
            if(array_key_exists($from,$after))$after[$to]=$after[$from];
        }
    }
    $fields=['customer_name'=>'customer_name','phone'=>'phone','carrier'=>'carrier','note'=>'note',
        'birth_year'=>'birth_year','insurance_kind'=>'insurance_kind','birth_date'=>'birth_date',
        'consultation_time'=>'consultation_time','consultation_place'=>'consultation_place','premium_band'=>'premium_band',
        'gender'=>'gender','callAvailability'=>'call_availability','visitSchedule'=>'visit_schedule',
        'counselorName'=>'counselor_name','status'=>'status'];
    foreach($fields as $key=>$column){
        if(!array_key_exists($key,$after)||!is_scalar($after[$key])||(string)$after[$key]!== (string)($row[$column]??''))return false;
    }
    return true;
}

/** Pure decision helper: ambiguous names and old default-only snapshots are never reassigned. */
function receipt_identity_repair_decide(array $row,?array $event,array $accounts): array {
    $cutoff=receipt_identity_repair_cutoff();$owner=$accounts[(int)$row['employee_id']]??null;
    if(!$owner)return ['skip'=>'owner_missing'];
    if($row['counselor_name']===''||$row['counselor_name']===$owner['display_name'])return ['skip'=>'already_canonical'];
    if(($owner['role']??'')!=='employee'||$owner['department']!==$row['department']||cnc_test_user($owner)!==(bool)$row['is_test'])return ['skip'=>'owner_scope'];
    if((string)$row['updated_at']>$cutoff||!$event||(string)$event['created_at']>$cutoff)return ['skip'=>'outside_request'];
    if($event['action']!=='edit'||(string)$event['record_key']!==(string)$row['id'])return ['skip'=>'no_admin_edit'];
    try{$after=json_decode($event['after_data'],true,512,JSON_THROW_ON_ERROR);}catch(JsonException $e){return ['skip'=>'invalid_audit'];}
    // An event written before the current row update cannot attest to its latest revision.
    if(!is_array($after)||(int)$row['revision']<2||(string)$row['updated_at']>(string)$event['created_at']||!receipt_identity_repair_matches($row,$after))return ['skip'=>'changed_since_edit'];
    // Follow every later edit back to the most recent name change. A memo edit must not erase proven intent,
    // but neither an intervening conflicting name change nor a new ID-based assignment may be skipped.
    $source=null;$chain=[];$previousId=null;$previousAt=null;
    foreach([$event,...($event['precedingEdits']??[])] as $entry){
        if($entry['action']!=='edit'||(string)$entry['record_key']!==(string)$row['id']||($previousId!==null&&(int)$entry['id']>=$previousId)||($previousAt!==null&&(string)$entry['created_at']>$previousAt))return ['skip'=>'invalid_audit_chain'];
        if((string)$entry['created_at']>$cutoff)return ['skip'=>'outside_request'];
        try{$from=json_decode($entry['before_data'],true,512,JSON_THROW_ON_ERROR);$to=json_decode($entry['after_data'],true,512,JSON_THROW_ON_ERROR);}catch(JsonException $e){return ['skip'=>'invalid_audit'];}
        if(!is_array($from)||!is_array($to)||!isset($from['counselorName'],$to['counselorName'])||!is_string($from['counselorName'])||!is_string($to['counselorName']))return ['skip'=>'missing_name_audit'];
        // New ID-based edits are authoritative already; this only repairs the former text-only writer.
        if(array_key_exists('employee_id',$from)||array_key_exists('employeeId',$from)||array_key_exists('employee_id',$to)||array_key_exists('employeeId',$to))return ['skip'=>'id_based_edit'];
        if($to['counselorName']!==$row['counselor_name'])return ['skip'=>'conflicting_name_change'];
        $chain[]=(int)$entry['id'];
        if($from['counselorName']!==$to['counselorName']){
            if(($entry['actor_role']??'')!=='admin')return ['skip'=>'no_admin_edit'];
            // Blank or already inconsistent text could have been an old automatic default, not an assignment.
            if($from['counselorName']!==$owner['display_name'])return ['skip'=>'uncertain_previous_owner'];
            $source=$entry;break;
        }
        $previousId=(int)$entry['id'];$previousAt=(string)$entry['created_at'];
    }
    if(!$source)return ['skip'=>'no_explicit_name_change'];
    $matches=[];
    foreach($accounts as $candidate){
        if(($candidate['role']??'')!=='employee'||(int)($candidate['active']??0)!==1)continue;
        // Legacy accounts without a membership row are approved by the existing login rules.
        if(array_key_exists('membership_status',$candidate)&&$candidate['membership_status']!=='approved')continue;
        if($candidate['display_name']!==$after['counselorName']||$candidate['department']!==$row['department']||cnc_test_user($candidate)!==(bool)$row['is_test'])continue;
        if((string)$candidate['created_at']>receipt_identity_repair_account_cutoff()||(string)$candidate['created_at']>(string)$source['created_at'])continue;
        $matches[]=$candidate;
    }
    if(count($matches)!==1)return ['skip'=>count($matches)>1?'ambiguous_name':'no_approved_match'];
    $target=$matches[0];if((int)$target['id']===(int)$row['employee_id'])return ['skip'=>'already_canonical'];
    return ['saleId'=>(int)$row['id'],'sourceId'=>(int)$row['employee_id'],'targetId'=>(int)$target['id'],
        'revision'=>(int)$row['revision'],'updatedAt'=>$row['updated_at'],'counselorName'=>$target['display_name'],
        'sourceEventId'=>(int)$source['id'],'sourceActorId'=>(int)$source['actor_id'],'latestEventId'=>(int)$event['id'],'verifiedEditIds'=>$chain];
}

function receipt_identity_repair(string $directory): array {
    $d=db();$d->beginTransaction();
    try{
        $q=$d->prepare('SELECT manifest FROM test_fixture_batches WHERE batch=? FOR UPDATE');$q->execute([receipt_identity_repair_batch()]);
        if($raw=$q->fetchColumn()){$manifest=json_decode($raw,true,512,JSON_THROW_ON_ERROR);$d->commit();return ['alreadyApplied'=>true]+$manifest;}
        // Follow normal receipt edits' lock order: receipt first, then identity and approval rows.
        $rows=$d->query('SELECT s.*,cc.counselor_name,c.consultation_time,c.consultation_place,c.premium_band,rd.gender,rd.call_availability,rd.visit_schedule,b.birth_date FROM sales_records s JOIN sales_counselor_details cc ON cc.sale_id=s.id LEFT JOIN sales_consultation_details c ON c.sale_id=s.id LEFT JOIN sales_receipt_details rd ON rd.sale_id=s.id LEFT JOIN sales_birth_details b ON b.sale_id=s.id ORDER BY s.id FOR UPDATE')->fetchAll();
        $accounts=[];foreach($d->query('SELECT id,username,display_name,role,department,active,created_at FROM app_users ORDER BY id FOR UPDATE')->fetchAll() as $account)$accounts[(int)$account['id']]=$account;
        foreach($d->query('SELECT user_id,status FROM employee_memberships ORDER BY user_id FOR UPDATE')->fetchAll() as $membership)if(isset($accounts[(int)$membership['user_id']]))$accounts[(int)$membership['user_id']]['membership_status']=$membership['status'];
        $latest=$d->prepare("SELECT e.*,u.role AS actor_role FROM intake_management_events e JOIN app_users u ON u.id=e.actor_id WHERE e.record_key=? AND e.action='edit' ORDER BY e.id DESC FOR UPDATE");
        $plan=[];$skipped=[];$evidence=[];
        foreach($rows as $row){
            $owner=$accounts[(int)$row['employee_id']]??null;
            if($row['counselor_name']===''||($owner&&$row['counselor_name']===$owner['display_name']))continue;
            $latest->execute([(string)$row['id']]);$edits=$latest->fetchAll();$event=array_shift($edits);if($event)$event['precedingEdits']=$edits;
            $decision=receipt_identity_repair_decide($row,$event,$accounts);
            $evidence[]=['receipt'=>$row,'latestEdit'=>$event,'decision'=>$decision];
            if(isset($decision['skip'])){$skipped[$decision['skip']]=($skipped[$decision['skip']]??0)+1;continue;}
            $plan[]=$decision;
        }
        // Also back up unresolved evidence: display canonicalization must not destroy old saved intent.
        $path=receipt_identity_repair_backup($directory,['batch'=>receipt_identity_repair_batch(),'cutoff'=>receipt_identity_repair_cutoff(),'accountCutoff'=>receipt_identity_repair_account_cutoff(),
            'savedAt'=>gmdate('c'),'accounts'=>array_values($accounts),'evidence'=>$evidence,'plan'=>$plan,'skipped'=>$skipped]);
        $update=$d->prepare('UPDATE sales_records SET employee_id=?,revision=revision+1,updated_at=UTC_TIMESTAMP(6) WHERE id=? AND employee_id=? AND revision=? AND updated_at=?');
        $audit=$d->prepare('INSERT INTO intake_management_events(record_key,actor_id,action,before_data,after_data,reason) VALUES(?,?,?,?,?,?)');
        foreach($plan as $item){
            $update->execute([$item['targetId'],$item['saleId'],$item['sourceId'],$item['revision'],$item['updatedAt']]);
            receipt_identity_repair_assert($update->rowCount()===1,'receipt_changed');
            $before=['employee_id'=>$item['sourceId'],'revision'=>$item['revision'],'counselorName'=>$item['counselorName']];
            $after=['employee_id'=>$item['targetId'],'revision'=>$item['revision']+1,'counselorName'=>$item['counselorName'],
                'repairBatch'=>receipt_identity_repair_batch(),'sourceEventId'=>$item['sourceEventId'],'latestEventId'=>$item['latestEventId']];
            // Actor identifies the proven original instruction; reason explicitly identifies automated replay.
            $audit->execute([(string)$item['saleId'],$item['sourceActorId'],'reassign',hr_json($before),hr_json($after),
                '상담원 계정 자동 보정: 기존 관리자 수정 이력 #'.$item['sourceEventId'].'의 담당 직원을 반영했습니다.']);
        }
        $verify=$d->prepare('SELECT employee_id,revision FROM sales_records WHERE id=?');
        foreach($plan as $item){$verify->execute([$item['saleId']]);$check=$verify->fetch();receipt_identity_repair_assert($check&&(int)$check['employee_id']===$item['targetId']&&(int)$check['revision']===$item['revision']+1,'verification_failed');}
        $manifest=['state'=>'complete','cutoff'=>receipt_identity_repair_cutoff(),'accountCutoff'=>receipt_identity_repair_account_cutoff(),'reassigned'=>count($plan),'skipped'=>$skipped,
            'assignments'=>$plan,'backup'=>$path,'completedAt'=>gmdate('c')];
        $q=$d->prepare('INSERT INTO test_fixture_batches(batch,manifest) VALUES(?,?)');$q->execute([receipt_identity_repair_batch(),hr_json($manifest)]);
        $d->commit();return ['alreadyApplied'=>false]+$manifest;
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
