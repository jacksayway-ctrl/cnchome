<?php
declare(strict_types=1);
require __DIR__.'/../lib/intake-policy.php';
class IntakeTestDB extends PDO {
 public function query(string $query,?int $fetchMode=null,mixed ...$fetchModeArgs): PDOStatement|false {return parent::query(str_replace(' FOR UPDATE','',$query));}
}
function db(): PDO {static $d;if(!$d)$d=new IntakeTestDB('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);return $d;}
function check(bool $ok,string $message):void{if(!$ok)throw new Exception($message);}
function rejects(callable $fn,string $type):void{try{$fn();}catch(Throwable $e){if($e instanceof $type)return;throw $e;}throw new Exception('Expected '.$type);}
$d=db();$d->exec("CREATE TABLE intake_policy_state(id INTEGER PRIMARY KEY,revision INTEGER,state TEXT,updated_at TEXT);INSERT INTO intake_policy_state VALUES(1,0,'{}',NULL);CREATE TABLE intake_policy_history(id INTEGER PRIMARY KEY,revision INTEGER UNIQUE,actor_id INTEGER,action TEXT,payload TEXT);");
$admin=['id'=>1,'role'=>'admin','display_name'=>'테스트 관리자'];$employee=['id'=>2,'role'=>'employee'];
$start=intake_policy_snapshot();check($start['revision']===0&&count((array)$start['policies'])===0,'empty DB, no example policies');
$rows=[['지역','수량','제외지역'],['수도권','4','서울특별시 강남구']];
$input=['action'=>'publish','revision'=>0,'client'=>'legacy','carrier'=>'hanwha','groups'=>['general'=>$rows,'silver'=>$rows],'savedAt'=>'fake','reviewed'=>true];
rejects(fn()=>intake_policy_mutate($employee,$input),IntakePolicyForbidden::class);
$s=intake_policy_mutate($admin,$input);check($s['revision']===1&&count((array)$s['policies'])===2,'dual product persisted');
$fresh=intake_policy_snapshot();check($fresh['policies']->{'hanwha:silver'}['rows']===$rows,'fresh employee read sees actual rows');
check($fresh['policies']->{'hanwha:silver'}['reviewed']===true,'explicit review persisted with actor and time');
check($fresh['policies']->{'hanwha:silver'}['savedAt']!=='fake','timestamp server owned');
rejects(fn()=>intake_policy_mutate($admin,$input),IntakePolicyConflict::class);
$invalid=$input;$invalid['revision']=1;$invalid['groups']=['other'=>$rows];rejects(fn()=>intake_policy_mutate($admin,$invalid),InvalidArgumentException::class);
check(intake_policy_snapshot()['revision']===1,'validation rollback');
$s=intake_policy_mutate($admin,['action'=>'client','revision'=>1,'label'=>'새 거래처']);$client=$s['changedId'];
$s=intake_policy_mutate($admin,['action'=>'code','revision'=>2,'label'=>'새 코드','aliases'=>['NEW']]);$code=$s['changedId'];
$s=intake_policy_mutate($admin,['action'=>'publish','revision'=>3,'client'=>$client,'carrier'=>$code,'groups'=>['general'=>$rows]]);
check(count((array)$s['policies'])===3,'unrelated policies retained');
check(count($s['clients'])===2&&count($s['codes'])===4,'shared client and code catalog');
rejects(fn()=>intake_policy_mutate($admin,['action'=>'code','revision'=>4,'label'=>'다른 코드','aliases'=>['NEW']]),InvalidArgumentException::class);
$s=intake_policy_mutate($admin,['action'=>'code','revision'=>4,'id'=>'hanwha','label'=>'한화 변경','aliases'=>[]]);
check(in_array('한화',$s['codes'][0]['aliases'],true),'original code alias retained');
rejects(fn()=>intake_policy_mutate($admin,['action'=>'publish','revision'=>5,'client'=>'unknown','carrier'=>'hanwha','groups'=>['general'=>$rows]]),InvalidArgumentException::class);
check(intake_policy_snapshot()['revision']===5,'bad client does not change saved policies');
check((int)$d->query('SELECT COUNT(*) FROM intake_policy_history')->fetchColumn()===5,'only successful writes recorded');
echo "PASS: real SQLite persistence, shared read, admin-only writes, revision conflicts, rollback, catalogs, scope preservation, dual products and audit.\n";
