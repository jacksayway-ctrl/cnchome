<?php
declare(strict_types=1);
require __DIR__.'/../lib/intake-policy.php';
class IntakeTestDB extends PDO {
 public function query(string $query,?int $fetchMode=null,mixed ...$fetchModeArgs): PDOStatement|false {return parent::query(str_replace(' FOR UPDATE','',$query));}
}
function db(): PDO {static $d;if(!$d)$d=new IntakeTestDB('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);return $d;}
function check(bool $ok,string $message):void{if(!$ok)throw new Exception($message);}
function rejects(callable $fn,string $type):void{try{$fn();}catch(Throwable $e){if($e instanceof $type)return;throw $e;}throw new Exception('Expected '.$type);}
$d=db();$d->exec("CREATE TABLE intake_policy_state(id INTEGER PRIMARY KEY,revision INTEGER,state TEXT,updated_at TEXT);INSERT INTO intake_policy_state VALUES(1,0,'{}',NULL);CREATE TABLE intake_policy_history(id INTEGER PRIMARY KEY,revision INTEGER UNIQUE,actor_id INTEGER,action TEXT,payload TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);");
$d->exec("CREATE TABLE office_notices(id INTEGER PRIMARY KEY AUTOINCREMENT,channel TEXT,department TEXT,title TEXT,body TEXT,actor_id INTEGER,source_key TEXT UNIQUE,active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP);");
$d->exec("CREATE TABLE app_users(id INTEGER PRIMARY KEY,display_name TEXT);INSERT INTO app_users VALUES(1,'정책 관리자');");
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
check((int)$d->query('SELECT COUNT(*) FROM office_notices')->fetchColumn()===0,'new policies and metadata changes do not announce a reduction');
$lower=$rows;$lower[1][1]='3';
$change=['action'=>'publish','revision'=>5,'client'=>'legacy','carrier'=>'hanwha','groups'=>['general'=>$lower]];
$s=intake_policy_mutate($admin,$change);
$feed=notice_snapshot(['id'=>2,'role'=>'employee','department'=>'insurance']);check(count($feed['activity'])===1&&str_contains($feed['activity'][0]['body'],'4건 → 3건'),'one confirmed decrease emits one announcement');
$cursor=(int)$feed['cursor'];check(count(notice_snapshot(['role'=>'employee','department'=>'insurance'],$cursor)['activity'])===0,'polling cursor does not repeat an event');
rejects(fn()=>intake_policy_mutate($admin,$change),IntakePolicyConflict::class);check((int)$d->query('SELECT COUNT(*) FROM office_notices')->fetchColumn()===1,'retry cannot duplicate announcement');
$change['revision']=6;$s=intake_policy_mutate($admin,$change);check((int)$d->query('SELECT COUNT(*) FROM office_notices')->fetchColumn()===1,'same quantity emits nothing');
$higher=$rows;$higher[1][1]='7';$change['revision']=7;$change['groups']['general']=$higher;intake_policy_mutate($admin,$change);check((int)$d->query('SELECT COUNT(*) FROM office_notices')->fetchColumn()===1,'increases emit nothing');
$unknown=$rows;$unknown[1][1]='확인 필요';$change['revision']=8;$change['groups']['general']=$unknown;intake_policy_mutate($admin,$change);check((int)$d->query('SELECT COUNT(*) FROM office_notices')->fetchColumn()===1,'unknown count is not inferred as zero');
$change['revision']=9;$change['groups']['general']=$rows;intake_policy_mutate($admin,$change);check((int)$d->query('SELECT COUNT(*) FROM office_notices')->fetchColumn()===1,'unknown-to-number is not a confirmed decrease');
$zero=$rows;$zero[1][1]='0';$change['revision']=10;$change['groups']['general']=$zero;intake_policy_mutate($admin,$change);
$feed=notice_snapshot(['role'=>'employee','department'=>'insurance'],$cursor);check(count($feed['activity'])===1&&str_contains($feed['activity'][0]['body'],'접수 마감'),'zero quantity emits closure');
check(count(notice_snapshot(['role'=>'employee','department'=>'cosmetics'])['activity'])===0,'insurance events are not exposed to another team');
$post=['action'=>'publish','title'=>'회사 공지','body'=>'테스트 공지 <내용>','department'=>'','requestKey'=>'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'];
rejects(fn()=>notice_mutate($employee,$post),NoticeForbidden::class);notice_mutate($admin,$post);notice_mutate($admin,$post);
$all=notice_snapshot(['role'=>'employee','department'=>'insurance']);check(count($all['company'])===1,'company notice persists without duplicate submission');$noticeId=$all['company'][0]['id'];
notice_mutate($admin,array_replace($post,['department'=>'cosmetics','title'=>'화장품 공지','requestKey'=>'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb']));
check(count(notice_snapshot(['role'=>'employee','department'=>'insurance'])['company'])===1,'company audience restriction');check(count(notice_snapshot($admin)['company'])===2,'admin sees all company notices');
rejects(fn()=>notice_mutate($employee,['action'=>'archive','id'=>$noticeId]),NoticeForbidden::class);notice_mutate($admin,['action'=>'archive','id'=>$noticeId]);check(count(notice_snapshot(['role'=>'employee','department'=>'insurance'])['company'])===0,'archived notices leave the active ticker');
$duplicates=notice_policy_rows([['지역','수량'],['서울','4'],['서울','2']]);check(array_values($duplicates)[0]['quantity']===null,'duplicate scope quantities are not guessed');
echo "PASS: reduction-only events, zero closure, unchanged/increased/unknown quantities, idempotent writes, company notices, archival and team isolation.\n";

// Employee visibility follows Korea's date, while administrator history retains old versions.
$before=intake_policy_snapshot();$state=$before;$state['policies']=(array)$state['policies'];
$state['policies']['hanwha:general']['savedAt']=(new DateTimeImmutable('yesterday',new DateTimeZone('Asia/Seoul')))->format(DATE_ATOM);
$state['policies']['ga:general']=['client'=>'legacy','carrier'=>'ga','kind'=>'general','rows'=>$rows,'savedAt'=>gmdate('c')];
$q=$d->prepare('UPDATE intake_policy_state SET state=? WHERE id=1');$q->execute([json_encode($state,JSON_UNESCAPED_UNICODE)]);
$visible=(array)intake_policy_snapshot($employee)['policies'];check(!isset($visible['hanwha:general'])&&isset($visible['ga:general']),'old policy hidden while one current carrier remains available');
check(isset(((array)intake_policy_snapshot($admin)['policies'])['hanwha:general']),'old policy remains in administrator management');
rejects(fn()=>intake_policy_history($employee),IntakePolicyForbidden::class);
$history=intake_policy_history($admin);check(count($history['history'])===11,'all successful changes listed with their immutable versions');
check(isset(intake_policy_history($admin,1)['state']['policies']['hanwha:general']),'historical upload rows remain readable');

// A same-named product in another department must never replace an insurance publication.
$insuranceBefore=intake_policy_snapshot($admin);$nextRevision=$insuranceBefore['revision'];
$cosmeticRows=[['지역','수량'],['대전광역시','9']];
$cosmetic=intake_policy_mutate($admin,['action'=>'publish','department'=>'cosmetics','revision'=>$nextRevision,'client'=>'legacy','carrier'=>'hanwha','groups'=>['general'=>$cosmeticRows]]);
check($cosmetic['department']==='cosmetics'&&count((array)$cosmetic['policies'])===1,'department response contains only its policies');
check((array)intake_policy_snapshot($admin,'insurance')['policies']===(array)$insuranceBefore['policies'],'insurance publications are preserved byte-for-byte');
$cosmeticEmployee=['id'=>3,'role'=>'employee','department'=>'cosmetics'];
check(((array)intake_policy_snapshot($cosmeticEmployee,'insurance')['policies'])['hanwha:general']['rows']===$cosmeticRows,'employee query cannot override authenticated department');
check(count((array)intake_policy_snapshot($admin,'health')['policies'])===0,'unconfigured health department starts empty');
$lowerCosmetic=$cosmeticRows;$lowerCosmetic[1][1]='5';
intake_policy_mutate($admin,['action'=>'publish','department'=>'cosmetics','revision'=>$cosmetic['revision'],'client'=>'legacy','carrier'=>'hanwha','groups'=>['general'=>$lowerCosmetic]]);
$cosmeticFeed=notice_snapshot($cosmeticEmployee);
check(count($cosmeticFeed['activity'])===1&&$cosmeticFeed['activity'][0]['department']==='cosmetics','policy reduction follows its department');
$cosmeticHistory=intake_policy_history($admin,0,0,'cosmetics');
check(count($cosmeticHistory['history'])===2&&count(intake_policy_history($admin)['history'])===11,'history is department-scoped including legacy insurance records');
$cosmeticHistoryId=(int)$cosmeticHistory['history'][0]['id'];
rejects(fn()=>intake_policy_history($admin,$cosmeticHistoryId,0,'insurance'),InvalidArgumentException::class);
$catalog=intake_policy_mutate($admin,['action'=>'client','department'=>'health','revision'=>$cosmetic['revision']+1,'label'=>'건강 부서 전용']);
check(count($catalog['clients'])===2&&count(intake_policy_snapshot($admin,'cosmetics')['clients'])===1,'catalog changes do not affect another department');
rejects(fn()=>intake_policy_snapshot($admin,'invalid'),InvalidArgumentException::class);
echo "PASS: independent department policies, catalogs, history, employee scope and reduction notifications.\n";
