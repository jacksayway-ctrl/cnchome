<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';require_once CNC_RUNTIME_DIR.'/notices.php';
header('Content-Type: application/json; charset=utf-8');
function notices_reply(int $status,array $data): never {http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
try{
 session_boot();$user=current_user();if(!$user)notices_reply(401,['error'=>'다시 로그인해 주세요.']);
 if($_SERVER['REQUEST_METHOD']==='POST'){
  if($user['role']!=='admin')notices_reply(403,['error'=>'관리자만 공지를 관리할 수 있습니다.']);
  if(!csrf_ok($_SERVER['HTTP_X_CSRF_TOKEN']??''))notices_reply(403,['error'=>'새로고침 후 다시 시도해 주세요.']);
  $raw=file_get_contents('php://input',false,null,0,16385);if(strlen($raw)>16384)notices_reply(413,['error'=>'공지 내용이 너무 깁니다.']);
  $input=json_decode($raw,true,16,JSON_THROW_ON_ERROR);notice_assert(is_array($input),'공지 입력을 확인해 주세요.');notice_mutate($user,$input);
 }elseif($_SERVER['REQUEST_METHOD']!=='GET')notices_reply(405,['error'=>'허용되지 않는 요청입니다.']);
 $after=null;if(isset($_GET['after'])){notice_assert(is_string($_GET['after'])&&ctype_digit($_GET['after'])&&strlen($_GET['after'])<=16,'조회 위치를 확인해 주세요.');$after=(int)$_GET['after'];}
 notices_reply(200,notice_snapshot($user,$after));
}catch(NoticeForbidden $e){notices_reply(403,['error'=>$e->getMessage()]);}
catch(InvalidArgumentException|JsonException $e){notices_reply(422,['error'=>$e->getMessage()]);}
catch(Throwable $e){error_log('cnchome notices '.get_class($e));notices_reply(503,['error'=>'공지를 불러오지 못했습니다. 잠시 후 다시 확인합니다.']);}
