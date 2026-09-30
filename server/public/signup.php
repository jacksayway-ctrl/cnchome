<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';
require_once CNC_RUNTIME_DIR.'/membership.php';
require_once CNC_RUNTIME_DIR.'/views.php';
session_boot();$error='';$success=false;$values=['username'=>'','name'=>'','phone'=>''];
if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
    try {
        hr_assert(is_string($_POST['csrf']??null)&&csrf_ok($_POST['csrf']),'페이지를 새로고침한 뒤 다시 신청해 주세요.');
        foreach($values as $key=>$_)$values[$key]=membership_text($_POST[$key]??'',64);
        // Public signup shares the proven serialized attempt limiter, using an independent IP bucket.
        $d=db();$d->beginTransaction();$bucket=hash('sha256','signup|'.($_SERVER['REMOTE_ADDR']??'unknown'));
        $q=$d->prepare('INSERT IGNORE INTO login_limits(bucket,attempts,window_start) VALUES(?,0,UTC_TIMESTAMP())');$q->execute([$bucket]);
        $q=$d->prepare('SELECT attempts,TIMESTAMPDIFF(SECOND,window_start,UTC_TIMESTAMP()) age FROM login_limits WHERE bucket=? FOR UPDATE');$q->execute([$bucket]);$limit=$q->fetch();
        if((int)$limit['age']>=900){$q=$d->prepare('UPDATE login_limits SET attempts=0,window_start=UTC_TIMESTAMP() WHERE bucket=?');$q->execute([$bucket]);$limit['attempts']=0;}
        if((int)$limit['attempts']>=5){$d->commit();throw new InvalidArgumentException('가입 신청이 많습니다. 15분 후 다시 시도해 주세요.');}
        $q=$d->prepare('UPDATE login_limits SET attempts=attempts+1 WHERE bucket=?');$q->execute([$bucket]);$d->commit();
        membership_register($_POST);$_SESSION['signup_success']=true;header('Location: /signup.php?role=employee',true,303);exit;
    }catch(InvalidArgumentException $e){$error=$e->getMessage();http_response_code(422);}
    catch(Throwable $e){if(isset($d)&&$d->inTransaction())$d->rollBack();error_log('cnchome signup: '.get_class($e));$error=$e instanceof PDOException&&$e->getCode()==='23000'?'이미 사용 중인 아이디입니다.':'가입 신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';http_response_code(503);}
}elseif(($_SERVER['REQUEST_METHOD']??'GET')!=='GET'){http_response_code(405);header('Allow: GET, POST');exit;}
if(!empty($_SESSION['signup_success'])){$success=true;unset($_SESSION['signup_success']);}
render_view('signup',compact('error','success','values'));
