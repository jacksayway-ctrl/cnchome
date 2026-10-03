<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
require __DIR__.'/../lib/views.php';
function check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
function html_view(string $name,array $data=[]):string {ob_start();render_view($name,$data);return ob_get_clean();}
$directory=dirname(__DIR__,2).'/.build';if(!is_dir($directory))mkdir($directory,0700,true);
$navigation=app_navigation();
check(office_page('employee','adminPayroll')==='home','employee cannot select admin page');
check(office_page('employee',['home'])==='home','array query rejected');
check(office_page('admin','../bootstrap.php')==='adminHome','path input rejected');
check(office_page('admin','adminPayroll')==='adminPayroll','admin route supported');
check(!str_contains(view_json(['text'=>'</script><script>alert(1)</script>']),'</script>'),'boot JSON cannot close script');
foreach(['admin','employee'] as $role){
 $routes=$role==='admin'?array_merge(['grade'],...array_map(fn($g)=>array_column($g['items'],0),$navigation['admin'])):array_column($navigation['employee'],0);
 $user=['id'=>1,'role'=>$role,'department'=>'insurance','display_name'=>'테스트 <직원>'];
 foreach($routes as $page){
  $boot=['user'=>$user,'page'=>$page,'entries'=>[],'revision'=>0,'csrf'=>'TEST','hr'=>['today'=>'2026-09-26','accounts'=>[],'employees'=>[],'payroll'=>[]]];
  $html=html_view('office',compact('role','page','user','boot'));
  preg_match('~<aside>(.*?)</aside>~s',$html,$matches);$sidebar=$matches[1];
  check(substr_count($html,'id="tm-main"')===1,'one main per page');
  check(!str_contains($html,'<h1>테스트 <직원>'),'escape user display name');
  check(!str_contains($sidebar,'data-page="admin'),'no legacy admin sidebar links');
  check(substr_count($sidebar,'data-aw-section=')===($role==='admin'?count($navigation['admin']):0),'role-specific initial sidebar');
  check(str_contains($sidebar,'data-page="home"')===($role==='employee'),'employee home visibility');
  check(str_contains($html,'<div hidden class="sample">'),'live pages hide the example banner before JavaScript');
  check($role==='admin'?!str_contains($html,'보험팀 중요 공지'):str_contains($html,'<section hidden class="top-notice"'),'admin pages omit the old notice strip');
  check(strpos($html,'notice-ticker.js')<strpos($html,'session-navigation.js'),'notice ticker loads before session bar');
  check(str_contains($html,'grade-header.js'),'live DB progress script is included');
  check(str_contains($html,'id="tm-head-daily">불러오는 중'),'live header never embeds sample counts');
  file_put_contents($directory.'/'.$role.'-'.$page.'.html',$html);
 }
}
file_put_contents($directory.'/office-preview.html',html_view('office',['preview'=>true]));
file_put_contents($directory.'/payroll-preview.html',html_view('payroll',['role'=>'admin','user'=>['role'=>'admin','display_name'=>'관리자 미리보기','department'=>'insurance']]));
check(in_array('payroll-requirements.json',document_files(),true),'all operating rules present');
check(!in_array('../bootstrap.php',document_files(),true),'documents traversal rejected');
foreach(['admin','employee'] as $role){
 $user=['id'=>1,'role'=>$role,'display_name'=>'헤더 <직원>','department'=>'insurance'];$_SESSION=['csrf'=>'HEADER'];
 ob_start();native_start('공통 헤더',$user,$role==='admin'?'adminMemberships':'myInfo');native_end();$html=ob_get_clean();
 check(str_contains($html,'회사 공지')&&str_contains($html,'정책 수량 감소'),'both notice channels appear on native pages for either role');
 check(str_contains($html,'/logout.php?role='.$role),'native notices retain role-specific logout');
 check(str_contains($html,'notice-ticker.js'),'native shared notice feed refreshes');
 check(str_contains($html,'헤더 &lt;직원&gt;'),'shared header escapes display names');
 if($role==='admin')check(str_contains($html,'membership-notification.js')&&str_contains($html,'직원 등록 승인'),'admin approval notification and submenu present');
}
echo 'PASS: role-checked PHP routes, escaped output, original-menu exclusion, document allowlist and rendered fixtures.'.PHP_EOL;

$_GET=['department'=>'health'];$role='admin';$user=['id'=>1,'role'=>'admin','department'=>'insurance','display_name'=>'관리자'];
foreach(['adminPolicy','adminGrade','adminBank','adminCorrections'] as $page){
 $boot=['user'=>$user,'page'=>$page,'entries'=>[],'revision'=>0,'csrf'=>'TEST','hr'=>['today'=>'2026-10-03','accounts'=>[],'employees'=>[],'payroll'=>[]]];
 $html=html_view('office',compact('role','page','user','boot'));
 check(str_contains($html,'class="aw-department-tabs"'),'each scoped group has department tabs');
 $location=strpos($html,'class="aw-location"');$tabs=strpos($html,'class="aw-department-tabs"');
 check($location!==false&&$tabs!==false&&$location<$tabs,'office breadcrumbs precede department tabs');
 check(str_contains($html,'department=health" class="active"'),'selected department is preserved by server rendering');
}
check(str_contains(native_url('adminPayroll','admin'),'department=health'),'native payroll link preserves department');
check(str_contains(native_url('adminPolicy','admin'),'department=health'),'native-to-office link preserves department');
$_GET=[];
echo "PASS: policy, grade and payroll department navigation.\n";

$_GET=['team'=>'insurance'];$user=['id'=>1,'role'=>'admin','display_name'=>'관리자','department'=>'insurance'];
foreach(['adminIntake','adminPending','adminIntakeRegister','adminPolicy','adminGrade','adminPayroll','adminBank','adminCorrections'] as $page){
 ob_start();native_start('접수관리',$user,$page);native_end();$html=ob_get_clean();
 $location=strpos($html,'class="nf-location"');$tabs=strpos($html,'class="nf-department-tabs"');
 check($location!==false&&$tabs!==false&&$location<$tabs,'native breadcrumbs precede department tabs');
}
$_GET=[];
echo "PASS: admin breadcrumb position across department groups.\n";
