<?php
declare(strict_types=1);
require __DIR__.'/../lib/calendar-holidays.php';
class CompanyHolidayFixtureDB extends PDO {
    public function prepare(string $sql,array $options=[]): PDOStatement|false {return parent::prepare(str_replace(' FOR UPDATE','',$sql),$options);}
}
function db(): PDO {static $d;return $d??=new CompanyHolidayFixtureDB('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}
function check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
function rejected(callable $callback,string $class): bool {try{$callback();return false;}catch(Throwable $e){return $e instanceof $class;}}
$d=db();$d->exec('CREATE TABLE company_calendar_holidays(holiday_date TEXT PRIMARY KEY,holiday_name TEXT,active INTEGER,revision INTEGER,actor_id INTEGER,actor_name TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);CREATE TABLE company_calendar_holiday_events(id INTEGER PRIMARY KEY,holiday_date TEXT,action TEXT,actor_id INTEGER,actor_name TEXT,before_name TEXT,after_name TEXT);CREATE TABLE business_calendar(month TEXT PRIMARY KEY,days TEXT);');
$d->exec("INSERT INTO business_calendar VALUES('2026-10','[\"2026-10-02\"]')");
$admin=['id'=>1,'role'=>'admin','display_name'=>'가상 관리자'];$employee=['id'=>2,'role'=>'employee','display_name'=>'가상 직원'];
check(calendar_holiday_range(['month'=>'2024-02'])===['2024-02-01','2024-02-29'],'month range includes leap day');
check(calendar_holiday_range(['from'=>'2026-09-27','to'=>'2026-11-07'])===['2026-09-27','2026-11-07'],'whole calendar grid supports adjoining months');
foreach([['month'=>'2026-13'],['from'=>'2026-10-01'],['from'=>'2026-10-03','to'=>'2026-10-02'],['from'=>'2026-01-01','to'=>'2027-01-06']] as $bad)check(rejected(fn()=>calendar_holiday_range($bad),InvalidArgumentException::class),'invalid or oversized date range rejected');
calendar_holiday_save($admin,['action'=>'add','date'=>'2026-10-02','name'=>'회사 창립기념일']);
$snapshot=calendar_holidays_read($employee,'2026-09-27','2026-11-07');
check($snapshot['holidays']===['2026-10-02'=>'회사 창립기념일']&&$snapshot['entries'][0]['revision']===1,'admin holiday is available to authenticated employees');
check(calendar_holidays_read($admin,'2026-09-01','2026-09-30')['holidays']===[],'outside-range holidays excluded');
check(rejected(fn()=>calendar_holidays_read(['role'=>'guest'],'2026-10-01','2026-10-31'),HRForbidden::class),'unauthorized holiday reads rejected');
check(rejected(fn()=>calendar_holiday_save($employee,['action'=>'add','date'=>'2026-10-03','name'=>'직원 입력']),HRForbidden::class),'employee cannot add holiday');
check(rejected(fn()=>calendar_holiday_save($admin,['action'=>'add','date'=>'2026-10-02','name'=>'중복']),CalendarHolidayConflict::class),'duplicate active holiday cannot be silently overwritten');
foreach([['date'=>'2026-02-30','name'=>'휴일'],['date'=>'2026-10-04','name'=>''],['date'=>'2026-10-04','name'=>str_repeat('가',81)],['date'=>'2026-10-04','name'=>"두\n줄"],['date'=>['2026-10-04'],'name'=>'휴일']] as $bad)check(rejected(fn()=>calendar_holiday_save($admin,['action'=>'add']+$bad),InvalidArgumentException::class),'invalid date and holiday name rejected');
calendar_holiday_save($admin,['action'=>'update','date'=>'2026-10-02','name'=>'회사 지정 휴일','revision'=>1]);
$updated=calendar_holidays_read($admin,'2026-10-01','2026-10-31');
check($updated['holidays']['2026-10-02']==='회사 지정 휴일'&&$updated['entries'][0]['revision']===2,'holiday edits increment revision');
check(rejected(fn()=>calendar_holiday_save($admin,['action'=>'remove','date'=>'2026-10-02','revision'=>1]),CalendarHolidayConflict::class),'stale removal rejected');
calendar_holiday_save($admin,['action'=>'remove','date'=>'2026-10-02','revision'=>2]);
check(calendar_holidays_read($employee,'2026-10-01','2026-10-31')['holidays']===[],'removed named holiday disappears from shared calendar');
calendar_holiday_save($admin,['action'=>'add','date'=>'2026-10-02','name'=>'재지정 휴일']);
check(calendar_holidays_read($employee,'2026-10-01','2026-10-31')['entries'][0]['revision']===4,'re-add retains revision history');
check(rejected(fn()=>calendar_holiday_save($admin,['action'=>'update','date'=>'2026-10-02','name'=>'오래된 수정','revision'=>2]),CalendarHolidayConflict::class),'stale editor cannot overwrite a re-added holiday');
check((int)$d->query('SELECT COUNT(*) FROM company_calendar_holiday_events')->fetchColumn()===4,'only successful holiday mutations receive audit entries');
$events=$d->query('SELECT before_name,after_name FROM company_calendar_holiday_events ORDER BY id')->fetchAll();
check($events[1]['before_name']==='회사 창립기념일'&&$events[1]['after_name']==='회사 지정 휴일'&&$events[2]['after_name']===null,'audit retains old and new labels');
check($d->query("SELECT days FROM business_calendar WHERE month='2026-10'")->fetchColumn()==='["2026-10-02"]','holiday labels never change stored business-day rules');
echo "PASS: shared company holidays, authorization, validation, revision conflicts, soft removal and audit; workday rules unchanged.\n";
