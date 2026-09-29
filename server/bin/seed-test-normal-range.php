<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/bootstrap.php';
require __DIR__.'/../lib/test-normal-fixtures.php';
$result=seed_test_normal_range();
echo $result['existing']?"테스트 정상 접수 10~15건 자료: 기존 변경 유지\n":"테스트 정상 접수 10~15건 자료 준비: ".count($result['manifest'])."명\n";
