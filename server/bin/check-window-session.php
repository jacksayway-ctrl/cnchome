<?php
declare(strict_types=1);
// Isolated CLI gate: synthetic identities and private temporary session files only.
require_once __DIR__.'/../lib/window-session.php';

if(($argv[1]??'')==='--worker'){
    $diagnostic=150;
    try{
        $in=json_decode(base64_decode($argv[2]??'',true)?:'',true,32,JSON_THROW_ON_ERROR);
        if(!is_array($in)||!is_dir($in['directory']??''))throw new RuntimeException('Missing fixture directory.');
        $diagnostic=151;session_save_path($in['directory']);ini_set('session.gc_probability','0');ini_set('session.cache_limiter','');
        $_COOKIE=$in['cookies']??[];$_GET=[];$_POST=[];
        $id=$in['window'];$role=$in['role']??'employee';$timeout=5;
        $diagnostic=152;window_session_start($id,$role,$timeout);
        $diagnostic=['login'=>153,'expire'=>154,'logout'=>155,'fork'=>156,'read'=>157][$in['operation']]??158;
        switch($in['operation']){
            case 'login':
                if(!session_regenerate_id(true))throw new RuntimeException('Fixture regeneration failed.');
                $_SESSION=['user_id'=>$in['user'],'last'=>time(),'csrf'=>bin2hex(random_bytes(32)),'cnc_window'=>$id,'cnc_role'=>$role,'fixture_notice'=>'retained'];break;
            case 'expire':$_SESSION['last']=time()-601;break;
            case 'logout':$_SESSION=[];session_destroy();break;
            case 'fork':window_session_fork($in['child'],5);break;
            case 'read':break;
            default:throw new RuntimeException('Unknown fixture operation.');
        }
        $diagnostic=159;$out=['name'=>session_name(),'id'=>session_id(),'state'=>$_SESSION??[],'context'=>window_session_current_context(),'cookieParams'=>session_get_cookie_params()];
        if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
        echo json_encode($out,JSON_THROW_ON_ERROR);
    }catch(Throwable $e){if(session_status()===PHP_SESSION_ACTIVE)session_abort();echo json_encode(['error'=>get_class($e),'status'=>$e instanceof WindowSessionError?$e->status:500,'diagnostic'=>$e instanceof WindowSessionError?0:$diagnostic],JSON_THROW_ON_ERROR);}
    exit;
}
// Only these fixed numbers reach deployment-status.json; never fixture cookies,
// exception strings, session IDs, or user data. Every failed assertion still stops deployment.
final class WindowSessionGateFailure extends RuntimeException {
    public function __construct(public readonly int $diagnostic) {parent::__construct('Window session gate failed.');}
}
set_exception_handler(static function(Throwable $error):never{
    $code=$error instanceof WindowSessionGateFailure?$error->diagnostic:149;
    if($code<61||$code>179)$code=149;
    fwrite(STDERR,'Window session gate failed: diagnostic '.$code."\n");exit($code);
});
function ws_assert(bool $condition,string $message): void {
    if($condition)return;
    $messages=[
        'Missing selector did not remain missing.','Matching selectors failed.','Unexpected rejection status.',
        'Document bootstrap unavailable.','API would receive an HTML bootstrap.','POST would bypass a missing selector.','A document cannot bootstrap a fresh window.',
        'Window A fixture login failed.','Window B did not receive its own session.','Logging in B changed A.','Logging in B replaced A CSRF.','Cookie protection/expiry changed.',
        'B authentication did not rotate its session ID.','B regeneration altered A.','Fork failed.','Child did not receive independent credentials.',
        'Fork copied unrelated state or changed the parent.','Fork changed parent authentication.','Existing child cookie was overwritten.','Fork reused its parent context.',
        'Logging out B affected A.','An anonymous window could fork a login.','Expiration was not isolated.','A session cookie was accepted for another window.',
        'Rejecting a copied cookie destroyed its owner.','A cookie crossed role boundaries.','Relative redirect lost route/hash.','Redirect retained another window selector.',
        'Same-origin redirect lost context.','Context leaked into an external/unsafe redirect.','Invalid session fixture response.'
    ];
    $index=array_search($message,$messages,true);throw new WindowSessionGateFailure($index===false?149:61+$index);
}
function ws_error(callable $fn,int $status): void {
    try{$fn();}catch(WindowSessionError $e){ws_assert($e->status===$status,'Unexpected rejection status.');return;}
    throw new WindowSessionGateFailure(140);
}
function ws_request(string $directory,array $input): array {
    $payload=base64_encode(json_encode(['directory'=>$directory]+$input,JSON_THROW_ON_ERROR));
    if(!function_exists('proc_open'))throw new WindowSessionGateFailure(141);
    $process=proc_open([PHP_BINARY,__FILE__,'--worker',$payload],[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
    if(!is_resource($process))throw new WindowSessionGateFailure(142);
    fclose($pipes[0]);$raw=stream_get_contents($pipes[1]);$errors=stream_get_contents($pipes[2]);fclose($pipes[1]);fclose($pipes[2]);
    $exit=proc_close($process);if($exit!==0)throw new WindowSessionGateFailure(143);if($errors!=='')throw new WindowSessionGateFailure(144);
    try{$out=json_decode($raw,true,32,JSON_THROW_ON_ERROR);}catch(JsonException $e){throw new WindowSessionGateFailure(145);}
    ws_assert(is_array($out),'Invalid session fixture response.');
    if(($out['status']??0)===500){$code=$out['diagnostic']??149;throw new WindowSessionGateFailure(is_int($code)&&$code>=150&&$code<=159?$code:149);}
    return $out;
}
function ws_run(string $directory,string $window,string $operation,array &$jar,array $extra=[]): array {
    $out=ws_request($directory,['window'=>$window,'operation'=>$operation,'cookies'=>$jar]+$extra);
    if(!isset($out['error'])){
        if($operation==='logout')unset($jar[window_session_cookie_name($window,$extra['role']??'employee')]);
        else $jar[$out['name']]=$out['id'];
    }
    return $out;
}

$directory=sys_get_temp_dir().'/cnc-window-session-'.bin2hex(random_bytes(12));
if(!mkdir($directory,0700))throw new WindowSessionGateFailure(146);
register_shutdown_function(static function()use($directory):void{foreach(glob($directory.'/*')?:[] as $file)if(is_file($file))unlink($file);rmdir($directory);});
$a=str_repeat('a',32);$b=str_repeat('b',32);$c=str_repeat('c',32);$d=str_repeat('d',32);$jar=[];

ws_assert(window_session_selector([],[],[])===null,'Missing selector did not remain missing.');
ws_assert(window_session_selector(['_cw'=>$a],['_cw'=>$a],['HTTP_X_CNC_WINDOW'=>$a])===$a,'Matching selectors failed.');
foreach(['',str_repeat('A',32),str_repeat('a',31),$a.'x',[$a],$a."\n"] as $bad)ws_error(fn()=>window_session_selector(['_cw'=>$bad],[],[]),400);
ws_error(fn()=>window_session_selector(['_cw'=>$a],[],['HTTP_X_CNC_WINDOW'=>$b]),400);
ws_error(fn()=>window_session_selector([],['_cw'=>$b],['HTTP_X_CNC_WINDOW'=>$a]),400);
ws_assert(window_session_is_document_get(['REQUEST_URI'=>'/office.php?role=employee','REQUEST_METHOD'=>'GET']),'Document bootstrap unavailable.');
foreach(['/sales-api.php','/session-api.php','/window-fork.php','/pending-intakes.php'] as $path)ws_assert(!window_session_is_document_get(['REQUEST_URI'=>$path,'REQUEST_METHOD'=>'GET']),'API would receive an HTML bootstrap.');
ws_assert(!window_session_is_document_get(['REQUEST_URI'=>'/login.php','REQUEST_METHOD'=>'POST']),'POST would bypass a missing selector.');
ws_error(fn()=>window_session_request_context([],[],['REQUEST_URI'=>'/session-api.php','REQUEST_METHOD'=>'GET']),401);
ws_error(fn()=>window_session_request_context([],[],['REQUEST_URI'=>'/login.php','REQUEST_METHOD'=>'POST']),401);
ws_assert(window_session_request_context([],[],['REQUEST_URI'=>'/login.php','REQUEST_METHOD'=>'GET'])===null,'A document cannot bootstrap a fresh window.');

$first=ws_run($directory,$a,'login',$jar,['user'=>101]);ws_assert(!isset($first['error']),'Window A fixture login failed.');
$firstCsrf=$first['state']['csrf'];$firstId=$first['id'];
$second=ws_run($directory,$b,'login',$jar,['user'=>202]);ws_assert(!isset($second['error'])&&$second['id']!==$firstId,'Window B did not receive its own session.');
$aRead=ws_run($directory,$a,'read',$jar);$bRead=ws_run($directory,$b,'read',$jar);
ws_assert(($aRead['state']['user_id']??null)===101&&($bRead['state']['user_id']??null)===202,'Logging in B changed A.');
ws_assert($aRead['state']['csrf']===$firstCsrf,'Logging in B replaced A CSRF.');
foreach([$aRead,$bRead] as $response){$params=$response['cookieParams'];ws_assert($params['secure']&&$params['httponly']&&$params['samesite']==='Lax'&&$params['lifetime']===300,'Cookie protection/expiry changed.');}

$oldB=$bRead['id'];$newB=ws_run($directory,$b,'login',$jar,['user'=>303]);
ws_assert($newB['id']!==$oldB&&$newB['state']['user_id']===303,'B authentication did not rotate its session ID.');
$aRead=ws_run($directory,$a,'read',$jar);ws_assert($aRead['id']===$firstId&&$aRead['state']['user_id']===101&&$aRead['state']['csrf']===$firstCsrf,'B regeneration altered A.');

$fork=ws_run($directory,$a,'fork',$jar,['child'=>$c]);ws_assert(!isset($fork['error'])&&$fork['context']===$c,'Fork failed.');
$child=ws_run($directory,$c,'read',$jar);$aRead=ws_run($directory,$a,'read',$jar);
ws_assert($child['state']['user_id']===101&&$child['state']['csrf']!==$firstCsrf&&$child['id']!==$firstId,'Child did not receive independent credentials.');
ws_assert(!isset($child['state']['fixture_notice'])&&$aRead['state']['fixture_notice']==='retained','Fork copied unrelated state or changed the parent.');
ws_assert($aRead['state']['csrf']===$firstCsrf&&$aRead['state']['user_id']===101,'Fork changed parent authentication.');
$duplicate=ws_run($directory,$a,'fork',$jar,['child'=>$c]);ws_assert(($duplicate['status']??0)===409,'Existing child cookie was overwritten.');
$same=ws_run($directory,$a,'fork',$jar,['child'=>$a]);ws_assert(($same['status']??0)===400,'Fork reused its parent context.');

ws_run($directory,$b,'logout',$jar);$bRead=ws_run($directory,$b,'read',$jar);$aRead=ws_run($directory,$a,'read',$jar);
ws_assert(!isset($bRead['state']['user_id'])&&$aRead['state']['user_id']===101,'Logging out B affected A.');
$anonymousFork=ws_run($directory,$b,'fork',$jar,['child'=>$d]);ws_assert(($anonymousFork['status']??0)===401,'An anonymous window could fork a login.');
ws_run($directory,$a,'expire',$jar);$expired=ws_run($directory,$a,'read',$jar);$child=ws_run($directory,$c,'read',$jar);
ws_assert(!isset($expired['state']['user_id'])&&$expired['state']['csrf']!==$firstCsrf&&$child['state']['user_id']===101,'Expiration was not isolated.');

$copied=$jar;$copied[window_session_cookie_name($d,'employee')]=$jar[window_session_cookie_name($c,'employee')];
$reject=ws_request($directory,['window'=>$d,'operation'=>'read','cookies'=>$copied]);ws_assert(($reject['status']??0)===401,'A session cookie was accepted for another window.');
$child=ws_run($directory,$c,'read',$jar);ws_assert($child['state']['user_id']===101,'Rejecting a copied cookie destroyed its owner.');
$roleCopy=$jar;$roleCopy[window_session_cookie_name($c,'admin')]=$jar[window_session_cookie_name($c,'employee')];
$reject=ws_request($directory,['window'=>$c,'role'=>'admin','operation'=>'read','cookies'=>$roleCopy]);ws_assert(($reject['status']??0)===401,'A cookie crossed role boundaries.');

$full=[];for($i=0;$i<64;$i++)$full[window_session_cookie_name(str_pad(dechex($i),32,'0',STR_PAD_LEFT),'employee')]='fixture';
ws_error(fn()=>window_session_cookie_capacity($d,'employee',$full),429);
window_session_cookie_capacity(str_repeat('0',32),'employee',$full);

$server=['HTTPS'=>'on','HTTP_HOST'=>'cncstaff.com'];
ws_assert(window_session_redirect('/office.php?role=employee#home',$a,$server)==='/office.php?role=employee&_cw='.$a.'#home','Relative redirect lost route/hash.');
ws_assert(window_session_redirect('/office.php?_cw='.$b.'&page=regions',$a,$server)==='/office.php?page=regions&_cw='.$a,'Redirect retained another window selector.');
ws_assert(window_session_redirect('https://cncstaff.com/personnel.php?id=1',$a,$server)==='https://cncstaff.com/personnel.php?id=1&_cw='.$a,'Same-origin redirect lost context.');
foreach(['https://example.com/','//example.com/','http://cncstaff.com/','https://cncstaff.com:8443/','https://user@cncstaff.com/','javascript:alert(1)','/\\example.com/'] as $external)ws_assert(window_session_redirect($external,$a,$server)===$external,'Context leaked into an external/unsafe redirect.');

echo "window-session checks passed: isolated authentication, regeneration, logout, expiry, fork, binding, and redirects\n";
