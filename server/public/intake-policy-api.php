<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';
require_once CNC_RUNTIME_DIR.'/intake-policy.php';
header('Content-Type: application/json; charset=utf-8');
function intake_policy_reply(int $status,array $data): never {http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
try{
 session_boot();$user=current_user();if(!$user)intake_policy_reply(401,['error'=>'다시 로그인해 주세요.']);
 if($_SERVER['REQUEST_METHOD']==='GET')intake_policy_reply(200,intake_policy_snapshot());
 if($_SERVER['REQUEST_METHOD']!=='POST')intake_policy_reply(405,['error'=>'허용되지 않은 요청입니다.']);
 if($user['role']!=='admin')intake_policy_reply(403,['error'=>'관리자만 정책을 저장할 수 있습니다.']);
 if(!csrf_ok($_SERVER['HTTP_X_CSRF_TOKEN']??''))intake_policy_reply(403,['error'=>'새로고침 후 다시 시도해 주세요.']);
 $raw=file_get_contents('php://input',false,null,0,2097153);if(strlen($raw)>2097152)intake_policy_reply(413,['error'=>'정책표가 너무 큽니다. 표를 나누어 등록해 주세요.']);
 $input=json_decode($raw,true,64,JSON_THROW_ON_ERROR);intake_policy_check(is_array($input),'정책 요청을 확인해 주세요.');
 intake_policy_reply(200,intake_policy_mutate($user,$input));
}catch(IntakePolicyForbidden $e){intake_policy_reply(403,['error'=>$e->getMessage()]);}
catch(IntakePolicyConflict $e){intake_policy_reply(409,['error'=>$e->getMessage()]);}
catch(InvalidArgumentException|JsonException $e){intake_policy_reply(422,['error'=>$e->getMessage()]);}
catch(Throwable $e){error_log('cnchome intake policy: '.get_class($e));intake_policy_reply(503,['error'=>'정책 DB에 연결하지 못했습니다. 저장 완료가 아닙니다. 잠시 후 다시 시도해 주세요.']);}
