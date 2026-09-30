<?php
declare(strict_types=1);
/** Prehash new request passwords so bcrypt's 72-byte truncation never affects them. */
function cnc_password_hash(string $password): string {return 'cnc-sha256:'.password_hash(hash('sha256',$password),PASSWORD_DEFAULT);}
function cnc_password_verify(string $password,string $hash): bool {
    $prefix='cnc-sha256:';
    return str_starts_with($hash,$prefix)?password_verify(hash('sha256',$password),substr($hash,strlen($prefix))):password_verify($password,$hash);
}
