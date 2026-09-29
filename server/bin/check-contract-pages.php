<?php
// Render against the isolated contract workflow fixtures, never production.
declare(strict_types=1);
ob_start();require __DIR__.'/check-contracts.php';ob_end_clean();
require_once __DIR__.'/../lib/native.php';
$d->exec("CREATE TABLE office_notices(id INTEGER PRIMARY KEY,channel TEXT,department TEXT,title TEXT,body TEXT,active INTEGER,created_at TEXT);
INSERT INTO office_notices VALUES(1,'company','insurance','회사 알림','<안내> & 내용',1,'2026-09-29 10:00:00');
INSERT INTO office_notices VALUES(2,'activity','cosmetics','다른 부서','직원에게 비공개',1,'2026-09-29 10:00:00');");
$_SESSION['csrf']='fixture-csrf';
function contract_page_fixture(array $actor,array $overrides=[]): string {
    $base=['user'=>$actor,'role'=>$actor['role'],'selected'=>null,'company'=>contract_company_row(),'contracts'=>contract_list($actor),'employees'=>db()->query('SELECT id,employee_no,profile FROM hr_employees ORDER BY id')->fetchAll(),'events'=>[],'error'=>'','notice'=>'','failedPost'=>[],'filterTeam'=>'','filterEmployee'=>0,'filterProfile'=>null,'editWindow'=>false,'previewOnly'=>false,'basicRequested'=>false];
    ob_start();render_view('contracts',array_replace($base,$overrides));return ob_get_clean();
}
$adminUser=$admin+['display_name'=>'관리자','department'=>'insurance'];$employeeUser=$one+['display_name'=>'직원 갑','department'=>'insurance'];
$html=contract_page_fixture($adminUser);
check(strpos($html,'data-contract-management-list')<strpos($html,'data-contract-basic-form'),'admin management list comes before large template');
check(str_contains($html,'data-contract-window-row')&&str_contains($html,'editWindow=1'),'admin rows link to edit windows');
$draft=contract_find($fiveId,$adminUser);
$edit=contract_page_fixture($adminUser,['selected'=>$draft,'editWindow'=>true]);
check(!str_contains($edit,'<aside')&&!str_contains($edit,'data-contract-management-list'),'edit window omits sidebar and management list');
check(substr_count($edit,'name="terms[employeeName]"')===1&&!str_contains($edit,'<article class="contract-sheet'),'edit window renders each field once without duplicate document');
check(str_contains($edit,'action="/contracts.php?role=admin&amp;id='.$fiveId.'&amp;editWindow=1"'),'save stays in edit window');
$preview=contract_page_fixture($adminUser,['selected'=>$draft,'editWindow'=>true,'previewOnly'=>true]);
check(substr_count($preview,'<article class="contract-sheet')===1&&!str_contains($preview,'id="contract-editor"'),'preview is a single print document without duplicate editor');
$employeeHtml=contract_page_fixture($employeeUser);
check(str_contains($employeeHtml,'<th>발행일</th>')&&str_contains($employeeHtml,'data-contract-toggle')&&str_contains($employeeHtml,'data-contract-detail hidden'),'employee contracts are initially collapsed issue-date rows');
check(substr_count($employeeHtml,'class="cnc-session-bar')===1&&substr_count($employeeHtml,'로그아웃</button>')===1,'employee has one shared notice/account bar');
check(str_contains($employeeHtml,'&lt;안내&gt; &amp; 내용')&&!str_contains($employeeHtml,'직원에게 비공개'),'notice server rendering escapes content and filters departments');
$issued=contract_list($employeeUser)[0];$expanded=contract_page_fixture($employeeUser,['selected'=>$issued]);
check(str_contains($expanded,'id="contract-detail-'.$issued['id'].'" data-contract-detail >'),'selected employee contract expands with PHP and no JavaScript');
$fixtureDir=getenv('CNC_CONTRACT_PAGE_FIXTURES');if($fixtureDir){if(!is_dir($fixtureDir))mkdir($fixtureDir,0700,true);foreach(['admin'=>$html,'edit'=>$edit,'preview'=>$preview,'employee'=>$employeeHtml,'expanded'=>$expanded] as $key=>$body)file_put_contents($fixtureDir.'/'.$key.'.html',$body);}
echo "PASS: contract list order, isolated popup editor, nonduplicated fields, preview, employee expansion, shared notice bar and scoped escaped announcements.\n";
