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
CREATE TABLE sales_consultation_details(sale_id INTEGER PRIMARY KEY REFERENCES sales_records(id),consultation_time TEXT DEFAULT '',consultation_place TEXT DEFAULT '',premium_band TEXT DEFAULT '');
CREATE TABLE sales_receipt_details(sale_id INTEGER PRIMARY KEY REFERENCES sales_records(id),gender TEXT DEFAULT '',call_availability TEXT DEFAULT '',visit_schedule TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE sales_birth_details(sale_id INTEGER PRIMARY KEY REFERENCES sales_records(id),birth_date TEXT NOT NULL);
CREATE TABLE sales_events(id INTEGER PRIMARY KEY AUTOINCREMENT,sale_id INTEGER REFERENCES sales_records(id),actor_id INTEGER REFERENCES app_users(id),old_status TEXT,new_status TEXT);
CREATE TABLE test_employee_data(user_id INTEGER PRIMARY KEY REFERENCES app_users(id),state TEXT,revision INTEGER DEFAULT 1);
INSERT INTO app_users VALUES(1,'admin','관리자','admin','insurance',1),(2,'one','보험 직원','employee','insurance',1),(3,'two','화장품 직원','employee','cosmetics',1),(4,'user1','테스트 직원','employee','insurance',1);");
$admin=['id'=>1,'role'=>'admin'];$one=['id'=>2,'role'=>'employee'];$two=['id'=>3,'role'=>'employee'];$today=hr_today();$year=(int)substr($today,0,4);$month=substr($today,0,7);
foreach([60=>'general',61=>'silver',62=>'silver',70=>'silver'] as $age=>$kind)check(sales_kind($year-$age+1,$today)===$kind,'counting-age boundary '.$age);
rejects(fn()=>sales_kind($year-70,$today),'age 71');rejects(fn()=>sales_kind($year+1,$today),'future birth');
$create=['action'=>'create','date'=>$today,'customer'=>'가상 검증','phone'=>'010-0000-0000','address'=>'검증용 주소','carrier'=>'GA','birthYear'=>$year-60,'requestKey'=>'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','consultationTime'=>'14:30','consultationPlace'=>'검증용 상담 장소','premiumBand'=>'200000','gender'=>'여','callAvailability'=>'오후 2시~5시','visitSchedule'=>'금요일 3시, 상담실'];
sales_mutate($one,$create+['employeeId'=>3]);$r=sales_snapshot($one,$month)['records'][0];
check($r['employeeId']===2&&$r['kind']==='silver'&&$r['status']==='pending','server owns employee assignment and age classification');
check($r['consultationTime']==='14:30'&&$r['consultationPlace']==='검증용 상담 장소'&&$r['premiumBand']==='200000','consultation fields round-trip through database');
check($r['gender']==='여'&&$r['callAvailability']==='오후 2시~5시'&&$r['visitSchedule']==='금요일 3시, 상담실'&&$r['receivedAt']!=='','receipt fields and server timestamp survive database reload');
sales_mutate($one,$create);check(count(sales_snapshot($one,$month)['records'])===1,'retry does not duplicate');
check((int)$d->query('SELECT count(*) FROM sales_consultation_details')->fetchColumn()===1,'retry does not duplicate consultation details');
check(count(sales_snapshot($two,$month)['records'])===0,'employee data isolation');
rejects(fn()=>sales_mutate($two,['action'=>'status','id'=>$r['id'],'revision'=>1,'status'=>'normal']),'cannot change another employee');
sales_mutate($one,['action'=>'status','id'=>$r['id'],'revision'=>1,'status'=>'normal']);
rejects(fn()=>sales_mutate($one,['action'=>'status','id'=>$r['id'],'revision'=>1,'status'=>'as']),'stale state rejected');
sales_mutate($admin,['action'=>'status','id'=>$r['id'],'revision'=>2,'status'=>'as']);
$r=sales_snapshot($one,$month)['records'][0];check($r['status']==='as'&&$r['date']===$today,'A/S changes stay on original date');
sales_mutate($admin,['action'=>'status','id'=>$r['id'],'revision'=>3,'status'=>'normal']);
$create['requestKey']='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';sales_mutate($two,$create);
check(count(sales_snapshot($admin,$month)['records'])===2,'both team feeds');check(sales_snapshot($two,$month)['records'][0]['team']==='cosmetics','cosmetics uses assigned team');
$q=$d->prepare('INSERT INTO test_employee_data(user_id,state) VALUES(4,?)');$q->execute([hr_json(['sales'=>[['id'=>1,'date'=>$today,'name'=>'가상고객','carrier'=>'GA','kind'=>'실버','status'=>'가접수','consultationTime'=>'11:30','consultationPlace'=>'[테스트] 가상 상담실','premiumBand'=>'200000','birthDate'=>'1963-01-15']]])]);
$all=sales_snapshot($admin,$month)['records'];check(count($all)===3&&$all[2]['isTest']===true,'test feed remains explicitly separated');
$testUser=['id'=>4,'role'=>'employee','username'=>'user1','display_name'=>'테스트 직원'];$testFeed=sales_snapshot($testUser,$month);
check($testFeed['isTestAccount']&&$testFeed['records'][0]['consultationTime']==='11:30'&&$testFeed['records'][0]['consultationPlace']==='[테스트] 가상 상담실'&&$testFeed['records'][0]['premiumBand']==='200000','test identity and complete sample intake fields reach employee view');
check(!sales_snapshot($one,$month)['isTestAccount']&&!sales_snapshot($admin,$month)['isTestAccount'],'real and administrator feeds never default to test data');
rejects(fn()=>sales_mutate($one,['action'=>'status','id'=>'test:4:1','revision'=>1,'status'=>'normal']),'test feed privacy');
sales_mutate($admin,['action'=>'status','id'=>'test:4:1','revision'=>1,'status'=>'normal']);check(sales_snapshot($admin,$month)['records'][2]['status']==='normal','existing test status reflected');
check((int)$d->query('SELECT count(*) FROM sales_events')->fetchColumn()===5,'persistent state history');
$invalid=$create;$invalid['requestKey']='cccccccc-cccc-cccc-cccc-cccccccccccc';
foreach(['24:00','12:60','09:15:30','9:15'] as $value)rejects(fn()=>sales_mutate($one,array_replace($invalid,['consultationTime'=>$value])),'invalid consultation time');
rejects(fn()=>sales_mutate($one,array_replace($invalid,['consultationPlace'=>str_repeat('가',501)])),'consultation place length');
rejects(fn()=>sales_mutate($one,array_replace($invalid,['address'=>str_repeat('가',501)])),'legacy address length');
foreach(['50000','400000','twenty'] as $value)rejects(fn()=>sales_mutate($one,array_replace($invalid,['premiumBand'=>$value])),'invalid premium band');
rejects(fn()=>sales_mutate($one,array_replace($invalid,['gender'=>'other'])),'invalid receipt gender');
rejects(fn()=>sales_mutate($one,array_replace($invalid,['callAvailability'=>str_repeat('가',201)])),'call availability length');
rejects(fn()=>sales_mutate($one,array_replace($invalid,['visitSchedule'=>str_repeat('가',501)])),'visit schedule length');
check((int)$d->query('SELECT count(*) FROM sales_records')->fetchColumn()===2,'invalid consultation fields cannot create a sale');
foreach(['100000','200000','300000'] as $index=>$band){$input=array_replace($create,['premiumBand'=>$band,'requestKey'=>sprintf('%08d-cccc-cccc-cccc-cccccccccccc',$index+1)]);sales_mutate($one,$input);$saved=array_values(array_filter(sales_snapshot($one,$month)['records'],fn($sale)=>$sale['premiumBand']===$band));check(count($saved)>0,'premium option round-trip '.$band);}
$legacy=$create;unset($legacy['consultationTime'],$legacy['consultationPlace'],$legacy['premiumBand']);$legacy['requestKey']='dddddddd-dddd-dddd-dddd-dddddddddddd';sales_mutate($one,$legacy);$legacyId=(int)$d->query("SELECT id FROM sales_records WHERE request_key='dddddddd-dddd-dddd-dddd-dddddddddddd'")->fetchColumn();
$d->exec('DELETE FROM sales_consultation_details WHERE sale_id='.$legacyId);
$legacyRow=array_values(array_filter(sales_snapshot($one,$month)['records'],fn($sale)=>(int)$sale['id']===$legacyId))[0];
check($legacyRow['consultationTime']===''&&$legacyRow['consultationPlace']===''&&$legacyRow['premiumBand']==='','pre-migration records remain readable with empty consultation fields');
check($legacyRow['address']==='검증용 주소','existing addresses remain readable');
$withoutAddress=array_replace($create,['requestKey'=>'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee','consultationPlace'=>'경기도 수원시 영통구 상담 카페']);unset($withoutAddress['address']);
sales_mutate($one,$withoutAddress);$withoutAddressId=(int)$d->query("SELECT id FROM sales_records WHERE request_key='eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'")->fetchColumn();
$withoutAddressRow=array_values(array_filter(sales_snapshot($one,$month)['records'],fn($sale)=>(int)$sale['id']===$withoutAddressId))[0];
check($withoutAddressRow['address']===''&&$withoutAddressRow['consultationPlace']==='경기도 수원시 영통구 상담 카페','intake without address preserves selected consultation place');
check($d->query('SELECT address FROM sales_records WHERE id='.$withoutAddressId)->fetchColumn()==='','omitted address is stored as an empty string');
$birthCase=array_replace($create,['birthYear'=>1990,'birthMonth'=>'03','birthDay'=>'23','requestKey'=>'ffffffff-ffff-ffff-ffff-ffffffffffff']);
sales_mutate($one,$birthCase);$birthRow=array_values(array_filter(sales_snapshot($one,$month)['records'],fn($sale)=>$sale['birthDate']==='1990-03-23'));
check(count($birthRow)===1&&$birthRow[0]['birthYear']===1990&&$birthRow[0]['kind']==='general','full birthday and year-based kind persist');
sales_mutate($one,$birthCase);check((int)$d->query('SELECT count(*) FROM sales_birth_details')->fetchColumn()===1,'birthday retry is idempotent');
check($legacyRow['birthDate']==='','legacy year-only birth date remains empty');
foreach([[1990,'02','29'],[1990,'04','31'],[1990,'13','01'],[1990,'00','01'],[1990,'01','00'],[1990,'03',''],[1990,'','23'],[1990,[],23]] as [$y,$m,$day])rejects(fn()=>sales_mutate($one,array_replace($birthCase,['birthYear'=>$y,'birthMonth'=>$m,'birthDay'=>$day])),'invalid or incomplete birthday');
$tomorrow=(new DateTimeImmutable($today))->modify('+1 day')->format('Y-m-d');rejects(fn()=>sales_mutate($one,array_replace($birthCase,['birthYear'=>(int)substr($tomorrow,0,4),'birthMonth'=>substr($tomorrow,5,2),'birthDay'=>substr($tomorrow,8,2)])),'future birthday');
$leap=array_replace($birthCase,['birthYear'=>2000,'birthMonth'=>'02','birthDay'=>'29','requestKey'=>'abababab-abab-abab-abab-abababababab']);sales_mutate($one,$leap);
check((int)$d->query("SELECT count(*) FROM sales_birth_details WHERE birth_date='2000-02-29'")->fetchColumn()===1,'valid leap day is stored');
echo "PASS: sales ownership, role isolation, age boundaries, duplicate prevention, stale changes, both departments, test separation, status history, optional address compatibility full birth dates, and consultation persistence/validation.\n";
