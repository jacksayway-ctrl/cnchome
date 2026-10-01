<?php
// Isolated SQLite fixtures only. This gate never reads production data or credentials.
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/user1-cleanup.php';
class User1CleanupTestDB extends PDO {
    public function prepare(string $query,array $options=[]): PDOStatement|false { return parent::prepare(str_replace(' FOR UPDATE','',$query),$options); }
}
function db(): PDO { return $GLOBALS['user1CleanupTestDB']; }
function cleanup_check(bool $condition,string $message): void { if(!$condition)throw new RuntimeException($message); }
function cleanup_fixture(): PDO {
    $d=new User1CleanupTestDB('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);$GLOBALS['user1CleanupTestDB']=$d;
    $d->exec("PRAGMA foreign_keys=ON;
CREATE TABLE app_users(id INTEGER PRIMARY KEY,username TEXT UNIQUE,display_name TEXT,role TEXT,password_hash TEXT);
CREATE TABLE hr_employees(id INTEGER PRIMARY KEY,user_id INTEGER UNIQUE REFERENCES app_users(id),profile TEXT,revision INTEGER);
CREATE TABLE sales_records(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES app_users(id),first_date TEXT,customer_name TEXT,phone TEXT,note TEXT,status TEXT,is_test INTEGER,revision INTEGER);
CREATE TABLE sales_events(id INTEGER PRIMARY KEY,sale_id INTEGER REFERENCES sales_records(id),actor_id INTEGER REFERENCES app_users(id),old_status TEXT,new_status TEXT);
CREATE TABLE sales_consultation_details(sale_id INTEGER PRIMARY KEY REFERENCES sales_records(id),consultation_time TEXT,consultation_place TEXT,premium_band TEXT);
CREATE TABLE sales_receipt_details(sale_id INTEGER PRIMARY KEY REFERENCES sales_records(id),gender TEXT,call_availability TEXT,visit_schedule TEXT,created_at TEXT);
CREATE TABLE sales_birth_details(sale_id INTEGER PRIMARY KEY REFERENCES sales_records(id),birth_date TEXT);
CREATE TABLE sales_counselor_details(sale_id INTEGER PRIMARY KEY REFERENCES sales_records(id),counselor_name TEXT);
CREATE TABLE intake_management_events(id INTEGER PRIMARY KEY,record_key TEXT,actor_id INTEGER REFERENCES app_users(id),action TEXT,before_data TEXT,after_data TEXT,reason TEXT);
CREATE TABLE test_employee_data(user_id INTEGER PRIMARY KEY REFERENCES app_users(id),state TEXT,revision INTEGER);
CREATE TABLE daily_grade_receipts(employee_id INTEGER REFERENCES app_users(id),performance_date TEXT,milestone INTEGER,amount INTEGER,PRIMARY KEY(employee_id,performance_date,milestone));
CREATE TABLE hr_payroll(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES hr_employees(id),month TEXT,status TEXT,revision INTEGER,calculation TEXT,published_snapshot TEXT);
CREATE TABLE hr_payroll_events(id INTEGER PRIMARY KEY,payroll_id INTEGER REFERENCES hr_payroll(id),actor_id INTEGER REFERENCES app_users(id),event TEXT,note TEXT,snapshot TEXT);
CREATE TABLE employee_checkins(user_id INTEGER REFERENCES app_users(id),work_date TEXT,check_in_at TEXT,PRIMARY KEY(user_id,work_date));
CREATE TABLE employee_checkin_approvals(user_id INTEGER,work_date TEXT,actor_id INTEGER REFERENCES app_users(id),approval_mode TEXT,FOREIGN KEY(user_id,work_date) REFERENCES employee_checkins(user_id,work_date));
CREATE TABLE employee_memberships(user_id INTEGER PRIMARY KEY REFERENCES app_users(id),status TEXT,profile_completed INTEGER);
CREATE TABLE hr_contracts(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES hr_employees(id),terms TEXT);
CREATE TABLE intake_policy_state(id INTEGER PRIMARY KEY,state TEXT);
CREATE TABLE test_fixture_batches(batch TEXT PRIMARY KEY,manifest TEXT);
INSERT INTO app_users VALUES(1,'admin','관리자','admin','fixture-private-hash'),(2,'user1','테스트 직원','employee','fixture-private-hash'),(3,'other','다른 직원','employee','fixture-private-hash');
INSERT INTO hr_employees VALUES(1,2,'{\"name\":\"테스트 직원\",\"bank\":\"그대로 보존\"}',8),(2,3,'{\"name\":\"다른 직원\"}',3);
INSERT INTO sales_records VALUES(16,2,'2026-09-30','보존 가상 고객','010-0000-0016','메모 원문 보존','pending',0,9),(17,2,'2026-09-30','보존 테스트 고객','010-0000-0017','다른 상태도 보존','as',1,2),(18,2,'2026-09-29','삭제 검증 고객','010-0000-0018','이전 날짜','normal',0,2),(19,2,'2026-10-01','삭제 검증 고객','010-0000-0019','다음 날짜','pending',1,1),(20,3,'2026-10-01','다른 직원 검증 고객','010-0000-0020','타 계정 보존','pending',0,1);
INSERT INTO daily_grade_receipts VALUES(2,'2026-09-30',6,2000),(2,'2026-10-01',6,2000),(3,'2026-09-30',6,2000);
INSERT INTO employee_checkins VALUES(2,'2026-09-30','2026-09-30 10:00:00'),(2,'2026-10-01','2026-10-01 10:00:00'),(3,'2026-10-01','2026-10-01 10:00:00');
INSERT INTO employee_checkin_approvals VALUES(2,'2026-09-30',1,'manual');
INSERT INTO employee_memberships VALUES(2,'approved',1),(3,'approved',1);
INSERT INTO hr_contracts VALUES(1,1,'계약 원문 보존'),(2,2,'타 계약 원문 보존');
INSERT INTO intake_policy_state VALUES(1,'{\"shared\":true}');
INSERT INTO test_fixture_batches VALUES('old-seed','{\"preserve\":true}');");
    foreach([16,17,18,19,20] as $id){
        $d->prepare('INSERT INTO sales_events VALUES(?,?,?,?,?)')->execute([$id,$id,2,'pending','normal']);
        $d->prepare('INSERT INTO sales_consultation_details VALUES(?,?,?,?)')->execute([$id,'14:00','가상 상담 장소','100000']);
        $d->prepare('INSERT INTO sales_receipt_details VALUES(?,?,?,?,?)')->execute([$id,'여','오후 2~3시','주민센터','2026-10-01 01:02:03.000000']);
        $d->prepare('INSERT INTO sales_birth_details VALUES(?,?)')->execute([$id,'1970-01-02']);
        $d->prepare('INSERT INTO sales_counselor_details VALUES(?,?)')->execute([$id,'상담원 원문']);
    }
    foreach(['16','18','20','test:2:1','test:2:2','test:2:999','test:3:2'] as $index=>$key)$d->prepare('INSERT INTO intake_management_events VALUES(?,?,?,?,?,?,?)')->execute([$index+1,$key,2,'recall','{"status":"pending"}','{"note":"이력 원문 보존"}','검증 이력']);
    $state=['sales'=>[['id'=>1,'date'=>'2026-09-30','name'=>'보존 가상 자료','status'=>'정상','note'=>'메모 그대로','nested'=>['keep'=>true]],['id'=>2,'date'=>'2026-09-29','name'=>'삭제 가상 자료','status'=>'가접수'],['id'=>3,'date'=>'2026-09-30','name'=>'보존 가상 자료 2','status'=>'A/S']],'attendance'=>[['date'=>'2026-09-30','in'=>'10:00','out'=>'17:00','status'=>'정상'],['date'=>'2026-10-01','in'=>'10:00','out'=>'17:00','fixture'=>'test-full-attendance-grade-20260930-v3']],'fixtures'=>['old-seed'=>['createdAt'=>'2026-09-29','salesIds'=>[1,2,3]]],'unrelated'=>['keep'=>true]];
    $d->prepare('INSERT INTO test_employee_data VALUES(2,?,7)')->execute([hr_json($state)]);
    $d->prepare('INSERT INTO test_employee_data VALUES(3,?,4)')->execute([hr_json($state)]);
    foreach([[1,1,'2026-09','published','[테스트] 현재 정상 접수와 만근시간·그레이드를 반영한 가상 급여. 실제 지급 대상 아님.'],[2,1,'2026-08','confirmed','실제 급여 정산'],[3,2,'2026-09','published','기능 테스트용 가상 급여 · 실제 지급 대상 아님'],[4,1,'2026-07','draft','관리자가 수정한 현재 급여'],[5,1,'2026-06','confirmed','테스트 항목 확인 후 실제 지급']] as [$id,$eid,$month,$status,$note]){
        $d->prepare('INSERT INTO hr_payroll VALUES(?,?,?,?,?,?,?)')->execute([$id,$eid,$month,$status,4,hr_json(['note'=>$note,'net'=>12345]),hr_json(['note'=>'원문 보존'])]);
        // An old synthetic audit note must not classify a currently real or ambiguous statement.
        $d->prepare('INSERT INTO hr_payroll_events VALUES(?,?,?,?,?,?)')->execute([$id,$id,2,'savePayroll','[테스트] 가상 지급 이력 · 실제 지급 대상 아님',hr_json(['note'=>'가상 기록'])]);
    }
    return $d;
}
function cleanup_database_snapshot(PDO $d): array {
    $snapshot=[];foreach($d->query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN) as $table)$snapshot[$table]=$d->query('SELECT * FROM '.$table.' ORDER BY rowid')->fetchAll();return $snapshot;
}
function cleanup_remove_tree(string $directory): void {foreach(glob($directory.'/*')?:[] as $path){if(is_dir($path))cleanup_remove_tree($path);else unlink($path);}if(is_dir($directory))rmdir($directory);}
$root=sys_get_temp_dir().'/cnchome-user1-cleanup-'.bin2hex(random_bytes(6));mkdir($root,0700);
try{
    cleanup_check(user1_cleanup_json_value(['b'=>2,'a'=>['z'=>1,'m'=>3]])===user1_cleanup_json_value(['a'=>['m'=>3,'z'=>1],'b'=>2])&&user1_cleanup_json_value([2,1])!==user1_cleanup_json_value([1,2]),'JSON verification accepts MySQL object-key ordering while preserving list ordering');
    $d=cleanup_fixture();$before=cleanup_database_snapshot($d);cleanup_check(!test_account_cleanup_protected(2),'missing completion marker does not disable sample generation');$result=cleanup_user1($root.'/success');
    cleanup_check($result['state']==='complete'&&!$result['alreadyApplied']&&$result['userId']===2&&$result['employeeId']===1&&$result['preservedDate']==='2026-09-30','completion identifies the exact authorized account and date');
    cleanup_check(test_account_cleanup_protected(2)&&!test_account_cleanup_protected(1)&&!test_account_cleanup_protected(3),'completed cleanup prevents user1 sample regeneration without protecting other accounts');
    cleanup_check($result['kept']===['native'=>2,'legacy'=>2,'payroll'=>3,'nativeAttendance'=>2]&&$result['deleted']===['native'=>2,'legacy'=>1,'intakeEvents'=>2,'payroll'=>1,'payrollEvents'=>1,'demoAttendance'=>2,'dailyGrade'=>2],'manifest reports exact preservation and deletion scope');
    $backupText=file_get_contents($result['backup']);$backup=json_decode($backupText,true,512,JSON_THROW_ON_ERROR);
    cleanup_check((fileperms(dirname($result['backup']))&0777)===0700&&(fileperms($result['backup'])&0777)===0600&&!str_contains($backupText,'fixture-private-hash'),'backup directory and file are private and never include authentication secrets');
    cleanup_check($backup['keptReceipts']['sales_records']===array_values(array_filter($before['sales_records'],fn($r)=>in_array($r['id'],[16,17],true)))&&count($backup['deletedReceipts']['sales_counselor_details'])===2&&count($backup['hr_payroll_events'])===1&&$backup['test_employee_data']['state']===$before['test_employee_data'][0]['state'],'backup includes removed rows and unmodified preserved receipt snapshots');
    $after=cleanup_database_snapshot($d);
    foreach(['app_users','hr_employees','employee_memberships','employee_checkins','employee_checkin_approvals','hr_contracts','intake_policy_state'] as $table)cleanup_check($after[$table]===$before[$table],$table.' remains byte-equivalent');
    foreach(['sales_records','sales_events','sales_consultation_details','sales_receipt_details','sales_birth_details','sales_counselor_details'] as $table){$key=$table==='sales_records'?'id':'sale_id';cleanup_check($after[$table]===array_values(array_filter($before[$table],fn($row)=>!in_array($row[$key],[18,19],true))),$table.' keeps every retained child, memo and other account row');}
    cleanup_check($after['intake_management_events']===array_values(array_filter($before['intake_management_events'],fn($r)=>!in_array($r['record_key'],['18','test:2:2'],true))),'only deleted receipt keys lose events; cross-account authorship and orphan keys remain untouched');
    cleanup_check($after['test_employee_data'][1]===$before['test_employee_data'][1]&&$after['daily_grade_receipts']===[$before['daily_grade_receipts'][2]],'other account legacy and daily grade records remain unchanged');
    $oldState=json_decode($before['test_employee_data'][0]['state'],true);$newState=json_decode($after['test_employee_data'][0]['state'],true);$expected=$oldState;$expected['sales']=[$oldState['sales'][0],$oldState['sales'][2]];$expected['attendance']=[];
    cleanup_check($newState===$expected&&$after['test_employee_data'][0]['revision']===8,'state row, retained receipt objects, fixture markers and unrelated values survive revision increment');
    cleanup_check($after['hr_payroll']===array_values(array_filter($before['hr_payroll'],fn($r)=>$r['id']!==1))&&$after['hr_payroll_events']===array_values(array_filter($before['hr_payroll_events'],fn($r)=>$r['payroll_id']!==1)),'only identifiable current synthetic payroll and its children are deleted');
    $d->exec("INSERT INTO sales_records VALUES(21,2,'2026-10-02','향후 실제 자료','010-0000-0021','다음 배포에도 보존','pending',0,1);INSERT INTO daily_grade_receipts VALUES(2,'2026-10-02',6,2000)");$future=cleanup_database_snapshot($d);$again=cleanup_user1($root.'/success');
    cleanup_check($again['alreadyApplied']&&cleanup_database_snapshot($d)===$future&&count(glob($root.'/success/*.json'))===1,'completed marker makes all later deployments a no-op for future real data');

    $d=cleanup_fixture();$d->exec("UPDATE app_users SET username='renamed' WHERE id=2");$unchanged=cleanup_database_snapshot($d);$suspended=cleanup_user1($root.'/identity');
    cleanup_check($suspended['state']==='suspended'&&$suspended['reason']==='identity_mismatch'&&!is_dir($root.'/identity')&&!$d->inTransaction(),'identity mismatch durably suspends before backup or mutation');
    cleanup_check(!test_account_cleanup_protected(2)&&!test_account_cleanup_protected(3),'suspended cleanup cannot be mistaken for completed sample-generation protection');
    $after=cleanup_database_snapshot($d);unset($unchanged['test_fixture_batches'],$after['test_fixture_batches']);cleanup_check($after===$unchanged,'suspended cleanup changes no account data');
    $d->exec("UPDATE app_users SET username='user1' WHERE id=2");$later=cleanup_database_snapshot($d);cleanup_check(cleanup_user1($root.'/identity')['state']==='suspended'&&cleanup_database_snapshot($d)===$later,'later matching identity never receives the suspended cleanup request');
    $d=cleanup_fixture();$d->exec("UPDATE sales_records SET first_date='2026-09-29' WHERE id=16");cleanup_check(cleanup_user1($root.'/missing')['reason']==='verified_receipt_missing','verified preserved receipt must still belong to the requested date');
    $d=cleanup_fixture();$d->prepare('INSERT INTO test_fixture_batches VALUES(?,?)')->execute([user1_cleanup_batch(),hr_json(['state'=>'complete','username'=>'user1','userId'=>3,'employeeId'=>1,'preservedDate'=>'2026-09-30','completedAt'=>'2026-10-01T00:00:00Z'])]);$before=cleanup_database_snapshot($d);$failed=false;
    try{cleanup_user1($root.'/invalid-marker');}catch(RuntimeException $e){$failed=true;}
    cleanup_check($failed&&!$d->inTransaction()&&cleanup_database_snapshot($d)===$before&&!is_dir($root.'/invalid-marker'),'invalid completion identity fails instead of reporting a successful cleanup');
    cleanup_check(!test_account_cleanup_protected(2),'completion for a different account cannot protect user1');
    foreach([['employeeId'=>2],['preservedDate'=>'2026-09-29'],['username'=>'other'],['completedAt'=>'']] as $invalid){
        $d->prepare('UPDATE test_fixture_batches SET manifest=? WHERE batch=?')->execute([hr_json(array_replace($result,$invalid)),user1_cleanup_batch()]);
        cleanup_check(!test_account_cleanup_protected(2),'sample-generation protection requires the exact completed account, HR identity and preserved date');
    }

    $d=cleanup_fixture();$before=cleanup_database_snapshot($d);$blocked=$root.'/blocked';file_put_contents($blocked,'fixture');$failed=false;
    set_error_handler(function(int $level,string $message): bool {throw new RuntimeException($message);});
    try{cleanup_user1($blocked);}catch(Throwable $e){$failed=true;}finally{restore_error_handler();}
    cleanup_check($failed&&!$d->inTransaction()&&cleanup_database_snapshot($d)===$before,'unavailable private backup aborts every deletion and marker write');
    $d=cleanup_fixture();$before=cleanup_database_snapshot($d);$d->exec("CREATE TRIGGER deny_cleanup BEFORE DELETE ON daily_grade_receipts WHEN OLD.employee_id=2 BEGIN SELECT RAISE(ABORT,'fixture rollback'); END");$failed=false;
    try{cleanup_user1($root.'/rollback');}catch(PDOException $e){$failed=true;}
    cleanup_check($failed&&!$d->inTransaction()&&cleanup_database_snapshot($d)===$before&&count(glob($root.'/rollback/*.json'))===1,'failure after deletions rolls back receipt children, payroll, legacy state and marker while preserving a private backup');
    $d->exec('DROP TRIGGER deny_cleanup');cleanup_check(cleanup_user1($root.'/retry')['state']==='complete','rolled-back cleanup can retry safely after the actual cause is resolved');
}finally{cleanup_remove_tree($root);}
echo "PASS: exact user1 identity, preserved 2026-09-30 receipts and history, scoped sample cleanup, private complete backup, transactional rollback and future-data protection.\n";
