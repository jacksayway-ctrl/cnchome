<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/bootstrap.php';
require __DIR__.'/../lib/hr.php';
require __DIR__.'/../lib/policy.php';
$batch='inspection-20260929';$d=db();$d->beginTransaction();
try {
    $q=$d->query("SELECT e.id employee_id,e.profile,u.id user_id,u.department FROM hr_employees e JOIN app_users u ON u.id=e.user_id WHERE u.username='user1' AND u.display_name='테스트 직원' AND u.role='employee' AND u.active=1 FOR UPDATE");$e=$q->fetch();
    if(!$e){$d->rollBack();exit("점검용 테스트 계정을 찾지 못했습니다.\n");}
    if(test_account_cleanup_protected((int)$e['user_id'])){$d->commit();exit;}
    $uid=(int)$e['user_id'];$today=hr_today();$month=substr($today,0,7);
    $q=$d->prepare('SELECT state FROM test_employee_data WHERE user_id=? FOR UPDATE');$q->execute([$uid]);$raw=$q->fetchColumn();
    if(!$raw){$d->rollBack();exit("기본 테스트 자료 준비 후 다시 실행하세요.\n");}
    $state=json_decode($raw,true,512,JSON_THROW_ON_ERROR);
    if(isset($state['fixtures'][$batch])){$d->commit();exit("임시 점검 자료: 이미 준비됨 (변경한 자료 유지)\n");}
    $manifest=['createdAt'=>gmdate('c'),'date'=>$today,'salesIds'=>[],'attendanceDates'=>[],'receiptMilestones'=>[],'gradeId'=>null,'profileBefore'=>json_decode($e['profile'],true,512,JSON_THROW_ON_ERROR)];
    $state['sales']=$state['sales']??[];$state['attendance']=$state['attendance']??[];
    $serial=max(array_merge([0],array_column($state['sales'],'id')));
    $days=[];for($n=1;$n<=(int)substr($today,8,2);$n++){$date=$month.'-'.str_pad((string)$n,2,'0',STR_PAD_LEFT);if((int)(new DateTimeImmutable($date))->format('N')<=5||$date===$today)$days[]=$date;}
    foreach($days as $date){
        $counts=['정상'=>0,'가접수'=>0,'A/S'=>0];foreach($state['sales'] as $sale)if($sale['date']===$date&&isset($counts[$sale['status']]))$counts[$sale['status']]++;
        foreach(['정상'=>$date===$today?9:8,'가접수'=>2,'A/S'=>1] as $status=>$target){
            for($i=$counts[$status];$i<$target;$i++){$id=++$serial;$state['sales'][]=['id'=>$id,'date'=>$date,'name'=>'[임시 점검] 고객 '.str_pad((string)$id,3,'0',STR_PAD_LEFT),'carrier'=>['GA','한화','신한'][$id%3],'kind'=>$id%4===0?'실버':'일반','status'=>$status,'fixture'=>$batch];$manifest['salesIds'][]=$id;}
        }
        if(!array_filter($state['attendance'],fn($r)=>$r['date']===$date)){$state['attendance'][]=['date'=>$date,'in'=>'10:00','out'=>$date===$today?'':'17:00','status'=>$date===$today?'테스트 근무 중':'정상','fixture'=>$batch];$manifest['attendanceDates'][]=$date;}
    }
    $profile=$manifest['profileBefore'];
    foreach(['email'=>'test-user@example.invalid','birthDate'=>'1980-01-01','address'=>'[임시 점검용] 가상 주소','addressDetail'=>'테스트 사무실','workplace'=>'씨앤씨 테스트 사무실','duties'=>'전화 상담 · 기능 점검용','bank'=>'가상은행(테스트용)','accountNumber'=>'000000000000','accountHolder'=>'테스트 직원','contractStart'=>$profile['startDate'],'wageEffective'=>$profile['startDate']] as $key=>$value)if(empty($profile[$key]))$profile[$key]=$value;
    $profile=hr_profile($profile);$manifest['profileSeeded']=$profile;
    $q=$d->prepare('UPDATE hr_employees SET profile=?,revision=revision+1 WHERE id=?');$q->execute([hr_json($profile),$e['employee_id']]);
    // A sample rule is inserted only when this department has no effective rule.
    $q=$d->prepare('SELECT policy FROM grade_versions WHERE department=? AND effective_date<=? ORDER BY effective_date DESC,id DESC LIMIT 1');$q->execute([$e['department'],$today]);$rawPolicy=$q->fetchColumn();
    if(!$rawPolicy){
        $row=['min'=>0,'max'=>null,'hourly'=>0,'achievement'=>0,'extraStart'=>null,'extra'=>0];
        $p=['version'=>1,'dailyCash'=>['start'=>6,'perCase'=>5000],'weeklyBasis'=>'average','daily'=>[$row],'weekly'=>[array_replace($row,['max'=>8]),array_replace($row,['min'=>8,'achievement'=>30000])],'monthly'=>[array_replace($row,['hourly'=>15000])]];
        $p=normalize_policy($p);$admin=$d->query("SELECT id FROM app_users WHERE role='admin' AND active=1 ORDER BY id LIMIT 1")->fetchColumn();
        if($admin){$q=$d->prepare('INSERT INTO grade_versions(department,effective_date,actor_id,actor_name,policy) VALUES(?,?,?,?,?)');$q->execute([$e['department'],$month.'-01',$admin,'[임시 점검용 기준]',hr_json($p)]);$manifest['gradeId']=(int)$d->lastInsertId();$d->exec('UPDATE grade_revision SET revision=revision+1 WHERE id=1');$rawPolicy=hr_json($p);}
    }
    $p=$rawPolicy?json_decode($rawPolicy,true,512,JSON_THROW_ON_ERROR):null;$start=$p['dailyCash']['start']??0;$perCase=$p['dailyCash']['perCase']??0;
    $normal=count(array_filter($state['sales'],fn($s)=>$s['date']===$today&&$s['status']==='정상'));
    if($start>0&&$perCase>0){for($step=$start;$step<=min($start+1,$normal);$step++){
        $q=$d->prepare('SELECT 1 FROM daily_grade_receipts WHERE employee_id=? AND performance_date=? AND milestone=?');$q->execute([$uid,$today,$step]);if($q->fetchColumn())continue;
        $q=$d->prepare('INSERT INTO daily_grade_receipts(employee_id,performance_date,milestone,amount,department) VALUES(?,?,?,?,?)');$q->execute([$uid,$today,$step,$perCase,$e['department']]);$manifest['receiptMilestones'][]=$step;
    }}
    $state['fixtures'][$batch]=$manifest;
    $q=$d->prepare('UPDATE test_employee_data SET state=?,revision=revision+1 WHERE user_id=?');$q->execute([hr_json($state),$uid]);
    $d->commit();echo "임시 점검 자료 준비 완료: user1 / 오늘 정상 {$normal}건 / 건별 수령 예시 포함\n";
}catch(Throwable $error){if($d->inTransaction())$d->rollBack();throw $error;}
