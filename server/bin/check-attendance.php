<?php
// Runs only in an isolated in-memory database during deployment.
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
require __DIR__.'/../lib/attendance.php';
class AttendanceFixtureDB extends PDO {
    public function prepare(string $query,array $options=[]): PDOStatement|false{return parent::prepare(str_replace(' FOR UPDATE','',$query),$options);}
}
function db(): PDO {
    static $d;
    if(!$d)$d=new AttendanceFixtureDB('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    return $d;
}
function check(bool $value,string $message): void {if(!$value)throw new RuntimeException($message);}
function rejects(callable $operation,string $message): void {try{$operation();}catch(InvalidArgumentException|HRForbidden $e){return;}throw new RuntimeException($message);}
$d=db();$d->exec("PRAGMA foreign_keys=ON;
CREATE TABLE app_users(id INTEGER PRIMARY KEY,username TEXT,display_name TEXT,role TEXT,department TEXT,active INTEGER DEFAULT 1);
CREATE TABLE employee_checkins(user_id INTEGER REFERENCES app_users(id),work_date TEXT,check_in_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,work_date));
INSERT INTO app_users VALUES(1,'admin','관리자','admin','insurance',1),(2,'one','직원 <1>','employee','insurance',1),(3,'two','직원 2','employee','cosmetics',1),(4,'inactive','비활성 직원','employee','insurance',0),(5,'user1','테스트 직원','employee','insurance',1);");
$admin=['id'=>1,'role'=>'admin'];$one=['id'=>2,'role'=>'employee'];$two=['id'=>3,'role'=>'employee'];
$at=fn(string $time)=>new DateTimeImmutable($time,new DateTimeZone('Asia/Seoul'));
$send=fn(array $user,string $time)=>attendance_mutate($user,['action'=>'checkIn'],$at($time));
$timeFor=fn(int $id,string $date)=>array_column(attendance_snapshot($admin,$date)['records'],'checkInTime','employeeId')[$id];
$send($one,'2026-09-30 08:45:20');check($timeFor(2,'2026-09-30')==='10:00','early check-in is recorded at 10:00');
$stored=$d->query('SELECT * FROM employee_checkins WHERE user_id=2')->fetch();
check($stored['check_in_at']==='2026-09-30 01:00:00.000000','recognized time is stored consistently in UTC');
$send($one,'2026-09-30 11:32:00');check($d->query('SELECT * FROM employee_checkins WHERE user_id=2')->fetch()===$stored,'repeat requests preserve the first check-in and audit timestamp');
$send($two,'2026-09-30 10:37:46');check($timeFor(3,'2026-09-30')==='10:37','after 10:00 keeps actual check-in minute');
$send($one,'2026-10-01 10:00:00');check($timeFor(2,'2026-10-01')==='10:00','exact 10:00 boundary is preserved');
attendance_mutate($two,['action'=>'checkIn'],new DateTimeImmutable('2026-09-30 15:05:00',new DateTimeZone('UTC')));
check($timeFor(3,'2026-10-01')==='10:00','Seoul midnight uses the next work date even when the UTC date is previous day');
$staff=attendance_snapshot($one,'1900-01-01',$at('2026-10-01 11:00:00'));
check($staff===['today'=>'2026-10-01','checkedIn'=>true,'records'=>[['date'=>'2026-10-01','status'=>'출근 완료'],['date'=>'2026-09-30','status'=>'출근 완료']]],'employee response contains only own dates/status and ignores a requested date');
check(!str_contains(hr_json($staff),'10:00')&&!str_contains(hr_json($staff),'check_in_at')&&!str_contains(hr_json($staff),'checkInTime')&&!str_contains(hr_json($staff),'created_at'),'employee JSON never includes recorded or audit times');
check(attendance_snapshot($one,null,$at('2026-10-02 00:01:00'))['checkedIn']===false,'button resets for a new Seoul date');
foreach([['action'=>'checkIn','date'=>'2020-01-01'],['action'=>'checkIn','time'=>'10:00'],['action'=>'checkIn','employeeId'=>3],['action'=>'clockOut']] as $payload)rejects(fn()=>attendance_mutate($one,$payload),'client cannot choose another employee, date, time or action');
rejects(fn()=>$send($admin,'2026-10-02 09:00:00'),'administrator cannot clock in for an employee');
rejects(fn()=>attendance_snapshot(['id'=>2,'role'=>'manager']),'unrecognized role cannot read attendance');
rejects(fn()=>$send(['id'=>4,'role'=>'employee'],'2026-10-02 09:00:00'),'inactive employee cannot clock in');
rejects(fn()=>attendance_snapshot($admin,['date']),'invalid date type rejected');
rejects(fn()=>attendance_snapshot($admin,'2026-02-30'),'invalid calendar date rejected');
$all=attendance_snapshot($admin,'2026-09-30')['records'];
check(count($all)===3&&count(array_filter($all,fn($row)=>$row['checkedIn']))===2,'administrator sees active employees and checked-in/unregistered counts');
check(array_column($all,'isTest','employeeId')[5]===true,'test employee remains labeled');
$d->exec('UPDATE app_users SET active=0 WHERE id=2');
check(isset(array_column(attendance_snapshot($admin,'2026-09-30')['records'],null,'employeeId')[2]),'existing historical attendance remains visible after account deactivation');
$sample=['sales'=>[['id'=>1]],'attendance'=>[['date'=>'2026-09-30','in'=>'08:30','out'=>'17:00','status'=>'정상']]];
$safe=attendance_test_public_state($sample);check($safe['sales']===$sample['sales']&&$safe['attendance']===[['date'=>'2026-09-30','status'=>'출근 완료 (테스트)','checkedIn'=>true]],'legacy test endpoint also omits attendance times without changing stored fixtures');
check($sample['attendance'][0]['in']==='08:30','public projection leaves payroll fixture source unchanged');
check(!$d->inTransaction()&&(int)$d->query('SELECT count(*) FROM employee_checkins')->fetchColumn()===4,'invalid requests leave no pending transaction or extra records');
echo "PASS: 10:00 floor, late and exact-boundary check-in, Seoul work date, duplicate preservation, owner/role isolation, timestamp privacy, admin history and legacy test redaction.\n";
