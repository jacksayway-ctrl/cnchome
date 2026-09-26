<?php
declare(strict_types=1);
function test_seed_state(): array {
 $today=hr_today();$month=substr($today,0,7);$sales=[];$attendance=[];
 for($day=1;$day<=(int)substr($today,8,2);$day++){
  $date=$month.'-'.str_pad((string)$day,2,'0',STR_PAD_LEFT);
  if((int)(new DateTimeImmutable($date))->format('N')>5)continue;
  $attendance[]=['date'=>$date,'in'=>$day===8?'10:10':'10:00','out'=>'17:00','status'=>$day===8?'지각 10분':'정상'];
  for($n=0;$n<5;$n++){$id=count($sales)+1;$sales[]=['id'=>$id,'date'=>$date,'name'=>'가상고객 '.str_pad((string)$id,3,'0',STR_PAD_LEFT),'carrier'=>['GA','한화','신한'][$id%3],'kind'=>$id%4===0?'실버':'일반','status'=>$id%13===0?'A/S':($id%11===0?'가접수':'정상')];}
 }
 return ['sales'=>$sales,'attendance'=>$attendance];
}
