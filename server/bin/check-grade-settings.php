<?php
// In-memory database only: scoped saves, date resolution and revision conflicts.
declare(strict_types=1);
require __DIR__.'/../lib/grade-settings.php';
class GradeFixtureDB extends PDO {
    public function query(string $query,?int $fetchMode=null,mixed ...$args): PDOStatement|false {return parent::query(str_replace(' FOR UPDATE','',$query));}
}
function db(): PDO {static $d;return $d??=new GradeFixtureDB('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);}
function check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
$d=db();$d->exec('CREATE TABLE grade_revision(id INTEGER PRIMARY KEY,revision INTEGER);INSERT INTO grade_revision VALUES(1,0);CREATE TABLE grade_versions(id INTEGER PRIMARY KEY,department TEXT,effective_date TEXT,actor_id INTEGER,actor_name TEXT,policy TEXT,saved_at TEXT DEFAULT CURRENT_TIMESTAMP);');
$admin=['id'=>1,'role'=>'admin','display_name'=>'가상 관리자'];
$base=grade_empty_policy();$base['dailyCash']['perCase']=5000;$base['monthly'][0]['achievement']=120000;
$row=$base['weekly'][0];$base['weekly']=[array_replace($row,['max'=>8])];
foreach(range(8,27) as $n)$base['weekly'][]=array_replace($row,['min'=>$n,'max'=>$n===27?null:$n+1,'achievement'=>30000+5000*($n-8)]);
function save_policy(string $period,string $date,array $policy,string $department='insurance'): array {
    global $admin;return grade_save_settings($admin,['department'=>$department,'date'=>$date,'period'=>$period,'policy'=>$policy,'revision'=>(int)db()->query('SELECT revision FROM grade_revision')->fetchColumn()]);
}
save_policy('all','2000-01-01',$base);
$future=$base;foreach($future['weekly'] as &$r)if($r['achievement'])$r['achievement']+=10000;unset($r);
save_policy('weekly','2026-10-01',$future);
$daily=$base;$daily['dailyCash']['perCase']=6000;$daily['monthly']='invalid unrelated draft';
$result=save_policy('daily','2026-09-16',$daily);
check($result['policy']['monthly']===$base['monthly']&&$result['policy']['weekly']===$base['weekly'],'daily save uses DB baseline, ignores unrelated draft changes');
$history=grade_history('insurance');$last=$history[array_key_last($history)];
check($last['date']==='2026-10-01'&&$last['policy']['dailyCash']['perCase']===6000&&$last['policy']['weekly'][3]['achievement']===50000,'future weekly save inherits earlier independent daily change');
check($last['savedPolicy']['dailyCash']['perCase']===5000&&$last['period']==='weekly','original saved snapshot is immutable');
$monthly=$base;$monthly['monthly'][0]['achievement']=240000;$monthly['dailyCash']['perCase']=999999;
save_policy('monthly','2026-09-16',$monthly);
$history=grade_history('insurance');check($history[2]['policy']['dailyCash']['perCase']===6000&&$history[2]['policy']['monthly'][0]['achievement']===240000,'same-day monthly save never reverts daily');
$last=$history[array_key_last($history)];check($last['policy']['monthly'][0]['achievement']===240000,'future weekly save also preserves monthly updates');
$preview=$last['policy'];$preview['dailyCash']['perCase']=7000;
$previewHistory=grade_preview_entries($history,'2026-09-20',$preview);
check($previewHistory[array_key_last($previewHistory)]['policy']['dailyCash']['perCase']===7000,'preview retains draft through future scoped saves');
save_policy('daily','2026-09-01',$base,'cosmetics');
$cosmetics=grade_history('cosmetics')[0]['policy'];check($cosmetics['dailyCash']['perCase']===5000&&$cosmetics['weekly'][0]['achievement']===0&&$cosmetics['monthly'][0]['achievement']===0,'new department gets only selected period');
$count=(int)$d->query('SELECT COUNT(*) FROM grade_versions')->fetchColumn();$revision=(int)$d->query('SELECT revision FROM grade_revision')->fetchColumn();
foreach([
    ['user'=>$admin,'input'=>['period'=>'daily','policy'=>$base,'revision'=>$revision-1],'class'=>GradeRevisionConflict::class],
    ['user'=>['role'=>'employee'],'input'=>['period'=>'daily','policy'=>$base,'revision'=>$revision],'class'=>HRForbidden::class],
    ['user'=>$admin,'input'=>['period'=>'daily','policy'=>['daily'=>[]],'revision'=>$revision],'class'=>InvalidArgumentException::class],
    ['user'=>$admin,'input'=>['period'=>'invalid','policy'=>$base,'revision'=>$revision],'class'=>InvalidArgumentException::class]
] as $case){
    $caught=false;try{grade_save_settings($case['user'],$case['input']+['department'=>'insurance','date'=>'2026-09-29']);}catch(Throwable $e){$caught=is_a($e,$case['class']);}
    check($caught,'invalid or unauthorized save is rejected');
    check(!$d->inTransaction()&&(int)$d->query('SELECT COUNT(*) FROM grade_versions')->fetchColumn()===$count&&(int)$d->query('SELECT revision FROM grade_revision')->fetchColumn()===$revision,'failed saves roll back without changing revision');
}
$samples=grade_sample_estimates('2026-09',[['date'=>'2000-01-01','policy'=>$base]]);
check($samples['days']===22&&array_column($samples['samples'],'perDay')===range(10,15),'six daily normal case scenarios');
foreach($samples['samples'] as $sample){$n=$sample['perDay'];$daily=($n-5)*5000*22;$weekly=(30000+($n-8)*5000)*4;
    check($sample['count']===$n*22&&$sample['daily']===$daily&&$sample['weekly']===$weekly&&$sample['monthly']===120000,'10–15 cases per weekday and four complete five-day weekly grades');
    check($sample['gradeTotal']===$daily+$weekly+120000&&$sample['paydayGrade']===$weekly+120000,'daily advance excluded once, weekly and monthly stack');
}
$prorated=grade_sample_estimates('2026-09',grade_history('insurance'))['samples'][0];
check($prorated['daily']===605000&&$prorated['monthly']===180000&&$prorated['weekly']===160000,'effective September 16 prorates daily and monthly without changing weekly');
echo "PASS: separate DB saves, selected-field isolation, immutable history, independent future dates, revision conflicts, rollback and six 10–15 case forecasts.\n";

$actor=json_decode($d->query('SELECT policy FROM grade_versions ORDER BY id DESC LIMIT 1')->fetchColumn(),true)['savedActor'];
check($actor['role']==='admin'&&$actor['position']==='관리자','changer affiliation and role are snapshotted at save time');
