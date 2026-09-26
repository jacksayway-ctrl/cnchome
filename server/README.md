# Cafe24 PHP application

Ubuntu 24.04, PHP 8.3 FPM, MySQL 8, Nginx HTTPS. PHP controllers and templates serve every application entry point. Employee/admin navigation is rendered according to the authenticated role before first paint. Login, grade/history, employee profiles and published payroll retain their existing DB APIs. Intake policies retain browser-local storage. Reception statuses now use the sales API; other prototype workflows retain their existing storage behavior. See [PHP migration and offline deployment](../docs/PHP_MIGRATION.md). Legacy HTML URLs redirect to PHP; `/preview.php?role=admin` and `/payroll.php?role=admin` require an administrator session.

## Deploy

Existing server config: `/etc/cnchome/database.json` (root:www-data, 0640), directory 0750. Never commit this file. The app user needs SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX and REFERENCES on `cnchome.*`. MySQL listens locally; do not expose port 3306.

From a root SSH terminal:

```sh
cd /opt/cnchome
git pull --ff-only origin main
bash server/deploy.sh
php server/bin/create-user.php admin admin insurance
```

The last command prompts for a display name and a hidden password twice (12–72 bytes). Existing accounts are never overwritten. Do not put passwords in commands, GitHub, screenshots or chat. Create an employee account with `php server/bin/create-user.php staff01 employee insurance`; departments: insurance, cosmetics, health. Account role and department are enforced by the API, not only by menu visibility.

The deployment first lints PHP, checks Nginx and prepares additive database tables, backs up web files to `/var/backups/cnchome/<timestamp>`, installs backend files outside webroot, then publishes endpoints and assets. It verifies PHP execution via local HTTPS and blocks public PHP endpoints if that check fails. Existing HTTPS configuration is not modified. File backups are not database backups.

## Acceptance on the actual server

1. Verify `/office.php` redirects to login when logged out and `/grade-api.php` returns 401.
2. Sign in as admin, open 그레이드 관리, set a test criterion, confirm and apply. Reload and check history and saved actor.
3. A second browser/account must see the same policy after 최신 기준 불러오기. Employee GET is limited to its own department; POST returns 403.
4. Two admins saving from the same old revision: the second gets 409 and retains its input. Re-load before editing again.
5. Future effective dates remain scheduled; previous snapshots remain intact. No hard deletion of history is exposed.
6. Log out and verify access is denied. Check `systemctl is-enabled certbot.timer` and renewal test.

Old browser-only criteria are **not** silently imported. Review and explicitly save the required table in the live portal. Existing payroll calculations and payroll confirmation are not connected to these DB rows yet. Staff can be registered using the HR screen or the CLI. Password reset, general attendance persistence and automated off-server database backups remain follow-up work; manual reviewed payroll publication already uses the HR API.

## 접수 상태와 실적 달력

`sales-api.php`와 `sales_records`가 접수 및 현재 상태를 저장하고 `sales_events`가 변경 이력을 보존합니다. 관리자는 전체, 직원은 본인 내역만 조회·변경할 수 있습니다. CSRF, 역할별 세션, 변경 버전, 중복 요청 키를 검사합니다. 관리자 업무현황의 보험·화장품 달력과 직원 실적/A/S 화면은 최초 접수일에 가접수·정상접수·A/S를 각각 집계하며, 열린 화면은 5초 간격으로 갱신합니다. 기존 `test_employee_data`는 테스트 자료 보기로 분리하며 실제 실적에 합산하지 않습니다. 급여 자동 산정에 새 실적을 연결하지는 않습니다.

보험은 접수일의 연도−출생연도+1인 세는나이를 적용합니다. 일반은 61세 이하, 실버는 62~70세이고 71세 이상은 등록되지 않습니다. 정책 텍스트·이미지는 변환 버튼으로 처리합니다. 일반/실버 제목·상품 열은 지역명과 분리하고, 혼합표는 두 상품의 정책으로 저장합니다. `수도권 4`는 서울·인천·경기 묶음의 공유 수량 4건, `광주주전남 1`은 광주·전남 묶음의 공유 수량 1건입니다. 정책표 자체는 기존 브라우저 저장 방식을 유지합니다.

검증: `php server/bin/check-sales.php`는 운영 DB에 접속하지 않는 SQLite 검증입니다. `node --test policy-input.test.cjs sales-workspace.test.cjs intake-code.integration.test.cjs` 및 `node scripts/check-php-browser.cjs`에서 정책 분류, 연령 경계, 수동 변환, 접수 상태 전환과 달력 자동 갱신을 확인합니다.

Session cookies require HTTPS, are HttpOnly and SameSite=Lax; idle timeout is one hour. Login limits are 20 attempts per source IP per 15 minutes. State-changing requests require CSRF tokens. Policies are validated server-side, stored as immutable snapshots with authenticated actor/time and guarded by a transactional revision lock. DB config is outside webroot; API failures do not output credentials.

## Verification

`node --test grade-settings.test.cjs grade-calendar.test.cjs`

With jsdom installed separately: `node scripts/check-grade-history-dom.cjs` and `node scripts/check-grade-server-dom.cjs`.

`php server/bin/check-policy.php` validates PHP policy rules. Actual PHP-FPM/MySQL integration must also pass the acceptance checks above on the server.

## Automatic Cafe24 deployment

Run `bash /opt/cnchome/server/enable-auto-deploy.sh` once as root after pulling this version. A systemd timer checks GitHub main every minute and deploys changed commits. It uses the existing public repository and does not require sharing root credentials or adding a GitHub password. Repository write access now authorizes server deployments; the deployment script executes with server administration privileges.

Local tracked edits stop automatic deployment rather than being discarded. A failed revision is attempted once; a subsequent fixed commit triggers another attempt. Status: `systemctl status cnchome-deploy.timer` and `journalctl -u cnchome-deploy.service -n 40 --no-pager`. Disable with `systemctl disable --now cnchome-deploy.timer`. To deliberately retry an unchanged failed revision after fixing server configuration: remove `/var/lib/cnchome-deploy/attempt` and run `systemctl start cnchome-deploy.service`. Web file backups remain under `/var/backups/cnchome`; monitor disk usage as versions accumulate. The timer's installation is only complete after the command succeeds on the actual server.


## 직원·급여 운영 흐름
- `hr_employees`: 직원 기본정보·계좌·계약, 서버 발급 사번 `cncYYYYMMDDNNN`, 직원 로그인 계정 1:1 연결.
- `hr_payroll`: 직원별 월 1건, 작성 → 게시 → 직원 수정요청 / 확인·확정. 확정 및 지난달 내역은 API에서도 변경을 거절합니다.
- `hr_payroll_events`: 게시 당시 명세서 스냅샷과 수정요청 메모를 보존합니다. 직원은 본인에게 게시된 버전만 조회합니다.
- 기본급은 등록 시급 × 관리자 검토 인정시간으로 계산하고 월급제는 등록 월 기본급을 사용합니다. 초기 인정시간은 근무요일과 입퇴사일에 따른 월 예정시간(하루 6시간)이며 실제 출결·휴일·주휴·성과수당·세금 자동 연동은 아닙니다. 관리자가 시간·수당·공제를 검토한 뒤 게시합니다.
- 직원등록에서 기존 직원 계정을 선택하거나 12자 이상 비밀번호를 지정해 사번을 아이디로 새 직원 계정을 생성합니다. 직책은 로그인 권한과 별개입니다.
- `/login.php?role=employee` / `/login.php?role=admin`: 로그인 구분을 서버에서 검증합니다.
- 배포 시 요청된 `user1` 직원 테스트 계정을 최초 1회 생성합니다. 이미 있으면 비밀번호와 기존 정보를 유지합니다. 실제 데이터는 자동 생성하지 않습니다.
- 주소 검색은 Kakao 우편번호 공식 스크립트를 사용합니다. 외부 연결 실패 시 직접 입력할 수 있습니다.
- 로컬 검증: `php server/bin/check-hr.php` (PDO SQLite 필요), `NODE_PATH=... node scripts/check-hr-dom.cjs` (jsdom 필요).
