<section class="nf-card intake-live" data-intake-live>
 <div class="nf-actions intake-live-heading"><h2>전체 접수 관리</h2><span class="intake-live-indicator">● 실시간</span><span data-live-status role="status">접수 목록을 불러오는 중입니다.</span><button type="button" data-live-refresh>지금 새로고침</button><button type="button" data-live-pause aria-pressed="false">자동 갱신 일시정지</button></div>
 <p class="nf-muted">보험 · 화장품 · 건강보조식품의 실제 접수를 최신 등록순으로 확인합니다. 5초마다 자동 갱신됩니다.</p>
 <form class="intake-live-filters" data-live-filters><label>부서 <select name="team"><option value="">전체 부서</option><?php foreach(management_departments() as $key=>$label): ?><option value="<?= view_h($key) ?>"><?= view_h($label) ?></option><?php endforeach ?></select></label><label>이름 또는 전화번호 <input type="search" name="q" maxlength="80" placeholder="이름 · 전화번호"></label><button type="submit">검색</button><button type="reset">초기화</button></form>
 <div class="intake-live-counts" role="group" aria-label="접수 상태별 조회"><?php foreach([''=>'전체 접수','pending'=>'가접수','normal'=>'정상접수','as'=>'A/S'] as $key=>$label): ?><button type="button" data-live-filter="<?= $key ?>" aria-pressed="<?= $key===''?'true':'false' ?>"><?= $label ?> <strong data-live-count="<?= $key ?>">—</strong>건</button><?php endforeach ?></div>
 <div class="intake-live-arrivals" data-live-arrivals role="status" hidden></div>
 <div class="nf-table-wrap"><table class="nf-table intake-live-table"><thead><tr><th>등록일시</th><th>최초 콜 날짜</th><th>부서</th><th>상담원</th><th>고객명</th><th>전화번호</th><th>지역</th><th>접수 상태</th><th>상세</th></tr></thead><tbody data-live-rows><tr><td colspan="9">접수 목록을 불러오는 중입니다.</td></tr></tbody></table></div>
 <div class="intake-pagination"><button type="button" data-live-page="prev" disabled>이전</button><span data-live-pagination>1 / 1 페이지</span><button type="button" data-live-page="next" disabled>다음</button></div>
</section>
<script src="<?= view_h(asset_url('intake-live.js')) ?>" defer></script>
