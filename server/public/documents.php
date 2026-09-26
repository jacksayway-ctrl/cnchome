<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';
require_once CNC_RUNTIME_DIR.'/views.php';
try {
    session_boot();$user=current_user();
    if (!$user) {http_response_code(401);render_view('error',['title'=>'로그인이 필요합니다.','message'=>'업무 계정으로 로그인해 주세요.']);exit;}
    $role=$user['role'];$files=document_files();$file=$_GET['file']??'';
    if (!is_string($file)||($file!==''&&!in_array($file,$files,true))) {http_response_code(404);render_view('error',['title'=>'문서를 찾을 수 없습니다.','message'=>'문서 목록에서 다시 선택해 주세요.','role'=>$role]);exit;}
    $content=$file===''?'':file_get_contents(document_root().'/'.$file);
    if ($file!==''&&($_GET['raw']??'')==='1') {
        header('Content-Type: '.(str_ends_with($file,'.json')?'application/json':'text/plain').'; charset=utf-8');echo $content;exit;
    }
    render_view('documents',compact('files','file','content','role'));
} catch (Throwable $e) {http_response_code(503);render_view('error',['title'=>'문서를 불러오지 못했습니다.','message'=>'잠시 후 다시 시도해 주세요.']);}
