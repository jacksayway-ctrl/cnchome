<?php
declare(strict_types=1);
require_once __DIR__.'/views.php';
require_once __DIR__.'/grade-departments.php';
require_once __DIR__.'/department-scope.php';

function native_routes(): array {
    return [
        'adminMemberships'=>'memberships.php',
        'adminBusinessCalendar'=>'business-calendar.php',
        'adminIntakeAlerts'=>'intake-alerts.php',
        'adminIntake'=>'intake.php',
        'adminPending'=>'intake.php',
        'adminIntakeRegister'=>'intake.php',
        'adminContracts'=>'contracts.php',
        'contracts'=>'contracts.php',
        'adminStaff'=>'personnel.php',
        'adminStaffRegister'=>'personnel.php',
        'myInfo'=>'personnel.php',
        'adminPayroll'=>'pay-statements.php',
        'payslips'=>'pay-statements.php',
    ];
}
function native_url(string $page,string $role): string {
    $route=native_routes()[$page]??null;
    $url='/'.($route??'office.php').'?role='.($role==='admin'?'admin':'employee');
    if($role==='admin'&&in_array($page,['adminPolicy','adminPerformance','adminAs','adminGrade','adminDaily','adminDailyHistory','adminPayroll','adminBank','adminCorrections'],true))$url.='&department='.management_request_department();
    if(!$route)return $url.'&page='.rawurlencode($page);
    if($page==='adminStaffRegister')return $url.'&register=1';
    if(in_array($page,['adminIntake','adminPending','adminIntakeRegister'],true)){
        $team=$_GET['team']??$_GET['department']??'insurance';if(!in_array($team,['insurance','cosmetics','health'],true))$team='insurance';
        $url.='&team='.$team;
        $filters=[];$month=$_GET['month']??null;
        if(is_string($month)&&($month==='all'||preg_match('/^\d{4}-(0[1-9]|1[0-2])$/D',$month)))$filters['month']=$month;
        foreach(['q','region','scope','employee','from','to'] as $key){$value=$_GET[$key]??null;if(is_string($value)&&$value!=='')$filters[$key]=$value;}
        if($filters)$url.='&'.http_build_query($filters);
        if($page==='adminPending')$url.='&status=pending';
        elseif($page==='adminIntake')$url.='&status=';
        else $url.='&new=1';
        return $url;
    }
    return $url;
}
function native_department_tab_url(string $team): string {
    if(!in_array($team,['insurance','cosmetics','health'],true))$team='insurance';
    $query=['role'=>'admin','team'=>$team];
    foreach(['month','q','region','status','scope','from','to'] as $key){$value=$_GET[$key]??null;if(is_string($value)&&$value!=='')$query[$key]=$value;}
    if(($_GET['new']??'')==='1')$query['new']='1';
    if(isset($_GET['p'])&&ctype_digit((string)$_GET['p'])&&(int)$_GET['p']>1)$query['p']=(string)$_GET['p'];
    return '/intake.php?'.http_build_query($query);
}
function native_csrf(): string {return '<input type="hidden" name="csrf" value="'.view_h((string)($_SESSION['csrf']??'')).'">';}
function native_money(int|float $amount): string {return number_format($amount).'원';}
function native_notice_bar(array $user): void {
    $role=$user['role']==='admin'?'admin':'employee';
    $notices=['company'=>[],'activity'=>[],'cursor'=>0,'canManage'=>false];
    if(function_exists('db')){try{require_once __DIR__.'/notices.php';$notices=notice_snapshot($user);}catch(Throwable $e){error_log('cnchome native notices unavailable: '.get_class($e));}}
    echo '<header class="cnc-session-bar nf-no-print" aria-label="공지 및 로그인 계정"><div class="cnc-notice-area">';
    foreach(['company'=>['회사 공지','접수 가능지역을 확인한 후 상담해 주세요.'],'activity'=>['정책 수량 감소','새로운 수량 감소 알림이 없습니다.']] as $key=>[$label,$empty]){
        $rows=$notices[$key];$item=$key==='company'?($rows[0]??null):($rows?end($rows):null);$text=$item?$item['title'].' · '.$item['body']:$empty;
        echo '<section class="cnc-notice-channel"><strong class="cnc-notice-label">'.$label.'</strong><button type="button" class="cnc-notice-viewport" aria-label="'.$label.' 전체 보기"><span class="cnc-notice-text" style="animation:none">'.view_h($text).'</span></button></section>';
    }
    echo '</div><div class="cnc-session-account"><span>'.view_h($user['username']??$user['display_name']).'</span><form method="post" action="/logout.php?role='.$role.'">'.native_csrf().'<button type="submit">로그아웃</button></form></div></header>';
    echo '<script type="application/json" id="native-session-data">'.view_json(['user'=>['id'=>(int)($user['id']??0),'role'=>$role,'display_name'=>$user['display_name']],'csrf'=>(string)($_SESSION['csrf']??''),'notices'=>$notices]).'</script>';
}
function native_start(string $title,array $user,string $active,array $extraStyles=[],bool $popup=false,string $headingExtra=''): void {
    $role=$user['role']==='admin'?'admin':'employee';$nav=app_navigation();
    $GLOBALS['native_notice_bar']=true;
    header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    header('Content-Type: text/html; charset=utf-8');
    if($GLOBALS['native_notice_bar'])$extraStyles[]='session-navigation.css';
    if($role==='admin'&&!in_array('membership.css',$extraStyles,true))$extraStyles[]='membership.css';
    if($role==='admin')$extraStyles[]='admin-save-confirm.css';
    $GLOBALS['membership_admin_context']=$role==='admin'?['user'=>['id'=>(int)($user['id']??0),'role'=>'admin'],'csrf'=>(string)($_SESSION['csrf']??'')]:null;
    $extraCss='';foreach($extraStyles as $file)$extraCss.='<link rel="stylesheet" href="'.view_h(asset_url($file)).'">';
    echo '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>'.view_h($title).' · 씨앤씨</title><link rel="icon" href="/cnc-mark.svg"><link rel="stylesheet" href="'.view_h(asset_url('ui-icons.css')).'"><link rel="stylesheet" href="'.view_h(asset_url('native.css')).'">'.$extraCss.'<link rel="stylesheet" href="'.view_h(asset_url('workspace-ui.css')).'"><link rel="stylesheet" href="'.view_h(asset_url('company-ui.css')).'"><link rel="stylesheet" href="'.view_h(asset_url('public-holidays.css')).'"><script src="'.view_h(asset_url('window-session.js')).'"></script><script src="'.view_h(asset_url('page-navigation.js')).'"></script><script src="'.view_h(asset_url('public-holidays.js')).'" defer></script></head><body class="nf-body'.($popup?' nf-popup':'').'" data-page="'.view_h($active).'">';
    native_notice_bar($user);
    if($popup){echo '<div class="nf-popup-shell"><main class="nf-main"><div class="nf-page-heading"><h1>'.view_h($title).'</h1><button type="button" data-window-close>창 닫기</button></div>';return;}
    echo '<div class="nf-shell"><aside class="nf-nav"><div class="nf-sidebar-brand"><img src="/cnc-mark.svg" alt="C&amp;C" width="12" height="8"><strong>씨앤씨</strong></div><div class="nf-team">'.view_h(department_label($user['department']??'')).' · '.($role==='admin'?'관리자':'직원').'</div><nav aria-label="'.($role==='admin'?'관리자':'직원').' 메뉴">';
    $selectedGroup=null;$selectedLabel='';
    if($role==='admin'){
        echo '<div class="nf-nav-cut">관리자 모드</div><div class="nf-nav-sections">';
        foreach($nav['admin'] as $group){
            $selected=in_array($active,array_column($group['items'],0),true);
            if($selected){$selectedGroup=$group;foreach($group['items'] as [$page,$label])if($page===$active)$selectedLabel=$label;}
            echo '<a href="'.view_h(native_url($group['items'][0][0],$role)).'"'.($selected?' class="active" aria-current="true"':'').'><span class="ui-icon ui-icon-'.view_h($group['icon']).'" aria-hidden="true"></span>'.view_h($group['label']).'</a>';
        }
        echo '</div>';
    }else{
        foreach($nav['employee'] as [$page,$label,$icon]){if($page==='grade'&&function_exists('db')&&!grade_employee_available($user,entries_for($user),(new DateTimeImmutable('now',new DateTimeZone('Asia/Seoul')))->format('Y-m-d')))continue;echo '<a href="'.view_h(native_url($page,$role)).'"'.($page===$active?' class="active" aria-current="page"':'').'><span class="ui-icon ui-icon-'.view_h($icon).'" aria-hidden="true"></span>'.view_h($label).'</a>';}
    }
    echo '</nav></aside><main class="nf-main">';
    if($selectedGroup){
        echo '<section class="nf-subpages nf-no-print">';
        $location='<div class="nf-location"><span>관리자</span><span>/</span><strong>'.view_h($selectedGroup['label']).'</strong><span>/</span><span>'.view_h($selectedLabel).'</span></div>';
        echo $location;
        if($role==='admin'&&$selectedGroup['items'][0][0]==='adminIntake'){
            $liveIntake=basename($_SERVER['SCRIPT_NAME']??'')==='intake-live.php';$team=$_GET['team']??'insurance';if(!in_array($team,['insurance','cosmetics','health'],true))$team='insurance';
            echo '<nav class="nf-department-tabs" aria-label="접수 부서"><a href="/intake-live.php?role=admin"'.($liveIntake?' class="active" aria-current="page"':'').'>전체 접수 관리</a>';
            foreach(['insurance'=>'보험','cosmetics'=>'화장품','health'=>'건강보조식품'] as $key=>$label)echo '<a href="'.view_h(native_department_tab_url($key)).'"'.(!$liveIntake&&$team===$key?' class="active" aria-current="page"':'').'>'.view_h($label).'</a>';
            echo '</nav>';
        }
        if($role==='admin'&&in_array($selectedGroup['items'][0][0],['adminPolicy','adminGrade','adminPayroll'],true)){
            $department=management_request_department();
            echo '<nav class="nf-department-tabs" aria-label="관리 부서">';
            foreach(management_departments() as $key=>$label){
                $target=native_url($active,'admin');$parts=parse_url($target);parse_str($parts['query']??'',$query);$query['department']=$key;
                $path=basename($_SERVER['SCRIPT_NAME']??'')==='payroll.php'?'/payroll.php':$parts['path'];
                echo '<a href="'.view_h($path.'?'.http_build_query($query)).'"'.($department===$key?' class="active" aria-current="page"':'').'>'.view_h($label).'</a>';
            }
            echo '</nav>';
        }
        echo '<nav class="nf-subpage-links" aria-label="'.view_h($selectedGroup['label']).' 하위 페이지">';
        foreach($selectedGroup['items'] as [$page,$label])echo '<a href="'.view_h(native_url($page,$role)).'"'.($page===$active?' class="active" aria-current="page"':'').'>'.view_h($label).'</a>';
        if($selectedGroup['items'][0][0]==='adminPayroll')echo '<a href="/payroll.php?role=admin&amp;department='.view_h(management_request_department()).'">급여 계산 검토 <span class="ui-icon ui-icon-external" aria-hidden="true"></span></a>';
        echo '</nav></section>';
    }
    echo '<div class="nf-page-heading"><h1>'.view_h($title).'</h1>'.$headingExtra.'<span>'.(new DateTimeImmutable('now',new DateTimeZone('Asia/Seoul')))->format('Y.m.d').'</span></div>';
}
function native_end(): void {
    if(!empty($GLOBALS['membership_admin_context']))echo '<script type="application/json" id="membership-admin-context">'.view_json($GLOBALS['membership_admin_context']).'</script><script src="'.view_h(asset_url('admin-save-confirm.js')).'" defer></script><script src="'.view_h(asset_url('membership-notification.js')).'" defer></script>';
    echo '</main></div><script src="'.view_h(asset_url('session-keepalive.js')).'" defer></script>';
    if(!empty($GLOBALS['native_notice_bar']))echo '<script src="'.view_h(asset_url('notice-ticker.js')).'" defer></script>';
    echo '<script src="'.view_h(asset_url('native-ui.js')).'" defer></script></body></html>';
}
