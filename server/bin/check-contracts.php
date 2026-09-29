<?php
// Isolated SQLite fixtures. Never connects to production MySQL.
declare(strict_types=1);
require __DIR__.'/../lib/contracts.php';
class ContractTestDB extends PDO {
    public function prepare(string $query,array $options=[]): PDOStatement|false {return parent::prepare(str_replace([' FOR UPDATE','INSERT IGNORE'],['','INSERT OR IGNORE'],$query),$options);}
    public function query(string $query,?int $fetchMode=null,mixed ...$fetchModeArgs): PDOStatement|false {
        $query=str_replace([' FOR UPDATE','INSERT IGNORE'],['','INSERT OR IGNORE'],$query);
        return $fetchMode===null?parent::query($query):parent::query($query,$fetchMode,...$fetchModeArgs);
    }
}
function db(): PDO {
    static $d;
    if(!$d){$d=new ContractTestDB('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);$d->sqliteCreateFunction('UTC_TIMESTAMP',fn($precision=0)=>gmdate('Y-m-d H:i:s'));}
    return $d;
}
function check(bool $condition,string $label): void {if(!$condition)throw new RuntimeException($label);}
function rejects(callable $fn,string $label): void {try{$fn();}catch(InvalidArgumentException $e){return;}throw new RuntimeException('Unexpected success: '.$label);}
function posted_terms(array $terms): array {
    $terms['existingWageAgreement']=$terms['existingWageAgreement']?'1':'';
    foreach($terms['schedule'] as &$day)$day['working']=$day['working']?'1':'';
    unset($day);return $terms;
}
function saved_terms(int $id,array $terms,array $admin): array {
    $row=contract_find($id,$admin);contract_mutate($admin,['action'=>'save','id'=>$id,'revision'=>$row['revision'],'terms'=>posted_terms($terms)]);return contract_find($id,$admin);
}
$d=db();$d->exec("PRAGMA foreign_keys=ON;
CREATE TABLE app_users(id INTEGER PRIMARY KEY,display_name TEXT,role TEXT);
CREATE TABLE hr_employees(id INTEGER PRIMARY KEY,employee_no TEXT,user_id INTEGER REFERENCES app_users(id),profile TEXT);
CREATE TABLE hr_contract_settings(id INTEGER PRIMARY KEY,settings TEXT,revision INTEGER DEFAULT 1,updated_by INTEGER REFERENCES app_users(id),updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE hr_contracts(id INTEGER PRIMARY KEY AUTOINCREMENT,employee_id INTEGER REFERENCES hr_employees(id),recipient_user_id INTEGER REFERENCES app_users(id),version INTEGER,revision INTEGER DEFAULT 1,status TEXT DEFAULT 'draft',terms TEXT,issued_snapshot TEXT,content_hash TEXT,created_by INTEGER REFERENCES app_users(id),received_by INTEGER REFERENCES app_users(id),created_at TEXT DEFAULT CURRENT_TIMESTAMP,issued_at TEXT,received_at TEXT,UNIQUE(employee_id,version));
CREATE TABLE hr_contract_events(id INTEGER PRIMARY KEY AUTOINCREMENT,contract_id INTEGER REFERENCES hr_contracts(id),actor_id INTEGER REFERENCES app_users(id),event TEXT,snapshot TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
INSERT INTO app_users VALUES(1,'관리자','admin'),(2,'직원 갑','employee'),(3,'직원 을','employee');");
$admin=['id'=>1,'role'=>'admin'];$one=['id'=>2,'role'=>'employee'];$two=['id'=>3,'role'=>'employee'];
$profile=['name'=>'직원 갑','birthDate'=>'1990-01-01','phone'=>'010-0000-0000','address'=>'서울특별시 테스트로 1','addressDetail'=>'101호','payType'=>'시급제','payAmount'=>15000,'startDate'=>hr_today(),'contractStart'=>hr_today(),'contractType'=>'무기계약','contractEnd'=>'','workDays'=>['월','화','수','목','금'],'weeklyHoliday'=>'일','workplace'=>'서울 사무실','duties'=>'상담 업무'];
$q=$d->prepare('INSERT INTO hr_employees VALUES(?,?,?,?)');$q->execute([1,'cnc0001',2,hr_json($profile)]);$q->execute([2,'cnc0002',3,hr_json(array_replace($profile,['name'=>'직원 을']))]);$q->execute([3,'cnc0003',null,hr_json($profile)]);
$company=array_replace(contract_company_defaults(),['employerName'=>'테스트 사업장','representative'=>'대표자','employerAddress'=>'서울특별시 테스트로 2','employerPhone'=>'02-000-0000']);
check(contract_company_row()['revision']===0,'company starts at revision zero');
rejects(fn()=>contract_mutate($one,['action'=>'saveCompany','revision'=>0,'company'=>$company]),'employee cannot change employer settings');
contract_mutate($admin,['action'=>'saveCompany','revision'=>0,'company'=>$company]);
check(contract_company_row()['revision']===1,'company saved');
rejects(fn()=>contract_mutate($admin,['action'=>'saveCompany','revision'=>0,'company'=>$company]),'stale company revision');
rejects(fn()=>contract_mutate($one,['action'=>'create','employeeId'=>1]),'employee cannot create contract');
$id=contract_mutate($admin,['action'=>'create','employeeId'=>1]);$row=contract_find($id,$admin);
check($row['version']===1&&$row['status']==='draft','first draft created');
check(contract_find($id,$one)===null&&contract_list($one)===[],'unissued draft hidden');
rejects(fn()=>contract_mutate($admin,['action'=>'create','employeeId'=>1]),'one open draft per employee');
rejects(fn()=>contract_mutate($one,['action'=>'acknowledge','id'=>$id,'revision'=>1,'reviewed'=>'1']),'unissued acknowledgement rejected');
rejects(fn()=>contract_mutate($admin,['action'=>'issue','id'=>$id,'revision'=>1]),'missing working hours and wage agreement');
$terms=$row['terms'];$terms['existingWageAgreement']=true;
foreach($terms['schedule'] as &$day)if($day['working']){$day['start']='09:00';$day['end']='15:30';$day['breakStart']='12:00';$day['breakEnd']='12:30';}unset($day);
foreach(['insurancePension','insuranceHealth','insuranceEmployment','insuranceAccident'] as $key)$terms[$key]='적용';
$terms['insuranceException']='';$terms['bonusTerms']='없음';$terms['otherAllowanceTerms']='없음';
$row=saved_terms($id,$terms,$admin);$terms=$row['terms'];
check(contract_issue_errors($terms,$row)===[],'complete part-time contract ready to issue');
check(contract_schedule_totals($terms)===['minutes'=>1800,'days'=>5],'daily schedule gives thirty weekly hours');
check(contract_text("추가\n\n 약정\t내용",30,'test')==='추가 약정 내용','print whitespace normalized without losing words');
$boundary=$terms;
foreach(['employerName'=>50,'representative'=>30,'employeeName'=>50,'businessNumber'=>20,'employerPhone'=>20,'employeePhone'=>20] as $key=>$max)$boundary[$key]=str_repeat('가',$max);
$printLimits=['employerAddress'=>100,'employeeAddress'=>120,'workplace'=>100,'duties'=>100,'paymentPeriod'=>50,'paymentMethod'=>50,'holidayDetail'=>100,'leaveDetail'=>100,'extraTerms'=>300,'insuranceException'=>100,'bonusTerms'=>100,'otherAllowanceTerms'=>100];
foreach($printLimits as $key=>$max)$boundary[$key]=str_repeat('가',(int)floor(510*$max/array_sum($printLimits)));
$boundary['extraTerms'].=str_repeat('가',700-contract_print_text_length($boundary));
check(contract_print_text_length($boundary)===700&&contract_issue_errors($boundary,$row)===[],'seven hundred character printable boundary is valid');
$overflow=$boundary;$overflow['extraTerms'].='가';check(count(contract_issue_errors($overflow,$row))>0,'one character beyond print budget blocks issue');
$invalid=posted_terms($terms);$invalid['extraTerms']="첫 문장\n\n둘째 문장";check(contract_terms($invalid)['extraTerms']==='첫 문장 둘째 문장','saved printable terms preserve text while removing layout-breaking newlines');

foreach([
    'employer missing'=>array_replace($terms,['employerName'=>'']),
    'retroactive wage change'=>array_replace($terms,['wageEffective'=>(new DateTimeImmutable(hr_today()))->modify('-1 day')->format('Y-m-d')]),
    'unsigned prior wage check'=>array_replace($terms,['existingWageAgreement'=>false]),
    'period end before start'=>array_replace($terms,['contractType'=>'기간제','contractEnd'=>'2000-01-01']),
    'future birth'=>array_replace($terms,['employeeBirth'=>'2099-01-01']),
] as $label=>$invalid)check(count(contract_issue_errors($invalid,$row))>0,$label.' must block issue');
$invalid=$terms;$invalid['schedule'][0]['breakEnd']='12:10';check(count(contract_issue_errors($invalid,$row))>0,'insufficient break blocks issue');
$invalid=$terms;$invalid['schedule'][0]['end']='08:00';check(count(contract_issue_errors($invalid,$row))>0,'overnight or negative schedule blocked');
$invalid=$terms;$invalid['weeklyHoliday']='월';check(count(contract_issue_errors($invalid,$row))>0,'weekly holiday conflicts with regular work');
$unlinked=$row;$unlinked['user_id']=null;check(count(contract_issue_errors($terms,$unlinked))>0,'unlinked employee cannot be issued a portal contract');
$invalid=$terms;$invalid['employeeName']=str_repeat('가',51);rejects(fn()=>contract_terms(posted_terms($invalid)),'overlong contract text');
$invalid=posted_terms($terms);$invalid['baseHourly']=['12500'];rejects(fn()=>contract_terms($invalid),'array instead of pay rate');
rejects(fn()=>contract_mutate($admin,['action'=>'issue','id'=>$id,'revision'=>1]),'stale issue revision');
contract_mutate($admin,['action'=>'issue','id'=>$id,'revision'=>$row['revision']]);$issued=contract_find($id,$admin);
check($issued['status']==='issued'&&$issued['recipient_user_id']==2,'issued contract recipient fixed');
check($issued['content_hash']===hash('sha256',hr_json($issued['issued_snapshot'])),'hash binds immutable issued snapshot');
check(contract_find($id,$one)!==null&&count(contract_list($one))===1,'recipient can view issued contract');
check(contract_find($id,$two)===null&&contract_list($two)===[],'other employee cannot view issued contract');
rejects(fn()=>contract_mutate($two,['action'=>'acknowledge','id'=>$id,'revision'=>$issued['revision'],'reviewed'=>'1']),'other employee cannot acknowledge');
rejects(fn()=>contract_mutate($one,['action'=>'acknowledge','id'=>$id,'revision'=>$issued['revision'],'reviewed'=>'']),'review confirmation required');
rejects(fn()=>contract_mutate($one,['action'=>'acknowledge','id'=>$id,'revision'=>1,'reviewed'=>'1']),'stale acknowledgement');
rejects(fn()=>contract_mutate($admin,['action'=>'save','id'=>$id,'revision'=>$issued['revision'],'terms'=>posted_terms($terms)]),'issued contract cannot be edited');
rejects(fn()=>contract_mutate($admin,['action'=>'issue','id'=>$id,'revision'=>$issued['revision']]),'issued contract cannot be reissued');
contract_mutate($one,['action'=>'acknowledge','id'=>$id,'revision'=>$issued['revision'],'reviewed'=>'1']);$received=contract_find($id,$admin);
check($received['status']==='received'&&$received['received_by']==2&&$received['received_at'],'acknowledgement records receipt');
check($received['issued_snapshot']===$issued['issued_snapshot']&&$received['content_hash']===$issued['content_hash'],'receipt preserves issued agreement');
$event=$d->query("SELECT snapshot FROM hr_contract_events WHERE event='received'")->fetchColumn();check(str_contains($event,'서명이나 임금 변경 동의의 대체가 아님'),'receipt explicitly does not record signature or wage consent');
check(!str_contains(hr_json($received),'"status":"signed"'),'receipt never claims signed contract');
rejects(fn()=>contract_mutate($one,['action'=>'acknowledge','id'=>$id,'revision'=>$received['revision'],'reviewed'=>'1']),'duplicate acknowledgement');
$company['employerName']='변경된 사업장';contract_mutate($admin,['action'=>'saveCompany','revision'=>1,'company'=>$company]);
$d->prepare('UPDATE hr_employees SET profile=? WHERE id=1')->execute([hr_json(array_replace($profile,['name'=>'인사정보 변경','payAmount'=>99999]))]);
check(contract_find($id,$one)['issued_snapshot']===$issued['issued_snapshot'],'company and personnel edits do not rewrite issued terms');
$newId=contract_mutate($admin,['action'=>'revise','id'=>$id]);$revised=contract_find($newId,$admin);
check($revised['version']===2&&$revised['status']==='draft','revision creates a new numbered draft');
check(!$revised['terms']['existingWageAgreement']&&$revised['terms']['employeeName']==='직원 갑','revision resets wage review and copies issued snapshot');
check(count(contract_list($one))===1,'new draft remains hidden while prior version is readable');
$newTerms=$revised['terms'];$newTerms['existingWageAgreement']=true;$newTerms['wageEffective']=(new DateTimeImmutable(hr_today()))->modify('+1 day')->format('Y-m-d');$newTerms['baseHourly']=13000;
$revised=saved_terms($newId,$newTerms,$admin);contract_mutate($admin,['action'=>'issue','id'=>$newId,'revision'=>$revised['revision']]);
check(count(contract_list($one))===2,'version history retained after later issue');
check(contract_find($id,$one)['issued_snapshot']===$issued['issued_snapshot'],'future-dated revision does not replace prior issued version');
check(contract_find($newId,$one)['status']==='issued','new version requires separate employee receipt');
$d->prepare('UPDATE hr_employees SET user_id=? WHERE id=1')->execute([3]);
check(contract_find($id,$one)!==null&&contract_find($id,$two)===null,'account reassignment does not redirect issued contract recipient');
check(!$d->inTransaction(),'rejected mutations always roll back');
echo "PASS: contract permissions, required fields, schedules, immutable issue snapshots, stale writes, receipt without signature, recipient isolation and version history.\n";

// Optional local render fixtures, outside the checkout by default.
$fixtureDir=getenv('CNC_CONTRACT_FIXTURE_DIR');
if(is_string($fixtureDir)&&$fixtureDir!==''){
    require_once __DIR__.'/../lib/views.php';
    if(!is_dir($fixtureDir))mkdir($fixtureDir,0700,true);
    $selected=$received;$user=$one;$role='employee';$documentOnly=true;$download=true;
    ob_start();require __DIR__.'/../views/contract-document.php';$html=ob_get_clean();file_put_contents($fixtureDir.'/contract-default.html',$html);
    $selected['issued_snapshot']['terms']=$boundary;
    ob_start();require __DIR__.'/../views/contract-document.php';$html=ob_get_clean();file_put_contents($fixtureDir.'/contract-boundary.html',$html);
    $selected['issued_snapshot']['terms']['employerName']='<script>alert(1)</script>&';
    ob_start();require __DIR__.'/../views/contract-document.php';$html=ob_get_clean();
    check(!str_contains($html,'<script>alert(1)</script>')&&str_contains($html,'&lt;script&gt;alert(1)&lt;/script&gt;&amp;'),'print fixture escapes administrator content');
    echo 'Print fixtures: '.$fixtureDir.PHP_EOL;
}
