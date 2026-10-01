<?php
declare(strict_types=1);
require_once __DIR__.'/hr.php';

/** This request is tied to the verified, existing account, not a reusable username. */
function user1_cleanup_batch(): string { return 'user1-keep-20260930-clear-20261001-v1'; }

/** MySQL JSON reorders object keys; list order and every scalar value still matter. */
function user1_cleanup_json_value(mixed $value): mixed {
    if(!is_array($value))return $value;
    if(!array_is_list($value))ksort($value,SORT_STRING);
    foreach($value as $key=>$child)$value[$key]=user1_cleanup_json_value($child);
    return $value;
}

function user1_cleanup_rows(PDO $d,string $table,string $column,array $values): array {
    $allowed=['sales_records'=>'id','sales_events'=>'sale_id','sales_consultation_details'=>'sale_id','sales_receipt_details'=>'sale_id','sales_birth_details'=>'sale_id','sales_counselor_details'=>'sale_id','intake_management_events'=>'record_key','hr_payroll_events'=>'payroll_id'];
    if(($allowed[$table]??null)!==$column)throw new LogicException('Unsupported cleanup table.');
    $rows=[];
    foreach(array_chunk($values,400) as $chunk){
        $q=$d->prepare('SELECT * FROM '.$table.' WHERE '.$column.' IN ('.implode(',',array_fill(0,count($chunk),'?')).') ORDER BY '.(in_array($table,['sales_consultation_details','sales_receipt_details','sales_birth_details','sales_counselor_details'],true)?'sale_id':'id').' FOR UPDATE');
        $q->execute($chunk);$rows=array_merge($rows,$q->fetchAll());
    }
    return $rows;
}

function user1_cleanup_receipt_snapshot(PDO $d,array $nativeIds,array $legacySales): array {
    $snapshot=['sales_records'=>user1_cleanup_rows($d,'sales_records','id',$nativeIds),'legacySales'=>$legacySales];
    foreach(['sales_events','sales_consultation_details','sales_receipt_details','sales_birth_details','sales_counselor_details'] as $table)$snapshot[$table]=user1_cleanup_rows($d,$table,'sale_id',$nativeIds);
    $keys=array_merge(array_map('strval',$nativeIds),array_map(fn($sale)=>'test:2:'.$sale['id'],$legacySales));
    $snapshot['intake_management_events']=user1_cleanup_rows($d,'intake_management_events','record_key',$keys);
    return $snapshot;
}

/** Match the current seed marker, never an old audit note on an edited real statement. */
function user1_cleanup_synthetic_payroll(array $row): bool {
    $calculation=json_decode($row['calculation'],true,512,JSON_THROW_ON_ERROR);
    $note=(string)($calculation['note']??'');
    return str_contains($note,'테스트')&&str_contains($note,'가상')
        &&(str_contains($note,'실제 지급 대상 아님')||str_contains($note,'실제 지급·약정·승인이 아닙니다.'));
}

function user1_cleanup_private_backup(string $directory,array $backup): string {
    if(is_link($directory))throw new RuntimeException('정리 백업 폴더가 올바르지 않습니다.');
    if(!is_dir($directory)&&!mkdir($directory,0700,true))throw new RuntimeException('정리 백업 폴더를 만들 수 없습니다.');
    if(!chmod($directory,0700))throw new RuntimeException('정리 백업 폴더 권한을 적용할 수 없습니다.');
    $path=$directory.'/user1-keep-20260930-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(6)).'.json';
    $mask=umask(0077);
    try{$handle=fopen($path,'x');}finally{umask($mask);}
    if(!$handle)throw new RuntimeException('정리 백업 파일을 만들 수 없습니다.');
    try{
        if(!chmod($path,0600))throw new RuntimeException('정리 백업 파일 권한을 적용할 수 없습니다.');
        $json=hr_json($backup);$written=0;$length=strlen($json);
        while($written<$length){$bytes=fwrite($handle,substr($json,$written));if($bytes===false||$bytes===0)throw new RuntimeException('정리 백업을 저장하지 못했습니다.');$written+=$bytes;}
        if(!fflush($handle)||(function_exists('fsync')&&!fsync($handle)))throw new RuntimeException('정리 백업을 저장하지 못했습니다.');
    }catch(Throwable $e){fclose($handle);unlink($path);throw $e;}
    fclose($handle);clearstatcache(true,$path);
    if((fileperms($path)&0777)!==0600||hash_file('sha256',$path)!==hash('sha256',$json))throw new RuntimeException('정리 백업 검증에 실패했습니다.');
    return $path;
}

function user1_cleanup_suspend(PDO $d,string $reason): array {
    $manifest=['username'=>'user1','userId'=>2,'employeeId'=>1,'preservedDate'=>'2026-09-30','state'=>'suspended','reason'=>$reason,'checkedAt'=>gmdate('c')];
    $q=$d->prepare('INSERT INTO test_fixture_batches(batch,manifest) VALUES(?,?)');$q->execute([user1_cleanup_batch(),hr_json($manifest)]);
    $d->commit();return ['alreadyApplied'=>false]+$manifest;
}

/** One authorized cleanup. A completed or suspended request never applies to future data. */
function cleanup_user1(string $backupDirectory): array {
    $d=db();$uid=2;$eid=1;$date='2026-09-30';$d->beginTransaction();
    try{
        $q=$d->prepare('SELECT manifest FROM test_fixture_batches WHERE batch=? FOR UPDATE');$q->execute([user1_cleanup_batch()]);
        if($raw=$q->fetchColumn()){
            $manifest=json_decode($raw,true,512,JSON_THROW_ON_ERROR);
            $complete=($manifest['state']??'')==='complete'&&($manifest['username']??'')==='user1'&&(int)($manifest['userId']??0)===$uid&&(int)($manifest['employeeId']??0)===$eid&&($manifest['preservedDate']??'')===$date&&!empty($manifest['completedAt']);
            if(!$complete&&($manifest['state']??'')!=='suspended')throw new RuntimeException('기존 정리 기록을 확인할 수 없습니다.');
            $d->commit();return ['alreadyApplied'=>$complete]+$manifest;
        }
        // Do not select password hashes, HR profiles, contracts or membership details.
        $q=$d->prepare('SELECT id,username,display_name,role FROM app_users WHERE id=? FOR UPDATE');$q->execute([$uid]);$user=$q->fetch();
        $q=$d->prepare('SELECT id,user_id FROM hr_employees WHERE id=? FOR UPDATE');$q->execute([$eid]);$employee=$q->fetch();
        if(!$user||$user['username']!=='user1'||$user['display_name']!=='테스트 직원'||$user['role']!=='employee'||!$employee||(int)$employee['user_id']!==$uid)return user1_cleanup_suspend($d,'identity_mismatch');

        $q=$d->prepare('SELECT * FROM sales_records WHERE employee_id=? ORDER BY id FOR UPDATE');$q->execute([$uid]);$sales=$q->fetchAll();
        $keptNative=[];$deletedNative=[];
        foreach($sales as $sale){if($sale['first_date']===$date)$keptNative[]=$sale;else $deletedNative[]=$sale;}
        // This receipt was verified before authorizing the cleanup. Fail closed if it moved or vanished.
        if(!in_array(16,array_map('intval',array_column($keptNative,'id')),true))return user1_cleanup_suspend($d,'verified_receipt_missing');
        $keptIds=array_column($keptNative,'id');$deletedIds=array_column($deletedNative,'id');
        $q=$d->prepare('SELECT state,revision FROM test_employee_data WHERE user_id=? FOR UPDATE');$q->execute([$uid]);$legacy=$q->fetch();
        $state=$legacy?json_decode($legacy['state'],true,512,JSON_THROW_ON_ERROR):[];
        hr_assert(is_array($state)&&is_array($state['sales']??[])&&is_array($state['attendance']??[]),'기존 테스트 자료 형식을 확인할 수 없습니다.');
        $keptLegacy=[];$deletedLegacy=[];$seen=[];
        foreach($state['sales']??[] as $sale){
            hr_assert(is_array($sale)&&isset($sale['id'])&&ctype_digit((string)$sale['id'])&&!isset($seen[(string)$sale['id']]),'기존 접수 식별자를 확인할 수 없습니다.');$seen[(string)$sale['id']]=true;
            if(($sale['date']??'')===$date)$keptLegacy[]=$sale;else $deletedLegacy[]=$sale;
        }
        $keptSnapshot=user1_cleanup_receipt_snapshot($d,$keptIds,$keptLegacy);
        $deletedSnapshot=user1_cleanup_receipt_snapshot($d,$deletedIds,$deletedLegacy);
        $q=$d->prepare('SELECT * FROM daily_grade_receipts WHERE employee_id=? ORDER BY performance_date,milestone FOR UPDATE');$q->execute([$uid]);$dailyGrade=$q->fetchAll();
        $q=$d->prepare('SELECT * FROM hr_payroll WHERE employee_id=? ORDER BY id FOR UPDATE');$q->execute([$eid]);$payroll=$q->fetchAll();$deletedPayroll=[];$keptPayroll=[];
        foreach($payroll as $row){if(user1_cleanup_synthetic_payroll($row))$deletedPayroll[]=$row;else $keptPayroll[]=$row;}
        $payrollIds=array_column($deletedPayroll,'id');$payrollEvents=user1_cleanup_rows($d,'hr_payroll_events','payroll_id',$payrollIds);
        $q=$d->prepare('SELECT COUNT(*) FROM employee_checkins WHERE user_id=?');$q->execute([$uid]);$nativeAttendance=(int)$q->fetchColumn();
        $backup=['batch'=>user1_cleanup_batch(),'account'=>$user,'employee'=>$employee,'preservedDate'=>$date,'savedAt'=>gmdate('c'),'keptReceipts'=>$keptSnapshot,'deletedReceipts'=>$deletedSnapshot,'test_employee_data'=>$legacy?:null,'daily_grade_receipts'=>$dailyGrade,'hr_payroll'=>$deletedPayroll,'hr_payroll_events'=>$payrollEvents];
        $backupPath=user1_cleanup_private_backup($backupDirectory,$backup);

        // Delete by selected primary keys only. Actor identity is never a deletion criterion.
        foreach(array_chunk($deletedIds,400) as $chunk){
            $marks=implode(',',array_fill(0,count($chunk),'?'));
            foreach(['sales_events','sales_consultation_details','sales_receipt_details','sales_birth_details','sales_counselor_details'] as $table){$q=$d->prepare('DELETE FROM '.$table.' WHERE sale_id IN ('.$marks.')');$q->execute($chunk);}
            $q=$d->prepare('DELETE FROM sales_records WHERE id IN ('.$marks.') AND employee_id=?');$q->execute([...$chunk,$uid]);
        }
        $deletedKeys=array_merge(array_map('strval',$deletedIds),array_map(fn($sale)=>'test:2:'.$sale['id'],$deletedLegacy));
        foreach(array_chunk($deletedKeys,400) as $chunk){$q=$d->prepare('DELETE FROM intake_management_events WHERE record_key IN ('.implode(',',array_fill(0,count($chunk),'?')).')');$q->execute($chunk);}
        foreach(array_chunk($payrollIds,400) as $chunk){
            $marks=implode(',',array_fill(0,count($chunk),'?'));$q=$d->prepare('DELETE FROM hr_payroll_events WHERE payroll_id IN ('.$marks.')');$q->execute($chunk);
            $q=$d->prepare('DELETE FROM hr_payroll WHERE id IN ('.$marks.') AND employee_id=?');$q->execute([...$chunk,$eid]);
        }
        $q=$d->prepare('DELETE FROM daily_grade_receipts WHERE employee_id=?');$q->execute([$uid]);
        if($legacy){
            $nextState=$state;$nextState['sales']=$keptLegacy;$nextState['attendance']=[];
            $q=$d->prepare('UPDATE test_employee_data SET state=?,revision=revision+1 WHERE user_id=?');$q->execute([hr_json($nextState),$uid]);
            $q=$d->prepare('SELECT state,revision FROM test_employee_data WHERE user_id=?');$q->execute([$uid]);$updated=$q->fetch();
            hr_assert(user1_cleanup_json_value(json_decode($updated['state'],true,512,JSON_THROW_ON_ERROR))===user1_cleanup_json_value($nextState)&&(int)$updated['revision']===(int)$legacy['revision']+1,'남겨둔 테스트 자료를 확인하지 못했습니다.');
        }
        hr_assert(user1_cleanup_receipt_snapshot($d,$keptIds,$keptLegacy)===$keptSnapshot,'9월 30일 접수와 상세 이력 보존을 확인하지 못했습니다.');
        $q=$d->prepare('SELECT * FROM sales_records WHERE employee_id=? ORDER BY id FOR UPDATE');$q->execute([$uid]);hr_assert($q->fetchAll()===$keptNative,'요청한 접수 정리를 확인하지 못했습니다.');
        $q=$d->prepare('SELECT * FROM hr_payroll WHERE employee_id=? ORDER BY id FOR UPDATE');$q->execute([$eid]);hr_assert($q->fetchAll()===$keptPayroll,'기존 급여 보존을 확인하지 못했습니다.');
        $q=$d->prepare('SELECT COUNT(*) FROM daily_grade_receipts WHERE employee_id=?');$q->execute([$uid]);hr_assert((int)$q->fetchColumn()===0,'일그레이드 지급 기록 정리를 확인하지 못했습니다.');
        hr_assert(user1_cleanup_rows($d,'intake_management_events','record_key',$deletedKeys)===[],'삭제 대상 접수 이력 정리를 확인하지 못했습니다.');
        $manifest=['username'=>'user1','userId'=>$uid,'employeeId'=>$eid,'state'=>'complete','preservedDate'=>$date,'kept'=>['native'=>count($keptNative),'legacy'=>count($keptLegacy),'payroll'=>count($keptPayroll),'nativeAttendance'=>$nativeAttendance],'deleted'=>['native'=>count($deletedNative),'legacy'=>count($deletedLegacy),'intakeEvents'=>count($deletedSnapshot['intake_management_events']),'payroll'=>count($deletedPayroll),'payrollEvents'=>count($payrollEvents),'demoAttendance'=>count($state['attendance']??[]),'dailyGrade'=>count($dailyGrade)],'backup'=>$backupPath,'completedAt'=>gmdate('c')];
        $q=$d->prepare('INSERT INTO test_fixture_batches(batch,manifest) VALUES(?,?)');$q->execute([user1_cleanup_batch(),hr_json($manifest)]);
        $d->commit();return ['alreadyApplied'=>false]+$manifest;
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
