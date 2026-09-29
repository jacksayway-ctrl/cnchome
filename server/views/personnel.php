<?php declare(strict_types=1); ?>
<style>
.personnel-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px 14px}.personnel-wide{grid-column:span 2}.personnel-full{grid-column:1/-1}.personnel-card{max-width:1080px;margin-inline:auto}.personnel-card h2{margin:0 0 8px;font-size:17px}.personnel-card h3{font-size:14px;margin:16px 0 7px}.personnel-meta{display:flex;justify-content:space-between;gap:12px;font-size:12px;color:#64748b}.personnel-table{table-layout:fixed;width:100%;border-collapse:collapse}.personnel-table th,.personnel-table td{padding:8px 10px;border:1px solid #dce2e9;text-align:left;vertical-align:top;font-size:13px;word-break:break-word}.personnel-table th{width:17%;background:#f4f6f8;font-weight:600}.personnel-table td{width:33%;white-space:normal}.personnel-pay{display:flex;flex-wrap:wrap;gap:8px 22px;margin:10px 0;font-size:13px}.personnel-pay strong{margin-left:6px}.personnel-note{font-size:12px;color:#64748b;line-height:1.5}.personnel-days{display:flex;gap:14px;align-items:center;min-height:34px}.personnel-days label{display:flex;gap:5px;align-items:center}.personnel-grid fieldset{border:0;padding:0;margin:0}.personnel-grid input[type=checkbox]{width:auto}.personnel-section{margin:0 0 14px}.personnel-form legend{font-size:14px;font-weight:700;margin-bottom:9px}.personnel-form textarea{min-height:64px;resize:vertical}.personnel-list td{vertical-align:middle}.personnel-empty{padding:24px;text-align:center;color:#64748b}
@media(max-width:800px){.personnel-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.personnel-meta{flex-wrap:wrap}.personnel-table th,.personnel-table td{font-size:12px;padding:6px}.personnel-table th{width:20%}.personnel-table td{width:30%}.personnel-pay{gap:8px 12px}}
@media print{.personnel-no-print{display:none!important}.personnel-card{max-width:none;margin:0;padding:0;border:0;box-shadow:none}.personnel-card h2{font-size:17pt;text-align:center}.personnel-card h3{font-size:10pt;margin:12px 0 5px}.personnel-table th,.personnel-table td{font-size:9pt;padding:6px 7px}.personnel-table th{background:#f4f6f8!important;print-color-adjust:exact}.personnel-meta,.personnel-note{font-size:8pt}.personnel-pay{font-size:9pt}.personnel-table tr{break-inside:avoid}}
</style>
<?php if($saved): ?><p class="nf-alert" role="status">인사정보를 저장했습니다.</p><?php endif; ?>
<?php if($error): ?><p class="nf-alert nf-error" role="alert"><?= h($error) ?></p><?php endif; ?>
<div class="nf-actions personnel-no-print">
<?php if($admin): ?>
<a href="/personnel.php?role=admin">직원 목록</a>
<a class="nf-button" href="/personnel.php?role=admin&amp;new=1">직원 등록</a>
<?php if($record&&!$editing): ?><a class="nf-button" href="/personnel.php?role=admin&amp;id=<?= $record['id'] ?>&amp;edit=1">인사정보 수정</a><?php endif; ?>
<?php endif; ?>
<?php if(!$editing): ?><a class="<?= $admin?'':'nf-contract-open' ?>" href="/contracts.php?role=<?= h($role) ?>">근로계약서</a><?php endif; ?>
<?php if($record&&!$editing): ?><button type="button" data-print>인사기록카드 인쇄</button><?php endif; ?>
</div>
<?php if($editing): ?>
<form class="personnel-form" method="post" action="/personnel.php?role=admin<?= $isNew?'&amp;new=1':'&amp;id='.$id.'&amp;edit=1' ?>">
<?= native_csrf() ?><input type="hidden" name="id" value="<?= $isNew?0:$id ?>"><input type="hidden" name="revision" value="<?= $formRevision ?>">
<section class="nf-card personnel-section"><h2><?= $isNew?'직원 등록':'인사기록 수정' ?></h2><p class="personnel-note">* 필수 입력 · 작성 내용을 실제 근로조건 및 계약서와 일치하도록 관리해 주세요.</p>
<fieldset><legend>기본 인적사항</legend><div class="personnel-grid">
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
personnel_field($profile,'jobType','직종','text',80);
personnel_select($profile,'employment','재직 상태',['재직'=>'재직','휴직'=>'휴직','퇴사'=>'퇴사']);
personnel_field($profile,'startDate','고용·입사일','date',10,true);
personnel_field($profile,'renewalDate','고용 갱신일','date',10);
personnel_field($profile,'endDate','퇴직·해고일','date',10);
personnel_field($profile,'retirementReason','퇴직·해고 사유','text',240);
personnel_field($profile,'deathDate','사망일 (해당 시)','date',10);
personnel_field($profile,'deathReason','사망 사유 (해당 시)','text',240,false,'personnel-wide');
personnel_field($profile,'workplace','근무 장소','text',240,false,'personnel-wide');
personnel_field($profile,'duties','종사 업무','text',240,false,'personnel-wide');
personnel_textarea($profile,'career','이력·주요 경력 (기간 / 소속 / 업무)',2000);
personnel_textarea($profile,'qualification','자격·면허 (해당 시)',500);
?>
</div></fieldset></section>
<section class="nf-card personnel-section"><fieldset><legend>근로조건·계약 기간</legend><div class="personnel-grid">
<div class="nf-field personnel-wide"><span>소정근로요일 *</span><div class="personnel-days"><?php foreach(['월','화','수','목','금'] as $day): ?><label><input type="checkbox" name="profile[workDays][]" value="<?= $day ?>"<?= in_array($day,$profile['workDays']??[],true)?' checked':'' ?>><?= $day ?></label><?php endforeach; ?></div></div>
<?php
personnel_select($profile,'weeklyHoliday','주휴일',['토'=>'토요일','일'=>'일요일']);
personnel_field($profile,'payday','매월 급여일 (1~31일)','text',2);
personnel_field($profile,'workStart','근로 시작','time',5);
personnel_field($profile,'workEnd','근로 종료','time',5);
personnel_field($profile,'breakStart','휴게 시작','time',5);
personnel_field($profile,'breakEnd','휴게 종료','time',5);
personnel_select($profile,'contractType','계약 구분',['무기계약'=>'기간의 정함 없음','기간제'=>'기간제']);
personnel_field($profile,'contractStart','계약 개시일','date',10);
personnel_field($profile,'contractEnd','계약 종료일 (기간제)','date',10);
personnel_field($profile,'wageEffective','임금 적용일','date',10);
?>
<p class="personnel-note personnel-full">요일별 시간이 다르거나 근로조건을 변경하는 경우 근로계약 관리에서 요일별 시간과 적용일을 별도로 작성하고 직원에게 교부해 주세요. 인사정보 저장만으로 이미 발행된 계약서가 변경되지는 않습니다.</p>
</div></fieldset></section>
<section class="nf-card personnel-section"><fieldset><legend>급여 기준·지급 계좌</legend><div class="personnel-grid">
<?php
personnel_select($profile,'payType','급여 방식',['시급제'=>'시급제','월급제'=>'월급제']);
personnel_field($profile,'payAmount','시간당 합산 기준 / 월 기본급 (원)','number',10,true);
personnel_field($profile,'bank','은행','text',50);
personnel_field($profile,'accountHolder','예금주','text',60);
personnel_field($profile,'accountNumber','급여 계좌번호','text',40,false,'personnel-wide');
?>
<p class="personnel-note personnel-full">시급제 합산 기준 15,000원은 기본시급 12,500원 + 주휴수당·회사 지원금의 시간당 환산액 2,500원으로 나누어 표시합니다. 월급제는 월 기본급을 입력합니다. 실제 지급액은 해당 기간의 인정시간과 계약서에 정한 지급 기준으로 확인해 주세요.</p>
</div></fieldset></section>
<section class="nf-card personnel-section"><fieldset><legend>계정 연결·관리 메모</legend><div class="personnel-grid">
<?php if(!empty($record['user_id'])): ?><p class="personnel-note personnel-full">직원 로그인 계정이 연결되어 있습니다. 직책 변경으로 로그인 권한이 바뀌지는 않습니다.</p>
<?php else: ?>
<label class="nf-field personnel-wide">기존 직원 로그인 계정<select name="accountId"><option value="0">계정 연결 없이 저장</option><?php foreach($accounts as $account): ?><option value="<?= (int)$account['id'] ?>"><?= h($account['display_name'].' · '.$account['username']) ?></option><?php endforeach; ?></select></label>
<label class="nf-field personnel-wide">또는 새 계정 비밀번호<input type="password" name="password" minlength="12" maxlength="72" autocomplete="new-password"><span class="personnel-note">12~72바이트. 새 계정 아이디는 자동 발급되는 사번입니다.</span></label>
<?php endif; ?>
<?php personnel_textarea($profile,'memo','관리자 메모 (직원 화면에는 표시하지 않음)',1000); ?>
</div></fieldset></section>
<div class="nf-actions"><button class="nf-button" type="submit">인사정보 저장</button><a href="/personnel.php?role=admin<?= $record?'&amp;id='.$record['id']:'' ?>">취소</a></div>
</form>
<?php elseif($record): $p=$record['profile']; ?>
<?php if($admin): $missing=[];foreach(['gender'=>'성별','birthDate'=>'생년월일','address'=>'주소','career'=>'이력','jobType'=>'직종','startDate'=>'고용일','duties'=>'종사 업무'] as $key=>$label)if(trim((string)($p[$key]??''))==='')$missing[]=$label; ?>
<?php if($missing): ?><p class="nf-alert personnel-no-print">근로자명부 확인 항목 중 미입력: <?= h(implode(', ',$missing)) ?>. 인사정보 수정에서 실제 내용을 작성해 주세요.</p><?php endif; ?>
<?php endif; ?>
<article class="nf-card personnel-card">
<h2>인사기록카드</h2><div class="personnel-meta"><span>사번 <?= h($record['employee_no']) ?></span><span>기준일 <?= h(hr_today()) ?> · 기록 버전 <?= (int)$record['revision'] ?></span></div>
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
personnel_cells('직종',$p['jobType']??'','재직 상태',$p['employment']??'');
personnel_cells('고용·입사일',$p['startDate']??'','고용 갱신일',$p['renewalDate']??'');
personnel_cells('근무 장소',$p['workplace']??'','종사 업무',$p['duties']??'');
personnel_cells('퇴직·해고일',$p['endDate']??'','퇴직·해고 사유',$p['retirementReason']??'');
personnel_cells('사망일',$p['deathDate']??'','사망 사유',$p['deathReason']??'');
?>
<tr><th>이력·주요 경력</th><td colspan="3"><?= nl2br(h(personnel_text($p['career']??''))) ?></td></tr>
<tr><th>자격·면허</th><td colspan="3"><?= nl2br(h(personnel_text($p['qualification']??''))) ?></td></tr>
</tbody></table>
<h3>3. 근로조건</h3><table class="personnel-table"><tbody>
<?php
$workTime=($p['workStart']??'')&&($p['workEnd']??'')?$p['workStart'].' ~ '.$p['workEnd']:'';
$breakTime=($p['breakStart']??'')&&($p['breakEnd']??'')?$p['breakStart'].' ~ '.$p['breakEnd']:'';
personnel_cells('소정근로요일',implode(' · ',$p['workDays']??[]),'주휴일',($p['weeklyHoliday']??'')?($p['weeklyHoliday'].'요일'):'');
personnel_cells('근로시간',$workTime,'휴게시간',$breakTime);
personnel_cells('계약 구분',$p['contractType']??'','계약 기간',($p['contractStart']??'').' ~ '.(($p['contractType']??'')==='무기계약'?'기간의 정함 없음':($p['contractEnd']??'')));
personnel_cells('임금 적용일',$p['wageEffective']??'','급여일',($p['payday']??'')?'매월 '.$p['payday'].'일':'');
?>
</tbody></table>
<h3>4. 급여 기준·지급 계좌</h3>
<?php if(($p['payType']??'')==='시급제'): $combined=(int)($p['payAmount']??0);$base=$combined/1.2;$holiday=$combined-$base; ?>
<div class="personnel-pay"><span>기본시급<strong><?= h(personnel_hourly_rate($base)) ?></strong></span><span>주휴수당·회사 지원금 환산<strong><?= h(personnel_hourly_rate($holiday)) ?></strong></span><span>시간당 합산<strong><?= h(native_money($combined)) ?></strong></span></div>
<p class="personnel-note">주휴수당·회사 지원금 환산액은 기본시급의 20% 기준입니다. 주별 지급 내역은 명세서에서 확인하며, 실제 근로조건·주휴수당 적용은 교부된 근로계약서를 함께 확인해 주세요.</p>
<?php else: ?><div class="personnel-pay"><span>월 기본급<strong><?= h(native_money((int)($p['payAmount']??0))) ?></strong></span></div><?php endif; ?>
<table class="personnel-table"><tbody><?php personnel_cells('은행',$p['bank']??'','예금주',$p['accountHolder']??''); ?><tr><th>급여 계좌번호</th><td colspan="3"><?= h(personnel_text($p['accountNumber']??'')) ?></td></tr></tbody></table>
<?php if($admin&&!empty($p['memo'])): ?><h3 class="personnel-no-print">관리자 메모</h3><p class="personnel-note personnel-no-print"><?= nl2br(h($p['memo'])) ?></p><?php endif; ?>
<p class="personnel-note">미입력 항목은 ‘—’로 표시합니다. 정보가 다르면 관리자에게 정정을 요청해 주세요.</p>
</article>
<?php elseif($admin): ?>
<section class="nf-card"><h2>직원 인사기록</h2><p class="personnel-note">인사기록과 근로계약은 별도로 관리합니다. 개인정보는 인사·급여 업무 목적으로 확인해 주세요.</p>
<table class="nf-table personnel-list"><thead><tr><th>사번</th><th>성명</th><th>소속·직책</th><th>입사일</th><th>상태</th><th>인사기록</th></tr></thead><tbody>
<?php foreach($records as $item): $p=$item['profile']; ?><tr><td><?= h($item['employee_no']) ?></td><td><?= h($p['name']??'') ?></td><td><?= h(department_label($p['team']??'').' · '.($p['role']??'')) ?></td><td><?= h($p['startDate']??'') ?></td><td><?= h($p['employment']??'') ?></td><td><a href="/personnel.php?role=admin&amp;id=<?= $item['id'] ?>">보기</a> · <a href="/personnel.php?role=admin&amp;id=<?= $item['id'] ?>&amp;edit=1">수정</a></td></tr><?php endforeach; ?>
<?php if(!$records): ?><tr><td colspan="6" class="personnel-empty">등록된 직원이 없습니다. 직원 등록에서 인사기록을 작성해 주세요.</td></tr><?php endif; ?>
</tbody></table></section>
<?php else: ?><section class="nf-card personnel-empty">아직 연결된 인사기록이 없습니다. 관리자에게 직원 계정 연결을 요청해 주세요.</section><?php endif; ?>
