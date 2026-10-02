<?php declare(strict_types=1);$popup=$popup??false;$employeeNumber=$employeeNumber??($record['employee_no']??'');$historyEntry=$historyEntry??null;$restoreEntry=$restoreEntry??null;$historyEntries=$historyEntries??[]; ?>
<?php if($saved): ?><p class="nf-alert" role="status"><?= $admin?'인사정보를 확정하고 수정이력을 저장했습니다.':'기본정보를 저장했습니다.' ?></p><?php endif; ?>
<?php if(isset($_GET['permissionSaved'])): ?><p class="nf-alert" role="status">직원 관리 설정을 저장했습니다.</p><?php endif; ?>
<?php if($error): ?><p class="nf-alert nf-error" role="alert"><?= h($error) ?></p><?php endif; ?>
<div class="nf-actions personnel-no-print">
<?php if($historyEntry): ?>
<a class="nf-button primary" href="/personnel.php?role=admin&amp;id=<?= $record['id'] ?>&amp;edit=1&amp;restore=<?= (int)$historyEntry['id'] ?>&amp;popup=1">이 내용으로 수정</a>
<a class="nf-button" href="/personnel.php?role=admin&amp;id=<?= $record['id'] ?>&amp;popup=1">현재 인사기록</a>
<?php elseif($admin): ?>
<a class="nf-button" href="/personnel.php?role=admin">직원 목록</a>
<a class="nf-button" href="/personnel.php?role=admin&amp;new=1&amp;popup=1" target="_blank" rel="noopener" data-personnel-window>직원 등록</a>
<?php if($record&&!$editing): ?><a class="nf-button" href="/personnel.php?role=admin&amp;id=<?= $record['id'] ?>&amp;edit=1<?= $popup?'&amp;popup=1':'' ?>">인사정보 수정</a><?php endif; ?>
<?php endif; ?>
<?php if(!empty($canSelfEdit)): ?><a class="nf-button primary" href="/profile-entry.php?role=employee">정보수정</a><?php endif; ?>
<?php if(!$editing&&!$historyEntry): ?><a class="nf-button<?= $admin?' nf-contract-manage-open':' nf-contract-open' ?>" href="/contracts.php?role=<?= h($role) ?><?= $admin?'':'&amp;document=1' ?>" target="_blank" rel="noopener">근로계약서</a><?php endif; ?>
<?php if($record&&!$editing&&!$historyEntry): ?>
<?php if($admin): ?><form method="post" class="personnel-permission-form"><?= native_csrf() ?><input type="hidden" name="id" value="<?= $record['id'] ?>"><input type="hidden" name="revision" value="<?= $record['revision'] ?>"><button type="submit" name="action" value="<?= empty($record['profile']['selfEditLocked'])?'lockStaff':'unlockStaff' ?>"><?= empty($record['profile']['selfEditLocked'])?'입력내용 확정 · 수정 잠금':'직원 수정권한 해제' ?></button></form><?php endif; ?>
<span class="personnel-edit-status"><?= empty($record['profile']['selfEditLocked'])?'기본정보 수정 가능':'관리자 확정 · 직원 수정 잠금' ?></span>
<?php endif; ?>
<?php if($record&&!$editing): ?><button type="button" data-print>인사기록카드 인쇄</button><?php endif; ?>
</div>
<?php if($admin&&!$editing&&!$popup): ?><details class="nf-card"><summary>로그인 세션 유지시간 설정</summary><form method="post"><?= native_csrf() ?><input type="hidden" name="action" value="sessionSettings"><label>페이지를 닫은 뒤 유지시간 (분) <input type="number" name="timeoutMinutes" min="5" max="1440" required value="<?= session_timeout_minutes() ?>"></label><button>설정 저장</button><p>페이지가 열려 있는 동안 1분마다 세션을 갱신합니다. 브라우저 종료·절전이나 통신 중단 시에는 설정한 시간이 적용됩니다.</p><?php if(isset($_GET['sessionSaved'])): ?><p role="status">저장했습니다.</p><?php endif ?></form></details><?php endif ?>
<?php if(!empty($record['loginName'])): ?><p>직원 로그인 아이디: <strong><?= h($record['loginName']) ?></strong></p><?php endif ?>
<?php if($historyEntry): ?><p class="nf-alert personnel-history-context"><strong><?= h(personnel_history_date($historyEntry['created_at'])) ?></strong> · <?= h(personnel_history_label($historyEntry['event'])) ?> · <?= h($historyEntry['actor_name']) ?><br>아래는 해당 기록에 저장된 내용입니다.</p><?php endif; ?>
<?php if($restoreEntry): ?><p class="nf-alert"><strong><?= h(personnel_history_date($restoreEntry['created_at'])) ?></strong> 기록의 내용을 불러왔습니다. 내용을 확인한 뒤 수정 확정을 누르면 반영됩니다.</p><?php endif; ?>
<?php if($admin&&!$historyEntry&&!$restoreEntry&&!empty($record['user_id'])): ?>
<section class="nf-card personnel-no-print"><h2>로그인 아이디·비밀번호 변경</h2>
<?php if(isset($_GET['accountSaved'])): ?><p class="nf-alert" role="status">로그인 정보를 변경했습니다.</p><?php endif ?>
<form method="post" action="/personnel.php?role=admin&amp;id=<?= (int)$record['id'] ?><?= $popup?'&amp;popup=1':'' ?>" autocomplete="off">
<?= native_csrf() ?><input type="hidden" name="action" value="changeAccount"><input type="hidden" name="id" value="<?= (int)$record['id'] ?>"><input type="hidden" name="revision" value="<?= (int)$record['revision'] ?>">
<div class="personnel-grid"><label class="nf-field">로그인 아이디<input name="username" value="<?= h($record['loginName']??'') ?>" pattern="[a-zA-Z0-9_.-]{3,64}" minlength="3" maxlength="64" required autocomplete="off"></label>
<label class="nf-field">새 비밀번호<input name="password" type="password" minlength="12" maxlength="72" autocomplete="new-password"></label><label class="nf-field">새 비밀번호 확인<input name="passwordConfirm" type="password" minlength="12" maxlength="72" autocomplete="new-password"></label></div>
<p>비밀번호 두 칸을 비우면 기존 비밀번호를 유지합니다. 변경 후에는 새 아이디와 비밀번호로 로그인하세요.</p><button type="submit">로그인 정보 변경 저장</button><button type="reset">취소</button></form></section>
<?php endif ?>
<?php if($editing): ?>
<form class="personnel-form" method="post" action="/personnel.php?role=admin<?= $isNew?'&amp;new=1':'&amp;id='.$id.'&amp;edit=1' ?><?= $popup?'&amp;popup=1':'' ?><?= $restoreEntry?'&amp;restore='.(int)$restoreEntry['id']:'' ?>">
<?= native_csrf() ?><input type="hidden" name="id" value="<?= $isNew?0:$id ?>"><input type="hidden" name="revision" value="<?= $formRevision ?>">
<section class="nf-card personnel-section"><h2><?= $isNew?'직원 등록':'인사기록 수정' ?></h2><p class="personnel-note">* 필수 입력 · 작성 내용을 실제 근로조건 및 계약서와 일치하도록 관리해 주세요.</p>
<p class="personnel-number">사번 <input aria-label="자동 사번" value="<?= h($employeeNumber) ?>" readonly><small><?= $isNew?'저장 시 자동 확정':'자동 발급 번호' ?></small></p><fieldset><legend>기본 인적사항</legend><div class="personnel-grid">
<?php
personnel_field($profile,'name','성명','text',60,true);
personnel_select($profile,'gender','성별',[''=>'미입력','남'=>'남','여'=>'여','기타'=>'기타']);
personnel_field($profile,'birthDate','생년월일','date',10);
personnel_field($profile,'nationality','국적','text',60);
personnel_field($profile,'phone','연락처','tel',20,true);
personnel_field($profile,'email','이메일','email',120);
personnel_field($profile,'emergencyName','비상연락 성명·관계','text',60);
personnel_field($profile,'emergencyPhone','비상 연락처','tel',20);
personnel_field($profile,'postcode','우편번호','text',10);
personnel_field($profile,'address','주소','text',240,false,'personnel-wide');
personnel_field($profile,'addressDetail','상세주소','text',240);
?>
</div></fieldset></section>
<section class="nf-card personnel-section"><fieldset><legend>고용·인사 사항</legend><div class="personnel-grid">
<?php
personnel_select($profile,'team','소속',['insurance'=>'보험팀','cosmetics'=>'화장품팀','health'=>'건강보조식품팀']);
personnel_select($profile,'role','직책',['상담원'=>'상담원','팀장'=>'팀장','관리자'=>'관리자']);
personnel_select($profile,'employment','재직 상태',['재직'=>'재직','휴직'=>'휴직','퇴사'=>'퇴사']);
personnel_field($profile,'startDate','고용·입사일','date',10,true);
personnel_field($profile,'renewalDate','고용 갱신일','date',10);
personnel_field($profile,'endDate','퇴직·해고일','date',10);
personnel_field($profile,'retirementReason','퇴직·해고 사유','text',240);
personnel_field($profile,'workplace','근무 장소','text',240,false,'personnel-wide');
personnel_field($profile,'duties','종사 업무','text',240,false,'personnel-wide');
?>
</div></fieldset></section>
<section class="nf-card personnel-section"><fieldset><legend>근로조건·계약 기간</legend><div class="personnel-grid">
<div class="nf-field personnel-wide"><span>소정근로요일 *</span><div class="personnel-days"><?php foreach(['월','화','수','목','금'] as $day): ?><label><input type="checkbox" name="profile[workDays][]" value="<?= $day ?>"<?= in_array($day,$profile['workDays']??[],true)?' checked':'' ?>><?= $day ?></label><?php endforeach; ?></div></div>
<?php
echo '<label class="nf-field">주휴일<input value="토,일" readonly><input type="hidden" name="profile[weeklyHoliday]" value="토,일"></label>';
echo '<label class="nf-field">급여일<input value="익월 15일" readonly><input type="hidden" name="profile[payday]" value="15"></label>';
personnel_field($profile,'workStart','근로 시작','time',5);
personnel_field($profile,'workEnd','근로 종료','time',5);
personnel_field($profile,'breakStart','휴게 시작','time',5);
personnel_field($profile,'breakEnd','휴게 종료','time',5);
personnel_select($profile,'contractType','계약 구분',[''=>'계약 구분 선택','무기계약'=>'기간의 정함 없음','기간제'=>'기간제']);
personnel_field($profile,'contractStart','계약 개시일','date',10);
personnel_field($profile,'contractEnd','계약 종료일 (기간제)','date',10);
personnel_field($profile,'wageEffective','임금 적용일','date',10);
?>
<p class="personnel-note personnel-full">계약기간 자동 계산·승인·적용은 인사·출결 → 근로계약에서 관리합니다.</p>
</div></fieldset></section>
<section class="nf-card personnel-section"><fieldset><legend>급여 기준·지급 계좌</legend><div class="personnel-grid">
<?php
personnel_select($profile,'payType','급여 방식',['시급제'=>'시급제','월급제'=>'월급제']);
personnel_field($profile,'payAmount','시급 + 주휴수당 합계 / 월 기본급 (원)','number',10,true);
personnel_select($profile,'bank','은행 선택',personnel_banks((string)($profile['bank']??'')));
personnel_field($profile,'accountNumber','계좌번호 입력','text',40);
personnel_field($profile,'accountHolder','예금주','text',60);
?>
<p class="personnel-note personnel-full" data-personnel-pay-split aria-live="polite"></p>
</div></fieldset></section>
<section class="nf-card personnel-section"><fieldset><legend>계정 연결·관리 메모</legend><div class="personnel-grid">
<?php if(!empty($record['user_id'])): ?><p class="personnel-note personnel-full">직원 로그인 계정이 연결되어 있습니다. 직책 변경으로 로그인 권한이 바뀌지는 않습니다.</p>
<?php else: ?>
<label class="nf-field personnel-wide">기존 직원 로그인 계정<select name="accountId"><option value="0">계정 연결 없이 저장</option><?php foreach($accounts as $account): ?><option value="<?= (int)$account['id'] ?>"><?= h($account['display_name'].' · '.$account['username']) ?></option><?php endforeach; ?></select></label>
<label class="nf-field personnel-wide">새 직원 로그인 아이디<input name="username" pattern="[a-z0-9_.-]{3,64}" minlength="3" maxlength="64" autocomplete="off" placeholder="예: cncstaff01"><span>비워 두면 사번으로 생성합니다. 중복 아이디는 저장되지 않습니다.</span></label>
<label class="nf-field personnel-wide">새 계정 비밀번호<input type="password" name="password" minlength="12" maxlength="72" autocomplete="new-password"><span class="personnel-note">12~72바이트. 아이디와 비밀번호를 함께 입력하면 직원 계정을 생성합니다.</span></label>
<?php endif; ?>
<?php personnel_textarea($profile,'memo','관리자 메모 (직원 화면에는 표시하지 않음)',1000); ?>
</div></fieldset></section>
<div class="nf-actions"><button class="nf-button primary" type="submit"><?= $isNew?'등록 확정':'수정 확정' ?></button><button type="button" data-print>등록 양식 인쇄</button><a href="/personnel.php?role=admin<?= $record?'&amp;id='.$record['id']:'' ?><?= $popup?'&amp;popup=1':'' ?>">취소</a></div>
</form>
<?php elseif($record): $p=$record['profile']; ?>
<?php if($admin): $missing=[];foreach(['gender'=>'성별','birthDate'=>'생년월일','address'=>'주소','startDate'=>'고용일','duties'=>'종사 업무'] as $key=>$label)if(trim((string)($p[$key]??''))==='')$missing[]=$label; ?>
<?php if($missing): ?><p class="nf-alert personnel-no-print">근로자명부 확인 항목 중 미입력: <?= h(implode(', ',$missing)) ?>. 인사정보 수정에서 실제 내용을 작성해 주세요.</p><?php endif; ?>
<?php endif; ?>
<article class="nf-card personnel-card">
<h2>인사기록카드</h2><div class="personnel-meta"><span>사번 <?= h($record['employee_no']) ?></span><span><?= $historyEntry?'기록일 '.h(personnel_history_date($historyEntry['created_at'])):'기준일 '.h(hr_today()) ?> · 기록 버전 <?= (int)$record['revision'] ?></span></div>
<h3>1. 기본 인적사항</h3><table class="personnel-table"><tbody>
<?php
personnel_cells('성명',$p['name']??'','성별',$p['gender']??'');
personnel_cells('생년월일',$p['birthDate']??'','국적',$p['nationality']??'');
personnel_cells('연락처',$p['phone']??'','이메일',$p['email']??'');
personnel_cells('주소',trim(($p['postcode']??'').' '.($p['address']??'').' '.($p['addressDetail']??'')),'비상 연락처',trim(($p['emergencyName']??'').' '.($p['emergencyPhone']??'')));
?>
</tbody></table>
<h3>2. 고용·인사 사항</h3><table class="personnel-table"><tbody>
<?php
personnel_cells('소속',department_label($p['team']??''),'직책',$p['role']??'');
echo '<tr><th>재직 상태</th><td colspan="3">'.h(personnel_text($p['employment']??'')).'</td></tr>';
personnel_cells('고용·입사일',$p['startDate']??'','고용 갱신일',$p['renewalDate']??'');
personnel_cells('근무 장소',$p['workplace']??'','종사 업무',$p['duties']??'');
personnel_cells('퇴직·해고일',$p['endDate']??'','퇴직·해고 사유',$p['retirementReason']??'');
?>
</tbody></table>
<h3>3. 근로조건</h3><table class="personnel-table"><tbody>
<?php
$workTime=($p['workStart']??'')&&($p['workEnd']??'')?$p['workStart'].' ~ '.$p['workEnd']:'';
$breakTime=($p['breakStart']??'')&&($p['breakEnd']??'')?$p['breakStart'].' ~ '.$p['breakEnd']:'';
personnel_cells('소정근로요일',implode(' · ',$p['workDays']??[]),'주휴일',($p['weeklyHoliday']??'')?str_replace(',', '·', $p['weeklyHoliday']).'요일':'');
personnel_cells('근로시간',$workTime,'휴게시간',$breakTime);
personnel_cells('계약 구분',$p['contractType']??'','계약 기간',($p['contractStart']??'').' ~ '.(($p['contractType']??'')==='무기계약'?'기간의 정함 없음':($p['contractEnd']??'')));
personnel_cells('임금 적용일',$p['wageEffective']??'','급여일',($p['payday']??'')?((($p['paydayTiming']??'current')==='next'?'익월 ':'매월 ').$p['payday'].'일'):'');
?>
</tbody></table>
<h3>4. 급여 기준·지급 계좌</h3>
<?php if(($p['payType']??'')==='시급제'): $combined=(int)($p['payAmount']??0);$base=$combined/1.2;$holiday=$combined-$base; ?>
<div class="personnel-pay"><span>시급<strong><?= h(personnel_hourly_rate($base)) ?></strong></span><span>주휴수당<strong><?= h(personnel_hourly_rate($holiday)) ?></strong></span><span>시급 + 주휴수당<strong><?= h(native_money($combined)) ?></strong></span></div>
<p class="personnel-note">시급에 주휴수당 20%를 더한 시간당 합계입니다. 주별 지급 내역은 급여명세서에서 확인할 수 있습니다.</p>
<?php else: ?><div class="personnel-pay"><span>월 기본급<strong><?= h(native_money((int)($p['payAmount']??0))) ?></strong></span></div><?php endif; ?>
<table class="personnel-table"><tbody><?php personnel_cells('은행',$p['bank']??'','예금주',$p['accountHolder']??''); ?><tr><th>급여 계좌번호</th><td colspan="3"><?= h(personnel_text($p['accountNumber']??'')) ?></td></tr></tbody></table>
<?php if($admin&&!empty($p['memo'])): ?><h3 class="personnel-no-print">관리자 메모</h3><p class="personnel-note personnel-no-print"><?= nl2br(h($p['memo'])) ?></p><?php endif; ?>
<p class="personnel-note">미입력 항목은 ‘—’로 표시합니다. <?= !empty($canSelfEdit)?'이름·연락처·주소·급여계좌 등은 상단 정보수정에서 입력할 수 있습니다. 근로조건이 다르면 관리자에게 정정을 요청해 주세요.':'정보가 다르면 관리자에게 정정을 요청해 주세요.' ?></p>
</article>
<?php if($admin&&!$historyEntry): ?>
<details class="nf-card personnel-record-list personnel-history-list personnel-no-print"><summary><span>인사기록 수정이력</span><small><?= count($historyEntries) ?>건 · 펼쳐보기</small></summary>
<?php if($historyEntries): ?><div class="nf-table-wrap"><table class="nf-table"><thead><tr><th>수정 날짜 · 시간</th><th>기록</th><th>수정자</th><th>버전</th></tr></thead><tbody>
<?php foreach($historyEntries as $entry): ?><tr><td><a class="personnel-history-date" href="/personnel.php?role=admin&amp;id=<?= $record['id'] ?>&amp;history=<?= (int)$entry['id'] ?>&amp;popup=1" target="_blank" rel="noopener" data-personnel-history-window><?= h(personnel_history_date($entry['created_at'])) ?></a></td><td><?= h(personnel_history_label($entry['event'])) ?></td><td><?= h($entry['actor_name']) ?></td><td><?= (int)$entry['revision'] ?></td></tr><?php endforeach; ?>
</tbody></table></div><?php else: ?><p class="personnel-note">수정·확정하면 날짜별로 기록됩니다. 처음 수정할 때 기존 입력 내용도 함께 보관합니다.</p><?php endif; ?>
</details>
<?php endif; ?>
<?php elseif($admin): ?>
<details class="nf-card personnel-record-list"><summary><span>직원 인사기록</span><small><?= count($records) ?>명 · 펼쳐보기</small></summary><p class="personnel-note">인사기록과 근로계약은 별도로 관리합니다. 개인정보는 인사·급여 업무 목적으로 확인해 주세요.</p>
<div class="nf-table-wrap"><table class="nf-table personnel-list"><thead><tr><th>사번</th><th>성명</th><th>소속·직책</th><th>입사일</th><th>상태</th><th>인사기록</th></tr></thead><tbody>
<?php foreach($records as $item): $p=$item['profile']; ?><tr><td><?= h($item['employee_no']) ?></td><td><?= h($p['name']??'') ?></td><td><?= h(department_label($p['team']??'').' · '.($p['role']??'')) ?></td><td><?= h($p['startDate']??'') ?></td><td><?= h($p['employment']??'') ?></td><td><a href="/personnel.php?role=admin&amp;id=<?= $item['id'] ?>&amp;popup=1" target="_blank" rel="noopener" data-personnel-window>보기</a> · <a href="/personnel.php?role=admin&amp;id=<?= $item['id'] ?>&amp;edit=1&amp;popup=1" target="_blank" rel="noopener" data-personnel-window>수정</a><?php if(!empty($item['user_id'])): ?> <form class="personnel-account-action" method="post" action="/personnel.php?role=admin&amp;id=<?= $item['id'] ?>&amp;returnList=1"><?= native_csrf() ?><input type="hidden" name="id" value="<?= $item['id'] ?>"><input type="hidden" name="revision" value="<?= $item['revision'] ?>"><button type="submit" name="action" value="<?= $item['accountActive']?'suspendStaff':'resumeStaff' ?>"><?= $item['accountActive']?'사용중지':'사용 재개' ?></button></form><?php endif; ?></td></tr><?php endforeach; ?>
<?php if(!$records): ?><tr><td colspan="6" class="personnel-empty">등록된 직원이 없습니다. 직원 등록에서 인사기록을 작성해 주세요.</td></tr><?php endif; ?>
</tbody></table></div></details>
<?php else: ?><section class="nf-card personnel-empty">아직 연결된 인사기록이 없습니다. 관리자에게 직원 계정 연결을 요청해 주세요.</section><?php endif; ?>
