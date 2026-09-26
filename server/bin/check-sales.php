<?php
// Isolated in-memory fixtures; this check never connects to the production database.
declare(strict_types=1);
require __DIR__.'/../lib/sales.php';
class SalesTestDB extends PDO {public function prepare(string $query,array $options=[]): PDOStatement|false{return parent::prepare(str_replace(' FOR UPDATE','',$query),$options);}}
function db(): PDO {static $d;if(!$d){$d=new SalesTestDB('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);$d->sqliteCreateFunction('UTC_TIMESTAMP',fn($precision=0)=>gmdate('Y-m-d H:i:s'));}return $d;}
function check(bool $ok,string $message):void {if(!$ok)throw new Exception($message);}
function rejects(callable $fn,string $message):void {try{$fn();}catch(InvalidArgumentException|HRForbidden $e){return;}throw new Exception('Unexpected success: '.$message);}
$d=db();$d->exec("PRAGMA foreign_keys=ON;
CREATE TABLE app_users(id INTEGER PRIMARY KEY,username TEXT,display_name TEXT,role TEXT,department TEXT,active INTEGER DEFAULT 1);
CREATE TABLE sales_records(id INTEGER PRIMARY KEY AUTOINCREMENT,employee_id INTEGER REFERENCES app_users(id),department TEXT,first_date TEXT,customer_name TEXT,phone TEXT,address TEXT,carrier TEXT,insurance_kind TEXT,birth_year INTEGER,note TEXT,status TEXT,is_test INTEGER,request_key TEXT UNIQUE,revision INTEGER DEFAULT 1,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE sales_events(id INTEGER PRIMARY KEY AUTOINCREMENT,sale_id INTEGER REFERENCES sales_records(id),actor_id INTEGER REFERENCES app_users(id),old_status TEXT,new_status TEXT);
CREATE TABLE test_employee_data(user_id INTEGER PRIMARY KEY REFERENCES app_users(id),state TEXT,revision INTEGER DEFAULT 1);
INSERT INTO app_users VALUES(1,'admin','관리자','admin','insurance',1),(2,'one','보험 직원','employee','insurance',1),(3,'two','화장품 직원','employee','cosmetics',1),(4,'user1','테스트 직원','employee','insurance',1);");
$admin=['id'=>1,'role'=>'admin'];$one=['id'=>2,'role'=>'employee'];$two=['id'=>3,'role'=>'employee'];$today=hr_today();$year=(int)substr($today,0,4);$month=substr($today,0,7);
foreach([61=>'general',62=>'silver',70=>'silver'] as $age=>$kind)check(sales_kind($year-$age+1,$today)===$kind,'counting-age boundary '.$age);
rejects(fn()=>sales_kind($year-70,$today),'age 71');rejects(fn()=>sales_kind($year+1,$today),'future birth');
$create=['action'=>'create','date'=>$today,'customer'=>'가상 검증','phone'=>'010-0000-0000','address'=>'검증용 주소','carrier'=>'GA','birthYear'=>$year-60,'requestKey'=>'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'];
sales_mutate($one,$create+['employeeId'=>3]);$r=sales_snapshot($one,$month)['records'][0];
check($r['employeeId']===2&&$r['kind']==='general'&&$r['status']==='pending','server owns employee assignment and age classification');
sales_mutate($one,$create);check(count(sales_snapshot($one,$month)['records'])===1,'retry does not duplicate');
check(count(sales_snapshot($two,$month)['records'])===0,'employee data isolation');
rejects(fn()=>sales_mutate($two,['action'=>'status','id'=>$r['id'],'revision'=>1,'status'=>'normal']),'cannot change another employee');
sales_mutate($one,['action'=>'status','id'=>$r['id'],'revision'=>1,'status'=>'normal']);
rejects(fn()=>sales_mutate($one,['action'=>'status','id'=>$r['id'],'revision'=>1,'status'=>'as']),'stale state rejected');
sales_mutate($admin,['action'=>'status','id'=>$r['id'],'revision'=>2,'status'=>'as']);
$r=sales_snapshot($one,$month)['records'][0];check($r['status']==='as'&&$r['date']===$today,'A/S changes stay on original date');
sales_mutate($admin,['action'=>'status','id'=>$r['id'],'revision'=>3,'status'=>'normal']);
$create['requestKey']='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';sales_mutate($two,$create);
check(count(sales_snapshot($admin,$month)['records'])===2,'both team feeds');check(sales_snapshot($two,$month)['records'][0]['team']==='cosmetics','cosmetics uses assigned team');
$q=$d->prepare('INSERT INTO test_employee_data(user_id,state) VALUES(4,?)');$q->execute([hr_json(['sales'=>[['id'=>1,'date'=>$today,'name'=>'가상고객','carrier'=>'GA','kind'=>'실버','status'=>'가접수']]])]);
$all=sales_snapshot($admin,$month)['records'];check(count($all)===3&&$all[2]['isTest']===true,'test feed remains explicitly separated');
rejects(fn()=>sales_mutate($one,['action'=>'status','id'=>'test:4:1','revision'=>1,'status'=>'normal']),'test feed privacy');
sales_mutate($admin,['action'=>'status','id'=>'test:4:1','revision'=>1,'status'=>'normal']);check(sales_snapshot($admin,$month)['records'][2]['status']==='normal','existing test status reflected');
check((int)$d->query('SELECT count(*) FROM sales_events')->fetchColumn()===5,'persistent state history');
echo "PASS: sales ownership, role isolation, age boundaries, duplicate prevention, stale changes, both departments, test separation and status history.\n";
