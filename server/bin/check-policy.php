<?php
require __DIR__.'/../lib/policy.php';
function check(bool $ok,string $name): void {if(!$ok)throw new Exception($name);}
$row=['min'=>0,'max'=>null,'hourly'=>0,'achievement'=>0,'extraStart'=>null,'extra'=>0];
$p=['version'=>1,'weeklyBasis'=>'average','dailyCash'=>['start'=>6,'perCase'=>5000],'daily'=>[$row],'weekly'=>[$row],'monthly'=>[$row]];
check(normalize_policy($p)===$p,'round trip');
check(valid_day('2028-02-29')&&!valid_day('2026-02-29'),'calendar dates');
$mutations=[fn($p)=>array_replace($p,['weeklyBasis'=>'bad']),fn($p)=>array_replace($p,['dailyCash'=>['start'=>0,'perCase'=>0]]),fn($p)=>array_replace($p,['monthly'=>[array_replace($p['monthly'][0],['hourly'=>-1])]]),fn($p)=>array_replace($p,['weekly'=>array_fill(0,22,$p['weekly'][0])])];
foreach($mutations as $i=>$mutate){$caught=false;try{normalize_policy($mutate($p));}catch(InvalidArgumentException $e){$caught=true;}check($caught,"invalid policy $i");}
$p['monthlyReference']=[];for($i=0;$i<9;$i++)$p['monthlyReference'][]=['label'=>'<script>bad</script>','max'=>$i===8?null:100+$i*10,'hourly'=>15000,'achievement'=>0,'threshold'=>100+$i*10,'extra'=>0,'example'=>0];
$n=normalize_policy($p);check($n['monthlyReference'][0]['label']==='100건 이하','canonical label');check($n['monthlyReference'][8]['label']==='171건 이상','final range');
$p['monthlyReference'][1]['hourly']=14000;$caught=false;try{normalize_policy($p);}catch(InvalidArgumentException $e){$caught=true;}check($caught,'minimum hourly');
echo "PASS: PHP policy ranges, numeric limits, dates and canonical labels\n";
