<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/bootstrap.php';require __DIR__.'/../lib/hr.php';
$d=db();$d->beginTransaction();
try{
 $month=substr(hr_today(),0,7);
 $q=$d->prepare("SELECT p.*,e.profile,u.id user_id FROM hr_payroll p JOIN hr_employees e ON e.id=p.employee_id JOIN app_users u ON u.id=e.user_id WHERE u.username='user1' AND u.display_name='테스트 직원' AND u.role='employee' AND p.month=? AND p.status<>'confirmed' FOR UPDATE");$q->execute([$month]);$p=$q->fetch();
 if(!$p){$d->commit();exit;}
 $old=json_decode($p['calculation'],true,512,JSON_THROW_ON_ERROR);$profile=json_decode($p['profile'],true,512,JSON_THROW_ON_ERROR);
 if(($old['holidayInclusive']??false)||$profile['payType']!=='시급제'){$d->commit();exit;}
 // This legacy migration only splits unchanged contract-rate demo wages.
 // Grade-rated statements are rebuilt by refresh-test-full-attendance.php later in deploy.
 if(isset($old['gradeSnapshot'])||(float)($old['rate']??$profile['payAmount'])!==(float)$profile['payAmount']){
  $d->commit();echo "그레이드 시급 명세서: 최신 만근·그레이드 재산정 단계에서 처리합니다.\n";exit;
 }
 $q=$d->prepare('SELECT state FROM test_employee_data WHERE user_id=?');$q->execute([$p['user_id']]);$raw=$q->fetchColumn();$state=$raw?json_decode($raw,true,512,JSON_THROW_ON_ERROR):[];
 $attendance=array_filter($state['attendance']??[],fn($r)=>str_starts_with($r['date'],$month));usort($attendance,fn($a,$b)=>strcmp($a['date'],$b['date']));
 $remaining=(int)$old['minutes'];$weeks=[];
 foreach($attendance as $row){if($remaining<=0)break;$date=new DateTimeImmutable($row['date']);$monday=$date->modify('-'.((int)$date->format('N')-1).' days')->format('Y-m-d');$minutes=min($remaining,($row['status']??'')==='지각 10분'?350:360);$weeks[$monday]=($weeks[$monday]??0)+$minutes;$remaining-=$minutes;}
 if($remaining>0){$d->commit();exit("테스트 급여의 주별 시간 확인 필요: 기존 금액 유지\n");}
 $weekly=[];foreach($weeks as $start=>$minutes)$weekly[]=['weekStart'=>$start,'minutes'=>$minutes];
 $calc=hr_calculate($profile,array_replace($old,['holidayInclusive'=>true,'weeklyMinutes'=>$weekly,'month'=>$month]));
 hr_assert($calc['gross']===$old['gross']&&$calc['net']===$old['net'],'테스트 급여 총액은 유지해야 합니다.');
 $snap=$p['published_snapshot']?json_decode($p['published_snapshot'],true,512,JSON_THROW_ON_ERROR):null;$before=$snap??['calculation'=>$old];if($snap)$snap['calculation']=$calc;
 $actor=$d->query("SELECT id FROM app_users WHERE role='admin' AND active=1 ORDER BY id LIMIT 1")->fetchColumn();
 if(!$actor){$d->rollBack();exit;}
 $q=$d->prepare('INSERT INTO hr_payroll_events(payroll_id,actor_id,event,note,snapshot) VALUES(?,?,?,?,?)');$q->execute([$p['id'],$actor,'savePayroll','시스템: 테스트 명세서 주휴 구분 전 기록 (총액 유지)',hr_json($before)]);
 $q=$d->prepare('UPDATE hr_payroll SET calculation=?,published_snapshot=?,revision=revision+1 WHERE id=?');$q->execute([hr_json($calc),$snap?hr_json($snap):null,$p['id']]);
 if($snap){$q=$d->prepare('INSERT INTO hr_payroll_events(payroll_id,actor_id,event,note,snapshot) VALUES(?,?,?,?,?)');$q->execute([$p['id'],$actor,'publish','시스템: 임시 명세서 기본급·주휴 구분 표시 (총액 유지)',hr_json($snap)]);}
 $d->commit();echo "테스트 명세서 주휴 구분 완료: 총액 유지\n";
}catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
