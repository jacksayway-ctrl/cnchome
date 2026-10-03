<?php
// CLI deployment validation: production connection, enforced read-only transaction, no row values in output.
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
require __DIR__.'/../lib/bootstrap.php';
require_once __DIR__.'/../lib/pending-intakes.php';
require_once __DIR__.'/../lib/intake-live.php';
require_once __DIR__.'/../lib/native.php';
$d=db();$stage='begin';
try{
    if($d->getAttribute(PDO::ATTR_DRIVER_NAME)!=='mysql')throw new RuntimeException('MySQL connection required');
    $d->exec('SET TRANSACTION READ ONLY');$d->beginTransaction();
    $today=hr_today();$month=substr($today,0,7);$admin=['id'=>0,'role'=>'admin','department'=>'insurance'];
    foreach(['insurance','cosmetics','health'] as $team){
        $stage='actual-date-query';$filters=intake_filters(['month'=>$month,'team'=>$team,'scope'=>'real']);
        $normalRecords=intake_actual_normal_records($admin,$filters);
        foreach($normalRecords as $record)if(!hr_day($record['statusDate']))throw new RuntimeException('Invalid effective status date');
        $stage='snapshot';$snapshot=sales_snapshot($admin,$month);$records=array_column($snapshot['records'],null,'id');
        foreach($normalRecords as $record)$records[$record['id']]=array_replace($records[$record['id']]??[],$record);$snapshot['records']=array_values($records);
        $counts=['pending'=>0,'normal'=>0,'as'=>0];foreach(intake_filtered($snapshot['records'],$filters) as $record)$counts[$record['status']]++;
        $actualNormalCount=count(intake_filtered($snapshot['records'],array_replace($filters,['status'=>'normal','dateBasis'=>'actual'])));
        $stage='recall-queue';$recallQueue=intake_recall_queue($admin,$filters);
        foreach(['first','actual'] as $basis){
            $filters=intake_filters(['month'=>$month,'team'=>$team,'scope'=>'real','status'=>'normal','dateBasis'=>$basis]);
            $rows=intake_filtered($snapshot['records'],$filters);$total=count($rows);$pages=max(1,(int)ceil($total/30));$list=array_slice($rows,0,30);
            $selected=null;$history=[];$user=$admin;$mode='list';$error='';$notice='';$posted=[];$testCount=0;$popup=false;
            $stage='render';ob_start();require view_root().'/intake.php';$html=ob_get_clean();
            if(!str_contains($html,'data-intake-count-basis="first"')||!str_contains($html,'data-intake-count-basis="actual"'))throw new RuntimeException('Receipt count controls missing');
            if($basis==='actual'&&$total!==$actualNormalCount)throw new RuntimeException('Actual count differs from matching list');
        }
    }
    $stage='calendar-query';$calendar=intake_live_calendar($d,$month,$today);
    $calendarMonth=$month;$calendarToday=$today;$calendarSeed=$calendar;
    $stage='calendar-render';ob_start();require view_root().'/intake-live.php';$html=ob_get_clean();
    if(!str_contains($html,'data-live-calendar-days'))throw new RuntimeException('Calendar missing');
    $d->rollBack();echo "PASS: live MySQL receipt queries, both date count controls and matching lists, three departments, calendar query/render; enforced READ ONLY transaction, no data changes.\n";
}catch(Throwable $e){
    if($d->inTransaction())$d->rollBack();while(ob_get_level())ob_end_clean();
    fwrite(STDERR,'Live intake validation failed: stage='.$stage.' kind='.get_class($e).' code='.(string)$e->getCode()."\n");exit(1);
}
