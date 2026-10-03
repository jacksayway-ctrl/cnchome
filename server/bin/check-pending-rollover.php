<?php
// Isolated fixture only; never connects to production or modifies real receipts.
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
require __DIR__.'/../lib/pending-rollover.php';
class PendingRolloverFixtureDB extends PDO {
    public function prepare(string $query,array $options=[]): PDOStatement|false{return parent::prepare(str_replace(' FOR UPDATE','',$query),$options);}
}
function db(): PDO {static $d;return $d??=new PendingRolloverFixtureDB('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}
function check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
$d=db();$d->exec("CREATE TABLE app_users(id INTEGER PRIMARY KEY,username TEXT,display_name TEXT,role TEXT);
CREATE TABLE sales_records(id INTEGER PRIMARY KEY,employee_id INTEGER,first_date TEXT,status TEXT,is_test INTEGER,revision INTEGER DEFAULT 1,updated_at TEXT);
CREATE TABLE intake_management_events(record_key TEXT,actor_id INTEGER,action TEXT,before_data TEXT,after_data TEXT,reason TEXT);
CREATE TABLE test_employee_data(user_id INTEGER PRIMARY KEY,state TEXT,revision INTEGER DEFAULT 1);
INSERT INTO app_users VALUES(1,'one','직원','employee'),(2,'two','동료','employee'),(3,'admin','관리자','admin');
INSERT INTO sales_records(id,employee_id,first_date,status,is_test) VALUES
(1,1,'2026-09-03','pending',0),(2,1,'2026-09-04','pending',0),(3,2,'2026-08-01','pending',0),
(4,1,'2026-08-01','normal',0),(5,1,'2026-08-01','as',0),(6,1,'2026-08-01','pending',1);");
$one=['id'=>1,'role'=>'employee'];$admin=['id'=>3,'role'=>'admin'];
check(pending_rollover_cutoff('2026-10-03')==='2026-09-03','one calendar month boundary');
check(pending_rollover_cutoff('2026-03-31')==='2026-02-28'&&pending_rollover_cutoff('2028-03-31')==='2028-02-29','short month and leap year clamp');
check(pending_rollover($one,'2026-10-03')===1,'only own unresolved real receipt at one-month boundary renews');
$rows=array_column($d->query('SELECT * FROM sales_records')->fetchAll(),null,'id');
check($rows[1]['first_date']==='2026-10-03'&&(int)$rows[1]['revision']===2,'renewed date increments revision');
foreach([2,3,4,5,6] as $id)check($rows[$id]['first_date']===($id===2?'2026-09-04':'2026-08-01'),'recent, colleague, normal, A/S and test receipts stay untouched');
$event=$d->query('SELECT * FROM intake_management_events')->fetch();check(json_decode($event['before_data'],true)['date']==='2026-09-03'&&json_decode($event['after_data'],true)['date']==='2026-10-03','original date retained in audit');
check(pending_rollover($one,'2026-10-03')===0,'repeat refresh is idempotent');
check(pending_rollover($admin,'2026-10-03')===2,'administrator renews remaining unresolved records across owners');
check((int)$d->query('SELECT COUNT(*) FROM intake_management_events')->fetchColumn()===3,'one audit event per renewed receipt');
echo "PASS: pending-only monthly renewal, short-month boundary, owner/test isolation, revisions and append-only date history.\n";
