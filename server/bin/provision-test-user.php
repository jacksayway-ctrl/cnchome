<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/bootstrap.php';
require __DIR__.'/../lib/hr.php';
$d=db();$q=$d->prepare('SELECT id FROM app_users WHERE username=?');$q->execute(['user1']);
if($q->fetch()){echo "테스트 계정: 기존 계정과 비밀번호 유지\n";exit;}
try{
 $d->beginTransaction();
 $q=$d->prepare("INSERT INTO app_users(username,display_name,password_hash,role,department) VALUES('user1','테스트 직원',?,'employee','insurance')");$q->execute([password_hash('1234',PASSWORD_DEFAULT)]);$uid=(int)$d->lastInsertId();
 $day=str_replace('-','',hr_today());$q=$d->prepare('INSERT INTO hr_employee_sequences(day,serial) VALUES(?,1) ON DUPLICATE KEY UPDATE serial=serial+1');$q->execute([$day]);
 $q=$d->prepare('SELECT serial FROM hr_employee_sequences WHERE day=? FOR UPDATE');$q->execute([$day]);$no='cnc'.$day.str_pad((string)$q->fetchColumn(),3,'0',STR_PAD_LEFT);
 $p=hr_profile(['name'=>'테스트 직원','phone'=>'010-0000-0000','team'=>'insurance','role'=>'상담원','startDate'=>hr_today(),'employment'=>'재직','payType'=>'시급제','payAmount'=>15000,'workDays'=>['월','화','수','목','금'],'weeklyHoliday'=>'일','contractType'=>'무기계약','memo'=>'직원 화면 확인용 테스트 계정 · 실제 직원 아님']);
 $q=$d->prepare('INSERT INTO hr_employees(employee_no,user_id,profile) VALUES(?,?,?)');$q->execute([$no,$uid,hr_json($p)]);$d->commit();echo "직원 테스트 계정 준비 완료: user1\n";
}catch(Throwable $e){if($d->inTransaction())$d->rollBack();fwrite(STDERR,"테스트 계정 준비 실패\n");exit(1);}
