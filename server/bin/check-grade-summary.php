<?php
// Isolated SQLite fixtures. Never accesses the production database.
declare(strict_types=1);
require __DIR__.'/../lib/grade-summary.php';
function db(): PDO {static $d;return $d??=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}
function check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
$d=db();$d->exec('CREATE TABLE hr_employees(user_id INTEGER,profile TEXT);CREATE TABLE business_calendar(month TEXT PRIMARY KEY,days TEXT);CREATE TABLE grade_versions(id INTEGER PRIMARY KEY,department TEXT,effective_date TEXT,policy TEXT,saved_at TEXT DEFAULT CURRENT_TIMESTAMP);CREATE TABLE sales_records(employee_id INTEGER,department TEXT,first_date TEXT,status TEXT,is_test INTEGER);CREATE TABLE test_employee_data(user_id INTEGER,state TEXT);CREATE TABLE daily_grade_receipts(employee_id INTEGER,performance_date TEXT,milestone INTEGER,amount INTEGER,department TEXT,confirmed_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(employee_id,performance_date,milestone));');
$profile=['startDate'=>'2026-09-01','endDate'=>'','workDays'=>['월','화','수','목','금'],'role'=>'상담원'];
$policy=grade_zero_policy();$policy['dailyCash']=['start'=>6,'perCase'=>5000];
$row=$policy['weekly'][0];$policy['weekly']=[array_replace($row,['max'=>8])];
foreach(range(8,27) as $tier)$policy['weekly'][]=array_replace($row,['min'=>$tier,'max'=>$tier===27?null:$tier+1,'achievement'=>30000+($tier-8)*5000]);
$policy['monthlyReference']=array_map(fn($max)=>['max'=>$max,'hourly'=>15000,'achievement'=>0,'threshold'=>0,'extra'=>0],[2,10,null]);
$q=$d->prepare('INSERT INTO hr_employees VALUES(?,?)');foreach([1,2,3] as $id)$q->execute([$id,hr_json($profile)]);
$q=$d->prepare('INSERT INTO grade_versions(id,department,effective_date,policy) VALUES(?,?,?,?)');$q->execute([1,'insurance','2026-09-01',hr_json($policy)]);$future=$policy;$future['dailyCash']['start']=99;$q->execute([2,'insurance','2026-10-01',hr_json($future)]);
$q=$d->prepare('INSERT INTO sales_records VALUES(?,?,?,?,?)');foreach([[1,'insurance','2026-09-28','normal',0],[1,'insurance','2026-09-29','normal',0],[1,'insurance','2026-09-29','normal',0],[1,'insurance','2026-09-29','pending',0],[1,'insurance','2026-09-29','as',0],[2,'insurance','2026-09-29','normal',0],[1,'insurance','2026-09-29','normal',1],[1,'cosmetics','2026-09-29','normal',0],[1,'insurance','2026-10-01','normal',0],[3,'insurance','2026-09-29','normal',1]] as $row)$q->execute($row);
$user=['id'=>1,'role'=>'employee','department'=>'insurance','username'=>'one','display_name'=>'직원'];
// Test-looking names and incomplete identities never switch a regular account into fixture mode.
check(!cnc_test_user($user+['test'=>true]),'client-style test flag cannot classify an ordinary account');
foreach([['username'=>'one','display_name'=>'테스트 직원'],['username'=>'user1','display_name'=>'실제 직원'],['role'=>'admin','username'=>'user1','display_name'=>'테스트 직원']] as $identity)check(!cnc_test_user(array_replace($user,$identity)),'only the exact employee fixture identity is accepted');
check(!cnc_test_user(['username'=>'user1','display_name'=>'테스트 직원']),'missing employee role never grants fixture access');
foreach(range(1,6) as $number)check(cnc_test_user(['role'=>'employee','username'=>'user'.$number,'display_name'=>$number===1?'테스트 직원':'테스트 직원 '.$number]),'all six dedicated test accounts remain supported');
$staleFixture=['sales'=>array_fill(0,20,['date'=>'2026-09-29','status'=>'정상']),'attendance'=>[['date'=>'2026-09-29','in'=>'10:00','out'=>'17:00']]];
$q=$d->prepare('INSERT INTO test_employee_data VALUES(?,?)');$q->execute([1,hr_json($staleFixture)]);
$r=grade_summary_snapshot($user,'2026-09-29');check($r['daily']['count']===2&&$r['monthly']['count']===3&&$r['weekly']['count']===3,'only own normal current department non-test records');check($r['daily']['target']===6,'future policy excluded');check($r['monthly']['range']==='3~10건','current monthly tier');check($r['workdays']===['total'=>22,'elapsed'=>21],'actual month schedule and elapsed days');check($r['weekly']['value']===0.6&&$r['weekly']['availableDays']===5,'weekly progress uses full available week');
check(!$r['isTest'],'a stale fixture row cannot change the regular employee grade source');
$d->exec("UPDATE sales_records SET status='as' WHERE employee_id=1 AND first_date='2026-09-28'");check(grade_summary_snapshot($user,'2026-09-29')['monthly']['count']===2,'status change immediately changes live progress');
$firstWeek=$profile;$firstWeek['startDate']='2026-09-30';$r=grade_progress($firstWeek,['2026-09-30'=>9],$policy,'2026-09-30');check($r['weekly']['availableDays']===3&&$r['weekly']['value']===3.0,'hire week denominator includes possible days, not attendance');
$r=grade_progress($profile,['2026-09-30'=>3,'2026-10-01'=>4,'2026-10-02'=>5],$policy,'2026-10-02');check($r['weekly']['count']===12&&$r['monthly']['count']===9,'week across month boundary');
$r=grade_progress([],[],null,'2026-09-29');check(!$r['scheduleRegistered']&&!$r['policyRegistered']&&$r['workdays']['total']===22,'missing settings are not replaced with sample values');
$leader=$profile;$leader['role']='팀장';check(!grade_progress($leader,[],$policy,'2026-09-29')['general'],'leaders use separate grade rules');
$partTime=$profile;$partTime['workDays']=['월','수','금'];check(grade_progress($partTime,[],$policy,'2026-09-29')['weekly']['availableDays']===3,'saved workdays drive denominator');
$q=$d->prepare('INSERT INTO test_employee_data VALUES(?,?)');$q->execute([3,hr_json(['sales'=>[['date'=>'2026-09-29','status'=>'정상'],['date'=>'2026-09-29','status'=>'가접수']]])]);$test=['id'=>3,'role'=>'employee','department'=>'insurance','username'=>'user1','display_name'=>'테스트 직원'];$r=grade_summary_snapshot($test,'2026-09-29');check($r['isTest']&&$r['daily']['count']===2,'test account reads own stored sample and new test records');
$denied=false;try{grade_summary_snapshot(['id'=>1,'role'=>'admin'],'2026-09-29');}catch(HRForbidden $e){$denied=true;}check($denied,'admin cannot impersonate personal progress endpoint');
$q=$d->prepare('INSERT INTO grade_versions(id,department,effective_date,policy) VALUES(?,?,?,?)');$policy['dailyCash']['start']=7;$q->execute([3,'insurance','2026-09-01',hr_json($policy)]);check(grade_summary_snapshot($user,'2026-09-29')['daily']['target']===7,'latest same-date administrator setting is used');
// Individual thresholds and receipts never spill into colleagues in the same department.
$policy['dailyCash']['start']=6;
foreach([5=>0,6=>5000,7=>10000,8=>15000,9=>20000,10=>25000,11=>30000,15=>50000,30=>125000] as $count=>$amount){
    check(grade_progress($profile,['2026-09-29'=>$count],$policy,'2026-09-29')['daily']['amount']===$amount,'personal daily cash threshold');
}
$q=$d->prepare('INSERT INTO daily_grade_receipts(employee_id,performance_date,milestone,amount,department) VALUES(?,?,?,?,?)');
$q->execute([1,'2026-09-29',6,5000,'insurance']);
$q->execute([2,'2026-09-29',7,5000,'insurance']);
$q->execute([1,'2026-09-28',7,5000,'insurance']);
$r=grade_summary_snapshot($user,'2026-09-29');
check(count($r['daily']['receipts'])===1&&$r['daily']['receipts'][0]['milestone']===6&&$r['daily']['confirmedPaid']===5000&&$r['daily']['paid']===0,'old receipts isolated and retained as history, automatic amount follows earned performance');
check(grade_progress($leader,['2026-09-29'=>8],$policy,'2026-09-29')['daily']['amount']===null,'team leader does not inherit counselor award');
$late=$profile;$late['startDate']='2026-09-28';$r=grade_progress($late,[],$policy,'2026-09-29');
check($r['workdays']===['total'=>22,'elapsed'=>21],'full monthly business calendar independent of hire date');
check(grade_progress($profile,['2026-09-29'=>9],$policy,'2026-09-29')['daily']['nextTarget']===10,'next daily milestone advances after achievement');
$rows=[['min'=>0,'max'=>8,'achievement'=>0],['min'=>8,'max'=>9,'achievement'=>30000],['min'=>9,'max'=>null,'achievement'=>35000]];
$r=grade_target_tiers($rows,7.999,true);check($r['current']['min']===0&&$r['next']['min']===8,'unrounded weekly average cannot claim next tier');
$r=grade_target_tiers($rows,8.0,true);check($r['current']['amount']===30000&&$r['next']['min']===9,'weekly boundary and single tier award');
$r=grade_target_tiers($rows,9.0,true);check($r['current']['amount']===35000&&$r['next']===null,'highest weekly tier is not duplicated');
$rows=[['max'=>80,'hourly'=>15000,'achievement'=>0,'threshold'=>80,'extra'=>0],['max'=>90,'hourly'=>15000,'achievement'=>100000,'threshold'=>80,'extra'=>5000],['max'=>null,'hourly'=>16000,'achievement'=>200000,'threshold'=>90,'extra'=>5000]];
$r=grade_target_tiers($rows,80.0,false,true);check($r['current']['range']==='80건 이하'&&$r['next']['min']===81&&$r['next']['amount']===105000,'monthly next threshold and its extra amount');
$r=grade_target_tiers($rows,91.0,false,true);check($r['current']['hourly']===16000&&$r['current']['amount']===205000&&$r['next']===null,'monthly highest tier amount includes grade extras only');
// A full week of real + fixture normal records uses five weekdays, never seven or fixture-only totals.
$q=$d->prepare('INSERT INTO grade_versions(id,department,effective_date,policy) VALUES(?,?,?,?)');$q->execute([4,'insurance','2026-09-01',hr_json($policy)]);
$state=['sales'=>[]];$q=$d->prepare('INSERT INTO sales_records VALUES(?,?,?,?,?)');
foreach(grade_week('2026-09-21') as $day){for($i=0;$i<9;$i++)$state['sales'][]=['date'=>$day,'status'=>'정상'];for($i=0;$i<3;$i++)$q->execute([3,'insurance',$day,'normal',1]);$q->execute([3,'insurance',$day,'pending',1]);$q->execute([3,'insurance',$day,'as',1]);}
for($i=0;$i<100;$i++)$q->execute([3,'insurance','2026-09-26','normal',1]);
$q=$d->prepare('UPDATE test_employee_data SET state=? WHERE user_id=3');$q->execute([hr_json($state)]);
$r=grade_summary_snapshot($test,'2026-09-25');
check($r['weekly']['count']===60&&$r['weekly']['value']===12.0&&$r['weekly']['availableDays']===5&&$r['weekly']['amount']===50000&&$r['weekly']['complete'],'60 own normal cases / 5 = 12, single 50k tier, both data sources');
check(grade_summary_snapshot($test,'2026-09-27')['weekly']['amount']===50000,'weekend normal cases never enter five-day weekly grade');
$counts=['2026-09-21'=>20,'2026-09-22'=>99,'2026-09-23'=>20,'2026-09-25'=>20];
check(grade_progress($partTime,$counts,$policy,'2026-09-25')['weekly']['count']===60,'non-scheduled weekday excluded from weekly numerator and denominator');
// No receipt button is required: earned and prepaid amounts are identical even with no click records.
$before=grade_summary_snapshot($test,'2026-09-25');$q=$d->prepare('INSERT INTO daily_grade_receipts(employee_id,performance_date,milestone,amount,department) VALUES(?,?,?,?,?)');
foreach(range(6,8) as $milestone)$q->execute([3,'2026-09-25',$milestone,5000,'insurance']);
$after=grade_summary_snapshot($test,'2026-09-25');
check($before['daily']['confirmedPaid']===0&&$before['daily']['amount']===35000&&$before['daily']['paid']===35000&&$before['daily']['pending']===0&&$before['daily']['receiptMode']==='automatic','all seven achieved milestones automatically prepaid without clicks');
check($after['daily']['amount']===35000&&$after['daily']['paidCount']===7&&$after['daily']['paid']===35000&&$after['daily']['pending']===0&&$after['daily']['confirmedPaid']===15000,'old click records never reduce or duplicate cumulative amount or automatic prepayment');
// A new Wednesday policy uses two old days plus three new days, just like payroll.
$changed=$policy;foreach($changed['weekly'] as &$tier)if($tier['achievement'])$tier['achievement']+=10000;unset($tier);
$q=$d->prepare('INSERT INTO grade_versions(id,department,effective_date,policy) VALUES(?,?,?,?)');$q->execute([5,'insurance','2026-09-23',hr_json($changed)]);
$r=grade_summary_snapshot($test,'2026-09-25');check($r['weekly']['amount']===56000&&array_column($r['weekly']['parts'],'bonus')===[20000,36000],'employee weekly amount shares payroll effective-day proration');
$d->exec("CREATE TABLE app_users(id INTEGER PRIMARY KEY,username TEXT,display_name TEXT,role TEXT);INSERT INTO app_users VALUES(1,'one','직원','employee');");
$ledger=grade_employee_context(['userId'=>1,'profile'=>$profile+['team'=>'insurance']],'2026-09');
check($ledger['count']===2&&$ledger['hours']===0,'ordinary employee totals exclude stale fixture receipts and fixture attendance');
echo "PASS: cumulative daily grades and automatic receipt-independent prepayment, combined own normal records, five-day weekly average, effective-date proration, personal isolation and boundaries.\n";
