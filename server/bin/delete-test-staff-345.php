<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/bootstrap.php';
require __DIR__.'/../lib/delete-test-staff-345.php';
$codes=['identity'=>60,'seed'=>61,'legacy_sales'=>62,'attendance'=>63,'native_activity'=>64,'payroll'=>65,'contract'=>66,'dependency'=>67,'backup_database'=>68,'unexpected'=>69];
try{
    $result=delete_test_staff_345('/var/backups/cnchome/delete-test-staff-345');
    // Only finite diagnostics and row counts: no identities, exception text or backup credentials.
    echo hr_json(array_intersect_key($result,array_flip(['state','alreadyApplied','reason','deletedCounts'])))."\n";
    // A previously suspended request stays inert and cannot block unrelated later deployments.
    exit($result['state']==='complete'||!empty($result['alreadyApplied'])?0:($codes[$result['reason']??'unexpected']??69));
}catch(Throwable $e){
    $reason=$e instanceof PDOException?'backup_database':dts345_reason($e instanceof RuntimeException?$e->getMessage():'data_guard');
    fwrite(STDERR,hr_json(['state'=>'not_completed','reason'=>$reason,'deletedCounts'=>[]])."\n");exit($codes[$reason]??69);
}
