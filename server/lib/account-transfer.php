<?php
declare(strict_types=1);
require_once __DIR__.'/hr.php';

/** This is one operator-authorized transfer, never a general account deletion API. */
function account_transfer_batch(): string {return 'account-transfer-lee001-lsh-20261002-021208-v1';}
function account_transfer_user_columns(): array {
    return ['employee_checkins'=>['user_id'],'employee_checkin_approvals'=>['user_id','actor_id'],
        'grade_versions'=>['actor_id'],'hr_employees'=>['user_id'],'hr_personnel_events'=>['actor_id'],
        'hr_payroll_events'=>['actor_id'],'test_employee_data'=>['user_id'],'sales_records'=>['employee_id'],
        'sales_events'=>['actor_id'],'office_notices'=>['actor_id'],'intake_policy_history'=>['actor_id'],
        'daily_grade_receipts'=>['employee_id'],'hr_contract_settings'=>['updated_by'],
        'hr_contracts'=>['recipient_user_id','created_by','received_by'],'hr_contract_events'=>['actor_id'],
        'intake_management_events'=>['actor_id'],'hr_contract_approvals'=>['actor_id'],
        'business_calendar'=>['actor_id'],'business_calendar_events'=>['actor_id'],
        'employee_memberships'=>['user_id','approved_by'],'employee_membership_events'=>['user_id','actor_id']];
}
function account_transfer_rows(PDO $d,string $table,string $column,array $ids): array {
    if(!$ids)return [];
    $q=$d->prepare('SELECT * FROM '.$table.' WHERE '.$column.' IN ('.implode(',',array_fill(0,count($ids),'?')).') FOR UPDATE');$q->execute($ids);return $q->fetchAll();
}
function account_transfer_update(PDO $d,string $table,array $values,array $where): void {
    $q=$d->prepare('UPDATE '.$table.' SET '.implode(',',array_map(fn($key)=>$key.'=?',array_keys($values))).' WHERE '.implode(' AND ',array_map(fn($key)=>$key.'=?',array_keys($where))));$q->execute([...array_values($values),...array_values($where)]);
}
function account_transfer_insert(PDO $d,string $table,array $row): void {
    $q=$d->prepare('INSERT INTO '.$table.' ('.implode(',',array_keys($row)).') VALUES ('.implode(',',array_fill(0,count($row),'?')).')');$q->execute(array_values($row));
}
function account_transfer_delete(PDO $d,string $table,array $where): void {
    $q=$d->prepare('DELETE FROM '.$table.' WHERE '.implode(' AND ',array_map(fn($key)=>$key.'=?',array_keys($where))));$q->execute(array_values($where));
}
function account_transfer_assert(bool $condition,string $reason): void {if(!$condition)throw new RuntimeException($reason);}

/** Stop if a later schema adds account references that this reviewed transfer does not handle. */
function account_transfer_check_schema(PDO $d): void {
    $known=['app_users'=>account_transfer_user_columns(),'hr_employees'=>['hr_payroll'=>['employee_id'],'hr_personnel_events'=>['employee_id'],'hr_contracts'=>['employee_id']]];
    if($d->getAttribute(PDO::ATTR_DRIVER_NAME)==='sqlite'){
        $refs=[];foreach($d->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN) as $table){
            account_transfer_assert((bool)preg_match('/^[a-z_]+$/D',$table),'unsupported_schema');
            foreach($d->query('PRAGMA foreign_key_list('.$table.')')->fetchAll() as $ref)$refs[]=['TABLE_NAME'=>$table,'COLUMN_NAME'=>$ref['from'],'REFERENCED_TABLE_NAME'=>$ref['table']];
        }
    }else $refs=$d->query("SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_NAME IN ('app_users','hr_employees')")->fetchAll();
    foreach($refs as $ref){$parent=$ref['REFERENCED_TABLE_NAME'];if(!isset($known[$parent]))continue;account_transfer_assert(in_array($ref['COLUMN_NAME'],$known[$parent][$ref['TABLE_NAME']]??[],true),'unsupported_schema');}
}
function account_transfer_backup(string $directory,array $snapshot): string {
    account_transfer_assert(!is_link($directory),'backup_failed');
    if(!is_dir($directory))account_transfer_assert(mkdir($directory,0700,true),'backup_failed');
    account_transfer_assert(chmod($directory,0700),'backup_failed');
    $path=$directory.'/account-transfer-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(6)).'.json';$mask=umask(0077);
    try{$handle=fopen($path,'x');}finally{umask($mask);}
    account_transfer_assert($handle!==false,'backup_failed');$json=hr_json($snapshot);
    try{account_transfer_assert(chmod($path,0600),'backup_failed');$written=0;while($written<strlen($json)){$n=fwrite($handle,substr($json,$written));account_transfer_assert($n!==false&&$n>0,'backup_failed');$written+=$n;}account_transfer_assert(fflush($handle)&&(!function_exists('fsync')||fsync($handle)),'backup_failed');}finally{fclose($handle);}
    clearstatcache(true,$path);account_transfer_assert((fileperms($path)&0777)===0600&&hash_file('sha256',$path)===hash('sha256',$json),'backup_failed');return $path;
}
function account_transfer_history(PDO $d,array $employee,int $destination,string $event): void {
    account_transfer_insert($d,'hr_personnel_events',['employee_id'=>$destination,'actor_id'=>null,'event'=>$event,'revision'=>$employee['revision'],'snapshot'=>hr_json(['employeeNo'=>$employee['employee_no'],'profile'=>json_decode($employee['profile'],true,512,JSON_THROW_ON_ERROR),'accountTransfer'=>account_transfer_batch()])]);
}

function account_transfer_lee001_lsh(string $directory): array {
    $d=db();$d->beginTransaction();
    try{
        $q=$d->prepare('SELECT manifest FROM test_fixture_batches WHERE batch=? FOR UPDATE');$q->execute([account_transfer_batch()]);
        if($raw=$q->fetchColumn()){$manifest=json_decode($raw,true,512,JSON_THROW_ON_ERROR);$d->commit();return ['alreadyApplied'=>true]+$manifest;}
        $q=$d->prepare('SELECT * FROM app_users WHERE username IN (?,?) ORDER BY id FOR UPDATE');$q->execute(['lee001','lsh']);$accounts=[];foreach($q->fetchAll() as $row)$accounts[$row['username']]=$row;
        account_transfer_assert(isset($accounts['lee001'],$accounts['lsh']),'account_missing');$source=$accounts['lee001'];$target=$accounts['lsh'];$from=(int)$source['id'];$to=(int)$target['id'];
        account_transfer_assert($from!==$to&&$source['role']==='employee'&&$target['role']==='employee'&&(int)$target['active']===1&&$source['department']===$target['department']&&!cnc_test_user($source)&&!cnc_test_user($target),'account_mismatch');
        account_transfer_assert($source['created_at']<='2026-10-02 02:12:08.999999'&&$target['created_at']<='2026-10-02 02:12:08.999999','account_mismatch');
        account_transfer_check_schema($d);
        $backup=['request'=>account_transfer_batch(),'savedAt'=>gmdate('c'),'accounts'=>array_values($accounts),'tables'=>[]];
        foreach(account_transfer_user_columns() as $table=>$columns){
            $q=$d->prepare('SELECT * FROM '.$table.' WHERE '.implode(' OR ',array_map(fn($column)=>$column.' IN (?,?)',$columns)).' FOR UPDATE');$q->execute(array_merge(...array_fill(0,count($columns),[$from,$to])));$backup['tables'][$table]=$q->fetchAll();
        }
        $employees=[];foreach($backup['tables']['hr_employees'] as $row)$employees[(int)$row['user_id']]=$row;$sourceEmployee=$employees[$from]??null;$targetEmployee=$employees[$to]??null;$employeeIds=array_column($employees,'id');
        foreach(['hr_payroll','hr_personnel_events','hr_contracts'] as $table)$backup['employeeTables'][$table]=account_transfer_rows($d,$table,'employee_id',$employeeIds);
        $backup['payrollEvents']=account_transfer_rows($d,'hr_payroll_events','payroll_id',array_column($backup['employeeTables']['hr_payroll'],'id'));
        foreach(['hr_contract_events','hr_contract_approvals'] as $table)$backup['contractTables'][$table]=account_transfer_rows($d,$table,'contract_id',array_column($backup['employeeTables']['hr_contracts'],'id'));
        $sales=$backup['tables']['sales_records'];$saleIds=array_column($sales,'id');
        foreach(['sales_events','sales_consultation_details','sales_receipt_details','sales_birth_details','sales_counselor_details'] as $table)$backup['receiptTables'][$table]=account_transfer_rows($d,$table,'sale_id',$saleIds);
        $backup['receiptHistory']=account_transfer_rows($d,'intake_management_events','record_key',array_map('strval',$saleIds));
        // Two payroll statements for one month need review; never add their payments together.
        if($sourceEmployee&&$targetEmployee){
            $seen=[];foreach($backup['employeeTables']['hr_payroll'] as $row){account_transfer_assert(!isset($seen[$row['month']]),'payroll_conflict');$seen[$row['month']]=true;}
        }
        foreach($backup['tables']['test_employee_data'] as $row){$state=json_decode($row['state'],true,512,JSON_THROW_ON_ERROR);account_transfer_assert(count(array_filter($state,fn($v)=>!in_array($v,[null,'',[],false,0],true)))===0,'legacy_conflict');}
        $checkins=[];$approvals=[];foreach($backup['tables']['employee_checkins'] as $row)$checkins[(int)$row['user_id']][$row['work_date']]=$row;
        foreach($backup['tables']['employee_checkin_approvals'] as $row)if(in_array((int)$row['user_id'],[$from,$to],true))$approvals[(int)$row['user_id']][$row['work_date']]=$row;
        $attendance=[];foreach($checkins[$from]??[] as $date=>$row){
            $other=$checkins[$to][$date]??null;$chosen=$other&&$other['check_in_at']<$row['check_in_at']?$other:$row;$approval=$approvals[(int)$chosen['user_id']][$date]??null;
            $alternate=$approvals[(int)$chosen['user_id']===$from?$to:$from][$date]??null;
            if(!$approval&&$alternate&&$alternate['recorded_check_in_at']===$chosen['check_in_at'])$approval=$alternate;
            account_transfer_assert($approval!==null||$alternate===null,'attendance_conflict');
            $attendance[$date]=['row'=>$chosen,'approval'=>$approval,'existing'=>$other];
        }
        $path=account_transfer_backup($directory,$backup);
        // Parent rows are created before moving approval children; FK enforcement stays enabled.
        foreach($attendance as $date=>$entry){
            $row=$entry['row'];$row['user_id']=$to;
            if($entry['existing'])account_transfer_update($d,'employee_checkins',['check_in_at'=>$row['check_in_at'],'created_at'=>$row['created_at']],['user_id'=>$to,'work_date'=>$date]);else account_transfer_insert($d,'employee_checkins',$row);
            account_transfer_delete($d,'employee_checkin_approvals',['user_id'=>$from,'work_date'=>$date]);
            if($entry['approval']){$approval=$entry['approval'];$approval['user_id']=$to;if(isset($approvals[$to][$date]))account_transfer_update($d,'employee_checkin_approvals',$approval,['user_id'=>$to,'work_date'=>$date]);else account_transfer_insert($d,'employee_checkin_approvals',$approval);}
            account_transfer_delete($d,'employee_checkins',['user_id'=>$from,'work_date'=>$date]);
        }
        $members=[];foreach($backup['tables']['employee_memberships'] as $row)if(in_array((int)$row['user_id'],[$from,$to],true))$members[(int)$row['user_id']]=$row;
        if(isset($members[$from])){
            $member=$members[$from];$member['user_id']=$to;
            if(isset($members[$to])){
                $existing=$members[$to];if($existing['status']==='approved'&&$member['status']!=='approved')foreach(['status','approved_by','approved_at'] as $key)$member[$key]=$existing[$key];
                if($member['phone']==='')$member['phone']=$existing['phone'];
                if($existing['profile_completed']&&!$member['profile_completed']){$member['profile_completed']=$existing['profile_completed'];$member['profile_completed_at']=$existing['profile_completed_at'];}
                $member['revision']=max((int)$member['revision'],(int)$existing['revision'])+1;account_transfer_update($d,'employee_memberships',$member,['user_id'=>$to]);account_transfer_delete($d,'employee_memberships',['user_id'=>$from]);
            }else account_transfer_update($d,'employee_memberships',['user_id'=>$to,'revision'=>(int)$member['revision']+1],['user_id'=>$from]);
        }
        if($sourceEmployee&&$targetEmployee){
            $sid=(int)$sourceEmployee['id'];$tid=(int)$targetEmployee['id'];
            account_transfer_history($d,$targetEmployee,$tid,'transferBefore');account_transfer_history($d,$sourceEmployee,$tid,'transferSource');
            $profile=json_decode($targetEmployee['profile'],true,512,JSON_THROW_ON_ERROR);foreach(json_decode($sourceEmployee['profile'],true,512,JSON_THROW_ON_ERROR) as $key=>$value)if($value!==''&&$value!==null&&$value!==[])$profile[$key]=$value;
            $revision=max((int)$sourceEmployee['revision'],(int)$targetEmployee['revision'])+1;account_transfer_update($d,'hr_employees',['profile'=>hr_json($profile),'revision'=>$revision],['id'=>$tid]);
            $maxVersion=0;foreach($backup['employeeTables']['hr_contracts'] as $contract)if((int)$contract['employee_id']===$tid)$maxVersion=max($maxVersion,(int)$contract['version']);
            $contracts=array_values(array_filter($backup['employeeTables']['hr_contracts'],fn($contract)=>(int)$contract['employee_id']===$sid));usort($contracts,fn($a,$b)=>(int)$a['version']<=>(int)$b['version']);
            // Only the destination list sequence changes. Issued contents, hashes and read receipts remain intact.
            foreach($contracts as $contract)account_transfer_update($d,'hr_contracts',['employee_id'=>$tid,'version'=>++$maxVersion,'revision'=>(int)$contract['revision']+1],['id'=>$contract['id']]);
            foreach(['hr_payroll','hr_personnel_events','hr_contracts'] as $table)account_transfer_update($d,$table,['employee_id'=>$tid],['employee_id'=>$sid]);
            account_transfer_delete($d,'hr_employees',['id'=>$sid]);
            account_transfer_history($d,array_replace($targetEmployee,['profile'=>hr_json($profile),'revision'=>$revision]),$tid,'accountTransfer');
        }elseif($sourceEmployee)account_transfer_update($d,'hr_employees',['user_id'=>$to,'revision'=>(int)$sourceEmployee['revision']+1],['id'=>$sourceEmployee['id']]);
        $paid=[];foreach($backup['tables']['daily_grade_receipts'] as $row)if((int)$row['employee_id']===$to)$paid[$row['performance_date'].':'.$row['milestone']]=$row;
        foreach($backup['tables']['daily_grade_receipts'] as $row)if((int)$row['employee_id']===$from){$key=$row['performance_date'].':'.$row['milestone'];if(isset($paid[$key])){
            $existing=$paid[$key];account_transfer_update($d,'daily_grade_receipts',['amount'=>max((int)$row['amount'],(int)$existing['amount']),'confirmed_at'=>min($row['confirmed_at'],$existing['confirmed_at'])],['employee_id'=>$to,'performance_date'=>$row['performance_date'],'milestone'=>$row['milestone']]);
            account_transfer_delete($d,'daily_grade_receipts',['employee_id'=>$from,'performance_date'=>$row['performance_date'],'milestone'=>$row['milestone']]);
        }}
        account_transfer_delete($d,'test_employee_data',['user_id'=>$from]);
        foreach(account_transfer_user_columns() as $table=>$columns)foreach($columns as $column){
            if(in_array($table,['employee_checkins','test_employee_data','hr_employees'],true)||($table==='employee_checkin_approvals'&&$column==='user_id')||($table==='employee_memberships'&&$column==='user_id'))continue;
            $q=$d->prepare('UPDATE '.$table.' SET '.$column.'=?'.($table==='sales_records'?',revision=revision+1':'').' WHERE '.$column.'=?');$q->execute([$to,$from]);
        }
        foreach(account_transfer_user_columns() as $table=>$columns)foreach($columns as $column){$q=$d->prepare('SELECT COUNT(*) FROM '.$table.' WHERE '.$column.'=?');$q->execute([$from]);account_transfer_assert((int)$q->fetchColumn()===0,'remaining_reference');}
        $q=$d->prepare('SELECT COUNT(*) FROM sales_records WHERE employee_id=?');$q->execute([$to]);account_transfer_assert((int)$q->fetchColumn()===count($sales),'receipt_count_mismatch');
        $q=$d->prepare('SELECT * FROM app_users WHERE id=?');$q->execute([$to]);account_transfer_assert($q->fetch()===$target,'target_login_changed');
        account_transfer_delete($d,'app_users',['id'=>$from,'username'=>'lee001']);
        $q=$d->prepare('SELECT COUNT(*) FROM app_users WHERE id=? OR username=?');$q->execute([$from,'lee001']);account_transfer_assert((int)$q->fetchColumn()===0,'source_delete_failed');
        $manifest=['state'=>'complete','sourceId'=>$from,'targetId'=>$to,'sourceUsername'=>'lee001','targetUsername'=>'lsh','movedReceipts'=>count(array_filter($sales,fn($row)=>(int)$row['employee_id']===$from)),'targetReceipts'=>count($sales),'backup'=>$path,'completedAt'=>gmdate('c')];
        account_transfer_insert($d,'test_fixture_batches',['batch'=>account_transfer_batch(),'manifest'=>hr_json($manifest)]);$d->commit();return ['alreadyApplied'=>false]+$manifest;
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
