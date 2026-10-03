# 씨앤씨 · PHP 업무 관리

현재 GitHub 소스 전체를 PHP 진입점·템플릿·정적 자산으로 분리한 Cafe24용 업무 관리 프로그램입니다.

- 진입: `/office.php`, `/admin.php`, `/employee.php`
- 로그인: `/login.php?role=admin` / `/login.php?role=employee`
- 급여 계산 검토: `/payroll.php?role=admin`
- 운영 문서: `/documents.php?role=admin`
- [전환 내용·저장 범위·GitHub 없이 설치](docs/PHP_MIGRATION.md)
- [서버 배포·DB 운영](server/README.md)

`server/public`은 공개 PHP 진입점, `server/views`는 화면 템플릿, `server/lib`는 인증·DB·출력 처리, `server/config`는 메뉴입니다. `office.js`·`office.css` 등은 브라우저의 지도·달력·팝업·계산 동작을 보존합니다. 기존 HTML 파일은 PHP 주소로 이동시키는 호환용입니다. GitHub Pages만으로는 PHP를 실행할 수 없습니다.

로그인·직원정보·그레이드·게시 명세서는 기존 PHP/DB 기능을 유지합니다. 접수 정책표·거래처·접수 코드는 서버 MySQL에 저장되어 직원 로그인 화면과 공유됩니다. 기존 브라우저 정책은 다시 등록해야 합니다. 다른 예시 업무의 저장 범위는 각 기능 안내를 따릅니다. [기능별 저장 범위](docs/PHP_MIGRATION.md#저장-범위)를 확인하세요.

## 검증

```bash
npm ci
php server/bin/check-views.php
php server/bin/check-business-calendar.php
php server/bin/check-personnel.php
npm test
npm run test:dom
php server/bin/check-policy.php
php server/bin/check-hr.php
```

`check-views.php`가 만든 `.build` 파일로 기존 DOM 검사와 PHP 브라우저 검사를 실행합니다. 검사 전용 Node/PHP 의존성은 운영 서버의 화면 동작에 필요하지 않습니다. DB 비밀번호와 실제 직원자료는 저장소·배포 패키지에 포함하지 않습니다.

화면 변경은 `office.js`, 지도 도형은 `region-geometry.js`에서 관리합니다. 정적 파일 URL에는 내용 해시가 붙어 변경된 파일만 캐시를 갱신합니다. Node 검사는 위 `package.json`의 지원 버전을 사용합니다.
