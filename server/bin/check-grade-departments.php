<?php
// Reuse isolated settings fixtures; never connect to production.
declare(strict_types=1);
require __DIR__.'/check-grade-settings.php';
require __DIR__.'/../lib/grade-estimates.php';
$insuranceBefore=hr_json(grade_history('insurance'));
// Preserve old unscoped records for history, but never apply them to other teams.
$q=$d->prepare('INSERT INTO grade_versions(department,effective_date,actor_id,actor_name,policy) VALUES(?,?,?,?,?)');
$q->execute(['health','2000-01-01',1,'legacy-insurance-copy',hr_json($base)]);$legacyId=(int)$d->lastInsertId();
check(grade_history('health')===[],'old unscoped insurance criteria cannot appear as health criteria');
$healthUser=['role'=>'employee','department'=>'health'];
check(!grade_employee_available($healthUser,grade_history('health'),'2026-10-01'),'health grade remains closed until its own effective save');
check(grade_employee_available(['role'=>'employee','department'=>'insurance'],[],'2026-10-01'),'insurance retains existing visibility');
$health=grade_empty_policy(0);$health['dailyCash']=['start'=>2,'perCase'=>1200];$health['weekly'][0]['achievement']=7100;$health['monthly'][0]['achievement']=31000;
$health['monthlyReference']=[['max'=>null,'hourly'=>15000,'achievement'=>999999,'threshold'=>0,'extra'=>0,'example'=>0]];
// Selected weekly save ignores unrelated invalid insurance-only metadata and other period values.
save_policy('weekly','2026-10-05',$health,'health');$history=grade_history('health');
check(count($history)===1&&!isset($history[0]['policy']['monthlyReference'])&&$history[0]['policy']['weekly'][0]['achievement']===7100,'health weekly rules saved without insurance monthly table');
check($history[0]['policy']['dailyCash']['perCase']===0&&$history[0]['policy']['monthly'][0]['achievement']===0,'health first save starts from empty other periods');
check(!grade_employee_available($healthUser,$history,'2026-10-01')&&grade_employee_available($healthUser,$history,'2026-10-05'),'scheduled department save opens on its own effective date');
$own=grade_empty_policy(0);$own['dailyCash']=['start'=>2,'perCase'=>1200];save_policy('daily','2026-10-01',$own,'health');
$history=grade_history('health');check($history[0]['policy']['dailyCash']['perCase']===1200&&$history[1]['policy']['dailyCash']['perCase']===1200,'health daily update preserved by its future weekly save');
$cosmeticBefore=hr_json(grade_history('cosmetics'));$healthBefore=hr_json($history);
$cosmetic=grade_empty_policy(0);$cosmetic['monthly'][0]['achievement']=22000;save_policy('monthly','2026-10-01',$cosmetic,'cosmetics');
check(hr_json(grade_history('insurance'))===$insuranceBefore&&hr_json(grade_history('health'))===$healthBefore&&hr_json(grade_history('cosmetics'))!==$cosmeticBefore,'cosmetics saves affect neither insurance nor health');
$raw=$d->query('SELECT policy FROM grade_versions WHERE id='.$legacyId)->fetchColumn();check($raw===hr_json($base),'unscoped old record remains unchanged in storage');
$last=grade_history('cosmetics');check($last[array_key_last($last)]['policy']['dailyCash']['perCase']===5000,'own previously saved cosmetic daily values preserved');
check(!grade_department_owns('health',['departmentScope'=>'cosmetics','departmentScopeVersion'=>1]),'another department marker is rejected');
$preview=grade_empty_policy(0);$preview['dailyCash']=['start'=>2,'perCase'=>1000];
// Compare a low-count full-month example: insurance floor must not be inherited by a new team.
$history=[['date'=>'2000-01-01','policy'=>$preview]];$calendar=[];
$actual=grade_estimates(['department'=>'health','month'=>'2026-09','basis'=>'full-month','policy'=>$preview,'counts'=>[1]],$history,$calendar,true)['rows'][0];
check($actual['daily']===0&&!isset($actual['minimumGrade']),'health examples never use insurance seven/eight-case floors');
echo "PASS: department scope, legacy insurance exclusion, independent criteria, scheduled visibility, cross-team isolation and insurance-only comparison floors.\n";
