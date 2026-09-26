<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';
require_once CNC_RUNTIME_DIR.'/policy.php';
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
    if (!in_array($input['department']??null,['insurance','cosmetics','health'],true) || !valid_day($input['date']??null) || !is_int($input['revision']??null)) reply(422,['error'=>'부서·적용일·변경 버전을 확인해 주세요.']);
    $policy=normalize_policy($input['policy']??null);
    $d=db(); $d->beginTransaction();
    $revision=(int)$d->query('SELECT revision FROM grade_revision WHERE id=1 FOR UPDATE')->fetchColumn();
    if ($revision!==$input['revision']) { $d->rollBack(); reply(409,['error'=>'다른 관리자가 기준을 변경했습니다. 수정값을 따로 기록한 뒤 새로고침하여 최신 기준을 확인해 주세요.']); }
    $q=$d->prepare('INSERT INTO grade_versions(department,effective_date,actor_id,actor_name,policy) VALUES(?,?,?,?,?)');
    $q->execute([$input['department'],$input['date'],$user['id'],$user['display_name'],json_encode($policy,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE)]);
    $d->exec('UPDATE grade_revision SET revision=revision+1 WHERE id=1');
    $entries=entries_for($user); $d->commit();
    reply(200,['entries'=>$entries,'revision'=>$revision+1]);
} catch(InvalidArgumentException|JsonException $e) {
    reply(422,['error'=>'입력한 기준을 확인해 주세요. '.$e->getMessage()]);
} catch(Throwable $e) {
    if (isset($d) && $d->inTransaction()) $d->rollBack();
    error_log('cnchome grade API failed: '.get_class($e));
    reply(503,['error'=>'DB 처리에 실패했습니다. 저장 여부를 새로고침으로 확인한 뒤 다시 시도해 주세요.']);
}
