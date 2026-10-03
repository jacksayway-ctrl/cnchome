<?php
declare(strict_types=1);
require_once __DIR__.'/intake-management.php';

function intake_live_calendar_month(mixed $value,string $today): string {
    $month=intake_text($value??substr($today,0,7),7);
    hr_assert(sales_month($month)&&(int)substr($month,0,4)>=2000&&(int)substr($month,0,4)<=2100,'실적 달력 조회 월을 확인해 주세요.');
    return $month;
}
/** Complete Sunday-to-Saturday rows, including adjoining-month display dates. */
function intake_live_calendar_grid_dates(string $month): array {
    intake_live_calendar_month($month,$month.'-01');
    $first=new DateTimeImmutable($month.'-01',new DateTimeZone('Asia/Seoul'));
    $leading=(int)$first->format('w');$cells=(int)(ceil(($leading+(int)$first->format('t'))/7)*7);
    $start=$first->modify('-'.$leading.' days');$grid=[];
    for($i=0;$i<$cells;$i++)$grid[]=$start->modify('+'.$i.' days')->format('Y-m-d');
    return $grid;
}
// Saved status dates are local time; audit/event timestamps are stored in UTC.
function intake_live_calendar_date(array $row): string {
    return intake_effective_status_date($row);
}
function intake_live_calendar_public_holidays(): array {
    static $public=null;
    if($public===null){$path=__DIR__.'/config/public-holidays.json';if(!is_file($path))$path=dirname(__DIR__).'/config/public-holidays.json';$public=json_decode(file_get_contents($path),true,512,JSON_THROW_ON_ERROR);}
    return $public;
}
/** Display rules do not change receipt counts, workday settings or payroll. */
function intake_live_calendar_display(PDO $d,string $month,string $today): array {
    $q=$d->prepare('SELECT days FROM business_calendar WHERE month=?');$q->execute([$month]);$saved=$q->fetchColumn();
    $workdays=$saved!==false?array_fill_keys(json_decode((string)$saved,true,512,JSON_THROW_ON_ERROR),true):null;
    $q=$d->prepare('SELECT holiday_date,holiday_name FROM company_calendar_holidays WHERE active=1 AND holiday_date>=? AND holiday_date<=?');$q->execute([$month.'-01',(new DateTimeImmutable($month.'-01'))->format('Y-m-t')]);$holidays=$q->fetchAll(PDO::FETCH_KEY_PAIR);
    $public=intake_live_calendar_public_holidays();
    $names=$public[substr($month,0,4)]??[];$out=[];
    foreach(intake_live_calendar_grid_dates($month) as $date){
        if(substr($date,0,7)!==$month)continue;
        $holiday=implode(' · ',array_unique(array_filter([$names[$date]??'',$holidays[$date]??''])));
        $open=$workdays!==null?isset($workdays[$date]):((int)(new DateTimeImmutable($date))->format('N')<=5&&$holiday==='');
        $out[$date]=['showValues'=>$date<=$today&&$open,'workdayOverride'=>$workdays!==null?$open:null,'holiday'=>$holiday];
    }
    return $out;
}
function intake_live_calendar(PDO $d,string $month,string $today): array {
    $zone=new DateTimeZone('Asia/Seoul');$first=new DateTimeImmutable($month.'-01',$zone);$next=$first->modify('+1 month');
    $start=$first->format('Y-m-d');$end=$next->format('Y-m-d');
    $utcStart=$first->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');$utcEnd=$next->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    $zero=['pending'=>0,'normal'=>0,'as'=>0];$totals=array_fill_keys(['insurance','cosmetics','health'],$zero);$days=[];
    $display=intake_live_calendar_display($d,$month,$today);
    for($day=$first;$day<$next;$day=$day->modify('+1 day')){$date=$day->format('Y-m-d');$days[$date]=['date'=>$date]+$display[$date]+$totals;}
    // Eligibility must include earlier months to prevent paying the same normal
    // customer twice; fetch only the identity fields required by the shared rule.
    $q=$d->prepare("SELECT id,first_date,customer_name,phone,status,is_test FROM sales_records WHERE is_test=0 AND status='normal' AND first_date<=?");$q->execute([$today]);
    $eligible=array_fill_keys(array_map('strval',array_column(sales_performance_unique($q->fetchAll()),'id')),true);
    // Latest relevant audit/date and status event are joined once per receipt,
    // without a query for each row. The candidate window also includes an old
    // first call whose explicitly saved status date belongs to this month.
    $sql="SELECT s.id,s.first_date,s.department,s.status,a.after_data,a.created_at AS audit_created_at,e.created_at AS status_created_at
        FROM sales_records s
        ".intake_status_date_joins($d)."
        WHERE s.is_test=0 AND ((s.first_date>=? AND s.first_date<?) OR (s.status<>'pending' AND (JSON_EXTRACT(a.after_data,'$.statusChangedAt') LIKE ? OR (a.created_at>=? AND a.created_at<?) OR (e.created_at>=? AND e.created_at<?))))";
    $q=$d->prepare($sql);$q->execute([$start,$end,'%'.$month.'-%',$utcStart,$utcEnd,$utcStart,$utcEnd]);
    foreach($q->fetchAll() as $row){
        $department=$row['department'];$status=$row['status'];if(!isset($totals[$department][$status]))continue;
        if($status==='normal'&&!isset($eligible[(string)$row['id']]))continue;
        $date=intake_live_calendar_date($row);if(!isset($days[$date])||$date>$today)continue;
        ++$days[$date][$department][$status];++$totals[$department][$status];
    }
    return ['month'=>$month,'today'=>$today,'days'=>array_values($days),'totals'=>$totals];
}

// Bounded, read-only monitoring of actual receipts across all three departments.
function intake_live_snapshot(array $user,array $query): array {
    intake_admin($user);$filters=intake_filters($query);$today=hr_today();$calendarMonth=intake_live_calendar_month($query['calendarMonth']??null,$today);$params=[];$where=['s.is_test=0'];
    if($filters['team']!==''){$where[]='s.department=?';$params[]=$filters['team'];}
    if($filters['q']!==''){
        $digits=preg_replace('/\D/','',$filters['q']);$phone=$digits!==''&&(bool)preg_match('/^[0-9\s()+.\-]+$/uD',$filters['q']);
        // Escape LIKE wildcards so a typed name is a literal substring.
        $needle=str_replace(['!','%','_'],['!!','!%','!_'],mb_strtolower($filters['q']));
        $where[]=$phone?"(LOWER(s.customer_name) LIKE ? ESCAPE '!' OR REPLACE(REPLACE(REPLACE(s.phone,'-',''),' ',''),'+','') LIKE ?)":"LOWER(s.customer_name) LIKE ? ESCAPE '!'";
        $params[]='%'.$needle.'%';if($phone)$params[]='%'.$digits.'%';
    }
    $base=implode(' AND ',$where);$d=db();$d->beginTransaction();
    try{
        $q=$d->prepare('SELECT s.status,COUNT(*) AS amount,MAX(s.id) AS latest FROM sales_records s WHERE '.$base.' GROUP BY s.status');$q->execute($params);
        $counts=['pending'=>0,'normal'=>0,'as'=>0];$latest=0;foreach($q->fetchAll() as $row){$counts[$row['status']]=(int)$row['amount'];$latest=max($latest,(int)$row['latest']);}
        $total=$filters['status']!==''?$counts[$filters['status']]:array_sum($counts);$pages=max(1,(int)ceil($total/30));$page=min($filters['p'],$pages);$offset=($page-1)*30;
        $after=intake_number($query['after']??0);$newCount=0;
        if($after>0){$q=$d->prepare('SELECT COUNT(*) FROM sales_records s WHERE '.$base.' AND s.id>?');$q->execute([...$params,$after]);$newCount=(int)$q->fetchColumn();}
        if($filters['status']!==''){$where[]='s.status=?';$params[]=$filters['status'];}
        $q=$d->prepare('SELECT s.id,s.first_date,s.department,s.employee_id,s.customer_name,s.phone,s.address,s.status,s.revision,u.display_name,c.consultation_place,r.created_at FROM sales_records s JOIN app_users u ON u.id=s.employee_id LEFT JOIN sales_consultation_details c ON c.sale_id=s.id LEFT JOIN sales_receipt_details r ON r.sale_id=s.id WHERE '.implode(' AND ',$where).' ORDER BY s.id DESC LIMIT 30 OFFSET '.$offset);$q->execute($params);
        $records=[];foreach($q->fetchAll() as $row){
            $records[]=['id'=>(string)$row['id'],'date'=>$row['first_date'],'department'=>$row['department'],'employeeId'=>(int)$row['employee_id'],'employee'=>$row['display_name'],'customer'=>$row['customer_name'],'phone'=>$row['phone'],'region'=>$row['consultation_place']?:$row['address'],'status'=>$row['status'],'revision'=>(int)$row['revision'],'receivedAt'=>$row['created_at']?intake_time($row['created_at']):'','url'=>intake_url(['team'=>$row['department'],'month'=>'all','scope'=>'real'],['id'=>(string)$row['id'],'popup'=>'1'])];
        }
        $calendar=intake_live_calendar($d,$calendarMonth,$today);$d->commit();return ['calendar'=>$calendar,'records'=>$records,'counts'=>$counts,'total'=>$total,'page'=>$page,'pages'=>$pages,'latestId'=>$latest,'newCount'=>$newCount,'checkedAt'=>(new DateTimeImmutable('now',new DateTimeZone('Asia/Seoul')))->format('H:i:s')];
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
