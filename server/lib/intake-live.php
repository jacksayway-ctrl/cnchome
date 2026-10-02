<?php
declare(strict_types=1);
require_once __DIR__.'/intake-management.php';

// Bounded, read-only monitoring of actual receipts across all three departments.
function intake_live_snapshot(array $user,array $query): array {
    intake_admin($user);$filters=intake_filters($query);$params=[];$where=['s.is_test=0'];
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
        $d->commit();return ['records'=>$records,'counts'=>$counts,'total'=>$total,'page'=>$page,'pages'=>$pages,'latestId'=>$latest,'newCount'=>$newCount,'checkedAt'=>(new DateTimeImmutable('now',new DateTimeZone('Asia/Seoul')))->format('H:i:s')];
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
