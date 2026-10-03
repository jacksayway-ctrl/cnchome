<?php
// The sales fixture uses an isolated in-memory DB, never production records.
declare(strict_types=1);
require __DIR__.'/check-sales.php';require __DIR__.'/../lib/intake-live.php';
// The shared sales fixture predates the timestamp/audit columns used by the live calendar.
$d->exec("ALTER TABLE sales_events ADD COLUMN created_at TEXT DEFAULT '';CREATE TABLE intake_management_events(id INTEGER PRIMARY KEY AUTOINCREMENT,record_key TEXT,actor_id INTEGER REFERENCES app_users(id),action TEXT,before_data TEXT,after_data TEXT,reason TEXT,created_at TEXT);");
$d->exec('CREATE TABLE business_calendar(month TEXT PRIMARY KEY,days TEXT);CREATE TABLE company_calendar_holidays(holiday_date TEXT PRIMARY KEY,holiday_name TEXT,active INTEGER);');
$d->prepare('UPDATE sales_events SET created_at=?')->execute([gmdate('Y-m-d H:i:s')]);
$before=$d->query('SELECT * FROM sales_records ORDER BY id')->fetchAll();
$all=intake_live_snapshot($admin,[]);
check($all['total']===(int)$d->query('SELECT COUNT(*) FROM sales_records WHERE is_test=0')->fetchColumn(),'all departments include actual receipts only');
check(count($all['records'])<=30&&$all['total']===array_sum($all['counts']),'bounded page and status counts agree');
$ids=array_map('intval',array_column($all['records'],'id'));$sorted=$ids;rsort($sorted);check($ids===$sorted,'newly registered rows appear first regardless of first call date');
$team=intake_live_snapshot($admin,['team'=>'cosmetics']);foreach($team['records'] as $row)check($row['department']==='cosmetics','department filter stays isolated');
$status=intake_live_snapshot($admin,['status'=>'pending']);foreach($status['records'] as $row)check($row['status']==='pending','status filter applies to rows');
check($status['total']===$all['counts']['pending'],'filtered total matches selected state');
$empty=intake_live_snapshot($admin,['q'=>'%']);check($empty['total']===0,'search wildcards are literal');
$latest=$all['records'][0];$search=intake_live_snapshot($admin,['q'=>str_replace('-','',$latest['phone'])]);check(in_array($latest['id'],array_column($search['records'],'id'),true),'phone search supports unformatted digits');
$after=max(1,$all['latestId']-1);$poll=intake_live_snapshot($admin,['after'=>(string)$after]);$q=$d->prepare('SELECT COUNT(*) FROM sales_records WHERE is_test=0 AND id>?');$q->execute([$after]);check($poll['newCount']===(int)$q->fetchColumn(),'new arrivals counted from last observed ID');
$d->exec("UPDATE app_users SET display_name='변경 상담원' WHERE id=".(int)$latest['employeeId']);$changed=intake_live_snapshot($admin,[]);check($changed['records'][0]['employee']==='변경 상담원','counselor name resolves from current employee identity');
rejects(fn()=>intake_live_snapshot($one,[]),'employees cannot monitor colleagues');
rejects(fn()=>intake_live_snapshot($admin,['team'=>'invalid']),'invalid department rejected');
check($before===$d->query('SELECT * FROM sales_records ORDER BY id')->fetchAll(),'monitoring never modifies receipt records');
// Calendar fixtures are isolated from production and use a fixed Korea date.
function live_calendar_fixture(PDO $d,string $key,string $department,string $status,string $first,string $name,string $phone,bool $test=false): int {
    $q=$d->prepare('INSERT INTO sales_records(employee_id,department,first_date,customer_name,phone,status,is_test,request_key) VALUES(?,?,?,?,?,?,?,?)');
    $q->execute([2,$department,$first,$name,$phone,$status,$test?1:0,'calendar-'.$key]);return (int)$d->lastInsertId();
}
function live_calendar_audit(PDO $d,int $id,string $status,string $saved,string $created): void {
    $q=$d->prepare('INSERT INTO intake_management_events(record_key,actor_id,action,before_data,after_data,reason,created_at) VALUES(?,?,?,?,?,?,?)');
    $q->execute([(string)$id,1,'edit',hr_json(['status'=>$status]),hr_json(['status'=>$status,'statusChangedAt'=>$saved]),'isolated calendar check',$created]);
}
function live_calendar_event(PDO $d,int $id,string $status,string $created): void {
    $q=$d->prepare('INSERT INTO sales_events(sale_id,actor_id,old_status,new_status,created_at) VALUES(?,?,?,?,?)');$q->execute([$id,1,'pending',$status,$created]);
}
live_calendar_fixture($d,'pending-i','insurance','pending','2026-02-01','보험 가접수','01010000001');
live_calendar_fixture($d,'pending-c','cosmetics','pending','2026-02-02','화장품 가접수','01010000002');
live_calendar_fixture($d,'pending-h','health','pending','2026-02-03','건강식품 가접수','01010000003');
$id=live_calendar_fixture($d,'normal-saved','insurance','normal','2026-01-01','저장 날짜 정상','01010000004');live_calendar_audit($d,$id,'normal','2026-02-04 11:30','2026-03-09 00:00:00');
$id=live_calendar_fixture($d,'as-saved','cosmetics','as','2026-01-01','저장 날짜 AS','01010000005');live_calendar_audit($d,$id,'as','2026-02-05 13:30','2026-02-09 00:00:00');
$id=live_calendar_fixture($d,'normal-event','health','normal','2026-01-01','한국 날짜 경계','01010000006');live_calendar_event($d,$id,'normal','2026-02-05 16:00:00');
live_calendar_fixture($d,'prior-duplicate','insurance','normal','2025-12-01','중복 실적','01010000007');
$id=live_calendar_fixture($d,'next-duplicate','health','normal','2026-01-02','중복 실적(중복접수)','010-1000-0007');live_calendar_audit($d,$id,'normal','2026-02-07 11:00','2026-02-09 00:00:00');
live_calendar_fixture($d,'marked-test','insurance','normal','2026-02-04','가상 테스트','01010000008',true);
live_calendar_fixture($d,'future-pending','insurance','pending','2026-02-20','미래 가접수','01010000009');
$id=live_calendar_fixture($d,'future-normal','insurance','normal','2026-01-03','미래 정상','01010000010');live_calendar_audit($d,$id,'normal','2026-02-21 11:00','2026-02-09 00:00:00');
live_calendar_fixture($d,'legacy-as','insurance','as','2026-02-08','기존 AS','01010000011');
$id=live_calendar_fixture($d,'different-phone','health','normal','2026-01-03','중복 실적','01010000012');live_calendar_audit($d,$id,'normal','2026-02-07 11:00','2026-02-09 00:00:00');
$id=live_calendar_fixture($d,'outside-saved','cosmetics','normal','2026-02-04','저장일 다른달','01010000013');live_calendar_audit($d,$id,'normal','2026-03-05 11:00','2026-02-09 00:00:00');
$id=live_calendar_fixture($d,'newer-event','insurance','normal','2026-01-01','나중 정상 전환','01010000014');live_calendar_audit($d,$id,'normal','2026-02-02 11:00','2026-02-02 03:00:00');live_calendar_event($d,$id,'normal','2026-02-07 16:00:00');
$id=live_calendar_fixture($d,'corrected-date','cosmetics','normal','2026-01-01','변경일 수정','01010000015');live_calendar_event($d,$id,'normal','2026-02-07 16:00:00');live_calendar_audit($d,$id,'normal','2026-02-01 11:00','2026-02-09 00:00:00');
$id=live_calendar_fixture($d,'legacy-audit','insurance','as','2026-01-01','기존 변경 이력','01010000016');
$q=$d->prepare('INSERT INTO intake_management_events(record_key,actor_id,action,before_data,after_data,reason,created_at) VALUES(?,?,?,?,?,?,?)');
$q->execute([(string)$id,1,'status',hr_json(['status'=>'pending']),hr_json(['status'=>'as']),'legacy status change','2026-02-09 16:00:00']);
$q->execute([(string)$id,1,'edit',hr_json(['status'=>'as']),hr_json(['status'=>'as','note'=>'later memo']),'memo only','2026-02-10 01:00:00']);
$calendarBefore=[];foreach(['sales_records','sales_events','intake_management_events'] as $table)$calendarBefore[$table]=$d->query('SELECT * FROM '.$table.' ORDER BY id')->fetchAll();
$calendar=intake_live_calendar($d,'2026-02','2026-02-10');$days=array_column($calendar['days'],null,'date');
check(count($days)===28&&$calendar['today']==='2026-02-10','calendar contains every day and explicit Korea today');
check($days['2026-02-01']['insurance']['pending']===1&&$days['2026-02-02']['cosmetics']['pending']===1&&$days['2026-02-03']['health']['pending']===1,'three departments keep first call pending counts separate');
check($days['2026-02-04']['insurance']['normal']===1&&$days['2026-02-05']['cosmetics']['as']===1,'saved status dates count an earlier first call in the selected month');
check($days['2026-02-06']['health']['normal']===1,'UTC status event maps to following Korean calendar day');
check($days['2026-02-07']['health']['normal']===1&&$calendar['totals']['health']['normal']===2,'duplicate customer and phone are not paid twice across months or departments');
check($days['2026-02-08']['insurance']['as']===1&&$days['2026-02-08']['insurance']['normal']===1&&$days['2026-02-02']['insurance']['normal']===0,'legacy date fallback and later actual state transition retain correct attribution');
check($days['2026-02-01']['cosmetics']['normal']===1&&$calendar['totals']['cosmetics']['normal']===1,'latest saved date correction wins and another saved month is excluded');
check($calendar['totals']['insurance']===['pending'=>1,'normal'=>2,'as'=>2],'future and marked test records never inflate calendar totals');
check($days['2026-02-10']['insurance']['as']===1,'legacy status audit supplies Korean date and later memo edit does not replace it');
foreach($days as $day)if($day['date']>'2026-02-10')foreach(['insurance','cosmetics','health'] as $department)check(array_sum($day[$department])===0,'future calendar days remain empty');
foreach(['insurance','cosmetics','health'] as $department)foreach(['pending','normal','as'] as $state)check(array_sum(array_map(fn($day)=>$day[$department][$state],$calendar['days']))===$calendar['totals'][$department][$state],'daily counts equal monthly department totals');
check(!$days['2026-02-01']['showValues']&&!$days['2026-02-07']['showValues']&&$days['2026-02-04']['showValues']&&!$days['2026-02-20']['showValues'],'past weekdays show values while weekends and future dates show only dates');
$d->exec("INSERT INTO company_calendar_holidays VALUES('2026-02-09','회사 휴일',1)");
$display=intake_live_calendar_display($d,'2026-02','2026-02-10');check(!$display['2026-02-09']['showValues'],'company holidays hide values without changing receipts');
$d->prepare('INSERT INTO business_calendar VALUES(?,?)')->execute(['2026-02',hr_json(['2026-02-01','2026-02-07','2026-02-09','2026-02-20'])]);
$display=intake_live_calendar_display($d,'2026-02','2026-02-10');
check($display['2026-02-01']['showValues']&&$display['2026-02-07']['showValues']&&$display['2026-02-09']['showValues']&&!$display['2026-02-04']['showValues']&&!$display['2026-02-20']['showValues'],'explicit administrator workdays override weekend and holiday defaults but never future dates');
$d->exec("DELETE FROM business_calendar;DELETE FROM company_calendar_holidays");
$display=intake_live_calendar_display($d,'2026-10','2026-10-10');check(!$display['2026-10-05']['showValues']&&!$display['2026-10-09']['showValues']&&$display['2026-10-08']['showValues'],'verified statutory and substitute holidays are date-only in initial HTML');
// Management counts use raw receipts, not paid-performance deduplication.
$normalFilters=intake_filters(['month'=>'2026-02','scope'=>'real','team'=>'insurance','status'=>'normal']);
$normalCandidates=intake_actual_normal_records($admin,$normalFilters);
$firstNormal=intake_filtered($normalCandidates,array_replace($normalFilters,['dateBasis'=>'first']));
$actualNormal=intake_filtered($normalCandidates,array_replace($normalFilters,['dateBasis'=>'actual']));
check(count($firstNormal)===0&&count($actualNormal)===3,'prior-month calls count by their actual normal receipt month without changing first-call totals');
check(count(intake_filtered($normalCandidates,array_replace($normalFilters,['dateBasis'=>'actual','q'=>'저장 날짜 정상'])))===1,'both count bases retain name and department search filters');
check(count(intake_filtered($normalCandidates,array_replace($normalFilters,['dateBasis'=>'actual','from'=>'2026-02-04','to'=>'2026-02-06'])))===1,'actual receipt date range selects the matching completed receipts');
rejects(fn()=>intake_actual_normal_records($one,$normalFilters),'actual receipt statistics remain administrator-only');
rejects(fn()=>intake_filters(['dateBasis'=>'invalid']),'invalid count basis is rejected');
$cosmeticFilters=intake_filters(['month'=>'2026-02','scope'=>'real','team'=>'cosmetics','status'=>'normal','dateBasis'=>'actual']);
$cosmeticActual=intake_filtered(intake_actual_normal_records($admin,$cosmeticFilters),$cosmeticFilters);
check(count($cosmeticActual)===1&&$cosmeticActual[0]['statusDate']==='2026-02-01','saved date correction wins while another actual month is excluded');
$healthFilters=intake_filters(['month'=>'2026-02','scope'=>'real','team'=>'health','status'=>'normal','dateBasis'=>'actual']);
$healthActual=intake_filtered(intake_actual_normal_records($admin,$healthFilters),$healthFilters);
check(count($healthActual)===3&&in_array('2026-02-06',array_column($healthActual,'statusDate'),true),'actual-date receipt counts retain duplicate receipt rows and Korea midnight attribution');
$base=intake_live_snapshot($admin,['calendarMonth'=>'2026-02']);$filtered=intake_live_snapshot($admin,['calendarMonth'=>'2026-02','q'=>'no-such-customer','team'=>'health','status'=>'as','p'=>'9']);
check($base['calendar']===$filtered['calendar']&&$filtered['total']===0,'calendar remains independent of table filters and pagination');
check($all['calendar']['month']===substr(hr_today(),0,7),'default calendar month is Korea current month');
foreach(['invalid','2026-13','1999-12','2101-01',[]] as $monthValue)rejects(fn()=>intake_live_snapshot($admin,['calendarMonth'=>$monthValue]),'invalid or unbounded calendar month');
check(count(intake_live_calendar($d,'2028-02','2028-02-29')['days'])===29,'leap month includes its last date');
$grid=intake_live_calendar_grid_dates('2026-05');
check(count($grid)===42&&$grid[0]==='2026-04-26'&&end($grid)==='2026-06-06','six-week month includes preceding and following display dates');
check(intake_live_calendar_grid_dates('2026-02')===array_column($calendar['days'],'date'),'Sunday-start four-week month has exactly four complete rows');
check(in_array('2028-02-29',intake_live_calendar_grid_dates('2028-02'),true),'complete grid preserves leap dates');
check(intake_live_calendar_grid_dates('2027-01')[0]==='2026-12-27','January display grid includes the previous year');
require_once __DIR__.'/../lib/native.php';
$calendarMonth='2026-05';$calendarToday='2026-05-01';$calendarSeed=['month'=>$calendarMonth,'today'=>$calendarToday];
ob_start();require view_root().'/intake-live.php';$emptyCalendarHtml=ob_get_clean();
check(substr_count($emptyCalendarHtml,'class="intake-live-calendar-date"')===42&&str_contains($emptyCalendarHtml,'datetime="2026-05-31"')&&str_contains($emptyCalendarHtml,'datetime="2026-06-06"'),'HTML shows every month date and neighboring dates before any data request');
check(str_contains($emptyCalendarHtml,'id="intake-live-calendar-seed"')&&str_contains($emptyCalendarHtml,'data-live-holiday-manage'),'empty calendar includes its selected month and holiday management link');
check(!str_contains($emptyCalendarHtml,'data-calendar-department='),'future dates and the May 1 holiday contain only dates while the calendar is loading');
$calendarMonth='2026-02';$calendarToday='2026-02-10';$calendarSeed=['month'=>$calendarMonth,'today'=>$calendarToday];
ob_start();require view_root().'/intake-live.php';$loadingCalendarHtml=ob_get_clean();
check(substr_count($loadingCalendarHtml,'data-calendar-department=')===7*3&&str_contains($loadingCalendarHtml,'data-calendar-status="normal">—</b>'),'only past working days show three department placeholders and missing data is never shown as zero');
$calendarMonth='2026-02';$calendarToday='2026-02-10';$calendarSeed=$calendar;
ob_start();require view_root().'/intake-live.php';$loadedCalendarHtml=ob_get_clean();
check(substr_count($loadedCalendarHtml,'data-calendar-department=')===7*3&&substr_count($loadedCalendarHtml,'data-calendar-status=')===7*9,'only elapsed working dates show all three department counts after loading');
check(str_contains($loadedCalendarHtml,'aria-label="보험 정상접수 1건"')&&str_contains($loadedCalendarHtml,'aria-label="화장품 A/S 1건"')&&str_contains($loadedCalendarHtml,'aria-label="건강식품 정상접수 1건"'),'initial HTML carries real status-date department totals');
check(str_contains($loadedCalendarHtml,'data-calendar-status="pending">0</b>')&&!str_contains($loadedCalendarHtml,'data-calendar-status="normal">—</b>'),'loaded dates show actual zero counts without loading placeholders');
foreach($calendarBefore as $table=>$rows)check($rows===$d->query('SELECT * FROM '.$table.' ORDER BY id')->fetchAll(),'calendar polling never changes receipts or status history');
echo "PASS: all-department calendar, date-only future/nonworking days, explicit workdays and holidays, dual first/actual receipt counts across months, saved date corrections, Korea UTC boundaries and read-only polling.\n";
