<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/bootstrap.php';require __DIR__.'/../lib/account-transfer.php';
try{$result=account_transfer_lee001_lsh('/var/backups/cnchome/account-transfers');if(($result['state']??'')!=='complete')throw new RuntimeException($result['reason']??'blocked');echo hr_json($result)."\n";}
catch(Throwable $e){
    // Only the category reaches public deployment health. Account details stay in private service logs.
    fwrite(STDERR,get_class($e).': '.$e->getMessage()."\n");
    $codes=['account_missing'=>41,'account_mismatch'=>42,'unsupported_schema'=>43,'backup_failed'=>44,'payroll_conflict'=>45,'contract_conflict'=>46,'grade_conflict'=>47,'legacy_conflict'=>48,'attendance_conflict'=>49];
    // A failed request is pinned as blocked, so a later reused username is never targeted automatically.
    try{$q=db()->prepare('INSERT IGNORE INTO test_fixture_batches(batch,manifest) VALUES(?,?)');$q->execute([account_transfer_batch(),hr_json(['state'=>'blocked','reason'=>isset($codes[$e->getMessage()])?$e->getMessage():'blocked','checkedAt'=>gmdate('c')])]);}catch(Throwable $markerError){error_log('account transfer request marker failed');}
    exit($codes[$e->getMessage()]??50);
}
