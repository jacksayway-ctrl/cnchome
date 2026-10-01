<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/bootstrap.php';require __DIR__.'/../lib/user1-cleanup.php';
try{
    $result=cleanup_user1('/var/backups/cnchome/performance');
    if(($result['state']??'')!=='complete'){
        fwrite(STDERR,"확인된 user1 계정 또는 보존 대상 접수가 일치하지 않아 정리를 보류했습니다. 이후 계정이나 자료에는 자동 적용하지 않습니다.\n");exit(42);
    }
    // Service logs are private. This manifest contains counts, never customer fields or credentials.
    echo hr_json($result)."\n";
}catch(Throwable $e){
    fwrite(STDERR,get_class($e).': '.$e->getMessage()."\n");
    if($e instanceof PDOException)exit(44);
    if($e instanceof RuntimeException&&str_starts_with($e->getMessage(),'정리 백업'))exit(43);
    exit(45);
}
