<?php
declare(strict_types=1);
require_once __DIR__.'/grade-ledger.php';

/** One-time, additive synthetic sales only. Deleted fixtures are never recreated. */
function seed_test_normal_range(): array {
    $batch='normal-range-20260929-v1';$d=db();$d->beginTransaction();
    try{
        $q=$d->prepare('SELECT manifest FROM test_fixture_batches WHERE batch=? FOR UPDATE');$q->execute([$batch]);
        if($raw=$q->fetchColumn()){$d->commit();return ['existing'=>true,'manifest'=>json_decode($raw,true,512,JSON_THROW_ON_ERROR)];}
        $today=hr_today();$month=substr($today,0,7);$manifest=[];
        $users=$d->query("SELECT u.id,u.username,u.display_name,u.role,u.department,e.profile FROM app_users u JOIN hr_employees e ON e.user_id=u.id WHERE u.active=1 AND u.role='employee' ORDER BY u.id")->fetchAll();
        foreach($users as $user){
            if(!cnc_test_user($user)||test_account_cleanup_protected((int)$user['id']))continue;
            $q=$d->prepare('SELECT state FROM test_employee_data WHERE user_id=? FOR UPDATE');$q->execute([$user['id']]);$raw=$q->fetchColumn();if(!$raw)continue;
            $state=json_decode($raw,true,512,JSON_THROW_ON_ERROR);$profile=json_decode($user['profile'],true,512,JSON_THROW_ON_ERROR);$counts=[];
            foreach($state['sales']??[] as $sale)if($sale['status']==='정상')$counts[$sale['date']]=($counts[$sale['date']]??0)+1;
            $q=$d->prepare("SELECT first_date,COUNT(*) AS amount FROM sales_records WHERE employee_id=? AND department=? AND is_test=1 AND status='normal' AND first_date>=? AND first_date<=? GROUP BY first_date");$q->execute([$user['id'],$user['department'],$month.'-01',$today]);foreach($q->fetchAll() as $row)$counts[$row['first_date']]=($counts[$row['first_date']]??0)+(int)$row['amount'];
            $serial=max(array_merge([0],array_column($state['sales']??[],'id')));$ids=[];$targets=[];$n=(int)substr($user['username'],4);
            foreach(grade_dates($month) as $index=>$date){
                $day=['월','화','수','목','금'][(int)(new DateTimeImmutable($date))->format('N')-1];
                if($date>$today||$date<($profile['startDate']??'')||(!empty($profile['endDate'])&&$date>$profile['endDate'])||!in_array($day,$profile['workDays']??['월','화','수','목','금'],true))continue;
                $target=10+(($index+$n)%6);$targets[$date]=max($target,$counts[$date]??0);
                for($i=$counts[$date]??0;$i<$target;$i++){$id=++$serial;$state['sales'][]=['id'=>$id,'date'=>$date,'name'=>'[테스트 10~15건] 가상고객 '.$id,'carrier'=>['GA','한화','신한'][$id%3],'kind'=>$id%4?'일반':'실버','status'=>'정상','fixture'=>$batch];$ids[]=$id;}
            }
            $entry=['userId'=>(int)$user['id'],'username'=>$user['username'],'month'=>$month,'salesIds'=>$ids,'normalByDate'=>$targets];$state['fixtures'][$batch]=$entry;
            $q=$d->prepare('UPDATE test_employee_data SET state=?,revision=revision+1 WHERE user_id=?');$q->execute([hr_json($state),$user['id']]);$manifest[]=$entry;
        }
        $q=$d->prepare('INSERT INTO test_fixture_batches(batch,manifest) VALUES(?,?)');$q->execute([$batch,hr_json($manifest)]);$d->commit();return ['existing'=>false,'manifest'=>$manifest];
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
