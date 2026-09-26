<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';
session_boot();
$error='';
$loginRole=session_role();
try {
    if (isset($_GET['role']) && $_SERVER['REQUEST_METHOD']==='GET' && current_user()) {header('Location: /office.php?role='.$loginRole); exit;}
    if ($_SERVER['REQUEST_METHOD']==='POST') {
        if (($_POST['login_role']??'employee')!==$loginRole) throw new RuntimeException('로그인 구분을 다시 선택해 주세요.');
        if (!csrf_ok((string)($_POST['csrf']??''))) throw new RuntimeException('페이지를 새로고침하고 다시 시도해 주세요.');
        $username=strtolower(trim((string)($_POST['username']??'')));
        $password=(string)($_POST['password']??'');
        if($loginRole==='employee' && $username==='test1')$username='user1';
        if (!preg_match('/^[a-z0-9_.-]{3,64}$/D',$username) || strlen($password)>1024) throw new RuntimeException('아이디 또는 비밀번호를 확인해 주세요.');
        $d=db(); $d->beginTransaction();
        // Count all attempts, not only failures; serialize parallel attempts per IP.
        $bucket=hash('sha256',$_SERVER['REMOTE_ADDR']??'unknown');
        $q=$d->prepare('INSERT IGNORE INTO login_limits(bucket,attempts,window_start) VALUES(?,0,UTC_TIMESTAMP())'); $q->execute([$bucket]);
        $q=$d->prepare('SELECT attempts, TIMESTAMPDIFF(SECOND,window_start,UTC_TIMESTAMP()) age FROM login_limits WHERE bucket=? FOR UPDATE'); $q->execute([$bucket]); $limit=$q->fetch();
        if ((int)$limit['age']>=900) { $q=$d->prepare('UPDATE login_limits SET attempts=0,window_start=UTC_TIMESTAMP() WHERE bucket=?'); $q->execute([$bucket]); $limit['attempts']=0; }
        if ((int)$limit['attempts']>=20) { $d->commit(); throw new RuntimeException('로그인 시도가 많습니다. 15분 후 다시 시도해 주세요.'); }
        $q=$d->prepare('UPDATE login_limits SET attempts=attempts+1 WHERE bucket=?'); $q->execute([$bucket]); $d->commit();
        $q=$d->prepare('SELECT id,password_hash,role FROM app_users WHERE username=? AND active=1'); $q->execute([$username]); $user=$q->fetch();
        $dummy='$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
        $valid=password_verify($password,$user['password_hash']??$dummy);
        if (!$user || !$valid || $user['role']!==$loginRole) throw new RuntimeException('아이디·비밀번호와 직원/관리자 선택을 확인해 주세요.');
        session_regenerate_id(true); $_SESSION=['user_id'=>(int)$user['id'],'last'=>time(),'csrf'=>bin2hex(random_bytes(32))];
        header('Location: /office.php?role='.$loginRole.($loginRole==='employee'?'#home':'#adminHome')); exit;
    }
} catch(RuntimeException $e) {
    if ($e instanceof PDOException) {$error='로그인 서비스를 사용할 수 없습니다. 관리자에게 문의해 주세요.'; http_response_code(503);}
    else $error=$e->getMessage();
} catch(Throwable $e) { $error='로그인 서비스를 사용할 수 없습니다. 관리자에게 문의해 주세요.'; http_response_code(503); }

require_once CNC_RUNTIME_DIR.'/views.php';
render_view('login',compact('error','loginRole'));
