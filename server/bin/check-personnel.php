<?php
// Isolated in-memory personnel fixtures. Never load production database settings.
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
require __DIR__.'/../lib/hr.php';
require __DIR__.'/../lib/personnel.php';
require __DIR__.'/../lib/native.php';
class PersonnelFixtureDB extends PDO {
    public function prepare(string $query,array $options=[]): PDOStatement|false {
        $query=str_replace(' FOR UPDATE','',$query);
        $query=str_replace('ON DUPLICATE KEY UPDATE serial=serial+1','ON CONFLICT(day) DO UPDATE SET serial=serial+1',$query);
        return parent::prepare($query,$options);
    }
}
function db(): PDO {
    static $database;
    if(!$database)$database=new PersonnelFixtureDB('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    return $database;
}
function h(string $value): string {return htmlspecialchars($value,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
function entries_for(array $user): array {return [];}
function session_timeout_minutes(): int {return 60;}
function personnel_check(bool $condition,string $message): void {if(!$condition)throw new RuntimeException($message);}
function personnel_rejects(callable $operation,string $message): void {
    try{$operation();}catch(InvalidArgumentException|HRForbidden|PDOException $e){return;}
    throw new RuntimeException('Unexpected acceptance: '.$message);
}
function personnel_fixture(array $user,array $record,bool $editing=false,bool $new=false): string {
    $admin=$user['role']==='admin';$role=$user['role'];$records=[$record];$profile=$record['profile'];
    $isNew=$new;$employeeNumber=$record['employee_no'];$id=$record['id'];$formRevision=$record['revision'];$error='';$saved=false;$accounts=[];
    $historyEntries=$admin&&!$editing?personnel_history_list($user,$id):[];
    ob_start();native_start('인사기록카드',$user,$admin?'adminStaff':'myInfo',['personnel.css'],$new);
    require __DIR__.'/../views/personnel.php';native_end();return ob_get_clean();
}
$database=db();$database->exec("PRAGMA foreign_keys=ON;
CREATE TABLE app_users(id INTEGER PRIMARY KEY,username TEXT UNIQUE,display_name TEXT,password_hash TEXT,role TEXT,department TEXT,active INTEGER DEFAULT 1);
CREATE TABLE hr_employee_sequences(day TEXT PRIMARY KEY,serial INTEGER);
CREATE TABLE hr_employees(id INTEGER PRIMARY KEY AUTOINCREMENT,employee_no TEXT UNIQUE,user_id INTEGER UNIQUE REFERENCES app_users(id),profile TEXT,revision INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE hr_personnel_events(id INTEGER PRIMARY KEY AUTOINCREMENT,employee_id INTEGER REFERENCES hr_employees(id),actor_id INTEGER REFERENCES app_users(id),event TEXT,revision INTEGER,snapshot TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE office_notices(id INTEGER PRIMARY KEY,channel TEXT,department TEXT,title TEXT,body TEXT,active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
INSERT INTO app_users(id,username,display_name,role,department) VALUES(1,'fixture-admin','관리자','admin','insurance'),(2,'fixture-one','직원 1','employee','insurance'),(3,'fixture-two','직원 2','employee','insurance');");
$_SESSION=['csrf'=>'fixture-csrf-token'];
$admin=['id'=>1,'role'=>'admin','display_name'=>'관리자','department'=>'insurance'];$employee=['id'=>2,'role'=>'employee','display_name'=>'직원 1','department'=>'insurance'];
$payload='<img src=x onerror=alert(1)>';$career='<script>alert(2)</script>';$memo='ADMIN_ONLY_PRIVATE_NOTE';
$profile=array_replace(personnel_default_profile(),['name'=>$payload,'phone'=>'010-0000-0000','startDate'=>'2026-01-01','contractStart'=>'2026-01-01','gender'=>'여','birthDate'=>'1990-01-01','address'=>'서울 <상세>','career'=>$career,'jobType'=>'고객상담','renewalDate'=>'2026-02-01','retirementReason'=>'계약 만료','deathDate'=>'','deathReason'=>'','qualification'=>'상담 교육 수료','memo'=>$memo]);
hr_mutate($admin,['action'=>'saveStaff','profile'=>$profile,'accountId'=>2]);
hr_mutate($admin,['action'=>'saveStaff','profile'=>array_replace($profile,['name'=>'다른 직원']),'accountId'=>3]);
// Older clients omit the new fields. A partial save must preserve existing register data.
hr_mutate($admin,['action'=>'saveStaff','id'=>1,'revision'=>1,'profile'=>['phone'=>'010-1111-1111']]);
$records=personnel_records($admin);$one=personnel_records($employee);
personnel_check(count($records)===2&&count($one)===1&&$one[0]['id']===1,'employee personnel scope');
$record=$one[0];$saved=$record['profile'];
foreach(['gender','birthDate','address','career','jobType','renewalDate','retirementReason','qualification','memo'] as $field)personnel_check($saved[$field]===$profile[$field],'omitted field must survive legacy save: '.$field);
personnel_check($saved['phone']==='010-1111-1111'&&$record['revision']===2,'partial edit saved with revision');
personnel_rejects(fn()=>hr_mutate($admin,['action'=>'saveStaff','id'=>1,'revision'=>1,'profile'=>['phone'=>'010-2222-2222']]),'stale edit');
personnel_rejects(fn()=>hr_mutate($employee,['action'=>'saveStaff','id'=>1,'revision'=>2,'profile'=>$profile]),'employee edit');
foreach([['birthDate'=>'2026-02-30'],['birthDate'=>(new DateTimeImmutable(hr_today()))->modify('+1 day')->format('Y-m-d')],['renewalDate'=>'2025-12-31'],['deathDate'=>'2025-12-31'],['deathDate'=>'2026-02-30'],['workStart'=>'24:00'],['payday'=>'32']] as $invalid)personnel_rejects(fn()=>hr_profile(array_replace($profile,$invalid)),'invalid personnel date/time');
$employeeHtml=personnel_fixture($employee,$record);$adminHtml=personnel_fixture($admin,$record);$editHtml=personnel_fixture($admin,$record,true);
foreach([$employeeHtml,$adminHtml,$editHtml] as $html){
    personnel_check(!str_contains($html,$payload)&&!str_contains($html,$career),'dangerous personnel HTML escaped');
    personnel_check(str_contains($html,h($payload))&&str_contains($html,h($career)),'escaped personnel text visible');
}
personnel_check(!str_contains($employeeHtml,$memo)&&str_contains($adminHtml,$memo),'admin memo omitted from employee view');
personnel_check(!str_contains($employeeHtml,'인사정보 수정'),'employee cannot edit personnel');
foreach(['12,500원','2,500원','15,000원','퇴직·해고일','퇴직·해고 사유'] as $text)personnel_check(str_contains($employeeHtml,$text),'card includes wage split/register field: '.$text);
personnel_check(str_contains($editHtml,'name="csrf" value="fixture-csrf-token"')&&str_contains($editHtml,'name="revision" value="2"'),'native form carries CSRF and current revision');
personnel_check(str_contains($employeeHtml,'data-print')&&str_contains($employeeHtml,'nf-contract-open'),'print and contract actions available');
$build=dirname(__DIR__,2).'/.build';if(!is_dir($build))mkdir($build,0700,true);
file_put_contents($build.'/personnel-employee.html',$employeeHtml);file_put_contents($build.'/personnel-admin.html',$adminHtml);file_put_contents($build.'/personnel-edit.html',$editHtml);

$newProfile=personnel_default_profile();personnel_check($newProfile['payday']==='15','new personnel payday defaults to 15');
$newRecord=['id'=>0,'revision'=>0,'profile'=>$newProfile,'user_id'=>null,'employee_no'=>personnel_next_number()];
file_put_contents($build.'/personnel-new.html',personnel_fixture($admin,$newRecord,true,true));
personnel_check(str_starts_with($newRecord['employee_no'],'cnc'.str_replace('-','',hr_today())),'auto number includes registration date');
// Every successful write is immutable and scoped to its employee; stale writes add nothing.
$history=personnel_history_list($admin,1);personnel_check(count($history)===2,'registration and confirmation retained without duplicate stale history');
$first=personnel_history_get($admin,1,(int)$history[1]['id']);$latest=personnel_history_get($admin,1,(int)$history[0]['id']);
personnel_check($first['snapshot']['profile']['phone']==='010-0000-0000'&&$latest['snapshot']['profile']['phone']==='010-1111-1111','history shows exact prior and confirmed values');
personnel_rejects(fn()=>personnel_history_get($admin,2,(int)$history[0]['id']),'history cannot be applied to another employee');
personnel_rejects(fn()=>personnel_history_get($employee,1,(int)$history[0]['id']),'employee cannot access administrator history');
personnel_check(str_contains($adminHtml,'data-personnel-history-window')&&str_contains($editHtml,'수정 확정')&&!str_contains($employeeHtml,'인사기록 수정이력'),'history popup and confirm are administrator-only');
hr_mutate($admin,['action'=>'saveStaff','id'=>1,'revision'=>2,'profile'=>$first['snapshot']['profile']]);
$restored=personnel_records($employee)[0];personnel_check($restored['profile']['phone']==='010-0000-0000'&&count(personnel_history_list($admin,1))===3,'applying a historical profile creates another confirmation and preserves later history');
personnel_check(personnel_history_get($admin,1,(int)$history[0]['id'])['snapshot']['profile']['phone']==='010-1111-1111','restore does not rewrite existing history');
personnel_rejects(fn()=>hr_mutate(['id'=>999,'role'=>'admin'],['action'=>'saveStaff','id'=>1,'revision'=>3,'profile'=>['phone'=>'010-9999-9999']]),'failed history insert rolls back profile write');
personnel_check(personnel_records($employee)[0]['revision']===3&&count(personnel_history_list($admin,1))===3,'profile and history rollback together');
// Existing records from before this feature retain a baseline on the first edit.
$q=$database->prepare('INSERT INTO hr_employees(employee_no,profile) VALUES(?,?)');$q->execute(['legacy-history-fixture',hr_json(hr_profile($profile))]);$legacyId=(int)$database->lastInsertId();
hr_mutate($admin,['action'=>'saveStaff','id'=>$legacyId,'revision'=>1,'profile'=>['phone'=>'010-3333-3333']]);
$legacyHistory=personnel_history_list($admin,$legacyId);personnel_check(count($legacyHistory)===2&&$legacyHistory[1]['event']==='baseline','legacy first edit captures original input before confirmation');
personnel_check(personnel_history_get($admin,$legacyId,(int)$legacyHistory[1]['id'])['snapshot']['profile']['phone']===$profile['phone'],'legacy baseline is faithful to original profile');
personnel_check(personnel_history_date('2026-10-01 01:00:00')==='2026-10-01 10:00:00','personnel history displayed in Korean time');
echo "PASS: personnel ownership, legacy field preservation, stale writes, date validation, escaped cards, admin memo privacy and 12,500 + 2,500 = 15,000 wage display.\n";
