<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/bootstrap.php';
require __DIR__.'/../lib/pending-intakes.php';
require_once __DIR__.'/../lib/test-identities.php';
$batch='pending-cards-demo-20261001-v1';$d=db();$d->beginTransaction();
try {
    $q=$d->prepare('SELECT manifest FROM test_fixture_batches WHERE batch=? FOR UPDATE');$q->execute([$batch]);
    if($q->fetchColumn()){$d->commit();echo "가접수 카드 예시: 기존 변경 유지\n";exit;}
    $q=$d->query("SELECT * FROM app_users WHERE username='user1' AND active=1");$user=$q->fetch();
    hr_assert($user&&cnc_test_user($user)&&$user['department']==='insurance','가접수 예시용 테스트 직원 계정을 확인해 주세요.');
    $q=$d->prepare('SELECT state FROM test_employee_data WHERE user_id=? FOR UPDATE');$q->execute([$user['id']]);$raw=$q->fetchColumn();hr_assert((bool)$raw,'테스트 기본 자료가 필요합니다.');
    $state=json_decode($raw,true,512,JSON_THROW_ON_ERROR);$serial=max(array_merge([0],array_column($state['sales']??[],'id')));$today=hr_today();$savedAt=gmdate('c');$ids=[];
    // A dated demo policy is attached only to these virtual receipts, never published as an operating policy.
    $policy=['client'=>'legacy','carrier'=>'ga','kind'=>'general','rows'=>[['지역','수량'],['서울특별시 강남구','3']],'savedAt'=>$savedAt];
    for($n=1;$n<=5;$n++){
        $id=++$serial;$key='test:'.$user['id'].':'.$id;$ids[]=$key;
        $state['sales'][]=['id'=>$id,'date'=>$today,'name'=>'[테스트] '.($n<=3?'재접수 가능 예시 '.$n:'관리자 확인 예시 '.($n-3)),'carrier'=>'G/A','kind'=>'일반','status'=>'가접수','phone'=>'010-0000-'.str_pad((string)(9000+$n),4,'0',STR_PAD_LEFT),'birthDate'=>'1987-01-15','consultationTime'=>'10:00','consultationPlace'=>'[테스트] 서울특별시 강남구 가상 상담실','premiumBand'=>'100000','note'=>'[테스트] 카드 펼침 확인용 가상 자료 · 실제 고객 및 운영 정책 아님','fixture'=>$batch];
        if($n<=3)$state['sales'][array_key_last($state['sales'])]['demoPolicy']=$policy;
        intake_audit($key,$user,$n<=3?'memo':'recall',['status'=>'pending'],['status'=>'pending','carrier'=>'G/A','date'=>$today],$n<=3?'[테스트] 오늘 등록된 가상 정책의 재접수 가능 예시':'[테스트] 재콜 요청 완료 · 관리자 정상접수 확인표 처리 예시');
    }
    $q=$d->prepare('UPDATE test_employee_data SET state=?,revision=revision+1 WHERE user_id=?');$q->execute([hr_json($state),$user['id']]);
    $q=$d->prepare('INSERT INTO test_fixture_batches(batch,manifest) VALUES(?,?)');$q->execute([$batch,hr_json(['userId'=>(int)$user['id'],'date'=>$today,'ids'=>$ids])]);
    $d->commit();echo "가접수 카드 예시 준비: 오늘 가능 3건 · 관리자 대기 2건\n";
}catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
