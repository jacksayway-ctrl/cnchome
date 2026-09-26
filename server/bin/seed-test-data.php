<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/bootstrap.php';require __DIR__.'/../lib/hr.php';require __DIR__.'/../lib/test-data.php';
$d=db();$q=$d->query("SELECT e.*,u.id uid FROM hr_employees e JOIN app_users u ON u.id=e.user_id WHERE u.username='user1' AND u.role='employee' AND u.display_name='테스트 직원'");$e=$q->fetch();if(!$e)exit;
$d->beginTransaction();
try{
 $state=test_seed_state();$q=$d->prepare('INSERT IGNORE INTO test_employee_data(user_id,state) VALUES(?,?)');$q->execute([$e['uid'],hr_json($state)]);
 $profile=json_decode($e['profile'],true,512,JSON_THROW_ON_ERROR);$month=substr(hr_today(),0,7);
 $calc=hr_calculate($profile,['minutes'=>max(0,count($state['attendance'])*360-count(array_filter($state['attendance'],fn($r)=>$r['status']==='지각 10분'))*10),'allowance'=>300000,'deductions'=>0,'note'=>'기능 테스트용 가상 급여 · 실제 지급 대상 아님 · 실적 테스트와 별도 고정 예시']);
 $snap=['name'=>$profile['name'],'employeeNo'=>$e['employee_no'],'month'=>$month,'calculation'=>$calc,'bank'=>'','accountNumber'=>'','accountHolder'=>''];
 $q=$d->prepare("INSERT IGNORE INTO hr_payroll(employee_id,month,status,calculation,published_snapshot,published_at) VALUES(?,?,'published',?,?,UTC_TIMESTAMP(6))");$q->execute([$e['id'],$month,hr_json($calc),hr_json($snap)]);
 $d->commit();echo "user1 테스트 실적·출결·급여 준비 완료 (기존 기록 유지)\n";
}catch(Throwable $error){$d->rollBack();throw $error;}
