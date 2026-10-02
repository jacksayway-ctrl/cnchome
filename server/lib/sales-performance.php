<?php
declare(strict_types=1);
require_once __DIR__.'/test-identities.php';

function sales_customer_base_name(string $name): string {return preg_replace('/(?:\s*\(중복(?:접수)?\))+\s*$/u','',trim($name));}
function sales_customer_key(string $name): string {return preg_replace('/\s+/u','',sales_customer_base_name($name));}
function sales_phone_key(string $phone): string {return preg_replace('/\D/','',$phone);}

/** Only normal receipts earn performance; a customer's matching name AND phone earn once. */
function sales_performance_unique(array $rows): array {
    usort($rows,fn($a,$b)=>strcmp($a['first_date'],$b['first_date'])?:strnatcmp((string)($a['id']??''),(string)($b['id']??'')));
    $seen=[];$result=[];
    foreach($rows as $row){
        if(($row['status']??'')!=='normal')continue;
        $name=sales_customer_key((string)($row['customer_name']??''));$phone=sales_phone_key((string)($row['phone']??''));
        // Incomplete legacy data cannot prove that two applicants are the same person.
        if($name!==''&&$phone!==''){$key=(int)$row['is_test'].'|'.$name.'|'.$phone;if(isset($seen[$key]))continue;$seen[$key]=true;}
        $result[]=$row;
    }
    return $result;
}
function sales_performance_rows(?bool $test,string $through): array {
    $q=db()->prepare("SELECT * FROM sales_records WHERE status='normal' AND first_date<=?".($test===null?'':' AND is_test=?').' ORDER BY first_date');$q->execute($test===null?[$through]:[$through,$test?1:0]);$rows=$q->fetchAll();
    if($test!==false){
        $q=db()->query('SELECT t.user_id,t.state,u.department,u.username,u.display_name,u.role FROM test_employee_data t JOIN app_users u ON u.id=t.user_id');
        foreach($q->fetchAll() as $owner){if(!cnc_test_user($owner))continue;$state=json_decode($owner['state'],true,512,JSON_THROW_ON_ERROR);foreach($state['sales']??[] as $index=>$sale)if(($sale['status']??'')==='정상'&&$sale['date']<=$through)$rows[]=['id'=>'test:'.$owner['user_id'].':'.($sale['id']??'row'.$index),'employee_id'=>$owner['user_id'],'department'=>$owner['department'],'first_date'=>$sale['date'],'customer_name'=>$sale['name']??'','phone'=>$sale['phone']??'','status'=>'normal','is_test'=>1];}
    }
    return sales_performance_unique($rows);
}
function sales_performance_counts(int $employeeId,string $department,bool $test,string $from,string $through): array {
    $counts=[];foreach(sales_performance_rows($test,$through) as $row)if((int)$row['employee_id']===$employeeId&&$row['department']===$department&&$row['first_date']>=$from)$counts[$row['first_date']]=($counts[$row['first_date']]??0)+1;return $counts;
}
