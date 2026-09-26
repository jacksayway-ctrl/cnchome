<?php
declare(strict_types=1);
require '/opt/cnchome-runtime/bootstrap.php';
session_boot();
$error='';
$loginRole=($_POST['login_role']??$_GET['role']??'employee')==='admin'?'admin':'employee';
try {
    if (current_user()) {header('Location: /office.php'); exit;}
    if ($_SERVER['REQUEST_METHOD']==='POST') {
        if (!csrf_ok((string)($_POST['csrf']??''))) throw new RuntimeException('페이지를 새로고침하고 다시 시도해 주세요.');
        $username=strtolower(trim((string)($_POST['username']??'')));
        $password=(string)($_POST['password']??'');
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
        header('Location: /office.php'.($loginRole==='employee'?'#payslips':'#adminHome')); exit;
    }
} catch(RuntimeException $e) {
    if ($e instanceof PDOException) {$error='로그인 서비스를 사용할 수 없습니다. 관리자에게 문의해 주세요.'; http_response_code(503);}
    else $error=$e->getMessage();
} catch(Throwable $e) { $error='로그인 서비스를 사용할 수 없습니다. 관리자에게 문의해 주세요.'; http_response_code(503); }
?>
<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>씨앤씨 · 직원 / 관리자 로그인</title><link rel="icon" href="/cnc-mark.svg" type="image/svg+xml">
<style>body{margin:0;background:#f2f5fa;color:#19283d;font-family:system-ui,sans-serif;display:grid;min-height:100vh;place-items:center}main{background:white;padding:36px;border-radius:18px;width:min(360px,80vw);box-shadow:0 12px 50px #172b4d15}h1{font-size:25px}label{display:block;margin-top:18px}input,button{box-sizing:border-box;width:100%;padding:13px;font:inherit;border:1px solid #cbd5e1;border-radius:8px;margin-top:7px}button{background:#982b24;color:white;border:0;margin-top:24px;cursor:pointer}.sub{color:#64748b;font-size:14px;line-height:1.6}.error{color:#b91c1c}.company-brand{display:flex;align-items:center;gap:12px;margin-bottom:28px;white-space:nowrap}.company-brand img{display:block;width:54px;height:36px;object-fit:contain;flex:0 0 54px}.company-brand strong{font-size:24px;letter-spacing:1px;line-height:36px}.company-brand small{display:block;font-size:9px;letter-spacing:.8px;line-height:1.6;color:#7f4b46;margin-top:7px}.login-role{display:flex;gap:12px;border:0;padding:0;margin:20px 0}.login-role legend{font-size:13px;color:#64748b;margin-bottom:8px}.login-role label{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid #d5dce6;border-radius:8px;padding:12px;margin:0;cursor:pointer}.login-role label:has(input:checked){background:#fff4f1;border-color:#982b24;color:#982b24;font-weight:700}.login-role input{width:auto;margin:0;accent-color:#982b24}</style>
<main><div class="company-brand"><img src="/cnc-mark.svg" alt="C&amp;C" width="54" height="36"><strong>씨앤씨</strong></div><h1 id="login-heading"><?= $loginRole==='admin'?'관리자 로그인':'직원 로그인' ?></h1><p class="sub">씨앤씨 업무 관리 시스템</p><form method="post"><fieldset class="login-role"><legend>로그인 구분</legend><label><input type="radio" name="login_role" value="employee" <?= $loginRole==='employee'?'checked':'' ?>>직원</label><label><input type="radio" name="login_role" value="admin" <?= $loginRole==='admin'?'checked':'' ?>>관리자</label></fieldset><input type="hidden" name="csrf" value="<?=h($_SESSION['csrf'])?>"><label>아이디<input name="username" required maxlength="64" autocomplete="username" autocapitalize="none"></label><label>비밀번호<input name="password" type="password" required maxlength="1024" autocomplete="current-password"></label><p class="error" role="alert"><?=h($error)?></p><button>로그인</button></form><p class="sub">계정 발급은 관리자에게 문의해 주세요.</p></main><script>document.querySelectorAll('[name="login_role"]').forEach(r=>r.addEventListener("change",()=>{document.getElementById("login-heading").textContent=r.value==="admin"?"관리자 로그인":"직원 로그인";}));</script></html>
