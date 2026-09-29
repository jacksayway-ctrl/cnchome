<?php
declare(strict_types=1);
function cnc_test_user(array $user): bool {
    $username=$user['username']??'';$name=$user['display_name']??'';
    return ($user['role']??'employee')==='employee'&&(($username==='user1'&&$name==='테스트 직원')||(preg_match('/^user([2-6])$/D',$username,$m)===1&&$name==='테스트 직원 '.$m[1]));
}
