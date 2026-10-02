<?php
declare(strict_types=1);
require_once __DIR__.'/intake-management.php';
function intake_alert_filters(array $query): array {
    $f=[];foreach(['scope'=>10,'team'=>20,'q'=>80,'order'=>10,'review'=>10] as $key=>$max)$f[$key]=intake_text($query[$key]??'',$max);
    $f['scope']=$f['scope']?:'real';$f['order']=$f['order']?:'oldest';$f['review']=$f['review']?:'all';
    hr_assert(in_array($f['scope'],['real','test','all'],true)&&in_array($f['team'],['','insurance','cosmetics','health'],true)&&in_array($f['order'],['oldest','newest'],true)&&in_array($f['review'],['all','new','held'],true),'조회 조건을 확인해 주세요.');
    $f['p']=max(1,intake_number($query['p']??1));return $f;
}
function intake_alert_region(string $consultationPlace,string $address=''): string {
    $text=trim(preg_replace('/\s+/u',' ',$consultationPlace.' '.$address)??'');
    if($text==='')return '';
    $provinces=[
        '서울특별시'=>'서울특별시','서울시'=>'서울특별시','서울'=>'서울특별시',
        '부산광역시'=>'부산광역시','부산시'=>'부산광역시','부산'=>'부산광역시',
        '대구광역시'=>'대구광역시','대구시'=>'대구광역시','대구'=>'대구광역시',
        '인천광역시'=>'인천광역시','인천시'=>'인천광역시','인천'=>'인천광역시',
        '광주광역시'=>'광주광역시','광주시'=>'광주광역시','광주'=>'광주광역시',
        '대전광역시'=>'대전광역시','대전시'=>'대전광역시','대전'=>'대전광역시',
        '울산광역시'=>'울산광역시','울산시'=>'울산광역시','울산'=>'울산광역시',
        '세종특별자치시'=>'세종특별자치시','세종시'=>'세종특별자치시','세종'=>'세종특별자치시',
        '경기도'=>'경기도','경기'=>'경기도','강원특별자치도'=>'강원특별자치도','강원도'=>'강원특별자치도','강원'=>'강원특별자치도',
        '충청북도'=>'충청북도','충북'=>'충청북도','충청남도'=>'충청남도','충남'=>'충청남도',
        '전북특별자치도'=>'전북특별자치도','전라북도'=>'전북특별자치도','전북'=>'전북특별자치도','전라남도'=>'전라남도','전남'=>'전라남도',
        '경상북도'=>'경상북도','경북'=>'경상북도','경상남도'=>'경상남도','경남'=>'경상남도','제주특별자치도'=>'제주특별자치도','제주도'=>'제주특별자치도','제주'=>'제주특별자치도'
    ];
    foreach($provinces as $prefix=>$canonical){
        if(!preg_match('/(?:^|\s)'.preg_quote($prefix,'/').'(?=\s|$)/u',$text,$match,PREG_OFFSET_CAPTURE))continue;
        $tail=trim(substr($text,$match[0][1]+strlen($match[0][0])));
        if(in_array($canonical,['서울특별시','부산광역시','대구광역시','인천광역시','광주광역시','대전광역시','울산광역시','세종특별자치시'],true))return $canonical;
        if(preg_match('/^([가-힣]+(?:시|군))(?=\s|$)/u',$tail,$local))return $canonical.' '.$local[1];
        return $canonical;
    }
    if(preg_match('/(?:^|\s)([가-힣]+시)(?=\s|$)/u',$text,$city))return $city[1];
    return '';
}
function intake_alert_snapshot(array $user,array $f): array {
    intake_admin($user);$d=db();
    $rows=$d->query("SELECT s.id,s.first_date AS date,s.customer_name AS customer,s.phone,s.address,s.department AS team,s.is_test AS isTest,u.display_name AS employee,c.consultation_place AS consultationPlace,(SELECT MIN(e.created_at) FROM sales_events e WHERE e.sale_id=s.id AND e.old_status='') AS createdAt FROM sales_records s JOIN app_users u ON u.id=s.employee_id LEFT JOIN sales_consultation_details c ON c.sale_id=s.id WHERE s.status='pending'")->fetchAll();
    if($f['scope']!=='real')foreach($d->query('SELECT t.state,u.id,u.display_name,u.department FROM test_employee_data t JOIN app_users u ON u.id=t.user_id')->fetchAll() as $test){
        foreach(json_decode($test['state'],true,512,JSON_THROW_ON_ERROR)['sales']??[] as $sale)if($sale['status']==='가접수')$rows[]=['id'=>'test:'.$test['id'].':'.$sale['id'],'date'=>$sale['date'],'customer'=>$sale['name'],'phone'=>$sale['phone']??'','address'=>$sale['address']??'','consultationPlace'=>$sale['consultationPlace']??'','team'=>$test['department'],'isTest'=>true,'employee'=>$test['display_name'],'createdAt'=>null];
    }
    $holds=[];foreach($d->query("SELECT record_key,created_at,reason FROM intake_management_events WHERE action='hold' ORDER BY id DESC")->fetchAll() as $r)if(!isset($holds[$r['record_key']]))$holds[$r['record_key']]=$r;
    foreach($rows as &$row){$row['id']=(string)$row['id'];$row['isTest']=(bool)$row['isTest'];$row['hold']=$holds[$row['id']]??null;$row['region']=intake_alert_region((string)($row['consultationPlace']??''),(string)($row['address']??''));}unset($row);
    $rows=array_values(array_filter($rows,function($r)use($f){
        if($f['scope']!=='all'&&$r['isTest']!==($f['scope']==='test'))return false;
        if($f['team']&&$r['team']!==$f['team'])return false;
        if(($f['review']==='new'&&$r['hold'])||($f['review']==='held'&&!$r['hold']))return false;
        if($f['q']){$q=mb_strtolower($f['q']);$hay=mb_strtolower($r['customer'].' '.$r['phone'].' '.$r['employee']);if(!str_contains($hay,$q)&&!(preg_match('/^[0-9 -]+$/D',$q)&&preg_replace('/\D/','',$q)!==''&&str_contains(preg_replace('/\D/','',$r['phone']),preg_replace('/\D/','',$q))))return false;}
        return true;
    }));
    usort($rows,function($a,$b)use($f){$left=$a['createdAt']?:$a['date'].' 00:00:00';$right=$b['createdAt']?:$b['date'].' 00:00:00';$c=strcmp($left,$right)?:strnatcmp($a['id'],$b['id']);return $f['order']==='oldest'?$c:-$c;});
    $total=count($rows);$pages=max(1,(int)ceil($total/30));$p=min($f['p'],$pages);
    return ['total'=>$total,'held'=>count(array_filter($rows,fn($r)=>$r['hold']!==null)),'rows'=>array_slice($rows,($p-1)*30,30),'pages'=>$pages,'page'=>$p];
}
