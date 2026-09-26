# CNC PHP 구조 전환 · 2026-09-26

기준 소스: GitHub `jacksayway-ctrl/cnchome`의 `c589a33` 전체 파일과 이전에 요청한 관리자 메뉴 깜빡임·정책 원문 표 수정. 사이트 운영 DB의 실제 직원정보·급여자료는 내려받거나 패키지에 포함하지 않았습니다.

## 바뀐 구조

| 주소·파일 | 역할 |
| --- | --- |
| `/index.php`, `/office.php` | PHP 인증 확인 후 업무 화면 출력 |
| `/admin.php` | 관리자 세션으로 업무 화면 진입 |
| `/employee.php` | 직원 세션으로 업무 화면 진입 |
| `/login.php`, `/logout.php` | 기존 역할별 로그인·로그아웃 |
| `/office.php?role=admin&page=adminStaff` | 선택 메뉴를 새로고침해도 유지 |
| `/payroll.php?role=admin` | 관리자 전용 급여 계산 검토 |
| `/preview.php?role=admin` | 관리자 전용 예시 화면 |
| `/documents.php?role=admin` | 기존 운영 문서 목록·원문 |
| `server/views/` | 업무 화면·로그인·급여·문서 PHP 템플릿 |
| `server/config/navigation.json` | 관리자 6개 그룹 / 직원 8개 메뉴 |
| `office.js`, `office.css` | 지도·표·팝업·계산 등 브라우저 동작과 스타일 |

PHP는 인증·역할별 화면 출력·메뉴 라우팅·DB API를 담당합니다. 지도 확대, 달력, 입력 즉시 계산, OCR과 팝업에 필요한 JavaScript는 그대로 사용합니다. HTML 문자열을 PHP에서 읽어 정규식으로 고치던 운영 방식은 제거했습니다. `index.html`과 `payroll.html`은 이전 즐겨찾기를 PHP 주소로 안내하는 작은 호환 파일입니다.

관리자는 처음 응답부터 6개 그룹과 선택 그룹의 하위 메뉴만 받습니다. 전체 관리자 메뉴가 잠시 표시됐다가 없어지는 초기화가 없습니다. 직원 화면은 처음부터 본인 메뉴만 출력합니다. 정책표는 선택 거래처의 등록 원문을 GA → 한화 → 신한 → 추가 접수코드 순서로 지도 위에 표시합니다. 빈 정책은 `등록된 정책 없음`으로 표시합니다.

## 저장 범위

| 기능 | 이 전환에서의 처리 |
| --- | --- |
| 로그인·직원 기본정보·계좌·계약정보·그레이드 기준 이력·게시 명세서 | 기존 PHP/DB 저장 기능 유지 |
| 접수 정책표·거래처·접수코드 | 기존 브라우저 저장 방식 유지. 다른 컴퓨터와 서버 동기화는 별도 작업 |
| 실적·출결·A/S·일부 관리자 예시 업무 | 기존 예시 동작 유지. 운영 DB 기능으로 새로 구현한 것은 아님 |
| 급여 계산 검토 | 예시 계산용. 실제 확정·지급 API로 바뀌지 않음 |

기존 SQL 스키마와 업무 산식을 바꾸지 않습니다. 기존 DB 설정 `/etc/cnchome/database.json`을 그대로 사용하며 비밀번호는 패키지에 넣지 않습니다.

## GitHub 인증 없이 현재 Cafe24에 적용

배포 파일에는 전체 소스, 로컬 Git bundle, 설치 스크립트가 있습니다. 기존 `/opt/cnchome` 저장소가 패키지의 기준 버전과 연결되는지 검사한 뒤 fast-forward로만 적용합니다. 서버에 다른 변경이 있으면 멈추며 강제로 덮어쓰지 않습니다.

1. 다운로드한 `cnchome-php-release.tar.gz`를 새 PowerShell 창에서 서버로 복사합니다. `서버IP`는 SSH 접속에 사용한 주소입니다.

```powershell
scp "$env:USERPROFILE\Downloads\cnchome-php-release.tar.gz" root@서버IP:/root/
```

2. 기존 SSH 창에서 실행합니다.

```bash
cd /root
tar -xzf cnchome-php-release.tar.gz
cd cnchome-php-release
bash install.sh
```

설치는 PHP 구문·화면 검사, Nginx 설정 확인, 기존 웹 파일 백업 후 진행합니다. 로그인 계정과 DB 설정을 새로 만들거나 초기화하지 않습니다. 기존 배포 스크립트의 추가 테이블 마이그레이션·테스트 계정 최초 등록 절차는 유지합니다.

GitHub에 없는 로컬 버전을 설치하므로 자동 배포 타이머는 정지·비활성화됩니다. 같은 커밋을 GitHub에 업로드한 후 아래 두 명령으로 다시 켭니다.

```bash
cd /opt/cnchome
git push origin main
# 위 업로드 성공을 확인한 후에만 실행
systemctl enable --now cnchome-deploy.timer
```

GitHub 업로드 실패 시 PHP 사이트 사용에는 영향이 없고 자동 배포만 정지 상태로 유지됩니다. 설치 실패 시 마지막 오류와 `/var/backups/cnchome/` 백업 경로를 확인합니다. 웹 파일 백업은 DB 백업을 대신하지 않습니다. 이전 소스 커밋은 `/var/lib/cnchome-deploy/before-php-release`에 기록됩니다.

## 검사

- `php server/bin/check-views.php`: PHP 템플릿·29개 권한별 경로·문자열 안전 처리. `.build/`에 테스트 HTML 생성.
- `node --test *.test.cjs`: 기존 계산·정책·세션 검사.
- `php server/bin/check-policy.php`, `php server/bin/check-hr.php`: 정책 검증·직원/명세서 권한·수정 충돌 검사. HR 검사는 PDO SQLite 필요.
- jsdom을 별도 설치한 환경에서 `node scripts/check-admin-dom.cjs`, `node scripts/check-grade-server-dom.cjs`, `node scripts/check-hr-dom.cjs`, `node scripts/check-payroll-dom.cjs`.
- Playwright Chromium 환경에서 `node scripts/check-php-browser.cjs` (검사 전용 임시 웹서버 자동 실행): 테스트 자료로 첫 화면·전체 메뉴·새로고침·지도 위 정책표 확인.

운영 서버 PHP-FPM/MySQL·로그인 통합 검사는 설치 후 실제 서버에서 확인해야 합니다. 테스트 화면은 운영 개인정보를 사용하지 않습니다.
