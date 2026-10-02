<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/bootstrap.php';
require_once __DIR__.'/../lib/receipt-identity-repair.php';
require_once __DIR__.'/../lib/automatic-sales-cleanup.php';
function automatic_cleanup_report(array $result): void {
    $path='/var/www/html/automatic-sales-cleanup-result.json';
    $safe=array_intersect_key($result,array_flip(['state','deletedCount','preservedLegacyCount','nativeReceiptsPreserved']));
    if(file_put_contents($path.'.new',hr_json($safe),LOCK_EX)===false||!chmod($path.'.new',0644)||!rename($path.'.new',$path))throw new RuntimeException('report_failed');
}
$d=db();$batch='automatic-sales-cleanup-20261002-061503-v1';
try{
    $d->beginTransaction();$q=$d->prepare('SELECT manifest FROM test_fixture_batches WHERE batch=? FOR UPDATE');$q->execute([$batch]);
    if(($raw=$q->fetchColumn())!==false){$d->commit();automatic_cleanup_report(json_decode($raw,true,512,JSON_THROW_ON_ERROR));exit;}
    $rows=$d->query('SELECT * FROM test_employee_data ORDER BY user_id FOR UPDATE')->fetchAll();$changes=[];$deleted=0;$preserved=0;
    foreach($rows as $row){
        $state=json_decode($row['state'],true,512,JSON_THROW_ON_ERROR);$keep=[];$removed=[];
        foreach($state['sales']??[] as $sale){if(automatic_sale_fixture($sale,$state))$removed[]=$sale;else $keep[]=$sale;}
        $preserved+=count($keep);if(!$removed)continue;
        $state['sales']=$keep;$deleted+=count($removed);$changes[]=['before'=>$row,'after'=>$state];
    }
    $backup=receipt_identity_repair_backup('/var/backups/cnchome/automatic-sales-cleanup',['batch'=>$batch,'changes'=>$changes]);
    foreach($changes as $change){$q=$d->prepare('UPDATE test_employee_data SET state=?,revision=revision+1 WHERE user_id=? AND revision=?');$q->execute([hr_json($change['after']),$change['before']['user_id'],$change['before']['revision']]);if($q->rowCount()!==1)throw new RuntimeException('revision_mismatch');}
    // Native manually entered sales and all their detail/audit rows are intentionally never modified.
    $result=['state'=>'complete','deletedCount'=>$deleted,'preservedLegacyCount'=>$preserved,'nativeReceiptsPreserved'=>true,'backup'=>$backup,'completedAt'=>gmdate('c')];
    $q=$d->prepare('INSERT INTO test_fixture_batches(batch,manifest) VALUES(?,?)');$q->execute([$batch,hr_json($result)]);$d->commit();automatic_cleanup_report($result);
    echo "Automatic fixture sales removed: {$deleted}; manual receipt tables preserved.\n";
}catch(Throwable $e){if($d->inTransaction())$d->rollBack();fwrite(STDERR,"Automatic sales cleanup failed; transaction rolled back.\n");exit(1);}
