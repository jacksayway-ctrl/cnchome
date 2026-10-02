<?php
declare(strict_types=1);
require __DIR__.'/../lib/automatic-sales-cleanup.php';
$base=['id'=>1,'date'=>'2026-09-01','name'=>'가상고객 001','carrier'=>'한화','kind'=>'일반','status'=>'정상'];
$cases=[[$base,true],[array_replace($base,['name'=>'실제 고객']),false],[array_replace($base,['phone'=>'01012345678']),false],[array_replace($base,['date'=>'2026-10-01']),false],[array_replace($base,['id'=>7]),false]];
foreach(['inspection-20260929'=>'[임시 점검] 고객 001','five-test-staff-20260929'=>'[테스트 2] 가상고객 1','normal-range-20260929-v1'=>'[테스트 10~15건] 가상고객 1','test-inspection-refresh-20260929-v1'=>'[테스트 1] 가상고객 1','pending-cards-demo-20261001-v1'=>'[테스트] 재접수 가능 예시 1'] as $batch=>$name){$sample=array_replace($base,['fixture'=>$batch,'name'=>$name]);$cases[]=[$sample,true];$cases[]=[array_replace($sample,['name'=>'직접 입력 고객']),false];$cases[]=[array_replace($sample,['fixture'=>'unknown']),false];}
foreach($cases as [$sale,$expected])if(automatic_sale_fixture($sale,[])!==$expected)throw new RuntimeException('Fixture provenance check failed');
echo "PASS: known generated sales only; entered names, phone-bearing legacy records and unknown batches preserved.\n";
