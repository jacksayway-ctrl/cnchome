<?php
declare(strict_types=1);
require_once __DIR__.'/window-session.php';
function db(): PDO {
    static $db;
    if (!$db) {
        $c = json_decode(file_get_contents('/etc/cnchome/database.json'), true, 512, JSON_THROW_ON_ERROR);
        $db = new PDO('mysql:host=localhost;dbname=cnchome;charset=utf8mb4', $c['username'], $c['password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES=>false, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
        $db->exec("SET time_zone = '+00:00'");
    }
    return $db;
}
function session_role(): string {
    return ($_GET['role'] ?? $_SERVER['HTTP_X_CNC_ROLE'] ?? 'employee') === 'admin' ? 'admin' : 'employee';
}
function session_timeout_minutes(): int {
    try {return max(5,min(1440,(int)(db()->query('SELECT timeout_minutes FROM app_session_settings WHERE id=1')->fetchColumn()?:60)));}catch(Throwable $e){return 60;}
}
function session_boot(): void {
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    try{
        $id=window_session_request_context($_GET,$_POST,$_SERVER);
        if($id===null)window_session_bootstrap_document();
        window_session_start($id,session_role(),session_timeout_minutes());
        window_session_register_redirects();
    }catch(WindowSessionError $e){window_session_error_response($e);}
}
function current_user(): ?array {
    if (empty($_SESSION['user_id'])) return null;
    $q=db()->prepare('SELECT id, username, display_name, role, department FROM app_users WHERE id=? AND active=1');
    $q->execute([$_SESSION['user_id']]);
    $user=$q->fetch();
    if(!$user||$user['role']!==session_role())return null;
    if($user['role']==='employee'){
        $q=db()->prepare('SELECT status,profile_completed FROM employee_memberships WHERE user_id=?');$q->execute([$user['id']]);$membership=$q->fetch();
        if($membership&&$membership['status']!=='approved')return null;
        $allowed=['/profile-entry.php','/login.php','/logout.php','/session-api.php'];
        if($membership&&!$membership['profile_completed']&&!in_array(parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH),$allowed,true)){
            $q=db()->prepare('SELECT profile FROM hr_employees WHERE user_id=?');$q->execute([$user['id']]);$profile=json_decode($q->fetchColumn()?:'{}',true);
            if(empty($profile['selfEditLocked'])){header('Location: /profile-entry.php?role=employee');exit;}
        }
    }
    return $user;
}
function csrf_ok(string $value): bool { return hash_equals($_SESSION['csrf'], $value); }
function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function entries_for(array $user): array {
    require_once __DIR__.'/views.php';
    require_once __DIR__.'/policy.php';
    require_once __DIR__.'/grade-departments.php';
    $sql='SELECT g.id,g.department,g.effective_date,g.saved_at,g.policy,g.actor_name,u.department AS actor_department,u.role AS actor_role FROM grade_versions g LEFT JOIN app_users u ON u.id=g.actor_id';
    $q=db()->prepare($sql.($user['role']==='admin'?'':' WHERE g.department=?').' ORDER BY g.id');
    $q->execute($user['role']==='admin'?[]:[$user['department']]);
    $groups=[];foreach($q->fetchAll() as $r){
        $policy=json_decode($r['policy'],true,512,JSON_THROW_ON_ERROR);if(!grade_department_owns($r['department'],$policy))continue;
        $actor=$policy['savedActor']??['department'=>$r['actor_department'],'position'=>$r['actor_role']==='admin'?'관리자':($r['actor_role']?'직원':'')];
        $affiliation=implode(' · ',array_filter([!empty($actor['department'])?department_label($actor['department']):'', $actor['position']??'']));
        $groups[$r['department']][]=['id'=>(int)$r['id'],'department'=>$r['department'],'date'=>$r['effective_date'],'savedAt'=>str_replace(' ','T',$r['saved_at']).'Z','savedBy'=>$r['actor_name'],'savedAffiliation'=>$affiliation?:'기록 없음','affiliationBasis'=>isset($policy['savedActor'])?'saved':'current','policy'=>$policy];
    }
    $entries=[];foreach($groups as $department=>$group)$entries=array_merge($entries,grade_resolve_entries($group,$department==='insurance'?null:grade_department_empty($department)));usort($entries,fn($a,$b)=>$a['id']<=>$b['id']);return $entries;
}
function snapshot(array $user): array {
    require_once __DIR__.'/grade-visibility.php';
    // One consistent snapshot prevents a new revision paired with older entries.
    $d=db(); $d->beginTransaction();
    try {
        $revision=(int)$d->query('SELECT revision FROM grade_revision WHERE id=1')->fetchColumn();
        $entries=entries_for($user); $visibility=grade_visibility_for($user); $d->commit();
        return ['revision'=>$revision,'entries'=>$entries,'gradeVisibility'=>$visibility];
    } catch(Throwable $e) { $d->rollBack(); throw $e; }
}
