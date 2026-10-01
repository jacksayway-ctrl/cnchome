<?php
// Deployment gate: an isolated database verifies approvals and employee ownership.
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/membership.php';
require __DIR__.'/../lib/native.php';
class MembershipFixtureDB extends PDO {
    public function prepare(string $query,array $options=[]): PDOStatement|false {
        $query=str_replace(' FOR UPDATE','',$query);
        $query=str_replace('ON DUPLICATE KEY UPDATE serial=serial+1','ON CONFLICT(day) DO UPDATE SET serial=serial+1',$query);
        return parent::prepare($query,$options);
    }
}
function db(): PDO {static $d;if(!$d)$d=new MembershipFixtureDB('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);return $d;}
function check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
function rejects(callable $operation,string $message): void {try{$operation();}catch(InvalidArgumentException|HRForbidden|PDOException $e){return;}throw new RuntimeException($message);}
$d=db();$d->exec("PRAGMA foreign_keys=ON;
CREATE TABLE app_users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE,display_name TEXT,password_hash TEXT,role TEXT,department TEXT,active INTEGER DEFAULT 1);
CREATE TABLE employee_memberships(user_id INTEGER PRIMARY KEY REFERENCES app_users(id),status TEXT,phone TEXT,revision INTEGER DEFAULT 0,approved_by INTEGER REFERENCES app_users(id),approved_at TEXT,profile_completed INTEGER DEFAULT 0,profile_completed_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE hr_employee_sequences(day TEXT PRIMARY KEY,serial INTEGER);
CREATE TABLE hr_employees(id INTEGER PRIMARY KEY AUTOINCREMENT,employee_no TEXT UNIQUE,user_id INTEGER UNIQUE REFERENCES app_users(id),profile TEXT,revision INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE hr_personnel_events(id INTEGER PRIMARY KEY AUTOINCREMENT,employee_id INTEGER REFERENCES hr_employees(id),actor_id INTEGER REFERENCES app_users(id),event TEXT,revision INTEGER,snapshot TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE employee_membership_events(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER REFERENCES app_users(id),actor_id INTEGER REFERENCES app_users(id),event TEXT,payload TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
INSERT INTO app_users(username,display_name,password_hash,role,department) VALUES('admin','관리자','unused','admin','insurance');");
$admin=['id'=>1,'role'=>'admin'];$pass='Membership!23456';$base=['username'=>'JoinOne','name'=>'직원 <예시>','phone'=>'010-1234-5678','password'=>$pass,'passwordConfirm'=>$pass];
rejects(fn()=>membership_register(array_replace($base,['password'=>'','passwordConfirm'=>''])),'empty password rejected');
rejects(fn()=>membership_register(array_replace($base,['passwordConfirm'=>'different'])),'password confirmation checked');
$id=membership_register($base);$q=$d->prepare('SELECT * FROM app_users WHERE id=?');$q->execute([$id]);$account=$q->fetch();
check($account['username']==='joinone'&&cnc_password_verify($pass,$account['password_hash'])&&$account['password_hash']!==$pass,'normalized username and hashed password');
check(!$account['active']&&$account['role']==='employee'&&membership_record($id)['status']==='pending','signup cannot log in and cannot choose administrator role');
check((int)$d->query('SELECT COUNT(*) FROM hr_employees')->fetchColumn()===0,'pending applications do not create active personnel records');
rejects(fn()=>membership_register($base),'duplicate signup preserves existing account');
$employee=['id'=>$id,'role'=>'employee'];
rejects(fn()=>membership_list($employee),'employees cannot view applicant list');
rejects(fn()=>membership_notification($employee),'employees cannot read administrator notifications');
rejects(fn()=>membership_approve($employee,$id,0,'insurance',hr_today()),'employees cannot approve themselves');
rejects(fn()=>membership_save_profile($employee,[]),'pending account cannot enter personal information');
$notice=membership_notification($admin);check($notice['pendingCount']===1&&count($notice)===2,'notification exposes count/token only');
// Audit failure must leave the applicant inactive and roll back any newly created personnel record.
rejects(fn()=>membership_approve(['id'=>999,'role'=>'admin'],$id,0,'insurance',hr_today()),'invalid approving actor fails audit');
check(membership_record($id)['status']==='pending'&&(int)$d->query('SELECT COUNT(*) FROM hr_employees')->fetchColumn()===0,'approval and personnel creation roll back atomically');
membership_approve($admin,$id,0,'cosmetics',hr_today());
check(membership_record($id)['status']==='approved'&&!membership_record($id)['profile_completed'],'approval requires personal information onboarding');
check((int)$d->query('SELECT active FROM app_users WHERE id='.$id)->fetchColumn()===1,'approved account activated');
check(membership_notification($admin)['pendingCount']===0,'approved applicant removed from pending alert');
rejects(fn()=>membership_approve($admin,$id,0,'insurance',hr_today()),'duplicate/stale approval cannot repeat');
$record=$d->query('SELECT * FROM hr_employees WHERE user_id='.$id)->fetch();$original=json_decode($record['profile'],true);
$short=membership_register(array_replace($base,['username'=>'shortpass','password'=>'1','passwordConfirm'=>'1']));
$q=$d->prepare('SELECT password_hash FROM app_users WHERE id=?');$q->execute([$short]);check(cnc_password_verify('1',$q->fetchColumn()),'one-character password is accepted without a minimum length');
$longPass=str_repeat('가상!',400);$long=membership_register(array_replace($base,['username'=>'longpass','password'=>$longPass,'passwordConfirm'=>$longPass]));$q->execute([$long]);$longHash=$q->fetchColumn();
check(cnc_password_verify($longPass,$longHash)&&!cnc_password_verify($longPass.'x',$longHash),'long passwords accepted without bcrypt truncation');
check(cnc_password_verify($pass,password_hash($pass,PASSWORD_DEFAULT)),'existing account password hashes remain compatible');
membership_approve($admin,$short,0,'insurance',hr_today(),'reject');membership_approve($admin,$long,0,'insurance',hr_today(),'reject');
$second=membership_register(array_replace($base,['username'=>'second']));
$third=membership_register(array_replace($base,['username'=>'third']));membership_approve($admin,$third,0,'insurance',hr_today(),'reject');
check(membership_record($third)['status']==='rejected'&&!(int)$d->query('SELECT active FROM app_users WHERE id='.$third)->fetchColumn(),'rejected applicant remains unable to log in');
rejects(fn()=>membership_approve($admin,$second,42,'insurance',hr_today()),'stale pending revision rejected');
$in=['revision'=>'0','name'=>'본인 이름','phone'=>'010-2222-3333','birthDate'=>'1990-02-03','address'=>'가상 주소','bank'=>'가상은행','accountNumber'=>'1234567890','accountHolder'=>'본인 이름','userId'=>$second,'id'=>999,'payAmount'=>99999999,'team'=>'health','role'=>'관리자','startDate'=>'2000-01-01'];
membership_save_profile($employee,$in);$record=$d->query('SELECT * FROM hr_employees WHERE user_id='.$id)->fetch();$saved=json_decode($record['profile'],true);
check($saved['name']==='본인 이름'&&$saved['accountNumber']==='1234567890'&&membership_record($id)['profile_completed'],'personal fields saved and onboarding completed');
foreach(['payAmount','team','role','startDate','contractType','workDays'] as $key)check($saved[$key]===$original[$key],'employee cannot change administrator field: '.$key);
check((int)$d->query('SELECT COUNT(*) FROM hr_personnel_events WHERE employee_id='.(int)$record['id'])->fetchColumn()===2,'employee onboarding preserves baseline and edited information in personnel history');
check(membership_record($second)['status']==='pending'&&!membership_record($second)['profile_completed'],'posted foreign owner ignored');
rejects(fn()=>membership_save_profile($employee,$in),'stale profile rejected');
rejects(fn()=>membership_save_profile($admin,$in),'administrator cannot use employee self-service route');
rejects(fn()=>personnel_history_list($employee,(int)$record['id']),'employee cannot read personnel audit history or private administrator notes');
check(count(membership_list($admin))===5&&membership_notification($admin)['pendingCount']===1,'administrator list and current notification counts match');
$memberships=membership_list($admin);$_SESSION=['csrf'=>'FIXTURE'];ob_start();require view_root().'/partials/membership-list.php';$html=ob_get_clean();
check(str_contains($html,'직원 &lt;예시&gt;')&&!str_contains($html,'직원 <예시>'),'application names escaped');
check(str_contains($html,'name="action" value="approve"')&&str_contains($html,'name="csrf"'),'approval controls carry CSRF and explicit action');
check(native_routes()['adminMemberships']==='memberships.php','membership submenu enters protected native page');
echo "PASS: pending signup, hashed credentials, admin-only atomic approval, notifications, rejection, profile ownership and immutable wage/contract fields.\n";
