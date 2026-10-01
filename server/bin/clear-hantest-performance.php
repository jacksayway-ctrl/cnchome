<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/bootstrap.php';require __DIR__.'/../lib/performance-reset.php';
try {
    $result=performance_reset_hantest('/var/backups/cnchome/performance');
    echo $result['alreadyApplied']?"hantest 실적 삭제 요청은 이미 적용되었습니다. 새 입력은 유지합니다.\n":"hantest 접수·실적·A/S 및 일그레이드 지급 기록 삭제 완료.\n";
} catch(Throwable $e) {
    // Private service logs retain the error; the public health report gets only a numeric category.
    fwrite(STDERR,get_class($e).': '.$e->getMessage()."\n");
    if($e instanceof InvalidArgumentException&&$e->getMessage()==='hantest 직원 계정을 찾을 수 없습니다.')exit(42);
    if($e instanceof PDOException)exit(44);
    if($e instanceof RuntimeException&&str_starts_with($e->getMessage(),'실적 백업'))exit(43);
    exit(45);
}
