<?php
declare(strict_types=1);

// _cw selects a window's cookie. It is not a session ID or bearer credential.
final class WindowSessionError extends RuntimeException {
    public function __construct(public readonly int $status, string $message) {parent::__construct($message);}
}
function window_session_valid_id(mixed $value): bool {
    return is_string($value) && preg_match('/^[a-f0-9]{32}$/D',$value)===1;
}
function window_session_selector(array $get,array $post,array $server): ?string {
    $values=[];
    foreach([[$get,'_cw'],[$post,'_cw'],[$server,'HTTP_X_CNC_WINDOW']] as [$source,$key]){
        if(!array_key_exists($key,$source))continue;
        if(!window_session_valid_id($source[$key]))throw new WindowSessionError(400,'창 로그인 정보를 확인할 수 없습니다. 새 창에서 다시 로그인해 주세요.');
        $values[]=$source[$key];
    }
    if(!$values)return null;
    if(count(array_unique($values))!==1)throw new WindowSessionError(400,'창 로그인 정보가 일치하지 않습니다. 새로고침해 주세요.');
    return $values[0];
}
function window_session_current_context(): string {return (string)($GLOBALS['cnc_window_context']??'');}
function window_session_cookie_name(string $id,string $role): string {
    if(!window_session_valid_id($id)||!in_array($role,['employee','admin'],true))throw new WindowSessionError(400,'창 로그인 정보를 확인해 주세요.');
    return 'cnchome_w_'.$id.'_'.$role;
}
function window_session_cookie_capacity(string $id,string $role,array $cookies): void {
    $target=window_session_cookie_name($id,$role);
    if(array_key_exists($target,$cookies))return;
    $count=0;foreach(array_keys($cookies) as $name)if(preg_match('/^cnchome_w_[a-f0-9]{32}_(?:employee|admin)$/D',(string)$name))$count++;
    if($count>=64)throw new WindowSessionError(429,'로그인한 창이 너무 많습니다. 사용하지 않는 창에서 로그아웃한 후 다시 열어 주세요.');
}
function window_session_configure(string $id,string $role,int $timeout): void {
    if(session_status()===PHP_SESSION_ACTIVE)throw new LogicException('A window session is already active.');
    ini_set('session.gc_maxlifetime','86400');
    ini_set('session.use_strict_mode','1');
    ini_set('session.use_cookies','1');
    ini_set('session.use_only_cookies','1');
    ini_set('session.use_trans_sid','0');
    session_name(window_session_cookie_name($id,$role));
    session_set_cookie_params(['lifetime'=>max(5,min(1440,$timeout))*60,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
}
function window_session_refresh_cookie(int $timeout): void {
    if(session_status()!==PHP_SESSION_ACTIVE)throw new LogicException('No active window session.');
    setcookie(session_name(),session_id(),['expires'=>time()+max(5,min(1440,$timeout))*60,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
}
function window_session_start(string $id,string $role,int $timeout): void {
    window_session_cookie_capacity($id,$role,$_COOKIE);
    window_session_configure($id,$role,$timeout);
    // A previous session may have been closed by the fork endpoint.
    session_id('');
    if(!session_start())throw new RuntimeException('Unable to open the window session.');
    if($_SESSION&&(!isset($_SESSION['cnc_window'],$_SESSION['cnc_role'])||$_SESSION['cnc_window']!==$id||$_SESSION['cnc_role']!==$role)){
        // A copied/misbound cookie must never alter the other window's session.
        session_abort();
        setcookie(session_name(),'', ['expires'=>time()-3600,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
        throw new WindowSessionError(401,'이 창에서 다시 로그인해 주세요.');
    }
    $GLOBALS['cnc_window_context']=$id;
    $_SESSION['cnc_window']=$id;$_SESSION['cnc_role']=$role;
    if(isset($_SESSION['last'])&&time()-(int)$_SESSION['last']>max(5,min(1440,$timeout))*60){
        $_SESSION=['cnc_window'=>$id,'cnc_role'=>$role];
        if(!session_regenerate_id(true))throw new RuntimeException('Unable to renew an expired window session.');
    }
    $_SESSION['last']=time();
    $_SESSION['csrf']??=bin2hex(random_bytes(32));
    window_session_refresh_cookie($timeout);
}
function window_session_is_document_get(array $server): bool {
    if(($server['REQUEST_METHOD']??'GET')!=='GET')return false;
    $path=parse_url((string)($server['REQUEST_URI']??''),PHP_URL_PATH);
    return is_string($path)&&in_array($path,['/login.php','/signup.php','/office.php','/employee.php','/admin.php','/preview.php','/personnel.php','/profile-entry.php','/memberships.php','/business-calendar.php','/contracts.php','/pay-statements.php','/payroll.php','/intake.php','/intake-alerts.php','/documents.php','/notices.php'],true);
}
function window_session_request_context(array $get,array $post,array $server): ?string {
    $id=window_session_selector($get,$post,$server);
    if($id===null&&!window_session_is_document_get($server))throw new WindowSessionError(401,'이 창에서 다시 로그인해 주세요.');
    return $id;
}
function window_session_bootstrap_document(): never {
    header('Content-Type: text/html; charset=utf-8');
    header("Content-Security-Policy: default-src 'none'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'");
    echo '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="cnc-window-bootstrap" content="1"><title>씨앤씨 로그인</title><script src="/window-session.js" defer></script></head><body><p role="status">이 창의 로그인 정보를 확인하고 있습니다.</p><noscript>창별 로그인을 사용하려면 JavaScript를 켜 주세요.</noscript></body></html>';
    exit;
}
function window_session_error_response(WindowSessionError $error): never {
    http_response_code($error->status);header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error'=>$error->getMessage(),'windowSessionRequired'=>true],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;
}
function window_session_redirect(string $location,string $id,array $server): string {
    if(!window_session_valid_id($id)||preg_match('/[\x00-\x20\x7f\\\\]/',$location))return $location;
    $parts=parse_url($location);if($parts===false||isset($parts['user'])||isset($parts['pass']))return $location;
    if(isset($parts['scheme'])||isset($parts['host'])){
        $secure=(!empty($server['HTTPS'])&&$server['HTTPS']!=='off')||($server['REQUEST_SCHEME']??'')==='https';
        $scheme=$secure?'https':'http';$origin=parse_url($scheme.'://'.($server['HTTP_HOST']??''));
        if(!$origin||strtolower($parts['host']??'')!==strtolower($origin['host']??'')||strtolower($parts['scheme']??$scheme)!==$scheme||($parts['port']??($scheme==='https'?443:80))!==($origin['port']??($scheme==='https'?443:80)))return $location;
    }
    $fragment='';$hash=strpos($location,'#');if($hash!==false){$fragment=substr($location,$hash);$location=substr($location,0,$hash);}
    $query=strpos($location,'?');$base=$query===false?$location:substr($location,0,$query);$kept=[];
    if($query!==false)foreach(explode('&',substr($location,$query+1)) as $part){if($part!==''&&urldecode(explode('=',$part,2)[0])!=='_cw')$kept[]=$part;}
    $kept[]='_cw='.$id;
    return $base.'?'.implode('&',$kept).$fragment;
}
function window_session_register_redirects(): void {
    static $registered=false;if($registered)return;$registered=true;
    header_register_callback(static function(): void {
        $id=window_session_current_context();if($id==='')return;
        foreach(headers_list() as $header){
            if(strncasecmp($header,'Location:',9)!==0)continue;
            $location=trim(substr($header,9));$next=window_session_redirect($location,$id,$_SERVER);
            if($next!==$location)header('Location: '.$next,true,http_response_code());
        }
    });
}
function window_session_fork(string $childId,int $timeout): string {
    if(session_status()!==PHP_SESSION_ACTIVE||empty($_SESSION['user_id']))throw new WindowSessionError(401,'다시 로그인해 주세요.');
    $parent=window_session_current_context();$role=(string)($_SESSION['cnc_role']??'');
    if(!window_session_valid_id($childId)||$childId===$parent)throw new WindowSessionError(400,'새 창의 로그인 정보를 확인해 주세요.');
    foreach(['employee','admin'] as $candidate)if(array_key_exists(window_session_cookie_name($childId,$candidate),$_COOKIE))throw new WindowSessionError(409,'이미 사용 중인 창입니다. 새 창을 다시 열어 주세요.');
    window_session_cookie_capacity($childId,$role,$_COOKIE);
    $userId=(int)$_SESSION['user_id'];
    session_write_close();
    window_session_start($childId,$role,$timeout);
    $_SESSION=['user_id'=>$userId,'last'=>time(),'csrf'=>bin2hex(random_bytes(32)),'cnc_window'=>$childId,'cnc_role'=>$role];
    session_write_close();
    return $childId;
}
