<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/sales.php';
header('Content-Type: application/json; charset=utf-8');
function sales_reply(int $status,array $body): never {http_response_code($status);echo hr_json($body);exit;}
try {
    session_boot();$user=current_user();if(!$user)sales_reply(401,['error'=>'다시 로그인해 주세요.']);
    $month=(string)($_GET['month']??substr(hr_today(),0,7));hr_assert(sales_month($month),'조회할 월을 확인해 주세요.');
    $department=$user['role']==='admin'&&isset($_GET['department'])?management_request_department():null;
    if($_SERVER['REQUEST_METHOD']==='POST'){
        if(!csrf_ok($_SERVER['HTTP_X_CSRF_TOKEN']??''))sales_reply(403,['error'=>'새로고침 후 다시 시도해 주세요.']);
        $raw=file_get_contents('php://input',false,null,0,8193);if(strlen($raw)>8192)sales_reply(413,['error'=>'입력 내용이 너무 깁니다.']);
        $in=json_decode($raw,true,32,JSON_THROW_ON_ERROR);hr_assert(is_array($in),'입력 내용을 확인해 주세요.');
        if(($in['action']??'')==='create'&&($in['scopeTeam']??'')!==''){
            hr_assert($user['role']==='admin','부서 제한 접수는 관리자만 등록할 수 있습니다.');
            $scopeTeam=$in['scopeTeam'];
            hr_assert(is_string($scopeTeam)&&in_array($scopeTeam,['insurance','cosmetics','health'],true),'부서 정보를 확인해 주세요.');
            $employeeQuery=db()->prepare("SELECT department FROM app_users WHERE id=? AND role='employee'");
            $employeeQuery->execute([(int)($in['employeeId']??0)]);
            hr_assert($employeeQuery->fetchColumn()===$scopeTeam,'선택한 직원이 현재 부서와 다릅니다.');
        }
        if($department!==null){
            if(($in['action']??'')==='create'){$q=db()->prepare('SELECT department FROM app_users WHERE id=?');$q->execute([(int)($in['employeeId']??0)]);hr_assert($q->fetchColumn()===$department,'선택한 부서의 직원을 확인해 주세요.');}
            elseif(($in['action']??'')==='status'){$scopeRows=sales_snapshot($user,$month)['records'];$matched=false;foreach($scopeRows as $record)if($record['id']===(string)($in['id']??'')&&$record['team']===$department)$matched=true;hr_assert($matched,'선택한 부서의 접수를 확인해 주세요.');}
        }
        sales_mutate($user,$in);
    }elseif($_SERVER['REQUEST_METHOD']!=='GET')sales_reply(405,['error'=>'허용되지 않은 요청입니다.']);
    $result=sales_snapshot($user,$month);
    if($user['role']==='employee'){
        require_once CNC_RUNTIME_DIR.'/intake-management.php';
        $normal=intake_actual_normal_records($user,['month'=>$month,'scope'=>'real','team'=>'','employee'=>'']);
        $home=array_values(array_filter($result['records'],fn($r)=>$r['status']!=='normal'&&str_starts_with($r['date'],$month)));
        foreach($normal as $record)if(str_starts_with($record['statusDate'],$month)){
            $record['firstDate']=$record['date'];$record['date']=$record['statusDate'];
            $home[]=$record;
        }
        $result['homeRecords']=$home;
    }
    if($department!==null){$result['records']=array_values(array_filter($result['records'],fn($r)=>$r['team']===$department));$result['staff']=array_values(array_filter($result['staff'],fn($r)=>$r['team']===$department));$result['department']=$department;}
    if(($in['action']??'')==='create'){$q=db()->prepare('SELECT s.customer_name,u.display_name AS counselor_name FROM sales_records s JOIN app_users u ON u.id=s.employee_id WHERE s.request_key=?');$q->execute([$in['requestKey']]);$saved=$q->fetch();if($saved)$result['savedReceipt']=['customer'=>$saved['customer_name'],'counselorName'=>$saved['counselor_name']??''];}
    sales_reply(200,$result);
}catch(SalesDuplicate $e){sales_reply(409,['duplicate'=>true,'duplicateCount'=>$e->count,'error'=>$e->getMessage()]);}
catch(HRForbidden $e){sales_reply(403,['error'=>$e->getMessage()]);}
catch(InvalidArgumentException|JsonException $e){sales_reply(422,['error'=>$e->getMessage()]);}
catch(Throwable $e){error_log('cnchome sales error '.get_class($e));sales_reply(503,['error'=>'접수 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.']);}
