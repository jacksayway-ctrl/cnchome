# TM OFFICE · cnchome

회사 관리 시스템의 직원용 정적 미리보기입니다. 모든 업무 자료는 예시입니다.

- 미리보기: https://jacksayway-ctrl.github.io/cnchome/
- 로컬 실행: 저장소를 내려받아 `index.html`을 브라우저에서 엽니다. 별도 CDN·지도 API·외부 폰트 연결은 없습니다.
- 외부 자료의 출처 링크는 수동 참고용이며 실행 의존성이 아닙니다.
- 실제 로그인, 관리자 저장, 여러 직원 간 동기화, 접수·급여 정산 서버는 아직 구현되지 않았습니다.
- 실제 업무 데이터는 공개 저장소에 저장하지 않습니다.

자체 운영 구조와 구현 범위는 [자체 운영 설계](docs/SELF_HOSTED_ARCHITECTURE.md)를 참고하세요.

## 급여 계산 개발

- [관리자 홈](https://jacksayway-ctrl.github.io/cnchome/#adminHome): 처리 대기 업무와 관리자 메뉴.
- [관리자 메뉴 점검·구현 범위](docs/ADMIN_MENU_REVIEW.md): 17개 메뉴와 예시 업무 흐름, 실제 운영 연결 전 제한 사항.

- [급여 계산 검토 화면](payroll.html): 변경 가능한 예시로 확정 운영 기준을 확인합니다. 실제 지급·저장은 수행하지 않습니다.
- [전체 운영 기준](docs/payroll-requirements.md)과 [구현 현황](docs/PAYROLL_IMPLEMENTATION.md)을 함께 관리합니다.
- 운영 기준은 질문 426번까지 반영했습니다. [309~426번 추가 결정과 출처](docs/payroll-decisions-309-426.md)를 확인할 수 있습니다. 추가 문서의 모든 기능이 현재 계산 화면에 구현된 것은 아닙니다.
- 계산 검증: `node --test payroll-engine.test.cjs`
- 기존 직원 그레이드 화면은 이전 참고표의 계산입니다. 새 급여 계산 모듈과 운영 서버 연동은 구분합니다.
