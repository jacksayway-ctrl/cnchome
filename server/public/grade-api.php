<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';
require_once CNC_RUNTIME_DIR.'/grade-settings.php';
header('Content-Type: application/json; charset=utf-8');
function reply(int $code,array $body): never { http_response_code($code); echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR); exit; }
try {
    session_boot(); $user=current_user();
    if (!$user) reply(401,['error'=>'로그인이 만료됐습니다. 다시 로그인해 주세요.']);
    if ($_SERVER['REQUEST_METHOD']==='GET') reply(200,snapshot($user));
    if ($_SERVER['REQUEST_METHOD']!=='POST') reply(405,['error'=>'허용되지 않은 요청입니다.']);
    if ($user['role']!=='admin') reply(403,['error'=>'관리자만 저장할 수 있습니다.']);
    if (!csrf_ok($_SERVER['HTTP_X_CSRF_TOKEN']??'')) reply(403,['error'=>'페이지를 새로고침한 후 다시 시도해 주세요.']);
    $raw=file_get_contents('php://input',false,null,0,131073);
    if (strlen($raw)>131072) reply(413,['error'=>'요청이 너무 큽니다.']);
    $input=json_decode($raw,true,512,JSON_THROW_ON_ERROR);
    if(!is_array($input))reply(422,['error'=>'입력 형식을 확인해 주세요.']);
    $saved=grade_save_settings($user,$input);
    reply(200,snapshot($user)+['saved'=>$saved]);
} catch(GradeRevisionConflict $e) {
    reply(409,['error'=>$e->getMessage()]);
} catch(HRForbidden $e) {
    reply(403,['error'=>$e->getMessage()]);
} catch(InvalidArgumentException|JsonException $e) {
    reply(422,['error'=>'입력한 기준을 확인해 주세요. '.$e->getMessage()]);
} catch(Throwable $e) {
    if (isset($d) && $d->inTransaction()) $d->rollBack();
    error_log('cnchome grade API failed: '.get_class($e));
    reply(503,['error'=>'DB 처리에 실패했습니다. 저장 여부를 새로고침으로 확인한 뒤 다시 시도해 주세요.']);
}
