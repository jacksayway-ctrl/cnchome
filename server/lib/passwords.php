<?php
declare(strict_types=1);
/** Prehash new request passwords so bcrypt's 72-byte truncation never affects them. */
function cnc_password_hash(string $password): string {return 'cnc-sha256:'.password_hash(hash('sha256',$password),PASSWORD_DEFAULT);}
function cnc_password_verify(string $password,string $hash): bool {
    $prefix='cnc-sha256:';
    return str_starts_with($hash,$prefix)?password_verify(hash('sha256',$password),substr($hash,strlen($prefix))):password_verify($password,$hash);
}

function cnc_update_employee_login(array $actor,int $userId,array $input): void {
    if(($actor['role']??'')!=='admin')throw new HRForbidden('계정 변경은 관리자만 할 수 있습니다.');
    $d=db();hr_assert($d->inTransaction(),'계정 변경 작업을 다시 시작해 주세요.');
    $q=$d->prepare("SELECT username FROM app_users WHERE id=? AND role='employee' FOR UPDATE");$q->execute([$userId]);$current=$q->fetchColumn();hr_assert($current!==false,'직원 계정을 찾을 수 없습니다.');
    $name=$input['username']??$current;hr_assert(is_string($name),'아이디를 확인해 주세요.');$name=strtolower(trim($name));
    hr_assert(preg_match('/^[a-z0-9_.-]{3,64}$/D',$name)===1,'아이디는 영문·숫자·밑줄·점·하이픈 3~64자로 입력해 주세요.');
    $password=$input['password']??'';$confirm=$input['passwordConfirm']??'';
    hr_assert(is_string($password)&&is_string($confirm),'비밀번호를 확인해 주세요.');
    hr_assert(hash_equals($password,$confirm),'비밀번호 확인이 일치하지 않습니다.');
    hr_assert($password===''||(strlen($password)>=12&&strlen($password)<=72),'새 비밀번호는 12~72바이트로 입력해 주세요.');
    $q=$d->prepare('SELECT id FROM app_users WHERE username=? AND id<>?');$q->execute([$name,$userId]);hr_assert(!$q->fetch(),'이미 사용 중인 아이디입니다.');
    $q=$d->prepare('UPDATE app_users SET username=? WHERE id=?');$q->execute([$name,$userId]);
    if($password!==''){$q=$d->prepare('UPDATE app_users SET password_hash=? WHERE id=?');$q->execute([cnc_password_hash($password),$userId]);}
}
