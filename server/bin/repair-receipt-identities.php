<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/bootstrap.php';require __DIR__.'/../lib/receipt-identity-repair.php';
try{
    $attempt=0;
    do{
        try{$result=receipt_identity_repair('/var/backups/cnchome/receipt-identities');break;}
        catch(PDOException $e){if(++$attempt>=3||!in_array((int)($e->errorInfo[1]??0),[1205,1213],true))throw $e;}
    }while(true);
    if(($result['state']??'')!=='complete')throw new RuntimeException('repair_blocked');
    // Never expose customer/account names, IDs, backup locations or unresolved evidence in deployment output.
    echo hr_json(['state'=>'complete','alreadyApplied'=>$result['alreadyApplied'],'reassigned'=>$result['reassigned'],'skipped'=>array_sum($result['skipped'])])."\n";
}catch(Throwable $e){
    $reason=in_array($e->getMessage(),['backup_failed','receipt_changed','verification_failed','repair_blocked'],true)?$e->getMessage():'repair_failed';
    // A failed request stays blocked rather than rematching old names against changed accounts on a later deploy.
    try{$q=db()->prepare('INSERT IGNORE INTO test_fixture_batches(batch,manifest) VALUES(?,?)');$q->execute([receipt_identity_repair_batch(),hr_json(['state'=>'blocked','reason'=>$reason,'checkedAt'=>gmdate('c')])]);}catch(Throwable $markerError){error_log('receipt identity repair marker failed');}
    fwrite(STDERR,'Receipt identity repair: '.$reason."\n");exit(51);
}
