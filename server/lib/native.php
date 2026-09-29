<?php
declare(strict_types=1);
require_once __DIR__.'/views.php';

function native_routes(): array {
    return ['adminIntakeAlerts'=>'intake-alerts.php','adminIntake'=>'intake.php','adminIntakeRegister'=>'intake.php','adminContracts'=>'contracts.php','contracts'=>'contracts.php','adminStaff'=>'personnel.php','adminStaffRegister'=>'personnel.php','myInfo'=>'personnel.php','adminPayroll'=>'pay-statements.php','payslips'=>'pay-statements.php'];
}
function native_url(string $page,string $role): string {
    $route=native_routes()[$page]??null;
    return '/'.($route??'office.php').'?role='.($role==='admin'?'admin':'employee').($route?(in_array($page,['adminStaffRegister','adminIntakeRegister'],true)?'&new=1'.($page==='adminStaffRegister'?'&popup=1':''):''):'&page='.rawurlencode($page));
}
function native_csrf(): string {return '<input type="hidden" name="csrf" value="'.view_h((string)($_SESSION['csrf']??'')).'">';}
function native_money(int|float $amount): string {return number_format($amount).'원';}
function native_start(string $title,array $user,string $active,array $extraStyles=[],bool $popup=false,string $headingExtra=''): void {
    $role=$user['role']==='admin'?'admin':'employee';$nav=app_navigation();
    header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    header('Content-Type: text/html; charset=utf-8');
    $extraCss='';foreach($extraStyles as $file)$extraCss.='<link rel="stylesheet" href="'.view_h(asset_url($file)).'">';
    echo '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>'.view_h($title).' · 씨앤씨</title><link rel="icon" href="/cnc-mark.svg"><link rel="stylesheet" href="'.view_h(asset_url('ui-icons.css')).'">'.$extraCss.'<link rel="stylesheet" href="'.view_h(asset_url('native.css')).'"></head><body class="nf-body">';
    if($popup){echo '<div class="nf-popup-shell"><main class="nf-main"><div class="nf-page-heading"><h1>'.view_h($title).'</h1><button type="button" data-window-close>창 닫기</button></div>';return;}
    echo '<header class="nf-topbar"><span>'.view_h($user['display_name']).' · '.($role==='admin'?'관리자':'직원').'</span><form method="post" action="/logout.php?role='.$role.'">'.native_csrf().'<button type="submit">로그아웃</button></form></header><div class="nf-shell"><aside class="nf-nav"><div class="nf-sidebar-brand"><img src="/cnc-mark.svg" alt="C&amp;C" width="12" height="8"><strong>씨앤씨</strong></div><div class="nf-team">'.view_h(department_label($user['department']??'')).' · '.($role==='admin'?'관리자':'직원').'</div><nav aria-label="'.($role==='admin'?'관리자':'직원').' 메뉴">';
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
        foreach($nav['employee'] as [$page,$label,$icon])echo '<a href="'.view_h(native_url($page,$role)).'"'.($page===$active?' class="active" aria-current="page"':'').'><span class="ui-icon ui-icon-'.view_h($icon).'" aria-hidden="true"></span>'.view_h($label).'</a>';
    }
    echo '</nav></aside><main class="nf-main">';
    if($selectedGroup){
        echo '<section class="nf-subpages nf-no-print"><div class="nf-location"><span>관리자</span><span>/</span><strong>'.view_h($selectedGroup['label']).'</strong><span>/</span><span>'.view_h($selectedLabel).'</span></div><nav class="nf-subpage-links" aria-label="'.view_h($selectedGroup['label']).' 하위 페이지">';
        foreach($selectedGroup['items'] as [$page,$label])echo '<a href="'.view_h(native_url($page,$role)).'"'.($page===$active?' class="active" aria-current="page"':'').'>'.view_h($label).'</a>';
        if($selectedGroup['items'][0][0]==='adminPayroll')echo '<a href="/payroll.php?role=admin">급여 계산 검토 <span class="ui-icon ui-icon-external" aria-hidden="true"></span></a>';
        echo '</nav></section>';
    }
    echo '<div class="nf-page-heading"><h1>'.view_h($title).'</h1>'.$headingExtra.'<span>'.(new DateTimeImmutable('now',new DateTimeZone('Asia/Seoul')))->format('Y.m.d').'</span></div>';
}
function native_end(): void {echo '</main></div><script src="'.view_h(asset_url('native-ui.js')).'" defer></script></body></html>';}
