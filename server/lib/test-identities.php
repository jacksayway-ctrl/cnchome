<?php
declare(strict_types=1);
function cnc_test_user(array $user): bool {
    if(($user['role']??'')!=='employee')return false;
    $username=$user['username']??'';$name=$user['display_name']??'';
    return is_string($username)&&is_string($name)&&(($username==='user1'&&$name==='테스트 직원')||(preg_match('/^user([2-6])$/D',$username,$m)===1&&$name==='테스트 직원 '.$m[1]));
}

/** A completed, account-bound cleanup permanently disables automatic sample generation. */
function test_account_cleanup_protected(int $userId): bool {
    if($userId!==2)return false;
    $q=db()->prepare('SELECT manifest FROM test_fixture_batches WHERE batch=?');
    $q->execute(['user1-keep-20260930-clear-20261001-v1']);$raw=$q->fetchColumn();
    if(!$raw)return false;
    $manifest=json_decode($raw,true,512,JSON_THROW_ON_ERROR);
    return ($manifest['username']??'')==='user1'&&(int)($manifest['userId']??0)===$userId&&(int)($manifest['employeeId']??0)===1&&($manifest['preservedDate']??'')==='2026-09-30'&&($manifest['state']??'')==='complete'&&!empty($manifest['completedAt']);
}
