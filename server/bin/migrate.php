<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') exit;
require __DIR__.'/../lib/bootstrap.php';
try {db()->exec(file_get_contents(__DIR__.'/../schema.sql')); echo "DB 테이블 준비 완료\n";}
catch(Throwable $e) {fwrite(STDERR,"DB 테이블 준비 실패. DB 계정 권한과 연결 설정을 확인해 주세요.\n");exit(1);}
