<?php
declare(strict_types=1);
require __DIR__.'/check-grade-settings.php';
require_once __DIR__.'/../lib/grade-visibility.php';
require __DIR__.'/grade-visibility-fixture.php';
$before=$d->query('SELECT policy FROM grade_versions ORDER BY id')->fetchAll();
$revision=(int)$d->query('SELECT revision FROM grade_revision')->fetchColumn();
$all=grade_visibility_for($admin);check(count($all)===3&&$all['insurance']['daily']&&$all['health']['monthly'],'all periods initially preserve existing visibility');
foreach(['insurance','cosmetics','health'] as $department){
    $saved=grade_visibility_save($admin,['department'=>$department,'revision'=>0,'daily'=>false,'weekly'=>true,'monthly'=>false]);
    check(!$saved[$department]['daily']&&$saved[$department]['weekly']&&!$saved[$department]['monthly'],'each period independently saved');
    $employee=grade_visibility_for(['role'=>'employee','department'=>$department]);check(array_keys($employee)===[$department],'employee receives only authenticated department');
    $caught=false;try{grade_visibility_save($admin,['department'=>$department,'revision'=>0,'daily'=>true,'weekly'=>true,'monthly'=>true]);}catch(GradeVisibilityConflict $e){$caught=true;}check($caught,'stale administrator cannot overwrite current settings');
}
$caught=false;try{grade_visibility_save(['role'=>'employee'],[]);}catch(HRForbidden $e){$caught=true;}check($caught,'employee cannot change exposure');
$all=grade_visibility_save($admin,['department'=>'insurance','revision'=>1,'daily'=>true,'weekly'=>false,'monthly'=>true]);
check($all['insurance']['daily']&&!$all['insurance']['weekly']&&!$all['cosmetics']['daily']&&$all['cosmetics']['weekly'],'insurance change leaves cosmetics setting intact');
check($before===$d->query('SELECT policy FROM grade_versions ORDER BY id')->fetchAll()&&$revision===(int)$d->query('SELECT revision FROM grade_revision')->fetchColumn(),'visibility never changes financial criteria or revision');
echo "PASS: independent department/period display settings, employee scope, authorization, conflicts and unchanged grade policies.\n";
