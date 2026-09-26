<?php
declare(strict_types=1);
require '/opt/cnchome-runtime/bootstrap.php';
session_boot();
if ($_SERVER['REQUEST_METHOD']!=='POST' || !csrf_ok((string)($_POST['csrf']??''))) {http_response_code(403); exit('잘못된 요청입니다.');}
$_SESSION=[]; session_destroy();
setcookie(session_name(),'', ['expires'=>time()-3600,'path'=>'/','secure'=>true,'httponly'=>true,'samesite'=>'Lax']);
header('Location: /login.php');
