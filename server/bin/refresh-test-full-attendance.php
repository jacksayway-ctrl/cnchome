<?php
declare(strict_types=1);if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/bootstrap.php';require __DIR__.'/../lib/grade-ledger.php';
$d=db();$batch='test-full-attendance-grade-20260930-v1';$d->beginTransaction();
try{
$q=$d->prepare('SELECT manifest FROM test_fixture_batches WHERE batch=? FOR UPDATE');$q->execute([$batch]);if($q->fetchColumn()){$d->commit();exit;}
$month=substr(hr_today(),0,7);$manifest=[];$actor=(int)$d->query("SELECT id FROM app_users WHERE role='admin' AND active=1 ORDER BY id LIMIT 1")->fetchColumn();
foreach($d->query("SELECT u.*,e.id AS eid,e.profile,e.employee_no FROM app_users u JOIN hr_employees e ON e.user_id=u.id WHERE u.role='employee' AND u.active=1")->fetchAll() as $u){
if(!cnc_test_user($u))continue;$p=json_decode($u['profile'],true);$p['startDate']=$month.'-01';$p['endDate']='';$p['workDays']=['월','화','수','목','금'];$q=$d->prepare('UPDATE hr_employees SET profile=?,revision=revision+1 WHERE id=?');$q->execute([hr_json($p),$u['eid']]);
$q=$d->prepare('SELECT state FROM test_employee_data WHERE user_id=? FOR UPDATE');$q->execute([$u['id']]);$state=json_decode($q->fetchColumn(),true);$attendance=[];foreach($state['attendance']??[] as $a)if(!str_starts_with($a['date'],$month))$attendance[]=$a;
$weeks=[];foreach(grade_dates($month,business_calendar_rules($month)) as $day){if($day>hr_today())continue;$attendance[]=['date'=>$day,'in'=>'10:00','out'=>'17:00','status'=>'만근 (테스트)','fixture'=>$batch];$w=grade_week($day)[0];$weeks[$w]=($weeks[$w]??0)+360;}$state['attendance']=$attendance;
$q=$d->prepare('UPDATE test_employee_data SET state=?,revision=revision+1 WHERE user_id=?');$q->execute([hr_json($state),$u['id']]);$g=grade_employee_context(['userId'=>(int)$u['id'],'profile'=>$p],$month);
$q=$d->prepare('SELECT * FROM hr_payroll WHERE employee_id=? AND month=? FOR UPDATE');$q->execute([$u['eid'],$month]);$row=$q->fetch();if(!$row||$row['status']==='confirmed')continue;
$old=json_decode($row['calculation'],true);$input=$old;$input['month']=$month;$input['minutes']=array_sum($weeks);$input['weeklyMinutes']=[];foreach($weeks as $w=>$m)$input['weeklyMinutes'][]=['weekStart'=>$w,'minutes'=>$m];$input['weeklyStatutory']=[];foreach($weeks as $w=>$m)$input['weeklyStatutory'][]=['weekStart'=>$w,'amount'=>0,'method'=>'테스트 만근 산정'];
$c=hr_calculate($p,grade_payroll_input($input,$g));$snapshot=json_decode($row['published_snapshot']??'null',true);if($snapshot)$snapshot['calculation']=$c;
$q=$d->prepare('INSERT INTO hr_payroll_events(payroll_id,actor_id,event,note,snapshot) VALUES(?,?,?,?,?)');$q->execute([$row['id'],$actor,'savePayroll','테스트 만근·현재 그레이드 재산정 전 기록',hr_json(['calculation'=>$old])]);
$q=$d->prepare('UPDATE hr_payroll SET calculation=?,published_snapshot=?,revision=revision+1 WHERE id=?');$q->execute([hr_json($c),$snapshot?hr_json($snapshot):null,$row['id']]);$manifest[]=['username'=>$u['username'],'normal'=>$g['count'],'hours'=>$g['hours'],'rate'=>$c['rate'],'workPay'=>pay_statement_summary($c)['workPay']];
}
$q=$d->prepare('INSERT INTO test_fixture_batches(batch,manifest) VALUES(?,?)');$q->execute([$batch,hr_json($manifest)]);$d->commit();echo hr_json($manifest)."\n";
}catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
