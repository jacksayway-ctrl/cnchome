<?php
// Isolated fixtures only. This gate never loads the production bootstrap or account credentials.
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/receipt-identity-repair.php';
function identity_repair_check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
function identity_repair_fixture_data(): array {
    $account=['id'=>2,'username'=>'fixture-source','display_name'=>'상담원가','role'=>'employee','department'=>'insurance','active'=>1,'created_at'=>'2026-09-01 00:00:00.000000','membership_status'=>'approved'];
    $accounts=[2=>$account,3=>array_replace($account,['id'=>3,'username'=>'fixture-target','display_name'=>'상담원나'])];
    $row=['id'=>501,'employee_id'=>2,'department'=>'insurance','first_date'=>'2026-09-30','customer_name'=>'검증고객','phone'=>'010-1234-5678','carrier'=>'한화','note'=>'일반',
        'birth_year'=>1970,'insurance_kind'=>'general','birth_date'=>'1970-05-20','consultation_time'=>'','consultation_place'=>'검증동','premium_band'=>'100000',
        'gender'=>'여','call_availability'=>'오후 2~3시','visit_schedule'=>'주민센터','counselor_name'=>'상담원나','status'=>'pending','is_test'=>0,'revision'=>3,'updated_at'=>'2026-10-02 02:40:00.000123'];
    $after=[];foreach(['customer_name','phone','carrier','note','birth_year','insurance_kind','birth_date','consultation_time','consultation_place','premium_band','gender','status'] as $key)$after[$key]=$row[$key];
    $after+=['callAvailability'=>$row['call_availability'],'visitSchedule'=>$row['visit_schedule'],'counselorName'=>$row['counselor_name']];
    $before=array_replace($after,['counselorName'=>'상담원가']);
    $event=['id'=>91,'record_key'=>'501','actor_id'=>1,'actor_role'=>'admin','action'=>'edit','before_data'=>hr_json($before),'after_data'=>hr_json($after),'created_at'=>'2026-10-02 02:40:00.000456'];
    return [$row,$event,$accounts,$before,$after];
}
class ReceiptIdentityFixtureDB extends PDO {
    public function prepare(string $query,array $options=[]): PDOStatement|false {return parent::prepare(str_replace(' FOR UPDATE','',$query),$options);}
    public function query(string $query,?int $fetchMode=null,mixed ...$fetchModeArgs): PDOStatement|false {return $fetchMode===null?parent::query(str_replace(' FOR UPDATE','',$query)):parent::query(str_replace(' FOR UPDATE','',$query),$fetchMode,...$fetchModeArgs);}
}
function db(): PDO {return $GLOBALS['receiptIdentityFixture'];}
function identity_repair_insert(PDO $d,string $table,array $row): void {$q=$d->prepare('INSERT INTO '.$table.' ('.implode(',',array_keys($row)).') VALUES ('.implode(',',array_fill(0,count($row),'?')).')');$q->execute(array_values($row));}
function identity_repair_database(): PDO {
    [$row,$event,$accounts]=identity_repair_fixture_data();
    $d=new ReceiptIdentityFixtureDB('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);$GLOBALS['receiptIdentityFixture']=$d;
    $d->sqliteCreateFunction('UTC_TIMESTAMP',fn($precision)=>'2026-10-02 03:00:00.000000',1);
    $d->exec("PRAGMA foreign_keys=ON;
CREATE TABLE app_users(id INTEGER PRIMARY KEY,username TEXT,display_name TEXT,role TEXT,department TEXT,active INTEGER,created_at TEXT);
CREATE TABLE employee_memberships(user_id INTEGER PRIMARY KEY REFERENCES app_users(id),status TEXT);
CREATE TABLE sales_records(id INTEGER PRIMARY KEY,employee_id INTEGER REFERENCES app_users(id),department TEXT,first_date TEXT,customer_name TEXT,phone TEXT,carrier TEXT,note TEXT,birth_year INTEGER,insurance_kind TEXT,status TEXT,is_test INTEGER,revision INTEGER,updated_at TEXT);
CREATE TABLE sales_counselor_details(sale_id INTEGER PRIMARY KEY REFERENCES sales_records(id),counselor_name TEXT);
CREATE TABLE sales_consultation_details(sale_id INTEGER PRIMARY KEY REFERENCES sales_records(id),consultation_time TEXT,consultation_place TEXT,premium_band TEXT);
CREATE TABLE sales_receipt_details(sale_id INTEGER PRIMARY KEY REFERENCES sales_records(id),gender TEXT,call_availability TEXT,visit_schedule TEXT);
CREATE TABLE sales_birth_details(sale_id INTEGER PRIMARY KEY REFERENCES sales_records(id),birth_date TEXT);
CREATE TABLE intake_management_events(id INTEGER PRIMARY KEY AUTOINCREMENT,record_key TEXT,actor_id INTEGER REFERENCES app_users(id),action TEXT,before_data TEXT,after_data TEXT,reason TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE test_fixture_batches(batch TEXT PRIMARY KEY,manifest TEXT);
CREATE TABLE daily_grade_receipts(employee_id INTEGER,amount INTEGER);
CREATE TABLE hr_payroll(employee_id INTEGER,published_snapshot TEXT);
INSERT INTO app_users VALUES(1,'fixture-admin','관리자','admin','insurance',1,'2026-09-01 00:00:00.000000');
INSERT INTO daily_grade_receipts VALUES(2,5000);INSERT INTO hr_payroll VALUES(2,'unchanged paid snapshot');");
    foreach($accounts as $account){unset($account['membership_status']);identity_repair_insert($d,'app_users',$account);identity_repair_insert($d,'employee_memberships',['user_id'=>$account['id'],'status'=>'approved']);}
    $columns=['id','employee_id','department','first_date','customer_name','phone','carrier','note','birth_year','insurance_kind','status','is_test','revision','updated_at'];identity_repair_insert($d,'sales_records',array_intersect_key($row,array_flip($columns)));
    foreach(['sales_counselor_details'=>['counselor_name'],'sales_consultation_details'=>['consultation_time','consultation_place','premium_band'],'sales_receipt_details'=>['gender','call_availability','visit_schedule'],'sales_birth_details'=>['birth_date']] as $table=>$keys)identity_repair_insert($d,$table,['sale_id'=>$row['id']]+array_intersect_key($row,array_flip($keys)));
    unset($event['actor_role']);identity_repair_insert($d,'intake_management_events',$event);return $d;
}
function identity_repair_remove(string $directory): void {foreach(glob($directory.'/*')?:[] as $path){if(is_dir($path))identity_repair_remove($path);else unlink($path);}if(is_dir($directory))rmdir($directory);}

$root=sys_get_temp_dir().'/cnc-receipt-identity-'.bin2hex(random_bytes(6));mkdir($root,0700);
try{
    [$row,$event,$accounts,$before,$after]=identity_repair_fixture_data();
    $decide=fn(?array $r=null,?array $e=null,?array $a=null)=>receipt_identity_repair_decide($r??$row,$e??$event,$a??$accounts);
    identity_repair_check(($decide()['targetId']??0)===3,'proven explicit admin counselor change targets the exact employee ID');
    foreach(['normal','as'] as $status)identity_repair_check(($decide(array_replace($row,['status'=>$status]),array_replace($event,['after_data'=>hr_json(array_replace($after,['status'=>$status]))]))['targetId']??0)===3,'audit proven assignment works for every status');
    $camel=$after;foreach(['customer_name'=>'customer','birth_year'=>'birthYear','insurance_kind'=>'kind','birth_date'=>'birthDate','consultation_time'=>'consultationTime','consultation_place'=>'consultationPlace','premium_band'=>'premiumBand'] as $from=>$to){$camel[$to]=$camel[$from];unset($camel[$from]);}
    identity_repair_check(($decide($row,array_replace($event,['after_data'=>hr_json($camel)]))['targetId']??0)===3,'pending editor camelcase audit is checked against all current fields');
    $duplicate=$accounts;$duplicate[4]=array_replace($accounts[3],['id'=>4,'username'=>'fixture-duplicate']);identity_repair_check(($decide($row,$event,$duplicate)['skip']??'')==='ambiguous_name','duplicate employee names never guess ownership');
    foreach([['active'=>0],['membership_status'=>'pending'],['membership_status'=>'rejected'],['department'=>'cosmetics'],['created_at'=>'2026-10-03 00:00:00.000000']] as $change){$bad=$accounts;$bad[3]=array_replace($bad[3],$change);identity_repair_check(isset($decide($row,$event,$bad)['skip']),'inactive, unapproved, foreign-department and future identities are excluded');}
    $legacy=$accounts;unset($legacy[3]['membership_status']);identity_repair_check(($decide($row,$event,$legacy)['targetId']??0)===3,'legacy approved login without membership stays eligible');
    identity_repair_check(($decide($row,array_replace($event,['actor_role'=>'employee']))['skip']??'')==='no_admin_edit','employee text edits cannot transfer ownership');
    identity_repair_check(($decide($row,array_replace($event,['before_data'=>hr_json(array_replace($before,['counselorName'=>'']))]))['skip']??'')==='uncertain_previous_owner','empty to automatic old default does not prove reassignment');
    identity_repair_check(($decide($row,array_replace($event,['before_data'=>hr_json($after)]))['skip']??'')==='no_explicit_name_change','unrelated later edit cannot prove a counselor switch');
    $laterAfter=array_replace($after,['note'=>'추가 메모']);
    $later=array_replace($event,['id'=>92,'actor_id'=>2,'actor_role'=>'employee','before_data'=>hr_json($after),'after_data'=>hr_json($laterAfter),'created_at'=>'2026-10-02 02:53:00.000456','precedingEdits'=>[$event]]);
    $laterRow=array_replace($row,['note'=>'추가 메모','revision'=>4,'updated_at'=>'2026-10-02 02:53:00.000123']);$chainDecision=$decide($laterRow,$later);
    identity_repair_check(($chainDecision['sourceEventId']??0)===91&&($chainDecision['sourceActorId']??0)===1&&($chainDecision['latestEventId']??0)===92,'later memo edit preserves original explicit admin assignment and its actor');
    identity_repair_check(($decide($laterRow,array_replace($later,['before_data'=>hr_json(array_replace($after,['counselorName'=>'다른 상담원']))]))['skip']??'')==='no_admin_edit','a later employee name change cannot be skipped to an earlier administrator instruction');
    identity_repair_check(($decide($laterRow,array_replace($later,['actor_role'=>'admin','before_data'=>hr_json(array_replace($after,['counselorName'=>'다른 상담원']))]))['skip']??'')==='uncertain_previous_owner','conflicting intervening administrator assignment cannot be skipped');
    identity_repair_check(($decide($laterRow,array_replace($later,['after_data'=>hr_json($laterAfter+['employee_id'=>2])]))['skip']??'')==='id_based_edit','any later ID-based edit blocks legacy name replay');
    identity_repair_check(($decide($laterRow,array_replace($later,['precedingEdits'=>[array_replace($event,['id'=>92])]]))['skip']??'')==='invalid_audit_chain','audit chain order must be strictly decreasing');
    identity_repair_check(($decide(array_replace($row,['phone'=>'010-9999-8888']))['skip']??'')==='changed_since_edit','any changed current field rejects stale evidence');
    identity_repair_check(($decide(array_replace($row,['updated_at'=>'2026-10-02 02:41:00.000000']))['skip']??'')==='changed_since_edit','post-audit updates cannot reuse an old intent');
    $outside=(new DateTimeImmutable(receipt_identity_repair_cutoff(),new DateTimeZone('UTC')))->modify('+1 second')->format('Y-m-d H:i:s.u');
    identity_repair_check(($decide(array_replace($row,['updated_at'=>$outside]))['skip']??'')==='outside_request','fixed request cutoff excludes later writes');
    identity_repair_check(($decide($row,array_replace($event,['created_at'=>$outside]))['skip']??'')==='outside_request','later audit events are excluded');
    $newAccount=$accounts;$newAccount[3]['created_at']='2026-10-02 02:52:00.000000';identity_repair_check(($decide($laterRow,$later,$newAccount)['skip']??'')==='no_approved_match','operation cutoff extension cannot admit newly created identities');
    identity_repair_check(($decide($row,array_replace($event,['after_data'=>hr_json($after+['employee_id'=>3])]))['skip']??'')==='id_based_edit','new ID-based assignments are not replayed');
    identity_repair_check(($decide(array_replace($row,['is_test'=>1]))['skip']??'')==='owner_scope','real and test scopes never mix');

    $d=identity_repair_database();$original=$d->query('SELECT * FROM sales_records')->fetch();$result=receipt_identity_repair($root.'/success');$saved=$d->query('SELECT * FROM sales_records')->fetch();
    identity_repair_check($result['reassigned']===1&&(int)$saved['employee_id']===3&&(int)$saved['revision']===4,'one proven receipt is reassigned with a new revision');
    foreach($original as $key=>$value)if(!in_array($key,['employee_id','revision','updated_at'],true))identity_repair_check($saved[$key]===$value,'receipt contents and status stay unchanged: '.$key);
    identity_repair_check((fileperms($result['backup'])&0777)===0600&&count(json_decode(file_get_contents($result['backup']),true)['evidence'])===1,'private verified backup retains original evidence');
    identity_repair_check((int)$d->query("SELECT COUNT(*) FROM intake_management_events WHERE action='reassign'")->fetchColumn()===1,'repair appends an explicit audit event');
    identity_repair_check($d->query('SELECT employee_id FROM daily_grade_receipts')->fetchColumn()===2&&$d->query('SELECT published_snapshot FROM hr_payroll')->fetchColumn()==='unchanged paid snapshot','confirmed payments and published payroll are never rewritten');
    $again=receipt_identity_repair($root.'/success');identity_repair_check($again['alreadyApplied']&&$d->query('SELECT * FROM sales_records')->fetch()===$saved&&(int)$d->query('SELECT COUNT(*) FROM intake_management_events')->fetchColumn()===2,'durable marker prevents repeated writes or duplicate audits');
    $d=identity_repair_database();$d->exec("UPDATE sales_records SET note='추가 메모',revision=4,updated_at='2026-10-02 02:53:00.000123' WHERE id=501");$savedLater=$later;unset($savedLater['actor_role'],$savedLater['precedingEdits']);identity_repair_insert($d,'intake_management_events',$savedLater);
    $result=receipt_identity_repair($root.'/later-memo');$saved=$d->query('SELECT * FROM sales_records')->fetch();
    identity_repair_check($result['reassigned']===1&&(int)$saved['employee_id']===3&&(int)$saved['revision']===5&&$saved['note']==='추가 메모'&&$result['assignments'][0]['sourceEventId']===91,'database audit chain repairs original assignment while preserving later memo edits');
    $again=receipt_identity_repair($root.'/later-memo');identity_repair_check($again['alreadyApplied']&&$d->query('SELECT * FROM sales_records')->fetch()===$saved&&(int)$d->query('SELECT COUNT(*) FROM intake_management_events')->fetchColumn()===3,'chained repair remains idempotent');
    $d=identity_repair_database();$d->exec("CREATE TRIGGER deny_repair BEFORE INSERT ON intake_management_events WHEN NEW.action='reassign' BEGIN SELECT RAISE(ABORT,'fixture audit denied'); END");$original=$d->query('SELECT * FROM sales_records')->fetch();$failed=false;
    try{receipt_identity_repair($root.'/rollback');}catch(PDOException $e){$failed=true;}
    identity_repair_check($failed&&!$d->inTransaction()&&$d->query('SELECT * FROM sales_records')->fetch()===$original&&(int)$d->query('SELECT COUNT(*) FROM test_fixture_batches')->fetchColumn()===0,'audit failure atomically rolls back ownership and completion marker');
    $d=identity_repair_database();$d->exec("INSERT INTO app_users VALUES(4,'ambiguous','상담원나','employee','insurance',1,'2026-09-01');INSERT INTO employee_memberships VALUES(4,'approved')");$original=$d->query('SELECT * FROM sales_records')->fetch();$result=receipt_identity_repair($root.'/ambiguous');
    identity_repair_check($result['reassigned']===0&&($result['skipped']['ambiguous_name']??0)===1&&$d->query('SELECT * FROM sales_records')->fetch()===$original,'ambiguous records remain unchanged and are privately reported');
    echo "PASS: proof-only receipt ownership repair, full audit matching, ambiguous-name and scope guards, cutoff, private backup, atomic rollback, idempotency and immutable paid records.\n";
}finally{identity_repair_remove($root);}
