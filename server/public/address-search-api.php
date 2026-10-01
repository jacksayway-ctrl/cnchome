<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';
require_once CNC_RUNTIME_DIR.'/address-search.php';
header('Content-Type: application/json; charset=utf-8');
function address_search_reply(int $status,array $body): never {http_response_code($status);echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
try{
    session_boot();$user=current_user();if(!$user)address_search_reply(401,['error'=>'다시 로그인해 주세요.','count'=>0,'results'=>[]]);
    if(($_SERVER['REQUEST_METHOD']??'')!=='GET'){header('Allow: GET');address_search_reply(405,['error'=>'허용되지 않은 요청입니다.','count'=>0,'results'=>[]]);}
    $query=address_search_query($_GET['q']??null);
    // The provider can be slow; never block saves or other requests in this window.
    if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
    address_search_reply(200,address_search(db(),$query));
}catch(InvalidArgumentException $e){address_search_reply(422,['error'=>$e->getMessage(),'count'=>0,'results'=>[]]);}
catch(Throwable $e){error_log('cnchome address search unavailable '.get_class($e));address_search_reply(503,['error'=>'주소 검색에 연결하지 못했습니다. 잠시 후 다시 입력하거나 주소를 직접 입력해 주세요.','count'=>0,'results'=>[]]);}
