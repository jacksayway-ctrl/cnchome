<?php
declare(strict_types=1);
require __DIR__.'/_runtime.php';
require_once CNC_RUNTIME_DIR.'/passwords.php';
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
        if (!preg_match('/^[a-z0-9_.-]{3,64}$/D',$username)) throw new RuntimeException('아이디 또는 비밀번호를 확인해 주세요.');
        $d=db(); $d->beginTransaction();
        // Count all attempts, not only failures; serialize parallel attempts per IP.
        $bucket=hash('sha256',$_SERVER['REMOTE_ADDR']??'unknown');
        $q=$d->prepare('INSERT IGNORE INTO login_limits(bucket,attempts,window_start) VALUES(?,0,UTC_TIMESTAMP())'); $q->execute([$bucket]);
        $q=$d->prepare('SELECT attempts, TIMESTAMPDIFF(SECOND,window_start,UTC_TIMESTAMP()) age FROM login_limits WHERE bucket=? FOR UPDATE'); $q->execute([$bucket]); $limit=$q->fetch();
        if ((int)$limit['age']>=900) { $q=$d->prepare('UPDATE login_limits SET attempts=0,window_start=UTC_TIMESTAMP() WHERE bucket=?'); $q->execute([$bucket]); $limit['attempts']=0; }
        if ((int)$limit['attempts']>=20) { $d->commit(); throw new RuntimeException('로그인 시도가 많습니다. 15분 후 다시 시도해 주세요.'); }
        $q=$d->prepare('UPDATE login_limits SET attempts=attempts+1 WHERE bucket=?'); $q->execute([$bucket]); $d->commit();
        $q=$d->prepare('SELECT u.id,u.password_hash,u.role,u.active,m.status AS membership_status,m.profile_completed FROM app_users u LEFT JOIN employee_memberships m ON m.user_id=u.id WHERE u.username=?'); $q->execute([$username]); $user=$q->fetch();
        $dummy='$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
        $valid=cnc_password_verify($password,$user['password_hash']??$dummy);
        if($user&&$valid&&$user['role']===$loginRole&&$user['membership_status']==='pending')throw new RuntimeException('직원 등록 승인 대기 중입니다. 관리자 승인 후 로그인해 주세요.');
        if (!$user || !$valid || !$user['active'] || $user['role']!==$loginRole || ($user['membership_status']!==null&&$user['membership_status']!=='approved')) throw new RuntimeException('아이디·비밀번호와 직원/관리자 선택을 확인해 주세요.');
        session_regenerate_id(true); $_SESSION=['user_id'=>(int)$user['id'],'last'=>time(),'csrf'=>bin2hex(random_bytes(32)),'login_notice_pending'=>true];
        if($loginRole==='employee'&&$user['membership_status']==='approved'&&!$user['profile_completed']){header('Location: /profile-entry.php?role=employee');exit;}
        header('Location: /office.php?role='.$loginRole.($loginRole==='employee'?'#home':'#adminHome')); exit;
    }
} catch(RuntimeException $e) {
    if ($e instanceof PDOException) {$error='로그인 서비스를 사용할 수 없습니다. 관리자에게 문의해 주세요.'; http_response_code(503);}
    else $error=$e->getMessage();
} catch(Throwable $e) { $error='로그인 서비스를 사용할 수 없습니다. 관리자에게 문의해 주세요.'; http_response_code(503); }

require_once CNC_RUNTIME_DIR.'/views.php';
render_view('login',compact('error','loginRole'));
