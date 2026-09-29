<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/bootstrap.php';
require __DIR__.'/../lib/test-inspection-fixtures.php';
$result=seed_test_inspection_refresh();
echo $result['existing']?"테스트 기본 자료 보강: 기존 변경 유지\n":"테스트 기본 자료 보강 완료: ".count($result['manifest'])."명 · 정상 접수 10~15건/일 · 출결·인사·급여 예시\n";
