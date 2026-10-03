<?php
declare(strict_types=1);
require_once __DIR__.'/hr.php';
require_once __DIR__.'/business-calendar.php';

class CalendarHolidayConflict extends RuntimeException {}

/** Named calendar holidays are display metadata; workday and payroll rules stay separate. */
function calendar_holiday_date(mixed $date): string {
    hr_assert(is_string($date)&&preg_match('/^(?:20\d{2}|2100)-(?:0[1-9]|1[0-2])-[0-3]\d$/D',$date)===1&&hr_day($date),'휴일 날짜를 확인해 주세요.');
    return $date;
}
function calendar_holiday_range(array $input): array {
    if(isset($input['from'])||isset($input['to'])){
        $from=calendar_holiday_date($input['from']??null);$to=calendar_holiday_date($input['to']??null);
    }else{
        $month=$input['month']??substr(hr_today(),0,7);
        hr_assert(is_string($month)&&preg_match('/^(?:20\d{2}|2100)-(?:0[1-9]|1[0-2])$/D',$month)===1,'휴일 조회 월을 확인해 주세요.');
        $date=new DateTimeImmutable($month.'-01');$from=$date->format('Y-m-d');$to=$date->format('Y-m-t');
    }
    hr_assert($from<=$to&&(new DateTimeImmutable($from))->diff(new DateTimeImmutable($to))->days<=369,'휴일 조회 기간은 370일 이내로 선택해 주세요.');
    return [$from,$to];
}
function calendar_holidays_read(array $user,string $from,string $to): array {
    if(!in_array($user['role']??'',['admin','employee'],true))throw new HRForbidden('달력 조회 권한이 없습니다.');
    [$from,$to]=calendar_holiday_range(['from'=>$from,'to'=>$to]);
    $q=db()->prepare('SELECT holiday_date,holiday_name,revision,actor_name,updated_at FROM company_calendar_holidays WHERE active=1 AND holiday_date>=? AND holiday_date<=? ORDER BY holiday_date');$q->execute([$from,$to]);
    $names=[];$entries=[];
    foreach($q->fetchAll() as $row){
        $names[$row['holiday_date']]=$row['holiday_name'];
        $entries[]=['date'=>$row['holiday_date'],'name'=>$row['holiday_name'],'revision'=>(int)$row['revision'],'savedBy'=>$row['actor_name'],'savedAt'=>str_replace(' ','T',$row['updated_at']).'Z'];
    }
    $q=db()->prepare('SELECT month,days FROM business_calendar WHERE month>=? AND month<=?');$q->execute([substr($from,0,7),substr($to,0,7)]);
    $workdayOverrides=[];
    foreach($q->fetchAll() as $row){
        $selected=business_calendar_validate($row['month'],json_decode($row['days'],true,512,JSON_THROW_ON_ERROR));
        foreach(business_calendar_dates($row['month']) as $date)if($date>=$from&&$date<=$to)$workdayOverrides[$date]=in_array($date,$selected,true);
    }
    return ['from'=>$from,'to'=>$to,'holidays'=>$names,'entries'=>$entries,'workdayOverrides'=>$workdayOverrides];
}
function calendar_holiday_save(array $user,array $input): void {
    if(($user['role']??'')!=='admin')throw new HRForbidden('관리자만 휴일을 지정할 수 있습니다.');
    $action=$input['action']??null;
    hr_assert(in_array($action,['add','update','remove'],true),'휴일 저장 방법을 확인해 주세요.');
    $date=calendar_holiday_date($input['date']??null);
    $name='';
    if($action!=='remove'){
        hr_assert(is_string($input['name']??null),'휴일명을 입력해 주세요.');
        $name=trim($input['name']);
        hr_assert($name!==''&&mb_strlen($name,'UTF-8')<=80&&preg_match('/[\p{Cc}\p{Zl}\p{Zp}]/u',$name)!==1,'휴일명은 줄바꿈 없이 80자 이내로 입력해 주세요.');
    }
    if($action!=='add')hr_assert(is_int($input['revision']??null)&&$input['revision']>=1,'휴일 변경 버전을 확인해 주세요.');
    $d=db();$d->beginTransaction();
    try{
        $q=$d->prepare('SELECT holiday_name,active,revision FROM company_calendar_holidays WHERE holiday_date=? FOR UPDATE');$q->execute([$date]);$old=$q->fetch();
        if($action==='add'&&$old&&(bool)$old['active'])throw new CalendarHolidayConflict('이미 휴일이 지정된 날짜입니다. 아래 목록에서 휴일명을 수정해 주세요.');
        if($action!=='add'&&(!$old||!(bool)$old['active']||(int)$old['revision']!==$input['revision']))throw new CalendarHolidayConflict('다른 관리자가 휴일을 변경했습니다. 새로고침한 뒤 다시 확인해 주세요.');
        $before=$old&&(bool)$old['active']?$old['holiday_name']:null;$after=$action==='remove'?null:$name;
        if($old){
            $q=$d->prepare('UPDATE company_calendar_holidays SET holiday_name=?,active=?,revision=revision+1,actor_id=?,actor_name=?,updated_at=CURRENT_TIMESTAMP WHERE holiday_date=?');
            $q->execute([$after??$old['holiday_name'],$action==='remove'?0:1,$user['id'],$user['display_name'],$date]);
        }else{
            $q=$d->prepare('INSERT INTO company_calendar_holidays(holiday_date,holiday_name,active,revision,actor_id,actor_name) VALUES(?,?,1,1,?,?)');
            $q->execute([$date,$name,$user['id'],$user['display_name']]);
        }
        $q=$d->prepare('INSERT INTO company_calendar_holiday_events(holiday_date,action,actor_id,actor_name,before_name,after_name) VALUES(?,?,?,?,?,?)');
        $q->execute([$date,$action,$user['id'],$user['display_name'],$before,$after]);$d->commit();
    }catch(Throwable $e){
        if($d->inTransaction())$d->rollBack();
        if($e instanceof PDOException&&$e->getCode()==='23000')throw new CalendarHolidayConflict('다른 관리자가 먼저 휴일을 저장했습니다. 새로고침한 뒤 확인해 주세요.');
        throw $e;
    }
}
