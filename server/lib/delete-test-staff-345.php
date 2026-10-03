<?php
declare(strict_types=1);
require_once __DIR__.'/account-transfer.php';

/** One request for the three verified seed identities. Never a general deletion API. */
function dts345_batch(): string {return 'delete-test-staff-345-20261003-v1';}
function dts345_assert(bool $ok,string $reason): void {if(!$ok)throw new RuntimeException($reason);}
/** Finite public diagnostics, never exception messages or row values. */
function dts345_reason(string $reason): string {
    $groups=[
        'identity'=>['identity_missing','identity_mismatch','protected_identity_conflict'],
        'seed'=>['seed_manifest_missing','invalid_seed_manifest','duplicate_seed_identity','seed_manifest_changed'],
        'legacy_sales'=>['legacy_data_mismatch','non_synthetic_legacy','unrecognized_legacy_history','real_sales_present'],
        'attendance'=>['non_synthetic_attendance','non_synthetic_grade_receipt'],
        'native_activity'=>['native_employee_activity'],
        'payroll'=>['non_synthetic_payroll','non_synthetic_payroll_event'],
        'contract'=>['non_synthetic_contract','non_synthetic_contract_event','contract_approval_present','contract_recipient_mismatch'],
        'dependency'=>['unsupported_table','unsupported_schema','unrelated_reference','unrelated_notice','missing_expected_foreign_key','missing_table','nontransactional_table','unsupported_trigger','delete_count_mismatch','delete_verification_failed','protected_identity_changed'],
        'backup_database'=>['backup_failed','database_guard','mysql_required','cleanup_busy'],
        'unexpected'=>['invalid_json','invalid_marker','data_guard']
    ];
    if(isset($groups[$reason]))return $reason;
    foreach($groups as $category=>$reasons)if(in_array($reason,$reasons,true))return $category;
    return 'unexpected';
}
function dts345_decode(mixed $raw): array {
    if(is_array($raw))return $raw;
    $value=json_decode((string)$raw,true,512,JSON_THROW_ON_ERROR);
    dts345_assert(is_array($value),'invalid_json');return $value;
}
function dts345_identity(array $employee,array $account,array $fixture,int $number): bool {
    try{$p=dts345_decode($employee['profile']??'');}catch(Throwable $e){return false;}
    return in_array($number,[3,4,5],true)&&(int)($employee['id']??0)===$number
        &&($employee['employee_no']??'')==='cncTEST20260929'.$number
        &&($p['name']??'')==='테스트 직원 '.$number&&($p['team']??'')==='insurance'
        &&($p['memo']??'')==='삭제 가능한 가상 직원. 실제 근로·급여 지급 대상이 아닙니다.'
        &&(int)($account['id']??0)>0&&(int)($employee['user_id']??0)===(int)$account['id']
        &&($account['username']??'')==='user'.$number&&($account['display_name']??'')==='테스트 직원 '.$number
        &&($account['role']??'')==='employee'&&($account['department']??'')==='insurance'
        &&array_key_exists('active',$account)&&(int)$account['active']===0
        &&($fixture['username']??'')==='user'.$number&&(int)($fixture['employeeId']??0)===$number
        &&(int)($fixture['userId']??0)===(int)$account['id'];
}
function dts345_synthetic_note(string $note): bool {
    return str_contains($note,'테스트')&&str_contains($note,'가상')
        &&(str_contains($note,'실제 지급·약정·승인이 아닙니다.')||str_contains($note,'실제 지급 대상 아님'));
}
function dts345_synthetic_attendance(array $row): bool {
    $fixture=$row['fixture']??'';$status=$row['status']??'';
    return is_string($row['date']??null)&&hr_day($row['date'])&&($row['in']??'')==='10:00'&&($row['out']??'')==='17:00'
        &&((in_array($fixture,['five-test-staff-20260929','test-inspection-refresh-20260929-v1'],true)&&$status==='정상 (가상 점검)')
        ||($fixture==='test-full-attendance-grade-20260930-v3'&&$status==='만근 (테스트)'));
}
function dts345_synthetic_payroll_event(array $row): bool {
    try{$s=dts345_decode($row['snapshot']??'');}catch(Throwable $e){return false;}
    $notes=['[테스트] 점검 자료 생성 · 실제 지급 아님','[테스트] 기본 자료 보강 전 가상 명세서 보관',
        '[테스트] 요청한 기본 자료·자동 일그레이드 선지급 반영 · 실제 지급 아님','테스트 만근·현재 그레이드 재산정 전 기록',
        '시스템: 테스트 명세서 주휴 구분 전 기록 (총액 유지)','시스템: 임시 명세서 기본급·주휴 구분 표시 (총액 유지)'];
    return in_array($row['event']??'',['publish','savePayroll'],true)&&in_array($row['note']??'',$notes,true)
        &&dts345_synthetic_note((string)($s['calculation']['note']??''));
}
function dts345_synthetic_payroll(array $row): bool {
    try{$c=dts345_decode($row['calculation']??'');$s=dts345_decode($row['published_snapshot']??'');}catch(Throwable $e){return false;}
    $note=(string)($c['note']??'');$savedNote=(string)($s['calculation']['note']??'');
    return ($row['status']??'')==='published'&&empty($row['confirmed_at'])&&$note===$savedNote
        &&dts345_synthetic_note($note);
}
function dts345_synthetic_contract(array $row): bool {
    try{$t=dts345_decode($row['terms']??'');$s=dts345_decode($row['issued_snapshot']??'');}catch(Throwable $e){return false;}
    $marker='기능 점검용 가상 계약서이며 실제 근로계약·서명·동의가 아닙니다.';
    return ($row['status']??'')==='issued'&&empty($row['received_at'])&&empty($row['received_by'])
        &&($t['extraTerms']??'')===$marker&&($s['terms']['extraTerms']??'')===$marker
        &&($t['employerName']??'')==='씨앤씨(가상 점검용)';
}
/** Whitelisted tables and exact primary keys; includes intentionally empty dependency sets. */
function dts345_primary_keys(): array {
    return ['app_users'=>['id'],'hr_employees'=>['id'],'test_employee_data'=>['user_id'],
        'sales_records'=>['id'],'sales_events'=>['id'],'sales_consultation_details'=>['sale_id'],
        'sales_receipt_details'=>['sale_id'],'sales_birth_details'=>['sale_id'],'sales_counselor_details'=>['sale_id'],
        'intake_management_events'=>['id'],'daily_grade_receipts'=>['employee_id','performance_date','milestone'],
        'hr_payroll'=>['id'],'hr_payroll_events'=>['id'],'hr_personnel_events'=>['id'],
        'hr_contracts'=>['id'],'hr_contract_events'=>['id'],'hr_contract_approvals'=>['contract_id'],
        'employee_checkins'=>['user_id','work_date'],'employee_checkin_approvals'=>['user_id','work_date'],
        'employee_memberships'=>['user_id'],'employee_membership_events'=>['id']];
}
function dts345_rows(PDO $d,string $table,string $column,array $values): array {
    dts345_assert(isset(dts345_primary_keys()[$table])&&preg_match('/^[a-z_]+$/D',$column)===1,'unsupported_table');
    if(!$values)return [];$rows=[];
    foreach(array_chunk(array_values(array_unique($values)),300) as $chunk){
        $q=$d->prepare('SELECT * FROM '.$table.' WHERE '.$column.' IN ('.implode(',',array_fill(0,count($chunk),'?')).') ORDER BY '.implode(',',dts345_primary_keys()[$table]).' FOR UPDATE');
        $q->execute($chunk);$rows=array_merge($rows,$q->fetchAll());
    }return $rows;
}
function dts345_key(string $table,array $row): string {
    return json_encode(array_map(fn($key)=>(string)$row[$key],dts345_primary_keys()[$table]),JSON_THROW_ON_ERROR);
}
/** Reject schema additions, triggers and references outside the selected owned rows. */
function dts345_dependencies(PDO $d,array $plan,array $userIds): void {
    $allowed=['app_users'=>account_transfer_user_columns(),
        'hr_employees'=>['hr_payroll'=>['employee_id'],'hr_personnel_events'=>['employee_id'],'hr_contracts'=>['employee_id']],
        'hr_payroll'=>['hr_payroll_events'=>['payroll_id']],
        'hr_contracts'=>['hr_contract_events'=>['contract_id'],'hr_contract_approvals'=>['contract_id']],
        'sales_records'=>['sales_events'=>['sale_id'],'sales_consultation_details'=>['sale_id'],'sales_receipt_details'=>['sale_id'],'sales_birth_details'=>['sale_id'],'sales_counselor_details'=>['sale_id']],
        'employee_checkins'=>['employee_checkin_approvals'=>['user_id','work_date']]];
    $allowed['app_users']['grade_visibility']=['actor_id'];
    $tables=array_keys(dts345_primary_keys());$marks=implode(',',array_fill(0,count($tables),'?'));
    $q=$d->prepare('SELECT TABLE_SCHEMA,TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IN ('.$marks.')');$q->execute($tables);$refs=$q->fetchAll();
    $database=(string)$d->query('SELECT DATABASE()')->fetchColumn();$seen=[];
    foreach($refs as $ref){
        $parent=$ref['REFERENCED_TABLE_NAME'];$table=$ref['TABLE_NAME'];$column=$ref['COLUMN_NAME'];$parentColumn=$ref['REFERENCED_COLUMN_NAME'];
        dts345_assert($ref['TABLE_SCHEMA']===$database&&in_array($column,$allowed[$parent][$table]??[],true),'unsupported_schema');
        dts345_assert(in_array($parentColumn,dts345_primary_keys()[$parent],true),'unsupported_schema');
        $seen[$parent.'.'.$table.'.'.$column]=true;
        $values=array_values(array_unique(array_column($plan[$parent]??[],$parentColumn)));if(!$values)continue;
        $accepted=[];foreach($plan[$table]??[] as $row)$accepted[dts345_key($table,$row)]=true;
        foreach(array_chunk($values,300) as $chunk){
            $query=$d->prepare('SELECT * FROM '.$table.' WHERE '.$column.' IN ('.implode(',',array_fill(0,count($chunk),'?')).') FOR UPDATE');$query->execute($chunk);
            foreach($query->fetchAll() as $row)dts345_assert(isset(dts345_primary_keys()[$table])&&isset($accepted[dts345_key($table,$row)]),'unrelated_reference');
        }
    }
    // A removed expected constraint must not silently hide an actor/owner reference.
    foreach($allowed as $parent=>$children)foreach($children as $table=>$columns)foreach($columns as $column){
        if($table==='office_notices')continue;
        dts345_assert(isset($seen[$parent.'.'.$table.'.'.$column]),'missing_expected_foreign_key');
    }
    // These references are logical rather than foreign keys.
    $q=$d->prepare('SELECT actor_id FROM office_notices WHERE actor_id IN (?,?,?) FOR UPDATE');$q->execute($userIds);dts345_assert(!$q->fetch(),'unrelated_notice');
    $affected=array_merge($tables,['test_fixture_batches']);$marks=implode(',',array_fill(0,count($affected),'?'));
    $q=$d->prepare('SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('.$marks.')');$q->execute($affected);$engines=$q->fetchAll();
    dts345_assert(count($engines)===count($affected),'missing_table');foreach($engines as $row)dts345_assert(strtoupper((string)$row['ENGINE'])==='INNODB','nontransactional_table');
    $q=$d->prepare('SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE IN ('.$marks.')');$q->execute($affected);dts345_assert(!$q->fetch(),'unsupported_trigger');
}
function dts345_record(PDO $d,array $manifest): void {
    $q=$d->prepare('INSERT INTO test_fixture_batches(batch,manifest) VALUES(?,?)');$q->execute([dts345_batch(),hr_json($manifest)]);
}

function delete_test_staff_345(string $backupDirectory): array {
    $d=db();dts345_assert($d->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql','mysql_required');
    $q=$d->prepare('SELECT GET_LOCK(?,0)');$q->execute([dts345_batch()]);dts345_assert((int)$q->fetchColumn()===1,'cleanup_busy');
    $armed=false;
    try{
        $d->beginTransaction();$q=$d->prepare('SELECT manifest FROM test_fixture_batches WHERE batch=? FOR UPDATE');$q->execute([dts345_batch()]);
        if($raw=$q->fetchColumn()){
            $old=dts345_decode($raw);dts345_assert(in_array($old['state']??'',['complete','suspended'],true),'invalid_marker');
            $d->commit();return ['state'=>$old['state'],'alreadyApplied'=>true,'deletedCounts'=>$old['deletedCounts']??[]]+($old['state']==='suspended'?['reason'=>dts345_reason((string)($old['reason']??''))]:[]);
        }
        // Persist a suspension after any failed preflight, so a later different identity is never targeted.
        $armed=true;$q=$d->prepare('SELECT manifest FROM test_fixture_batches WHERE batch=? FOR UPDATE');$q->execute(['five-test-staff-20260929']);$seedRaw=$q->fetchColumn();
        dts345_assert(is_string($seedRaw),'seed_manifest_missing');$seed=dts345_decode($seedRaw);$fixtures=[];
        foreach($seed as $entry){dts345_assert(is_array($entry)&&isset($entry['username']),'invalid_seed_manifest');dts345_assert(!isset($fixtures[$entry['username']]),'duplicate_seed_identity');$fixtures[$entry['username']]=$entry;}
        $plan=array_fill_keys(array_keys(dts345_primary_keys()),[]);$plan['hr_employees']=dts345_rows($d,'hr_employees','id',[3,4,5]);dts345_assert(count($plan['hr_employees'])===3,'identity_missing');
        $userIds=array_map('intval',array_column($plan['hr_employees'],'user_id'));dts345_assert(count(array_unique($userIds))===3&&!in_array(0,$userIds,true),'identity_mismatch');
        $plan['app_users']=dts345_rows($d,'app_users','id',$userIds);$accounts=array_column($plan['app_users'],null,'id');
        foreach($plan['hr_employees'] as $employee){$n=(int)$employee['id'];dts345_assert(dts345_identity($employee,$accounts[$employee['user_id']]??[],$fixtures['user'.$n]??[],$n),'identity_mismatch');}
        $protected=dts345_rows($d,'hr_employees','id',[6]);dts345_assert(count($protected)===1&&!in_array((int)$protected[0]['user_id'],$userIds,true),'protected_identity_conflict');
        $protectedAccounts=dts345_rows($d,'app_users','id',[(int)$protected[0]['user_id']]);
        $plan['test_employee_data']=dts345_rows($d,'test_employee_data','user_id',$userIds);$legacyKeys=[];$demoDates=[];
        foreach($plan['test_employee_data'] as $row){
            $state=dts345_decode($row['state']);$uid=(int)$row['user_id'];
            dts345_assert(is_array($state['sales']??null)&&is_array($state['attendance']??null),'legacy_data_mismatch');
            $seen=[];
            foreach($state['sales'] as $sale){
                dts345_assert(is_array($sale)&&ctype_digit((string)($sale['id']??''))&&!isset($seen[(string)$sale['id']]),'legacy_data_mismatch');$seen[(string)$sale['id']]=true;
                dts345_assert(in_array($sale['fixture']??'',['five-test-staff-20260929','normal-range-20260929-v1','test-inspection-refresh-20260929-v1'],true)&&str_starts_with((string)($sale['name']??''),'[테스트'),'non_synthetic_legacy');
                $legacyKeys[]='test:'.$uid.':'.$sale['id'];
            }
            foreach($state['attendance'] as $attendance){
                dts345_assert(is_array($attendance)&&dts345_synthetic_attendance($attendance),'non_synthetic_attendance');
                $demoDates[$uid][(string)$attendance['date']]=true;
            }
        }
        $plan['sales_records']=dts345_rows($d,'sales_records','employee_id',$userIds);
        foreach($plan['sales_records'] as $row)dts345_assert((int)$row['is_test']===1&&str_starts_with($row['customer_name'],'[테스트'),'real_sales_present');
        $saleIds=array_column($plan['sales_records'],'id');
        foreach(['sales_events','sales_consultation_details','sales_receipt_details','sales_birth_details','sales_counselor_details'] as $table)$plan[$table]=dts345_rows($d,$table,'sale_id',$saleIds);
        $plan['intake_management_events']=dts345_rows($d,'intake_management_events','record_key',array_merge(array_map('strval',$saleIds),$legacyKeys));
        // Unrecognized legacy audit keys could refer to a real record; do not orphan them.
        foreach($userIds as $uid){$q=$d->prepare('SELECT id FROM intake_management_events WHERE record_key LIKE ? FOR UPDATE');$q->execute(['test:'.$uid.':%']);$known=array_column($plan['intake_management_events'],'id');foreach($q->fetchAll() as $row)dts345_assert(in_array($row['id'],$known),'unrecognized_legacy_history');}
        $plan['daily_grade_receipts']=dts345_rows($d,'daily_grade_receipts','employee_id',$userIds);
        foreach($plan['daily_grade_receipts'] as $row)dts345_assert($row['department']==='insurance'&&isset($demoDates[(int)$row['employee_id']][$row['performance_date']]),'non_synthetic_grade_receipt');
        foreach(['employee_checkins','employee_checkin_approvals','employee_memberships','employee_membership_events'] as $table)dts345_assert(dts345_rows($d,$table,'user_id',$userIds)===[],'native_employee_activity');
        foreach(['hr_payroll','hr_personnel_events','hr_contracts'] as $table)$plan[$table]=dts345_rows($d,$table,'employee_id',[3,4,5]);
        foreach($plan['hr_payroll'] as $row)dts345_assert((int)$row['id']===(int)($fixtures['user'.$row['employee_id']]['payrollId']??0)&&dts345_synthetic_payroll($row),'non_synthetic_payroll');
        foreach($plan['hr_contracts'] as $row){
            $fixture=$fixtures['user'.$row['employee_id']]??[];
            dts345_assert((int)($row['recipient_user_id']??0)===(int)($fixture['userId']??-1),'contract_recipient_mismatch');
            dts345_assert((int)$row['id']===(int)($fixture['contractId']??0)&&dts345_synthetic_contract($row),'non_synthetic_contract');
        }
        $plan['hr_payroll_events']=dts345_rows($d,'hr_payroll_events','payroll_id',array_column($plan['hr_payroll'],'id'));
        foreach($plan['hr_payroll_events'] as $row)dts345_assert(dts345_synthetic_payroll_event($row),'non_synthetic_payroll_event');
        $contractIds=array_column($plan['hr_contracts'],'id');$plan['hr_contract_events']=dts345_rows($d,'hr_contract_events','contract_id',$contractIds);
        foreach($plan['hr_contract_events'] as $row){$event=dts345_decode($row['snapshot']);dts345_assert($row['event']==='issued'&&str_contains((string)($event['reason']??''),'가상 점검용'),'non_synthetic_contract_event');}
        dts345_assert(dts345_rows($d,'hr_contract_approvals','contract_id',$contractIds)===[],'contract_approval_present');
        dts345_dependencies($d,$plan,$userIds);
        // Includes account hashes only in a server-private restore file; never print the snapshot.
        $path=account_transfer_backup($backupDirectory,['request'=>dts345_batch(),'savedAt'=>gmdate('c'),'seedManifest'=>$seed,'tables'=>$plan,'protectedEmployee6'=>$protected,'protectedAccount6'=>$protectedAccounts]);
        $counts=array_map('count',$plan);
        $order=['sales_events','sales_consultation_details','sales_receipt_details','sales_birth_details','sales_counselor_details','intake_management_events','sales_records','daily_grade_receipts','test_employee_data','hr_payroll_events','hr_payroll','hr_contract_events','hr_contracts','hr_personnel_events','hr_employees','app_users'];
        foreach($order as $table){
            $keys=dts345_primary_keys()[$table];$where=implode(' AND ',array_map(fn($key)=>$key.'=?',$keys));$q=$d->prepare('DELETE FROM '.$table.' WHERE '.$where);
            foreach($plan[$table] as $row){$q->execute(array_map(fn($key)=>$row[$key],$keys));dts345_assert($q->rowCount()===1,'delete_count_mismatch');}
        }
        dts345_assert(dts345_rows($d,'hr_employees','id',[3,4,5])===[]&&dts345_rows($d,'app_users','id',$userIds)===[],'delete_verification_failed');
        dts345_assert(dts345_rows($d,'hr_employees','id',[6])===$protected&&dts345_rows($d,'app_users','id',[(int)$protected[0]['user_id']])===$protectedAccounts,'protected_identity_changed');
        $q=$d->prepare('SELECT manifest FROM test_fixture_batches WHERE batch=? FOR UPDATE');$q->execute(['five-test-staff-20260929']);dts345_assert($q->fetchColumn()===$seedRaw,'seed_manifest_changed');
        dts345_record($d,['state'=>'complete','targets'=>[3,4,5],'userIds'=>$userIds,'deletedCounts'=>$counts,'backup'=>$path,'backupSha256'=>hash_file('sha256',$path),'completedAt'=>gmdate('c')]);
        $d->commit();return ['state'=>'complete','alreadyApplied'=>false,'deletedCounts'=>$counts];
    }catch(Throwable $e){
        if($d->inTransaction())$d->rollBack();
        if(!$armed)throw $e;
        // A suspended marker is permanent. Review requires a separately authorized new request.
        $d->beginTransaction();$q=$d->prepare('SELECT manifest FROM test_fixture_batches WHERE batch=? FOR UPDATE');$q->execute([dts345_batch()]);
        $reason=$e instanceof PDOException?'backup_database':dts345_reason($e instanceof RuntimeException?$e->getMessage():'data_guard');
        if(!$q->fetchColumn())dts345_record($d,['state'=>'suspended','targets'=>[3,4,5],'reason'=>$reason,'deletedCounts'=>[],'checkedAt'=>gmdate('c')]);
        $d->commit();return ['state'=>'suspended','alreadyApplied'=>false,'reason'=>$reason,'deletedCounts'=>[]];
    }finally{
        if($d->inTransaction())$d->rollBack();$q=$d->prepare('SELECT RELEASE_LOCK(?)');$q->execute([dts345_batch()]);
    }
}
