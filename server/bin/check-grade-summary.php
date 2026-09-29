<?php
// Isolated SQLite fixtures. Never accesses the production database.
declare(strict_types=1);
require __DIR__.'/../lib/grade-summary.php';
function db(): PDO {static $d;return $d??=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}
function check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
$d=db();$d->exec('CREATE TABLE hr_employees(user_id INTEGER,profile TEXT);CREATE TABLE grade_versions(id INTEGER PRIMARY KEY,department TEXT,effective_date TEXT,policy TEXT);CREATE TABLE sales_records(employee_id INTEGER,department TEXT,first_date TEXT,status TEXT,is_test INTEGER);CREATE TABLE test_employee_data(user_id INTEGER,state TEXT);CREATE TABLE daily_grade_receipts(employee_id INTEGER,performance_date TEXT,milestone INTEGER,amount INTEGER,department TEXT,confirmed_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(employee_id,performance_date,milestone));');
$profile=['startDate'=>'2026-09-01','endDate'=>'','workDays'=>['월','화','수','목','금'],'role'=>'상담원'];
$policy=['dailyCash'=>['start'=>6,'perCase'=>5000],'weeklyBasis'=>'average','weekly'=>[['min'=>0,'achievement'=>0,'extra'=>0],['min'=>8,'achievement'=>30000,'extra'=>0]],'monthlyReference'=>[['max'=>2],['max'=>10],['max'=>null]]];
$q=$d->prepare('INSERT INTO hr_employees VALUES(?,?)');foreach([1,2,3] as $id)$q->execute([$id,hr_json($profile)]);
$q=$d->prepare('INSERT INTO grade_versions VALUES(?,?,?,?)');$q->execute([1,'insurance','2026-09-01',hr_json($policy)]);$future=$policy;$future['dailyCash']['start']=99;$q->execute([2,'insurance','2026-10-01',hr_json($future)]);
$q=$d->prepare('INSERT INTO sales_records VALUES(?,?,?,?,?)');foreach([[1,'insurance','2026-09-28','normal',0],[1,'insurance','2026-09-29','normal',0],[1,'insurance','2026-09-29','normal',0],[1,'insurance','2026-09-29','pending',0],[1,'insurance','2026-09-29','as',0],[2,'insurance','2026-09-29','normal',0],[1,'insurance','2026-09-29','normal',1],[1,'cosmetics','2026-09-29','normal',0],[1,'insurance','2026-10-01','normal',0],[3,'insurance','2026-09-29','normal',1]] as $row)$q->execute($row);
$user=['id'=>1,'role'=>'employee','department'=>'insurance','username'=>'one','display_name'=>'직원'];
$r=grade_summary_snapshot($user,'2026-09-29');check($r['daily']['count']===2&&$r['monthly']['count']===3&&$r['weekly']['count']===3,'only own normal current department non-test records');check($r['daily']['target']===6,'future policy excluded');check($r['monthly']['range']==='3~10건','current monthly tier');check($r['workdays']===['total'=>22,'elapsed'=>21],'actual month schedule and elapsed days');check($r['weekly']['value']===0.6&&$r['weekly']['availableDays']===5,'weekly progress uses full available week');
$d->exec("UPDATE sales_records SET status='as' WHERE employee_id=1 AND first_date='2026-09-28'");check(grade_summary_snapshot($user,'2026-09-29')['monthly']['count']===2,'status change immediately changes live progress');
$firstWeek=$profile;$firstWeek['startDate']='2026-09-30';$r=grade_progress($firstWeek,['2026-09-30'=>9],$policy,'2026-09-30');check($r['weekly']['availableDays']===3&&$r['weekly']['value']===3.0,'hire week denominator includes possible days, not attendance');
$r=grade_progress($profile,['2026-09-30'=>3,'2026-10-01'=>4,'2026-10-02'=>5],$policy,'2026-10-02');check($r['weekly']['count']===12&&$r['monthly']['count']===9,'week across month boundary');
$r=grade_progress([],[],null,'2026-09-29');check(!$r['scheduleRegistered']&&!$r['policyRegistered']&&$r['workdays']['total']===22,'missing settings are not replaced with sample values');
$leader=$profile;$leader['role']='팀장';check(!grade_progress($leader,[],$policy,'2026-09-29')['general'],'leaders use separate grade rules');
$partTime=$profile;$partTime['workDays']=['월','수','금'];check(grade_progress($partTime,[],$policy,'2026-09-29')['weekly']['availableDays']===3,'saved workdays drive denominator');
$q=$d->prepare('INSERT INTO test_employee_data VALUES(?,?)');$q->execute([3,hr_json(['sales'=>[['date'=>'2026-09-29','status'=>'정상'],['date'=>'2026-09-29','status'=>'가접수']]])]);$test=['id'=>3,'role'=>'employee','department'=>'insurance','username'=>'user1','display_name'=>'테스트 직원'];$r=grade_summary_snapshot($test,'2026-09-29');check($r['isTest']&&$r['daily']['count']===2,'test account reads own stored sample and new test records');
$denied=false;try{grade_summary_snapshot(['id'=>1,'role'=>'admin'],'2026-09-29');}catch(HRForbidden $e){$denied=true;}check($denied,'admin cannot impersonate personal progress endpoint');
$q=$d->prepare('INSERT INTO grade_versions VALUES(?,?,?,?)');$policy['dailyCash']['start']=7;$q->execute([3,'insurance','2026-09-01',hr_json($policy)]);check(grade_summary_snapshot($user,'2026-09-29')['daily']['target']===7,'latest same-date administrator setting is used');
// Individual thresholds and receipts never spill into colleagues in the same department.
$policy['dailyCash']['start']=6;
foreach([5=>0,6=>5000,7=>10000,8=>15000] as $count=>$amount){
    check(grade_progress($profile,['2026-09-29'=>$count],$policy,'2026-09-29')['daily']['amount']===$amount,'personal daily cash threshold');
}
$q=$d->prepare('INSERT INTO daily_grade_receipts(employee_id,performance_date,milestone,amount,department) VALUES(?,?,?,?,?)');
$q->execute([1,'2026-09-29',6,5000,'insurance']);
$q->execute([2,'2026-09-29',7,5000,'insurance']);
$q->execute([1,'2026-09-28',7,5000,'insurance']);
$r=grade_summary_snapshot($user,'2026-09-29');
check(count($r['daily']['receipts'])===1&&$r['daily']['receipts'][0]['milestone']===6&&$r['daily']['paid']===5000,'receipts isolated by employee and day, retained after performance drops');
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
echo "PASS: personal DB isolation, normal status changes, effective policies, calendar and hire-week boundaries, role and test-account separation.\n";
