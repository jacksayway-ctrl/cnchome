<?php
// Synthetic, in-memory database verifies one-time fixtures and their financial records.
declare(strict_types=1);
require_once __DIR__.'/../lib/test-staff-fixtures.php';
require_once __DIR__.'/../lib/test-normal-fixtures.php';
require_once __DIR__.'/../lib/test-inspection-fixtures.php';
class FixtureDB extends PDO {
 public function prepare(string $sql,array $options=[]): PDOStatement|false{return parent::prepare(str_replace(' FOR UPDATE','',$sql),$options);}
}
function db(): PDO {static $d;if(!$d){$d=new FixtureDB('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);$d->sqliteCreateFunction('UTC_TIMESTAMP',fn($p=0)=>gmdate('Y-m-d H:i:s'));}return $d;}
function fixture_check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
$d=db();$d->exec("PRAGMA foreign_keys=ON;
CREATE TABLE app_users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE,display_name TEXT,password_hash TEXT,role TEXT,department TEXT,active INTEGER DEFAULT 1);
CREATE TABLE hr_employees(id INTEGER PRIMARY KEY AUTOINCREMENT,employee_no TEXT UNIQUE,user_id INTEGER REFERENCES app_users(id),profile TEXT,revision INTEGER DEFAULT 1);
CREATE TABLE test_employee_data(user_id INTEGER PRIMARY KEY REFERENCES app_users(id),state TEXT,revision INTEGER DEFAULT 1);
CREATE TABLE test_fixture_batches(batch TEXT PRIMARY KEY,manifest TEXT);
CREATE TABLE business_calendar(month TEXT PRIMARY KEY,days TEXT);CREATE TABLE grade_versions(id INTEGER PRIMARY KEY AUTOINCREMENT,department TEXT,effective_date TEXT,saved_at TEXT DEFAULT CURRENT_TIMESTAMP,policy TEXT);
CREATE TABLE daily_grade_receipts(employee_id INTEGER REFERENCES app_users(id),performance_date TEXT,milestone INTEGER,amount INTEGER,department TEXT,confirmed_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(employee_id,performance_date,milestone));
CREATE TABLE sales_records(id INTEGER PRIMARY KEY,employee_id INTEGER,department TEXT,is_test INTEGER,first_date TEXT,status TEXT);
CREATE TABLE hr_payroll(id INTEGER PRIMARY KEY AUTOINCREMENT,employee_id INTEGER REFERENCES hr_employees(id),month TEXT,status TEXT DEFAULT 'draft',calculation TEXT,published_snapshot TEXT,published_at TEXT,confirmed_at TEXT,revision INTEGER DEFAULT 1,UNIQUE(employee_id,month));
CREATE TABLE hr_payroll_events(id INTEGER PRIMARY KEY AUTOINCREMENT,payroll_id INTEGER REFERENCES hr_payroll(id),actor_id INTEGER REFERENCES app_users(id),event TEXT,note TEXT,snapshot TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE hr_contracts(id INTEGER PRIMARY KEY AUTOINCREMENT,employee_id INTEGER REFERENCES hr_employees(id),recipient_user_id INTEGER REFERENCES app_users(id),version INTEGER,revision INTEGER DEFAULT 1,status TEXT DEFAULT 'draft',terms TEXT,issued_snapshot TEXT,content_hash TEXT,created_by INTEGER REFERENCES app_users(id),received_by INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP,issued_at TEXT,received_at TEXT,UNIQUE(employee_id,version));
CREATE TABLE hr_contract_events(id INTEGER PRIMARY KEY AUTOINCREMENT,contract_id INTEGER REFERENCES hr_contracts(id),actor_id INTEGER REFERENCES app_users(id),event TEXT,snapshot TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE hr_contract_approvals(contract_id INTEGER PRIMARY KEY,state TEXT,actor_id INTEGER,reason TEXT,updated_at TEXT);
INSERT INTO app_users(username,display_name,role,department) VALUES('admin','테스트 관리자','admin','insurance');");
$policy=grade_zero_policy();$policy['dailyCash']=['start'=>6,'perCase'=>5000];$policy['weekly'][0]['achievement']=30000;$policy['monthly'][0]['achievement']=40000;
$d->prepare('INSERT INTO grade_versions(department,effective_date,policy) VALUES(?,?,?)')->execute(['insurance','2000-01-01',hr_json($policy)]);
$result=seed_five_test_staff();fixture_check(!$result['existing']&&count($result['manifest'])===5,'exactly five new employees');
foreach($result['manifest'] as $entry){
 $q=$d->prepare('SELECT * FROM app_users WHERE id=?');$q->execute([$entry['userId']]);$user=$q->fetch();fixture_check(cnc_test_user($user)&&password_verify('1234',$user['password_hash']),'test login identity');
 $state=hr_snapshot($user);fixture_check(count($state['employees'])===1&&count($state['payroll'])===1,'employee payroll and profile scope');$c=$state['payroll'][0]['calculation'];
 fixture_check(isset($c['gradeSnapshot'])&&$c['net']===$c['gross']-$c['deductions']-$c['prepaidDaily'],'payroll includes grades less advances');
 $summary=pay_statement_summary($c);fixture_check($c['dailyGradeSettlement']==='cash-auto'&&$summary['daily']===$summary['dailyPaid']&&$summary['daily']===$c['gradeSnapshot']['daily'],'fixture payroll automatically prepays the complete earned daily amount');
 fixture_check($c['net']===$summary['workPay']+$summary['workAdjustment']+$summary['weekly']+$summary['monthly']+$summary['other']-$c['deductions'],'fixture payday net includes hourly pay and weekly/monthly grades, no daily grade');
 $contracts=contract_list($user);fixture_check(count($contracts)===1&&$contracts[0]['id']===$entry['contractId']&&$contracts[0]['issued_snapshot']['formatVersion']===2,'own issued contract only');
 fixture_check(contract_workflow_state($contracts[0])==='pending'&&!$contracts[0]['received_by'],'no fabricated employee approval');
 $input=['action'=>'savePayroll','id'=>$entry['payrollId'],'revision'=>1,'calculation'=>$c];try{hr_mutate($user,$input);throw new RuntimeException('Employee payroll mutation allowed');}catch(HRForbidden $e){}
}
$before=$d->query('SELECT id,published_snapshot,calculation FROM hr_payroll ORDER BY id')->fetchAll();$again=seed_five_test_staff();fixture_check($again['existing']&&$before===$d->query('SELECT id,published_snapshot,calculation FROM hr_payroll ORDER BY id')->fetchAll(),'rerunning preserves all saved statements');
$beforeReceipts=$d->query('SELECT * FROM daily_grade_receipts ORDER BY employee_id,performance_date,milestone')->fetchAll();
$normalBatch=seed_test_normal_range();fixture_check(!$normalBatch['existing']&&count($normalBatch['manifest'])===5,'normal-range fixture only touches recognized test accounts');
foreach($normalBatch['manifest'] as $entry){
 foreach($entry['normalByDate'] as $count)fixture_check($count>=10&&$count<=15,'daily test normal count stays between ten and fifteen');
 $q=$d->prepare('SELECT profile FROM hr_employees WHERE user_id=?');$q->execute([$entry['userId']]);$profile=json_decode($q->fetchColumn(),true);
 $totals=grade_personal_totals(['userId'=>$entry['userId'],'profile'=>$profile],$entry['month']);
 fixture_check($totals['count']===array_sum($entry['normalByDate']),'personal monthly totals use saved synthetic normal counts');
 fixture_check($totals['total']===$totals['workPay']+$totals['daily']+$totals['weekly']+$totals['monthly']&&$totals['payday']===$totals['total']-$totals['daily'],'personal totals include all grades once and exclude daily cash at payday');
 fixture_check($totals['workPay']===(int)floor(array_sum(array_map(fn($part)=>$part['hours']*$part['hourly'],$totals['workDetails']))),'personal pay estimate uses effective grade rates');
 fixture_check($totals['dailyPaid']===$totals['daily']&&$totals['dailyPending']===0,'normal range top-up automatically updates prepaid amount without new receipt rows');
 fixture_check(array_sum(array_column($totals['dailyDetails'],'amount'))===$totals['daily'],'daily breakdown sums to personal total');
}
fixture_check($before===$d->query('SELECT id,published_snapshot,calculation FROM hr_payroll ORDER BY id')->fetchAll()&&$beforeReceipts===$d->query('SELECT * FROM daily_grade_receipts ORDER BY employee_id,performance_date,milestone')->fetchAll(),'sales fixture cannot rewrite payroll or create cash receipts');
fixture_check(seed_test_normal_range()['existing'],'normal-range fixture is idempotent');
// Explicitly requested inspection refresh also fills user1 and updates only synthetic unconfirmed statements.
$user1Profile=$profile;$user1Profile['name']='테스트 직원';$user1Profile['startDate']=hr_today();$user1Profile['contractStart']=hr_today();$user1Profile['workStart']='';$user1Profile['email']='';$user1Profile['contractType']='무기계약';$user1Profile['contractEnd']='';$user1Profile=hr_profile($user1Profile);
$d->exec("INSERT INTO app_users(username,display_name,role,department) VALUES('user1','테스트 직원','employee','insurance')");$user1Id=(int)$d->lastInsertId();
$d->prepare('INSERT INTO hr_employees(employee_no,user_id,profile) VALUES(?,?,?)')->execute(['cncTEST-user1',$user1Id,hr_json($user1Profile)]);$user1Employee=(int)$d->lastInsertId();
$d->prepare('INSERT INTO test_employee_data(user_id,state) VALUES(?,?)')->execute([$user1Id,hr_json(['sales'=>[],'attendance'=>[]])]);
foreach([1,2] as $sid)$d->prepare('INSERT INTO sales_records(id,employee_id,department,is_test,first_date,status) VALUES(?,?,?,?,?,?)')->execute([$sid,$user1Id,'insurance',1,hr_today(),'normal']);
$d->exec("INSERT INTO app_users(username,display_name,role,department) VALUES('real-employee','운영 직원','employee','insurance')");$realId=(int)$d->lastInsertId();
$d->prepare('INSERT INTO hr_employees(employee_no,user_id,profile) VALUES(?,?,?)')->execute(['cncREAL',$realId,hr_json($user1Profile)]);
$d->prepare('UPDATE hr_payroll SET status=? WHERE id=?')->execute(['confirmed',$result['manifest'][0]['payrollId']]);
$d->prepare('UPDATE hr_payroll SET status=? WHERE id=?')->execute(['draft',$result['manifest'][1]['payrollId']]);
$protected=$d->query("SELECT * FROM hr_payroll WHERE status IN ('confirmed','draft') ORDER BY id")->fetchAll();
$contractsBefore=$d->query('SELECT * FROM hr_contracts ORDER BY id')->fetchAll();$rulesBefore=$d->query('SELECT * FROM grade_versions ORDER BY id')->fetchAll();
$refresh=seed_test_inspection_refresh();fixture_check(!$refresh['existing']&&count($refresh['manifest'])===6,'six recognized test accounts receive the explicit refresh');
$user1Entry=array_values(array_filter($refresh['manifest'],fn($entry)=>$entry['userId']===$user1Id))[0];
$q=$d->prepare('SELECT profile FROM hr_employees WHERE user_id=?');$q->execute([$user1Id]);$seededProfile=json_decode($q->fetchColumn(),true);
fixture_check($seededProfile['startDate']===substr(hr_today(),0,7).'-01'&&$seededProfile['workStart']==='10:00'&&$seededProfile['payday']==='15','user1 supports a full demo month with complete personnel defaults');
$q=$d->prepare('SELECT state FROM test_employee_data WHERE user_id=?');$q->execute([$user1Id]);$seededState=json_decode($q->fetchColumn(),true);
foreach($user1Entry['normalByDate'] as $date=>$count){fixture_check($count>=10&&$count<=15,'user1 normal target remains ten to fifteen including new test records');$pending=count(array_filter($seededState['sales'],fn($sale)=>$sale['date']===$date&&$sale['status']==='가접수'));$as=count(array_filter($seededState['sales'],fn($sale)=>$sale['date']===$date&&$sale['status']==='A/S'));fixture_check($pending===2&&$as===1,'pending and A/S examples per working day');}
fixture_check(count($seededState['attendance'])===count($user1Entry['normalByDate']),'attendance covers eligible weekdays');
foreach($seededState['sales'] as $sale)fixture_check(!empty($sale['consultationTime'])&&!empty($sale['consultationPlace'])&&!empty($sale['birthDate'])&&!empty($sale['premiumBand']),'normal intake fields included in synthetic records');
$q=$d->prepare('SELECT calculation FROM hr_payroll WHERE employee_id=?');$q->execute([$user1Employee]);$demoPay=json_decode($q->fetchColumn(),true);
fixture_check($demoPay['dailyGradeSettlement']==='cash-auto'&&$demoPay['gradeSnapshot']['count']===array_sum($user1Entry['normalByDate'])&&$demoPay['prepaidDaily']===$user1Entry['daily'],'new user1 demo statement uses full actual fixture performance and automatic daily prepayment');
fixture_check($protected===$d->query("SELECT * FROM hr_payroll WHERE status IN ('confirmed','draft') ORDER BY id")->fetchAll(),'confirmed and user-editable draft statements remain untouched');
fixture_check($contractsBefore===$d->query('SELECT * FROM hr_contracts ORDER BY id')->fetchAll()&&$rulesBefore===$d->query('SELECT * FROM grade_versions ORDER BY id')->fetchAll(),'contract approvals and shared grade policy remain unchanged');
$q=$d->prepare('SELECT profile FROM hr_employees WHERE user_id=?');$q->execute([$realId]);fixture_check(json_decode($q->fetchColumn(),true)===$user1Profile,'real employee personnel is unchanged');
$q=$d->prepare('SELECT COUNT(*) FROM test_employee_data WHERE user_id=?');$q->execute([$realId]);fixture_check((int)$q->fetchColumn()===0,'no demo data on real account');
$refreshedPay=$d->query('SELECT * FROM hr_payroll ORDER BY id')->fetchAll();fixture_check(seed_test_inspection_refresh()['existing']&&$refreshedPay===$d->query('SELECT * FROM hr_payroll ORDER BY id')->fetchAll(),'repeat deployment never duplicates or recalculates refreshed sample data');
fixture_check($beforeReceipts===$d->query('SELECT * FROM daily_grade_receipts ORDER BY employee_id,performance_date,milestone')->fetchAll(),'automatic fixture refresh needs no fabricated receipt clicks');
$d->prepare('DELETE FROM test_employee_data WHERE user_id=?')->execute([$result['manifest'][0]['userId']]);seed_five_test_staff();fixture_check((int)$d->query('SELECT COUNT(*) FROM test_employee_data')->fetchColumn()===5,'deleted test data never reappears on deployment');
seed_test_normal_range();seed_test_inspection_refresh();fixture_check((int)$d->query('SELECT COUNT(*) FROM test_employee_data')->fetchColumn()===5,'deleted normal-range and refreshed fixtures stay deleted');
echo "PASS: five test employees, scoped accounts/profile/payroll/contracts, no forged approvals, advance net totals and idempotent deletion-preserving fixtures.\n";
