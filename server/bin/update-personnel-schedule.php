<?php
// One-time requested schedule change. Preserve the original profile in immutable history.
declare(strict_types=1);
if(PHP_SAPI!=='cli')exit;
require __DIR__.'/../lib/bootstrap.php';
require_once __DIR__.'/../lib/personnel-history.php';
$d=db();
// System settings changes have no human actor; do not attribute them to an administrator.
$d->exec('ALTER TABLE hr_personnel_events MODIFY actor_id BIGINT UNSIGNED NULL');
$d->beginTransaction();
try{
    $rows=$d->query('SELECT * FROM hr_employees ORDER BY id FOR UPDATE')->fetchAll();$changed=0;
    foreach($rows as $row){
        $profile=json_decode($row['profile'],true,512,JSON_THROW_ON_ERROR);
        if(($profile['personnelScheduleVersion']??0)>=1)continue;
        $profile['paidWeeklyHoliday']=in_array($profile['weeklyHoliday']??'',['토','일'],true)?$profile['weeklyHoliday']:'일';
        $profile['weeklyHoliday']='토,일';$profile['payday']='15';$profile['paydayTiming']='next';$profile['personnelScheduleVersion']=1;
        if(!array_key_exists('selfEditLocked',$profile)){
            $q=$d->prepare("SELECT event FROM hr_personnel_events WHERE employee_id=? AND event IN ('confirm','created','profile','unlock','lock') ORDER BY id DESC LIMIT 1");$q->execute([$row['id']]);
            $profile['selfEditLocked']=in_array($q->fetchColumn(),['confirm','created','lock'],true);
        }
        $q=$d->prepare('UPDATE hr_employees SET profile=?,revision=revision+1 WHERE id=?');$q->execute([hr_json($profile),$row['id']]);
        personnel_history_append(['id'=>null],$row,array_replace($row,['profile'=>hr_json($profile),'revision'=>(int)$row['revision']+1]),'settings');$changed++;
    }
    $d->commit();echo 'Personnel schedule updated: '.$changed." records.\n";
}catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
