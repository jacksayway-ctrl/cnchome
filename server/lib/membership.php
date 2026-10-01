<?php
declare(strict_types=1);
require_once __DIR__.'/hr.php';
require_once __DIR__.'/personnel.php';
require_once __DIR__.'/passwords.php';
function membership_text(mixed $value,int $max): string {
    hr_assert(is_string($value),'입력 형식을 확인해 주세요.');$value=trim($value);
    hr_assert(mb_strlen($value)<=$max&&!preg_match('/[\p{Cc}\p{Cf}]/u',$value),'입력 길이와 문자를 확인해 주세요.');return $value;
}
function membership_register(array $in): int {
    $username=strtolower(membership_text($in['username']??'',64));$name=membership_text($in['name']??'',60);$phone=membership_text($in['phone']??'',20);
    hr_assert((bool)preg_match('/^[a-z0-9_.-]{3,64}$/D',$username),'아이디는 영문·숫자·밑줄·점·하이픈 3~64자로 입력해 주세요.');
    hr_assert($name!==''&&(bool)preg_match('/^0[0-9 -]{8,14}$/D',$phone),'이름과 연락처를 입력해 주세요.');
    $password=$in['password']??null;hr_assert(is_string($password)&&$password!=='','비밀번호를 입력해 주세요.');
    hr_assert(is_string($in['passwordConfirm']??null)&&hash_equals($password,$in['passwordConfirm']),'비밀번호 확인이 일치하지 않습니다.');
    $hash=cnc_password_hash($password);$d=db();$d->beginTransaction();
    try {
        $q=$d->prepare('SELECT id FROM app_users WHERE username=?');$q->execute([$username]);hr_assert(!$q->fetch(),'이미 사용 중인 아이디입니다.');
        $q=$d->prepare("INSERT INTO app_users(username,display_name,password_hash,role,department,active) VALUES(?,?,?,'employee','insurance',0)");$q->execute([$username,$name,$hash]);$id=(int)$d->lastInsertId();
        $q=$d->prepare("INSERT INTO employee_memberships(user_id,status,phone) VALUES(?,'pending',?)");$q->execute([$id,$phone]);$d->commit();return $id;
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
function membership_record(int $id): ?array {
    $q=db()->prepare('SELECT * FROM employee_memberships WHERE user_id=?');$q->execute([$id]);return $q->fetch()?:null;
}
function membership_admin(array $user): void {if(($user['role']??'')!=='admin')throw new HRForbidden('직원 등록 요청 관리는 관리자만 사용할 수 있습니다.');}
function membership_list(array $user): array {
    membership_admin($user); $rows=db()->query("SELECT m.*,u.username,u.display_name,u.department,u.active,e.id AS employee_id FROM employee_memberships m JOIN app_users u ON u.id=m.user_id LEFT JOIN hr_employees e ON e.user_id=m.user_id ORDER BY CASE m.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,m.created_at,m.user_id")->fetchAll();
    foreach($rows as &$row){$q=db()->prepare("SELECT payload FROM employee_membership_events WHERE user_id=? AND event='saveApplicant' ORDER BY id DESC LIMIT 1");$q->execute([$row['user_id']]);$input=json_decode($q->fetchColumn()?:'{}',true);$row['start_date']=$input['startDate']??hr_today();}unset($row);return $rows;
}
function membership_approve(array $user,int $id,int $revision,string $team,string $startDate,string $action='approve',array $basic=[]): void {
    membership_admin($user);hr_assert(in_array($action,['approve','reject','saveApplicant'],true),'승인 작업을 확인해 주세요.');
    hr_assert(in_array($team,['insurance','cosmetics','health'],true)&&hr_day($startDate),'부서와 입사일을 확인해 주세요.');$d=db();$d->beginTransaction();
    try {
        $q=$d->prepare('SELECT m.*,u.display_name,u.role FROM employee_memberships m JOIN app_users u ON u.id=m.user_id WHERE m.user_id=? FOR UPDATE');$q->execute([$id]);$row=$q->fetch();
        hr_assert($row&&$row['role']==='employee'&&in_array($row['status'],['pending','rejected'],true)&&(int)$row['revision']===$revision,'이미 처리되었거나 변경된 직원 등록 요청입니다. 새로고침해 주세요.');
        $name=membership_text($basic['name']??$row['display_name'],60);$phone=membership_text($basic['phone']??$row['phone'],20);
        hr_assert($name!==''&&preg_match('/^0[0-9 -]{8,14}$/D',$phone)===1,'이름과 연락처를 입력해 주세요.');
        $q=$d->prepare('UPDATE app_users SET display_name=?,department=? WHERE id=?');$q->execute([$name,$team,$id]);$row['display_name']=$name;$row['phone']=$phone;
        if($action==='approve'){
            $q=$d->prepare('SELECT id FROM hr_employees WHERE user_id=?');$q->execute([$id]);
            if(!$q->fetch()){
                $day=str_replace('-','',hr_today());$q=$d->prepare('INSERT INTO hr_employee_sequences(day,serial) VALUES(?,1) ON DUPLICATE KEY UPDATE serial=serial+1');$q->execute([$day]);
                $q=$d->prepare('SELECT serial FROM hr_employee_sequences WHERE day=? FOR UPDATE');$q->execute([$day]);$serial=(int)$q->fetchColumn();
                $profile=hr_profile(array_replace(personnel_default_profile(),['name'=>$row['display_name'],'phone'=>$row['phone'],'team'=>$team,'startDate'=>$startDate,'contractStart'=>$startDate]));
                $q=$d->prepare('INSERT INTO hr_employees(employee_no,user_id,profile) VALUES(?,?,?)');$q->execute(['cnc'.$day.str_pad((string)$serial,3,'0',STR_PAD_LEFT),$id,hr_json($profile)]);
            }
            $q=$d->prepare("UPDATE app_users SET active=1,department=? WHERE id=? AND role='employee'");$q->execute([$team,$id]);
        }
        $status=$action==='approve'?'approved':($action==='reject'?'rejected':$row['status']);
        if($action==='saveApplicant'){$q=$d->prepare('UPDATE employee_memberships SET phone=?,revision=revision+1 WHERE user_id=?');$q->execute([$phone,$id]);}
        else{$q=$d->prepare('UPDATE employee_memberships SET status=?,phone=?,approved_by=?,approved_at=CURRENT_TIMESTAMP,revision=revision+1 WHERE user_id=?');$q->execute([$status,$phone,$user['id'],$id]);}
        $q=$d->prepare('INSERT INTO employee_membership_events(user_id,actor_id,event,payload) VALUES(?,?,?,?)');$q->execute([$id,$user['id'],$action,hr_json(['before'=>$row['status'],'status'=>$status,'team'=>$team,'startDate'=>$startDate])]);$d->commit();
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}
function membership_save_profile(array $user,array $in): void {
    if(($user['role']??'')!=='employee')throw new HRForbidden('직원 본인 정보만 입력할 수 있습니다.');
    $d=db();$d->beginTransaction();
    try {
        $q=$d->prepare("SELECT m.status,u.active FROM app_users u LEFT JOIN employee_memberships m ON m.user_id=u.id WHERE u.id=? AND u.role='employee' FOR UPDATE");$q->execute([$user['id']]);$member=$q->fetch();
        if(!$member||($member['status']!==null&&$member['status']!=='approved')||!$member['active'])throw new HRForbidden('로그인 승인 후 본인 정보를 입력할 수 있습니다.');
        $q=$d->prepare('SELECT * FROM hr_employees WHERE user_id=? FOR UPDATE');$q->execute([$user['id']]);$row=$q->fetch();hr_assert((bool)$row,'연결된 인사정보가 없습니다. 관리자에게 문의해 주세요.');
        hr_assert(ctype_digit((string)($in['revision']??''))&&(int)$in['revision']===(int)$row['revision'],'다른 화면에서 정보가 변경되었습니다. 새로고침 후 다시 입력해 주세요.');
        $profile=json_decode($row['profile'],true,512,JSON_THROW_ON_ERROR);$before=$profile;
        if(!empty($profile['selfEditLocked']))throw new HRForbidden('관리자가 인사정보를 확정하여 수정이 잠겼습니다. 관리자에게 수정권한 해제를 요청해 주세요.');
        // Strict allowlist: employment, wages, dates, role, owner and permissions remain administrator controlled.
        foreach(['name'=>60,'phone'=>20,'email'=>120,'birthDate'=>10,'address'=>240,'addressDetail'=>240,'postcode'=>10,'gender'=>10,'nationality'=>60,'bank'=>50,'accountNumber'=>40,'accountHolder'=>60,'emergencyName'=>60,'emergencyPhone'=>20,'career'=>2000,'qualification'=>500] as $key=>$max){
            if(array_key_exists($key,$in))$profile[$key]=membership_text($in[$key],$max);
        }
        foreach(['name','phone','birthDate','address','bank','accountNumber','accountHolder'] as $key)hr_assert(($profile[$key]??'')!=='','이름·연락처·생년월일·주소·급여계좌 정보를 입력해 주세요.');
        $profile=hr_profile($profile);
        $q=$d->prepare('UPDATE hr_employees SET profile=?,revision=revision+1 WHERE id=?');$q->execute([hr_json($profile),$row['id']]);
        require_once __DIR__.'/personnel-history.php';
        personnel_history_append($user,$row,array_replace($row,['profile'=>hr_json($profile),'revision'=>(int)$row['revision']+1]),'profile');
        $q=$d->prepare("UPDATE app_users SET display_name=? WHERE id=? AND role='employee'");$q->execute([$profile['name'],$user['id']]);
        $q=$d->prepare('UPDATE employee_memberships SET phone=?,profile_completed=1,profile_completed_at=CURRENT_TIMESTAMP,revision=revision+1 WHERE user_id=?');$q->execute([$profile['phone'],$user['id']]);
        $q=$d->prepare('INSERT INTO employee_membership_events(user_id,actor_id,event,payload) VALUES(?,?,?,?)');$q->execute([$user['id'],$user['id'],'profile',hr_json(['employeeId'=>(int)$row['id'],'changedFields'=>array_keys(array_diff_assoc(array_filter($profile,'is_scalar'),array_filter($before,'is_scalar')))])]);$d->commit();
    }catch(Throwable $e){if($d->inTransaction())$d->rollBack();throw $e;}
}

function membership_notification(array $user): array {
    membership_admin($user);$rows=db()->query("SELECT user_id,revision FROM employee_memberships WHERE status='pending' ORDER BY user_id")->fetchAll();
    return ['pendingCount'=>count($rows),'token'=>hash('sha256',hr_json($rows))];
}
