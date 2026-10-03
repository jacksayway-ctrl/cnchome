<?php
declare(strict_types=1);
require_once __DIR__.'/sales.php';

function pending_rollover_cutoff(string $today): string {
    hr_assert(hr_day($today),'접수 갱신 기준일을 확인해 주세요.');
    $day=new DateTimeImmutable($today,new DateTimeZone('Asia/Seoul'));
    $previous=$day->modify('first day of previous month');
    return $previous->setDate((int)$previous->format('Y'),(int)$previous->format('m'),min((int)$day->format('d'),(int)$previous->format('t')))->format('Y-m-d');
}

/** Renew only unresolved receipts; keep the prior first date in append-only audit history. */
function pending_rollover(array $user,?string $today=null): int {
    if(!in_array($user['role']??'',['employee','admin'],true))throw new HRForbidden('가접수 갱신 권한이 없습니다.');
    $today=$today??hr_today();$cutoff=pending_rollover_cutoff($today);$admin=$user['role']==='admin';$test=sales_test_user($user);$d=db();$count=0;
    $ownsTransaction=!$d->inTransaction();if($ownsTransaction)$d->beginTransaction();
    try{
        $audit=$d->prepare('INSERT INTO intake_management_events(record_key,actor_id,action,before_data,after_data,reason) VALUES(?,?,?,?,?,?)');
        $q=$d->prepare("SELECT id,first_date FROM sales_records WHERE status='pending' AND first_date<=?".($admin?'':' AND employee_id=?'.($test?'':' AND is_test=0')).' ORDER BY id FOR UPDATE');$q->execute($admin?[$cutoff]:[$cutoff,$user['id']]);
        $update=$d->prepare("UPDATE sales_records SET first_date=?,revision=revision+1,updated_at=? WHERE id=? AND status='pending' AND first_date=?");
        foreach($q->fetchAll() as $row){
            $update->execute([$today,gmdate('Y-m-d H:i:s'),$row['id'],$row['first_date']]);
            if(!$update->rowCount())continue;
            $audit->execute([(string)$row['id'],$user['id'],'rollover',hr_json(['date'=>$row['first_date']]),hr_json(['date'=>$today]),'한 달 이상 미처리된 가접수 · 최초 접수일 '.$row['first_date'].' → '.$today]);$count++;
        }
        if($admin||$test){
            $q=$d->prepare('SELECT user_id,state FROM test_employee_data'.($admin?'':' WHERE user_id=?').' ORDER BY user_id FOR UPDATE');$q->execute($admin?[]:[$user['id']]);
            foreach($q->fetchAll() as $owner){
                $state=json_decode($owner['state'],true,512,JSON_THROW_ON_ERROR);$changed=false;
                foreach($state['sales']??[] as $index=>$sale){
                    if(($sale['status']??'')!=='가접수'||!hr_day($sale['date']??'')||$sale['date']>$cutoff)continue;
                    $state['sales'][$index]['date']=$today;$changed=true;$count++;
                    $audit->execute(['test:'.$owner['user_id'].':'.$sale['id'],$user['id'],'rollover',hr_json(['date'=>$sale['date']]),hr_json(['date'=>$today]),'한 달 이상 미처리된 가접수 · 최초 접수일 '.$sale['date'].' → '.$today]);
                }
                if($changed){$update=$d->prepare('UPDATE test_employee_data SET state=?,revision=revision+1 WHERE user_id=?');$update->execute([hr_json($state),$owner['user_id']]);}
            }
        }
        if($ownsTransaction)$d->commit();return $count;
    }catch(Throwable $e){if($ownsTransaction&&$d->inTransaction())$d->rollBack();throw $e;}
}
