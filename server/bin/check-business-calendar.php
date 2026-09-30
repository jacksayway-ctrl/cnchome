<?php
declare(strict_types=1);
require __DIR__.'/../lib/grade-summary.php';
require __DIR__.'/../lib/native.php';
class CalendarFixtureDB extends PDO {public function prepare(string $sql,array $options=[]): PDOStatement|false{return parent::prepare(str_replace(' FOR UPDATE','',$sql),$options);}}
function db(): PDO {static $d;return $d??=new CalendarFixtureDB('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}
function check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
$d=db();$d->exec('CREATE TABLE business_calendar(month TEXT PRIMARY KEY,days TEXT,revision INTEGER,actor_id INTEGER,actor_name TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);CREATE TABLE business_calendar_events(id INTEGER PRIMARY KEY,month TEXT,actor_id INTEGER,before_days TEXT,after_days TEXT);');
$admin=['id'=>1,'role'=>'admin','department'=>'insurance','display_name'=>'가상 관리자'];$month='2026-09';
$original=business_calendar_month($month);check(count($original['days'])===22&&$original['revision']===0,'unsaved calendar defaults to 22 weekdays');
$selected=array_values(array_diff($original['days'],['2026-09-23']));$selected[]='2026-09-26';
business_calendar_save($admin,$month,$selected,0);$data=business_calendar_month($month);$calendar=business_calendar_rules($month);
check($data['revision']===1&&count($data['days'])===22&&!$calendar['2026-09-23']&&$calendar['2026-09-26'],'weekday holiday and weekend business toggles persist');
check(count(business_calendar_month('2026-10')['days'])===22,'another month retains defaults');
$caught=false;try{business_calendar_save($admin,$month,[],0);}catch(BusinessCalendarConflict $e){$caught=true;}check($caught&&business_calendar_month($month)===$data,'stale save cannot overwrite calendar');
$caught=false;try{business_calendar_save(['role'=>'employee'],$month,[],1);}catch(HRForbidden $e){$caught=true;}check($caught,'employee writes forbidden');
foreach([['2026-10-01'],['2026-09-01','2026-09-01'],['2026-09-31']] as $bad){$caught=false;try{business_calendar_save($admin,$month,$bad,1);}catch(InvalidArgumentException $e){$caught=true;}check($caught,'reject invalid, duplicate and foreign-month dates');}
$policy=grade_zero_policy();$policy['dailyCash']['perCase']=5000;$policy['weekly'][0]['achievement']=40000;$policy['monthly'][0]['achievement']=120000;$entries=[['date'=>'2000-01-01','policy'=>$policy]];
$sample=grade_ledger($month,grade_daily_sample_records($month,10,$calendar),$entries,[],$calendar);
check($sample['count']===220&&$sample['daily']===550000&&$sample['base']===1980000,'Saturday business is included in monthly forecasts');
$week=array_values(array_filter($sample['weeks'],fn($w)=>$w['start']==='2026-09-21'))[0];
check($week['days']===4&&$week['count']==40&&$week['average']==10&&$week['bonus']===32000,'weekly grade excludes holiday and weekend, keeps four-fifths proration');
$profile=['startDate'=>'2026-09-01','workDays'=>['월','화','수','목','금'],'role'=>'상담원'];
$progress=grade_progress($profile,['2026-09-23'=>10,'2026-09-24'=>10,'2026-09-26'=>100],$policy,'2026-09-27',$calendar);
check($progress['workdays']===['total'=>22,'elapsed'=>19]&&$progress['weekly']['availableDays']===4&&$progress['weekly']['count']===10,'employee header shares business calendar, weekly count excludes holiday and Saturday');
$actual=grade_ledger($month,[['date'=>'2026-09-23','count'=>10,'hours'=>6]],$entries,$profile,$calendar);
check($actual['daily']===25000&&$actual['hours']==6&&$actual['base']===90000,'holiday configuration never deletes actual work time or earned daily cash');
business_calendar_save($admin,$month,$original['days'],1);check(business_calendar_month($month)['days']===$original['days'],'second toggle restores original weekday');
business_calendar_save($admin,'2026-10',[],0);$empty=business_calendar_rules('2026-10');
check(grade_forecast_records('2026-10',0,$empty)===[],'all-holiday month permits a zero forecast');
$caught=false;try{grade_forecast_records('2026-10',10,$empty);}catch(InvalidArgumentException $e){$caught=true;}check($caught,'nonzero performance requires business days');
check((int)$d->query('SELECT COUNT(*) FROM business_calendar_events')->fetchColumn()===3,'only successful saves have audit records');
check(business_calendar_grid_dates('2026-09')[0]==='2026-08-31'&&array_slice(business_calendar_grid_dates('2026-09'),-1)[0]==='2026-10-04','Monday-first neighboring dates fill complete September rows');
check(business_calendar_grid_dates('2027-01')[0]==='2026-12-28','January grid preserves previous-year dates');
check(in_array('2024-02-29',business_calendar_grid_dates('2024-02'),true)&&array_slice(business_calendar_grid_dates('2024-02'),-1)[0]==='2024-03-03','leap-day grid ends with adjoining March dates');
// Render a standalone fixture for browser checks; the form works with HTML checkboxes and PHP POST.
$data=business_calendar_month($month);$dates=business_calendar_dates($month);$savedCount=count($data['days']);$error='';$saved=false;$_SESSION['csrf']='TEST';
ob_start();native_start('영업일 달력',$admin,'adminBusinessCalendar',['business-calendar.css']);require view_root().'/business-calendar.php';native_end();$html=ob_get_clean();
check(substr_count($html,'type="checkbox"')===30&&str_contains($html,'영업일 저장')&&str_contains($html,'name="csrf"'),'calendar has every date, save and CSRF');
check(substr_count($html,'class="bc-day bc-outside-month"')===5&&str_contains($html,'2026-08-31')&&str_contains($html,'2026-10-04'),'adjoining dates display without editable checkboxes');
file_put_contents(dirname(__DIR__,2).'/.build/business-calendar.html',$html);
echo "PASS: calendar save/restore, authorization, revisions, audit, holiday-aware five-day grades, actual earnings preservation and PHP calendar render.\n";
