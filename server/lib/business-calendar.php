<?php
declare(strict_types=1);
require_once __DIR__.'/hr.php';

class BusinessCalendarConflict extends RuntimeException {}
function business_calendar_dates(string $month): array {
    hr_assert((bool)preg_match('/^20\d{2}-(0[1-9]|1[0-2])$/D',$month),'영업일 달력의 월을 확인해 주세요.');
    $dates=[];for($day=new DateTimeImmutable($month.'-01');$day->format('Y-m')===$month;$day=$day->modify('+1 day'))$dates[]=$day->format('Y-m-d');return $dates;
}
function business_calendar_is_workday(string $date,array $calendar=[]): bool {return $calendar[$date]??((int)(new DateTimeImmutable($date))->format('N')<=5);}
function business_calendar_workdays(string $month,array $calendar=[]): array {return array_values(array_filter(business_calendar_dates($month),fn($day)=>business_calendar_is_workday($day,$calendar)));}
function business_calendar_validate(string $month,mixed $days): array {
    $all=business_calendar_dates($month);hr_assert(is_array($days)&&array_is_list($days)&&count($days)<=count($all),'영업일을 확인해 주세요.');
    foreach($days as $day)hr_assert(is_string($day)&&in_array($day,$all,true),'선택한 월의 날짜만 저장할 수 있습니다.');
    hr_assert(count(array_unique($days))===count($days),'중복 날짜를 확인해 주세요.');sort($days);return $days;
}
function business_calendar_month(string $month): array {
    business_calendar_dates($month);$q=db()->prepare('SELECT * FROM business_calendar WHERE month=?');$q->execute([$month]);$r=$q->fetch();
    return ['month'=>$month,'revision'=>$r?(int)$r['revision']:0,'days'=>$r?business_calendar_validate($month,json_decode($r['days'],true,512,JSON_THROW_ON_ERROR)):business_calendar_workdays($month),'savedBy'=>$r['actor_name']??'','savedAt'=>$r['updated_at']??''];
}
/** Include adjoining months so a Monday-Friday week has one consistent calendar. */
function business_calendar_rules(string $month): array {
    business_calendar_dates($month);$date=new DateTimeImmutable($month.'-01');$q=db()->prepare('SELECT month,days FROM business_calendar WHERE month>=? AND month<=?');$q->execute([$date->modify('-1 month')->format('Y-m'),$date->modify('+1 month')->format('Y-m')]);$out=[];
    foreach($q->fetchAll() as $row){$selected=business_calendar_validate($row['month'],json_decode($row['days'],true,512,JSON_THROW_ON_ERROR));foreach(business_calendar_dates($row['month']) as $day)$out[$day]=in_array($day,$selected,true);}return $out;
}
function business_calendar_save(array $user,string $month,mixed $days,int $revision): void {
    if(($user['role']??'')!=='admin')throw new HRForbidden('관리자만 영업일을 저장할 수 있습니다.');
    $days=business_calendar_validate($month,$days);hr_assert($revision>=0,'변경 버전을 확인해 주세요.');$d=db();$d->beginTransaction();
    try{
        $q=$d->prepare('SELECT revision,days FROM business_calendar WHERE month=? FOR UPDATE');$q->execute([$month]);$old=$q->fetch();
        if(($old?(int)$old['revision']:0)!==$revision)throw new BusinessCalendarConflict('다른 관리자가 달력을 변경했습니다. 입력값을 확인하고 새로고침한 뒤 다시 저장해 주세요.');
        $before=$old?json_decode($old['days'],true,512,JSON_THROW_ON_ERROR):business_calendar_workdays($month);
        if($old){$q=$d->prepare('UPDATE business_calendar SET days=?,revision=revision+1,actor_id=?,actor_name=?,updated_at=CURRENT_TIMESTAMP WHERE month=?');$q->execute([hr_json($days),$user['id'],$user['display_name'],$month]);}
        else{$q=$d->prepare('INSERT INTO business_calendar(month,days,revision,actor_id,actor_name) VALUES(?,?,1,?,?)');$q->execute([$month,hr_json($days),$user['id'],$user['display_name']]);}
        $q=$d->prepare('INSERT INTO business_calendar_events(month,actor_id,before_days,after_days) VALUES(?,?,?,?)');$q->execute([$month,$user['id'],hr_json($before),hr_json($days)]);$d->commit();
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();if($e instanceof PDOException&&$e->getCode()==='23000')throw new BusinessCalendarConflict('달력이 먼저 저장되었습니다. 새로고침 후 다시 확인해 주세요.');throw $e;}
}
