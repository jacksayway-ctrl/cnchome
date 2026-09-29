<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/bootstrap.php';require __DIR__.'/../lib/test-staff-fixtures.php';
$result=seed_five_test_staff();echo $result['existing']?"테스트 직원 5명: 기존 변경·삭제 내역 유지\n":"테스트 직원 user2~user6: 인사·실적·출결·급여·계약 자료 준비 완료\n";
