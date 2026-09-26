# Cafe24 grade database release

Ubuntu 24.04, PHP 8.3 FPM, MySQL 8, Nginx HTTPS. This release implements login and persisted grade policy/history only. Reception, attendance, payroll and staff administration remain demos. The original static preview is preserved at `/preview.html`; the deployed root goes to `/office.php`.

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

Old browser-only criteria are **not** silently imported. Review and explicitly save the required table in the live portal. Existing payroll calculations and payroll confirmation are not connected to these DB rows yet. Staff provisioning is CLI-only in this release. Password-reset UI, payroll/attendance/reception persistence and scheduled off-server database backups remain follow-up work before full production use.

Session cookies require HTTPS, are HttpOnly and SameSite=Lax; idle timeout is one hour. Login limits are 20 attempts per source IP per 15 minutes. State-changing requests require CSRF tokens. Policies are validated server-side, stored as immutable snapshots with authenticated actor/time and guarded by a transactional revision lock. DB config is outside webroot; API failures do not output credentials.

## Verification

`node --test grade-settings.test.cjs grade-calendar.test.cjs`

With jsdom installed separately: `node scripts/check-grade-history-dom.cjs` and `node scripts/check-grade-server-dom.cjs`.

`php server/bin/check-policy.php` validates PHP policy rules. Actual PHP-FPM/MySQL integration must also pass the acceptance checks above on the server.
