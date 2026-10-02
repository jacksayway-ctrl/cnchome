<?php
// Isolated in-memory database only; no production credentials, records or network access.
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
require __DIR__.'/../lib/pending-intakes.php';
class ReceiptIdentityDB extends PDO {
    public function prepare(string $query,array $options=[]): PDOStatement|false {return parent::prepare(str_replace(' FOR UPDATE','',$query),$options);}
}
function db(): PDO {
    static $d;
    if(!$d){$d=new ReceiptIdentityDB('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);$d->sqliteCreateFunction('UTC_TIMESTAMP',fn($precision=0)=>gmdate('Y-m-d H:i:s'));}
    return $d;
}
function identity_check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
function identity_rejects(callable $fn,string $message): void {try{$fn();}catch(InvalidArgumentException|HRForbidden $e){return;}throw new RuntimeException('Unexpected success: '.$message);}
$d=db();$d->exec("PRAGMA foreign_keys=ON;
CREATE TABLE app_users(id INTEGER PRIMARY KEY,username TEXT,display_name TEXT,role TEXT,department TEXT,active INTEGER DEFAULT 1);
CREATE TABLE employee_memberships(user_id INTEGER PRIMARY KEY REFERENCES app_users(id),status TEXT);
CREATE TABLE sales_records(id INTEGER PRIMARY KEY AUTOINCREMENT,employee_id INTEGER REFERENCES app_users(id),department TEXT,first_date TEXT,customer_name TEXT,phone TEXT,address TEXT,carrier TEXT,insurance_kind TEXT,birth_year INTEGER,note TEXT,status TEXT,is_test INTEGER,request_key TEXT UNIQUE,revision INTEGER DEFAULT 1,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE sales_consultation_details(sale_id INTEGER PRIMARY KEY REFERENCES sales_records(id),consultation_time TEXT DEFAULT '',consultation_place TEXT DEFAULT '',premium_band TEXT DEFAULT '');
CREATE TABLE sales_receipt_details(sale_id INTEGER PRIMARY KEY REFERENCES sales_records(id),gender TEXT DEFAULT '',call_availability TEXT DEFAULT '',visit_schedule TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE sales_counselor_details(sale_id INTEGER PRIMARY KEY REFERENCES sales_records(id),counselor_name TEXT DEFAULT '');
CREATE TABLE sales_birth_details(sale_id INTEGER PRIMARY KEY REFERENCES sales_records(id),birth_date TEXT NOT NULL);
CREATE TABLE sales_events(id INTEGER PRIMARY KEY AUTOINCREMENT,sale_id INTEGER REFERENCES sales_records(id),actor_id INTEGER REFERENCES app_users(id),old_status TEXT,new_status TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE intake_management_events(id INTEGER PRIMARY KEY AUTOINCREMENT,record_key TEXT,actor_id INTEGER REFERENCES app_users(id),action TEXT,before_data TEXT,after_data TEXT,reason TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE test_employee_data(user_id INTEGER PRIMARY KEY REFERENCES app_users(id),state TEXT,revision INTEGER DEFAULT 1);
INSERT INTO app_users VALUES(1,'admin','관리자','admin','insurance',1),(2,'staff_one','동명이인','employee','insurance',1),(3,'staff_two','동명이인','employee','insurance',1),(4,'staff_cosmetics','화장품 직원','employee','cosmetics',1),(5,'user1','테스트 직원','employee','insurance',1),(6,'inactive','비활성 직원','employee','insurance',0),(7,'pending','승인 대기 직원','employee','insurance',1);
INSERT INTO employee_memberships VALUES(2,'approved'),(3,'approved'),(4,'approved'),(5,'approved'),(6,'approved'),(7,'pending');");
$admin=['id'=>1,'role'=>'admin'];$one=['id'=>2,'role'=>'employee'];$two=['id'=>3,'role'=>'employee'];$test=['id'=>5,'role'=>'employee'];$today=hr_today();$month=substr($today,0,7);
$staff=sales_staff($admin);$staffIds=array_map('intval',array_column($staff,'id'));
identity_check(count(array_filter($staff,fn($row)=>$row['name']==='동명이인'))===2&&in_array(2,$staffIds,true)&&in_array(3,$staffIds,true),'same display name must retain both independent account IDs');
identity_check(!in_array(6,$staffIds,true)&&!in_array(7,$staffIds,true),'inactive and unapproved accounts cannot be assigned');
$create=['action'=>'create','employeeId'=>2,'date'=>$today,'customer'=>'아이디 기준 고객','phone'=>'010-7777-8888','birthYear'=>1990,'birthMonth'=>'03','birthDay'=>'23','carrier'=>'한화','note'=>'한화','counselorName'=>'다른 이름 주입','consultationTime'=>'14:20','consultationPlace'=>'경기도 이천시','premiumBand'=>'200000','gender'=>'여','callAvailability'=>'오후 2~3시','visitSchedule'=>'주민센터','requestKey'=>'12121212-aaaa-bbbb-cccc-000000000001'];
sales_mutate($admin,$create);$id=(string)$d->query('SELECT id FROM sales_records')->fetchColumn();
$record=fn()=>array_column(sales_snapshot($admin,$month)['records'],null,'id')[$id];
$edit=function(array $overrides=[])use($record):array{$row=$record();$in=['action'=>'edit','id'=>$row['id'],'revision'=>$row['revision']];foreach(['customer','phone','carrier','note','consultationTime','consultationPlace','premiumBand','gender','callAvailability','visitSchedule','status','birthDate'] as $key)$in[$key]=$row[$key];return array_replace($in,$overrides);};
$state=function()use($d,$id):array{$out=[];foreach(['sales_records'=>'id','sales_consultation_details'=>'sale_id','sales_receipt_details'=>'sale_id','sales_counselor_details'=>'sale_id','sales_birth_details'=>'sale_id','sales_events'=>'sale_id','intake_management_events'=>'record_key'] as $table=>$column){$q=$d->prepare('SELECT * FROM '.$table.' WHERE '.$column.'=?');$q->execute([$id]);$out[$table]=$q->fetchAll();}return $out;};
$initial=$record();identity_check($initial['employeeId']===2&&$initial['counselorName']==='동명이인'&&$initial['status']==='pending','registration derives counselor and pending status from the selected account');
$original=$state();

// Name equality must not suppress a real ID change, and no receipt is copied.
intake_update($admin,$edit(['employeeId'=>3,'counselorName'=>'무시할 문자열','reason'=>'동명이인 중 두 번째 직원 선택']));
$assigned=$record();identity_check($assigned['employeeId']===3&&$assigned['counselorName']==='동명이인'&&$assigned['revision']===$initial['revision']+1,'same-name reassignment changes the actual owner exactly once');
identity_check((int)$d->query('SELECT count(*) FROM sales_records')->fetchColumn()===1&&$assigned['date']===$initial['date'],'reassignment never copies a record or changes its receipt date');
identity_check(array_column(sales_snapshot($one,$month)['records'],'id')===[]&&array_column(pending_intake_snapshot($one)['records'],'id')===[],'old owner immediately loses receipt and pending-feed visibility');
identity_check(array_column(sales_snapshot($two,$month)['records'],'id')===[$id]&&array_column(pending_intake_snapshot($two)['records'],'id')===[$id],'new owner sees the same receipt in both screens');
$pending=array_column(pending_intake_snapshot($admin)['records'],null,'id')[$id];$search=array_column(intake_live_search($admin,$assigned['customer'])['records'],null,'id')[$id];
identity_check($pending['employeeId']===3&&$pending['counselorName']===$assigned['counselorName']&&(int)$search['employeeId']===3&&$search['counselorName']===$assigned['counselorName'],'pending list, editor and live search share the numeric owner and displayed name');
$events=array_values(array_filter(intake_history($admin,$id),fn($event)=>$event['action']==='edit'));$last=$events[0];
identity_check((int)($last['before']['employee_id']??$last['before']['employeeId']??0)===2&&(int)($last['after']['employee_id']??$last['after']['employeeId']??0)===3,'audit records both numeric account IDs even when names are identical');
identity_check($state()['sales_birth_details']===$original['sales_birth_details']&&$state()['sales_consultation_details']===$original['sales_consultation_details']&&$state()['sales_receipt_details']===$original['sales_receipt_details'],'reassignment preserves birthday and consultation/receipt detail rows');
identity_check($state()['sales_records'][0]['request_key']===$original['sales_records'][0]['request_key'],'reassignment retains the idempotency key');

// Renaming an account, stale counselor strings and missing old detail rows must not split identity.
$d->exec("UPDATE app_users SET display_name='변경된 직원 이름' WHERE id=3; UPDATE sales_counselor_details SET counselor_name='기존 입력 이름' WHERE sale_id=".(int)$id);
$renamed=$record();$pending=array_column(pending_intake_snapshot($admin)['records'],null,'id')[$id];$search=array_column(intake_live_search($admin,$renamed['customer'])['records'],null,'id')[$id];
identity_check($renamed['employeeId']===3&&$renamed['counselorName']==='변경된 직원 이름'&&$pending['counselorName']===$renamed['counselorName']&&$search['counselorName']===$renamed['counselorName'],'all views derive the current name from the stable account ID');
$d->exec('DELETE FROM sales_counselor_details WHERE sale_id='.(int)$id);
identity_check($record()['counselorName']==='변경된 직원 이름'&&array_column(pending_intake_snapshot($admin)['records'],null,'id')[$id]['counselorName']==='변경된 직원 이름','missing legacy counselor rows fall back to account identity');
intake_update($admin,$edit(['counselorName'=>'화장품 직원','note'=>'신한']));
identity_check($record()['employeeId']===3&&$record()['counselorName']==='변경된 직원 이름'&&$record()['note']==='신한','old name-only clients preserve account ownership while real receipt changes persist');
foreach(['G/A','한화','신한'] as $memo){
    intake_update($admin,$edit(['employeeId'=>3,'counselorName'=>'다른 표시 이름','note'=>$memo]));
    $full=$record();$pending=array_column(pending_intake_snapshot($admin)['records'],null,'id')[$id];
    identity_check($full['note']===$memo&&$pending['note']===$memo&&$full['employeeId']===3&&$full['counselorName']==='변경된 직원 이름'&&$full['birthDate']===$initial['birthDate']&&$full['consultationPlace']===$initial['consultationPlace'],'full receipt submission retains selected '.$memo.' memo, stable account ID and unchanged detail fields');
}

// Invalid identities, stale forms and employee transfers must leave all rows and audit intact.
$stable=$state();
identity_rejects(fn()=>intake_update($admin,$edit(['employeeId'=>2,'revision'=>$initial['revision']])),'stale reassignment');
foreach([0,999,1,5,6,7] as $target)identity_rejects(fn()=>intake_update($admin,$edit(['employeeId'=>$target])),'invalid or different-scope account '.$target);
identity_rejects(fn()=>intake_update($one,$edit(['employeeId'=>2])),'employees cannot use administrator reassignment');
identity_rejects(fn()=>pending_intake_update($two,['action'=>'edit','id'=>$id,'revision'=>$record()['revision'],'employeeId'=>2,'customer'=>'권한 없는 이전']),'employee cannot transfer an owned receipt');
identity_rejects(fn()=>pending_intake_update($one,['action'=>'edit','id'=>$id,'revision'=>$record()['revision'],'customer'=>'이전 소유자 변경']),'old owner cannot edit after reassignment');
identity_check($state()===$stable&&!$d->inTransaction(),'rejected identities and stale forms leave all saved state untouched');
try{intake_update(['id'=>999,'role'=>'admin'],$edit(['employeeId'=>2,'note'=>'취소되어야 하는 내용']));throw new RuntimeException('Expected audit FK failure');}catch(PDOException $e){}
identity_check($state()===$stable&&!$d->inTransaction(),'audit failure rolls back owner, contents, details and revision together');

// The pending disclosure path performs the same account transfer and note persistence.
pending_intake_update($admin,['action'=>'edit','id'=>$id,'revision'=>$record()['revision'],'employeeId'=>2,'counselorName'=>'이름 무시','note'=>'한화']);
$pendingAssigned=$record();identity_check($pendingAssigned['employeeId']===2&&$pendingAssigned['counselorName']==='동명이인'&&$pendingAssigned['note']==='한화','pending disclosure reassigns by ID and persists selected memo');
identity_check(array_column(pending_intake_snapshot($two)['records'],'id')===[]&&array_column(pending_intake_snapshot($one)['records'],'id')===[$id],'pending disclosure also updates employee grouping immediately');
$pendingEvents=array_values(array_filter(intake_history($admin,$id),fn($event)=>$event['action']==='edit'&&(int)($event['before']['employeeId']??$event['before']['employee_id']??0)===3&&(int)($event['after']['employeeId']??$event['after']['employee_id']??0)===2));
identity_check(count($pendingEvents)===1,'pending disclosure transfer includes both IDs in its audit');

// Normal performance follows the same ID without duplicating earnings across employees/teams.
intake_update($admin,$edit(['employeeId'=>3,'status'=>'normal']));
identity_check(array_sum(sales_performance_counts(3,'insurance',false,$today,$today))===1&&array_sum(sales_performance_counts(2,'insurance',false,$today,$today))===0,'normal performance follows the newly selected account');
intake_update($admin,$edit(['employeeId'=>4]));
$cosmetics=$record();identity_check($cosmetics['employeeId']===4&&$cosmetics['team']==='cosmetics'&&$cosmetics['counselorName']==='화장품 직원'&&$cosmetics['kind']==='','cross-department transfer uses target department and valid product classification');
identity_check(array_sum(sales_performance_counts(3,'insurance',false,$today,$today))===0&&array_sum(sales_performance_counts(4,'cosmetics',false,$today,$today))===1,'cross-department transfer removes old performance and adds exactly one new performance');
sales_mutate($admin,array_replace($create,['employeeId'=>2,'requestKey'=>'12121212-aaaa-bbbb-cccc-000000000002','duplicateConfirmed'=>true]));
$duplicateId=(string)$d->query('SELECT MAX(id) FROM sales_records')->fetchColumn();sales_mutate($admin,['action'=>'status','id'=>$duplicateId,'revision'=>1,'status'=>'normal']);
identity_check(count(sales_performance_rows(false,$today))===1&&array_sum(sales_performance_counts(2,'insurance',false,$today,$today))===0&&array_sum(sales_performance_counts(4,'cosmetics',false,$today,$today))===1,'duplicate normal receipt does not earn again under another employee');

// Legacy test data displays account identity and cannot be transferred into real data.
$testState=['sales'=>[['id'=>1,'date'=>$today,'name'=>'테스트 기존 고객','phone'=>'010-5555-6666','birthYear'=>1990,'birthDate'=>'1990-03-23','carrier'=>'한화','kind'=>'일반','status'=>'가접수','counselorName'=>'오래된 문자열','note'=>'한화']]];
$d->prepare('INSERT INTO test_employee_data(user_id,state) VALUES(5,?)')->execute([hr_json($testState)]);
$legacy=array_column(pending_intake_snapshot($admin)['records'],null,'id')['test:5:1'];
identity_check($legacy['employeeId']===5&&$legacy['counselorName']==='테스트 직원'&&array_column(sales_snapshot($admin,$month)['records'],null,'id')['test:5:1']['counselorName']==='테스트 직원','legacy test snapshots use account ID for displayed counselor');
identity_rejects(fn()=>pending_intake_update($admin,['action'=>'edit','id'=>'test:5:1','revision'=>1,'employeeId'=>2,'customer'=>'실제 계정으로 이전']),'legacy test receipt cannot move into a real account');
identity_check($d->query('SELECT state FROM test_employee_data WHERE user_id=5')->fetchColumn()===hr_json($testState),'denied legacy reassignment leaves its source unchanged');
identity_rejects(fn()=>sales_mutate($one,array_replace($create,['employeeId'=>3,'requestKey'=>'12121212-aaaa-bbbb-cccc-000000000003'])),'employee registration cannot select another account');
foreach([1,6,7,999] as $target)identity_rejects(fn()=>sales_mutate($admin,array_replace($create,['employeeId'=>$target,'requestKey'=>'12121212-aaaa-bbbb-cccc-000000000003'])),'new registration rejects invalid target '.$target);
identity_check(!$d->inTransaction(),'identity fixture finishes outside a transaction');
echo "PASS: stable account IDs, duplicate display names, canonical counselor names, atomic reassignment and audit, employee privacy, real/test isolation, stale/invalid identities, legacy compatibility, memo persistence and single-count normal performance.\n";
