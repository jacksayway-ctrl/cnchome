<?php
// Isolated SQLite fixtures only; never connects to production MySQL.
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/contract-checklist.php';
function db(): PDO {static $d;return $d??=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}
function check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
$d=db();$d->exec('CREATE TABLE app_users(id INTEGER PRIMARY KEY,username TEXT,display_name TEXT,role TEXT,active INTEGER);CREATE TABLE hr_employees(id INTEGER PRIMARY KEY,employee_no TEXT,user_id INTEGER,profile TEXT);CREATE TABLE hr_contracts(id INTEGER PRIMARY KEY,employee_id INTEGER,version INTEGER,status TEXT,terms TEXT,issued_snapshot TEXT);CREATE TABLE hr_contract_approvals(contract_id INTEGER PRIMARY KEY,state TEXT);');
$admin=['id'=>1,'role'=>'admin'];$today='2026-10-03';
for($id=1;$id<=15;$id++){
    $userId=$id===10?null:$id;$name='직원'.$id;$username='real'.$id;$active=$id===8?0:1;
    if($id===9){$name='테스트 직원';$username='user1';}
    if($userId){$q=$d->prepare("INSERT INTO app_users VALUES(?,?,?,'employee',?)");$q->execute([$userId,$username,$name,$active]);}
    $p=['name'=>$name,'employment'=>$id===7?'퇴사':'재직','endDate'=>'','team'=>$id%3===0?'health':($id%3===1?'insurance':'cosmetics'),'payType'=>'시급제','contractType'=>'기간제','contractStart'=>'2026-09-01','contractEnd'=>'2026-10-31'];
    $q=$d->prepare('INSERT INTO hr_employees VALUES(?,?,?,?)');$q->execute([$id,'cnc'.$id,$userId,hr_json($p)]);
}
function fixture_contract(int $id,int $employee,int $version,string $state,string $start,string $end,string $type='기간제'): void {
    $terms=['contractStart'=>$start,'contractEnd'=>$end,'contractType'=>$type];$status=$state==='draft'?'draft':(in_array($state,['approved','applied','legacy'],true)?'received':'issued');
    $q=db()->prepare('INSERT INTO hr_contracts VALUES(?,?,?,?,?,?)');$q->execute([$id,$employee,$version,$status,hr_json($terms),$status==='draft'?null:hr_json(['terms'=>$terms])]);
    if($state!=='legacy'){ $q=db()->prepare('INSERT INTO hr_contract_approvals VALUES(?,?)');$q->execute([$id,$state]);}
}
fixture_contract(1,2,1,'draft','2026-10-01','2026-10-31');
fixture_contract(2,3,1,'applied','2026-09-01','2026-10-10');
fixture_contract(3,4,1,'applied','2026-09-01','2026-10-03');
fixture_contract(4,4,2,'draft','2026-10-04','2026-12-31');
fixture_contract(5,5,1,'applied','2026-09-01','2026-10-02');
fixture_contract(6,5,2,'applied','2026-10-04','2026-12-31');
fixture_contract(7,6,1,'applied','2026-09-01','','무기계약');
fixture_contract(8,11,1,'applied','2026-09-01','2026-10-05');
fixture_contract(9,11,2,'applied','2026-10-06','2026-12-31');
fixture_contract(10,12,1,'approved','2026-09-01','2026-10-31');
fixture_contract(11,13,1,'withdrawn','2026-09-01','2026-10-31');
fixture_contract(12,14,1,'legacy','2026-09-01','2026-10-31');
fixture_contract(13,15,1,'applied','2026-10-10','2026-12-31');
$before=$d->query('SELECT * FROM hr_contracts ORDER BY id')->fetchAll();
$snapshot=contract_checklist_snapshot($admin,$today);$rows=array_column($snapshot['records'],null,'employeeId');
check($snapshot['total']===12&&$snapshot['excluded']===3,'retired, suspended and dedicated test accounts excluded');
check($rows[1]['group']==='missing'&&$rows[10]['group']==='missing','employees with no contract and no login remain visible');
check($rows[2]['state']==='draft'&&$rows[2]['group']==='pending','draft is waiting rather than completed');
check($rows[3]['group']==='completed'&&$rows[3]['remainingDays']===7,'applied contract and Korean date countdown');
check($rows[4]['state']==='draft'&&$rows[4]['remainingDays']===0&&$rows[4]['renewalText']==='오늘 만료','new renewal draft does not hide current applied expiry');
check($rows[5]['remainingDays']===-1&&$rows[5]['renewal']&&$rows[5]['nextStart']==='2026-10-04','future applied contract with a gap does not hide expired current contract');
check($rows[6]['remainingDays']===null&&!$rows[6]['renewal']&&$rows[6]['renewalText']==='기간의 정함 없음','unlimited period never gets zero-day renewal alert');
check(!$rows[11]['renewal']&&str_starts_with($rows[11]['renewalText'],'갱신 완료'),'already applied seamless renewal needs no renewal action');
check($rows[12]['state']==='approved'&&$rows[12]['group']==='pending','employee approval still awaits administrator application');
check($rows[13]['group']==='missing','withdrawn-only contract is unwritten');
check($rows[14]['state']==='pending'&&$rows[14]['group']==='pending','legacy received receipt is not final contract completion');
check(!$rows[15]['renewal']&&str_starts_with($rows[15]['renewalText'],'계약 시작 예정'),'future-only applied contract displays start schedule');
check(array_sum(array_intersect_key($snapshot['counts'],array_flip(['missing','pending','completed'])))===$snapshot['total'],'primary status counts cover each employee once');
check($before===$d->query('SELECT * FROM hr_contracts ORDER BY id')->fetchAll(),'read-only checklist leaves issued snapshots unchanged');
$denied=false;try{contract_checklist_snapshot(['role'=>'employee'],$today);}catch(HRForbidden $e){$denied=true;}check($denied,'employee cannot query staff contract checklist');
echo "PASS: actual employee contract coverage, workflow status, current/future expiry, renewal drafts, unlimited periods, scope and read-only behavior.\n";
