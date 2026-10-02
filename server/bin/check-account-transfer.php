<?php
// Isolated SQLite only: no live credentials, accounts or receipts are loaded by this gate.
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/account-transfer.php';require __DIR__.'/../lib/sales-performance.php';
class AccountTransferFixtureDB extends PDO {
    public function prepare(string $query,array $options=[]): PDOStatement|false {return parent::prepare(str_replace(' FOR UPDATE','',$query),$options);}
}
function db(): PDO {return $GLOBALS['accountTransferDB'];}
function transfer_check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
function transfer_fixture(): PDO {
    $d=new AccountTransferFixtureDB('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);$GLOBALS['accountTransferDB']=$d;
    $d->exec("PRAGMA foreign_keys=ON;
CREATE TABLE app_users(id INTEGER PRIMARY KEY,username TEXT UNIQUE,display_name TEXT,password_hash TEXT,role TEXT,department TEXT,active INTEGER,created_at TEXT);
CREATE TABLE hr_employees(id INTEGER PRIMARY KEY,employee_no TEXT UNIQUE,user_id INTEGER UNIQUE REFERENCES app_users(id),profile TEXT,revision INTEGER,created_at TEXT);
CREATE TABLE employee_checkins(user_id INTEGER REFERENCES app_users(id),work_date TEXT,check_in_at TEXT,created_at TEXT,PRIMARY KEY(user_id,work_date));
CREATE TABLE employee_checkin_approvals(user_id INTEGER,work_date TEXT,actor_id INTEGER REFERENCES app_users(id),approval_mode TEXT,recorded_check_in_at TEXT,approved_at TEXT,PRIMARY KEY(user_id,work_date),FOREIGN KEY(user_id,work_date) REFERENCES employee_checkins(user_id,work_date));
CREATE TABLE employee_memberships(user_id INTEGER PRIMARY KEY REFERENCES app_users(id),status TEXT,phone TEXT,revision INTEGER,approved_by INTEGER REFERENCES app_users(id),approved_at TEXT,profile_completed INTEGER,profile_completed_at TEXT,created_at TEXT);
CREATE TABLE test_employee_data(user_id INTEGER PRIMARY KEY REFERENCES app_users(id),state TEXT,revision INTEGER);
CREATE TABLE sales_records(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES app_users(id),department TEXT,first_date TEXT,customer_name TEXT,phone TEXT,status TEXT,is_test INTEGER,revision INTEGER);
CREATE TABLE daily_grade_receipts(employee_id INTEGER REFERENCES app_users(id),performance_date TEXT,milestone INTEGER,amount INTEGER,department TEXT,confirmed_at TEXT,PRIMARY KEY(employee_id,performance_date,milestone));
CREATE TABLE hr_payroll(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES hr_employees(id),month TEXT,status TEXT,revision INTEGER,calculation TEXT,published_snapshot TEXT,UNIQUE(employee_id,month));
CREATE TABLE hr_contracts(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES hr_employees(id),recipient_user_id INTEGER REFERENCES app_users(id),version INTEGER,revision INTEGER,status TEXT,terms TEXT,issued_snapshot TEXT,content_hash TEXT,created_by INTEGER REFERENCES app_users(id),received_by INTEGER REFERENCES app_users(id),UNIQUE(employee_id,version));
CREATE TABLE hr_personnel_events(id INTEGER PRIMARY KEY AUTOINCREMENT,employee_id INTEGER REFERENCES hr_employees(id),actor_id INTEGER REFERENCES app_users(id),event TEXT,revision INTEGER,snapshot TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE test_fixture_batches(batch TEXT PRIMARY KEY,manifest TEXT);");
    $existing=$d->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
    foreach(account_transfer_user_columns() as $table=>$columns)if(!in_array($table,$existing,true)){
        $definition=['id INTEGER PRIMARY KEY AUTOINCREMENT'];foreach($columns as $column)$definition[]=$column.' INTEGER REFERENCES app_users(id)';
        foreach(['sales_events'=>['sale_id','sales_records'],'hr_payroll_events'=>['payroll_id','hr_payroll'],'hr_contract_events'=>['contract_id','hr_contracts'],'hr_contract_approvals'=>['contract_id','hr_contracts']] as $name=>[$column,$parent])if($table===$name)$definition[]=$column.' INTEGER REFERENCES '.$parent.'(id)';
        if($table==='intake_management_events')$definition[]='record_key TEXT';$definition[]='payload TEXT';$d->exec('CREATE TABLE '.$table.' ('.implode(',',$definition).')');
    }
    foreach(['sales_consultation_details','sales_receipt_details','sales_birth_details','sales_counselor_details'] as $table)$d->exec('CREATE TABLE '.$table.' (sale_id INTEGER PRIMARY KEY REFERENCES sales_records(id),payload TEXT)');
    $d->exec("INSERT INTO app_users VALUES(1,'admin','관리자','admin-hash','admin','insurance',1,'2026-09-01 00:00:00'),(2,'lee001','이전 직원','source-hash','employee','insurance',1,'2026-09-01 00:00:00'),(3,'lsh','대상 직원','target-hash','employee','insurance',1,'2026-09-30 00:00:00'),(4,'other','다른 직원','other-hash','employee','insurance',1,'2026-09-01 00:00:00');
INSERT INTO hr_employees VALUES(10,'CNC-S',2,'{\"name\":\"이전 직원\",\"bank\":\"은행 정보\"}',7,'2026-09-01'),(20,'CNC-T',3,'{\"name\":\"대상 직원\",\"email\":\"fixture@example.invalid\"}',2,'2026-09-30'),(30,'CNC-O',4,'{}',1,'2026-09-01');
INSERT INTO employee_checkins VALUES(2,'2026-10-01','2026-10-01 01:00:00','2026-10-01 01:00:00'),(3,'2026-10-01','2026-10-01 02:00:00','2026-10-01 02:00:00'),(2,'2026-09-30','2026-09-30 01:00:00','2026-09-30 01:00:00');
INSERT INTO employee_checkin_approvals VALUES(2,'2026-10-01',1,'individual','2026-10-01 01:00:00','2026-10-01 01:30:00');
INSERT INTO employee_memberships VALUES(2,'approved','010-0000-0000',3,1,'2026-09-01',1,'2026-09-01','2026-09-01'),(3,'approved','',1,1,'2026-09-30',0,NULL,'2026-09-30');
INSERT INTO sales_records VALUES(101,2,'insurance','2026-09-01','중복 고객','010-1234-5678','normal',0,3),(102,3,'insurance','2026-10-01','중복 고객(중복접수)','01012345678','normal',0,2),(103,2,'insurance','2026-10-01','대기 고객','010-1234-5555','pending',0,1),(104,4,'insurance','2026-10-01','다른 고객','010-1234-6666','normal',0,1),(105,2,'insurance','2026-10-01','다른 정상 고객','010-1234-7777','normal',0,1),(106,2,'insurance','2026-10-01','AS 고객','010-1234-8888','as',0,1);
INSERT INTO daily_grade_receipts VALUES(2,'2026-09-01',6,5000,'insurance','2026-09-01 02:00:00'),(3,'2026-09-01',6,5000,'insurance','2026-09-01 03:00:00');
INSERT INTO hr_payroll VALUES(11,10,'2026-09','confirmed',2,'{\"net\":10000}','{\"immutable\":true}'),(12,20,'2026-10','draft',1,'{\"net\":0}',NULL);
INSERT INTO hr_contracts VALUES(11,10,2,1,2,'received','{\"contract\":\"source terms\"}','{\"version\":1,\"signed\":true}','original-contract-hash',1,2),(12,20,3,1,1,'issued','{\"contract\":\"target terms\"}','{\"version\":1}','target-contract-hash',1,NULL);
INSERT INTO hr_personnel_events(employee_id,actor_id,event,revision,snapshot) VALUES(10,2,'profile',7,'{\"profile\":{\"name\":\"이전 직원\"}}');
");
    foreach(account_transfer_user_columns() as $table=>$columns)if(!in_array($table,$existing,true)){
        $row=array_fill_keys($columns,2);$row['payload']='original audit payload';if($table==='sales_events')$row['sale_id']=101;if($table==='hr_payroll_events')$row['payroll_id']=11;if(in_array($table,['hr_contract_events','hr_contract_approvals'],true))$row['contract_id']=11;if($table==='intake_management_events')$row['record_key']='101';account_transfer_insert($d,$table,$row);
    }
    foreach(['sales_consultation_details','sales_receipt_details','sales_birth_details','sales_counselor_details'] as $table)account_transfer_insert($d,$table,['sale_id'=>101,'payload'=>'preserve original receipt detail']);
    return $d;
}
function transfer_snapshot(PDO $d): array {$out=[];foreach($d->query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN) as $table)$out[$table]=$d->query('SELECT * FROM '.$table.' ORDER BY rowid')->fetchAll();return $out;}
function transfer_remove(string $directory): void {foreach(glob($directory.'/*')?:[] as $path){if(is_dir($path))transfer_remove($path);else unlink($path);}if(is_dir($directory))rmdir($directory);}
$root=sys_get_temp_dir().'/cnc-account-transfer-'.bin2hex(random_bytes(6));mkdir($root,0700);
try{
    $base=['id'=>1,'employee_id'=>2,'department'=>'insurance','first_date'=>'2026-09-01','customer_name'=>'검증 고객','phone'=>'010-1234-5678','status'=>'pending','is_test'=>0];
    $unique=sales_performance_unique([$base,array_replace($base,['id'=>2,'status'=>'normal']),array_replace($base,['id'=>3,'employee_id'=>3,'status'=>'normal','customer_name'=>'검증 고객(중복접수)','phone'=>'01012345678']),array_replace($base,['id'=>4,'status'=>'as']),array_replace($base,['id'=>5,'status'=>'normal','customer_name'=>'다른 고객']),array_replace($base,['id'=>6,'status'=>'normal','phone'=>'010-9999-9999'])]);
    transfer_check(array_column($unique,'id')===[2,5,6],'only normal duplicates with both matching fields collapse, including cross-employee duplicates');
    $d=transfer_fixture();$before=transfer_snapshot($d);$result=account_transfer_lee001_lsh($root.'/success');$after=transfer_snapshot($d);
    transfer_check($result['state']==='complete'&&$result['movedReceipts']===4&&$result['targetReceipts']===5,'all source receipt statuses transfer without dropping existing target records');
    transfer_check($d->query("SELECT COUNT(*) FROM app_users WHERE username='lee001'")->fetchColumn()===0,'source account is deleted');
    transfer_check($d->query("SELECT * FROM app_users WHERE username='lsh'")->fetch()===$before['app_users'][2],'target login identity and password are unchanged');
    transfer_check($d->query('SELECT * FROM sales_records WHERE id=104')->fetch()===$before['sales_records'][3],'unrelated employee data is unchanged');
    foreach(['sales_consultation_details','sales_receipt_details','sales_birth_details','sales_counselor_details'] as $table)transfer_check($before[$table]===$after[$table],'receipt child content is preserved: '.$table);
    transfer_check(count($after['hr_contracts'])===2&&$after['hr_contracts'][0]['employee_id']===20&&$after['hr_contracts'][0]['recipient_user_id']===3&&$after['hr_contracts'][0]['version']===2,'both contract versions are accessible from destination');
    foreach(['terms','issued_snapshot','content_hash'] as $key)transfer_check($after['hr_contracts'][0][$key]===$before['hr_contracts'][0][$key],'issued contract contents and hashes remain unchanged');
    transfer_check($after['hr_payroll'][0]['employee_id']===20&&$after['hr_payroll'][0]['published_snapshot']===$before['hr_payroll'][0]['published_snapshot'],'published payroll snapshot transfers intact');
    transfer_check((int)$d->query('SELECT SUM(amount) FROM daily_grade_receipts WHERE employee_id=3')->fetchColumn()===5000,'same-day same-milestone payment is not added twice');
    transfer_check(sales_performance_counts(3,'insurance',false,'2026-09-01','2026-10-02')===['2026-09-01'=>1,'2026-10-01'=>1],'performance uses unique normal receipts across months; pending and AS earn nothing');
    transfer_check($d->query("SELECT check_in_at FROM employee_checkins WHERE user_id=3 AND work_date='2026-10-01'")->fetchColumn()==='2026-10-01 01:00:00','merged attendance uses the first arrival');
    transfer_check((fileperms($result['backup'])&0777)===0600&&count(json_decode(file_get_contents($result['backup']),true)['tables']['sales_records'])===5,'verified private backup preserves all source and target receipts');
    $again=account_transfer_lee001_lsh($root.'/success');transfer_check($again['alreadyApplied']&&transfer_snapshot($d)===$after,'later deployments do not repeat the merge');

    $d=transfer_fixture();$d->exec("CREATE TRIGGER deny_transfer BEFORE DELETE ON app_users WHEN OLD.id=2 BEGIN SELECT RAISE(ABORT,'fixture delete failure'); END");$before=transfer_snapshot($d);$failed=false;
    try{account_transfer_lee001_lsh($root.'/rollback');}catch(PDOException $e){$failed=true;}transfer_check($failed&&transfer_snapshot($d)===$before&&!$d->inTransaction(),'delete failure rolls back every moved row and payment');
    $d=transfer_fixture();$d->exec("UPDATE hr_payroll SET month='2026-09' WHERE id=12");$before=transfer_snapshot($d);$failed=false;
    try{account_transfer_lee001_lsh($root.'/conflict');}catch(RuntimeException $e){$failed=$e->getMessage()==='payroll_conflict';}transfer_check($failed&&transfer_snapshot($d)===$before,'overlapping monthly payroll never produces double payments or silent deletion');
    $d=transfer_fixture();$d->exec("CREATE TABLE unexpected_owner(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES app_users(id));INSERT INTO unexpected_owner VALUES(1,2)");$before=transfer_snapshot($d);$failed=false;
    try{account_transfer_lee001_lsh($root.'/unknown');}catch(RuntimeException $e){$failed=$e->getMessage()==='unsupported_schema';}transfer_check($failed&&transfer_snapshot($d)===$before,'unknown ownership dependencies stop before mutation');
    $d=transfer_fixture();$d->exec("UPDATE app_users SET created_at='2026-10-03 00:00:00' WHERE id=2");$before=transfer_snapshot($d);$failed=false;
    try{account_transfer_lee001_lsh($root.'/future');}catch(RuntimeException $e){$failed=$e->getMessage()==='account_mismatch';}transfer_check($failed&&transfer_snapshot($d)===$before,'a future reused username is outside this request');
    echo "PASS: full account transfer, contract integrity, retained credentials, normal-only unique performance, duplicate payment prevention, backup, atomic rollback, schema guard and one-time execution.\n";
}finally{transfer_remove($root);}
