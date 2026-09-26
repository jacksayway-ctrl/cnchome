<?php
// Isolated SQLite fixture tests; never connect to production MySQL.
declare(strict_types=1);
require __DIR__.'/../lib/hr.php';
class TestDB extends PDO {
 public function prepare(string $query,array $options=[]): PDOStatement|false {
  $query=str_replace(' FOR UPDATE','',$query);
  $query=str_replace('ON DUPLICATE KEY UPDATE serial=serial+1','ON CONFLICT(day) DO UPDATE SET serial=serial+1',$query);
  return parent::prepare($query,$options);
 }
}
function db(): PDO {static $d;if(!$d){$d=new TestDB('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);$d->sqliteCreateFunction('UTC_TIMESTAMP',fn($precision=0)=>gmdate('Y-m-d H:i:s'));}return $d;}
function check(bool $b,string $m):void {if(!$b)throw new Exception($m);}
function rejects(callable $fn,string $label):void {try{$fn();}catch(InvalidArgumentException|HRForbidden|PDOException $e){return;}throw new Exception('Unexpected success: '.$label);}
$d=db();$d->exec("PRAGMA foreign_keys=ON;
CREATE TABLE app_users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE,display_name TEXT,password_hash TEXT,role TEXT,department TEXT,active INTEGER DEFAULT 1);
CREATE TABLE hr_employee_sequences(day TEXT PRIMARY KEY,serial INTEGER);
CREATE TABLE hr_employees(id INTEGER PRIMARY KEY AUTOINCREMENT,employee_no TEXT UNIQUE,user_id INTEGER UNIQUE REFERENCES app_users(id),profile TEXT,revision INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE hr_payroll(id INTEGER PRIMARY KEY AUTOINCREMENT,employee_id INTEGER REFERENCES hr_employees(id),month TEXT,status TEXT DEFAULT 'draft',revision INTEGER DEFAULT 1,calculation TEXT,published_snapshot TEXT,published_at TEXT,confirmed_at TEXT,UNIQUE(employee_id,month));
CREATE TABLE hr_payroll_events(id INTEGER PRIMARY KEY AUTOINCREMENT,payroll_id INTEGER REFERENCES hr_payroll(id),actor_id INTEGER REFERENCES app_users(id),event TEXT,note TEXT,snapshot TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
INSERT INTO app_users(id,username,display_name,role,department) VALUES(1,'admin','관리자','admin','insurance'),(2,'one','첫째','employee','insurance'),(3,'two','둘째','employee','insurance');");
$admin=['id'=>1,'role'=>'admin'];$one=['id'=>2,'role'=>'employee'];$two=['id'=>3,'role'=>'employee'];
$p=['name'=>'테스트','phone'=>'010-0000-0000','team'=>'insurance','role'=>'상담원','startDate'=>hr_today(),'employment'=>'재직','payType'=>'시급제','payAmount'=>15000,'workDays'=>['월'],'weeklyHoliday'=>'일','contractType'=>'기간제','contractStart'=>'2026-01-31','contractTerm'=>'month'];
check(hr_contract_end('2026-01-31','month')==='2026-02-28','month end');check(hr_contract_end('2024-02-29','year')==='2025-02-28','leap year');check(hr_contract_end('2026-09-26','week')==='2026-10-02','week inclusive');
hr_mutate($admin,['action'=>'saveStaff','profile'=>$p,'accountId'=>2]);hr_mutate($admin,['action'=>'saveStaff','profile'=>$p,'accountId'=>3]);
$s=hr_snapshot($admin);check(count($s['employees'])===2,'two staff');check(str_ends_with($s['employees'][0]['employeeNo'],'001')&&str_ends_with($s['employees'][1]['employeeNo'],'002'),'sequential IDs');check($s['employees'][0]['profile']['contractEnd']==='2026-02-28','server computes end');
check(count(hr_snapshot($one)['employees'])===1,'employee privacy');rejects(fn()=>hr_mutate($one,['action'=>'saveStaff','profile'=>$p]),'employee admin write');
$save=['action'=>'savePayroll','employeeId'=>1,'month'=>substr(hr_today(),0,7),'calculation'=>['minutes'=>120,'allowance'=>1000,'deductions'=>500,'note'=>'fixture']];
hr_mutate($admin,$save);$row=hr_snapshot($admin)['payroll'][0];check($row['calculation']['net']===30500,'server calculation');check(count(hr_snapshot($one)['payroll'])===0,'draft hidden');
rejects(fn()=>hr_mutate($admin,$save),'unique month');
hr_mutate($admin,['action'=>'publish','id'=>1,'revision'=>1]);check(count(hr_snapshot($one)['payroll'])===1,'published visible');check(count(hr_snapshot($two)['payroll'])===0,'other employee private');
rejects(fn()=>hr_mutate($two,['action'=>'confirm','id'=>1,'revision'=>2,'reviewed'=>true]),'other employee confirm');
rejects(fn()=>hr_mutate($one,['action'=>'confirm','id'=>1,'revision'=>1,'reviewed'=>true]),'stale version');
hr_mutate($one,['action'=>'request','id'=>1,'revision'=>2,'note'=>'시간 확인 요청']);
$edit=$save;$edit['id']=1;$edit['revision']=3;$edit['calculation']['minutes']=180;hr_mutate($admin,$edit);
check(hr_snapshot($one)['payroll'][0]['calculation']['net']===30500,'unpublished correction hidden');
hr_mutate($admin,['action'=>'publish','id'=>1,'revision'=>4]);check(hr_snapshot($one)['payroll'][0]['calculation']['net']===45500,'republish visible');
hr_mutate($one,['action'=>'confirm','id'=>1,'revision'=>5,'reviewed'=>true]);
rejects(fn()=>hr_mutate($one,['action'=>'request','id'=>1,'revision'=>6,'note'=>'late']),'confirmed immutable');
$edit['revision']=6;rejects(fn()=>hr_mutate($admin,$edit),'admin cannot edit confirmed');
check(count(array_filter(hr_snapshot($one)['payroll'][0]['events'],fn($e)=>$e['event']==='publish'))===2,'published history retained');
check(!hr_can_change(['month'=>'2000-01','status'=>'draft'],'savePayroll',true,hr_today()),'past month locked');
rejects(fn()=>hr_calculate($p,['minutes'=>1,'allowance'=>0,'deductions'=>999999]),'negative net');
echo "PASS: HR permissions, sequential IDs, date boundaries, automatic pay calculation, publication, employee privacy, corrections, confirmation, immutable history and stale writes.\n";
