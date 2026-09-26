<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') exit;
require __DIR__.'/../lib/bootstrap.php';
$username=strtolower($argv[1]??'admin'); $role=$argv[2]??'admin'; $dept=$argv[3]??'insurance';
if (!preg_match('/^[a-z0-9_.-]{3,64}$/D',$username) || !in_array($role,['admin','employee'],true) || !in_array($dept,['insurance','cosmetics','health'],true)) exit("사용법: php server/bin/create-user.php 아이디 admin|employee insurance|cosmetics|health\n");
$q=db()->prepare('SELECT id FROM app_users WHERE username=?');$q->execute([$username]);
if ($q->fetch()) exit("이미 존재하는 계정입니다. 기존 비밀번호를 유지합니다.\n");
if (!posix_isatty(STDIN)) exit("비밀번호 설정은 직접 접속한 터미널에서 실행해 주세요.\n");
echo "표시할 이름: "; $name=trim(fgets(STDIN));
if ($name==='' || mb_strlen($name)>100) exit("이름은 1~100자로 입력해 주세요.\n");
function secret(string $prompt): string {
    echo $prompt; $mode=trim((string)shell_exec('stty -g'));
    system('stty -echo');
    try {return rtrim((string)fgets(STDIN),"\r\n");}
    finally {system('stty '.escapeshellarg($mode)); echo "\n";}
}
$a=secret('새 비밀번호 (12자 이상, 입력은 보이지 않음): ');$b=secret('비밀번호 한 번 더: ');
if (strlen($a)<12 || strlen($a)>72 || $a!==$b) exit("비밀번호는 12~72바이트이며 두 입력이 같아야 합니다. 다시 실행해 주세요.\n");
$q=db()->prepare('INSERT INTO app_users(username,display_name,password_hash,role,department) VALUES(?,?,?,?,?)');
$q->execute([$username,$name,password_hash($a,PASSWORD_DEFAULT),$role,$dept]);
echo "계정 생성 완료: $username\n";
