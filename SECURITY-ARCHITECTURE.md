# 보안 작업 상태
검토일: 2026-09-24

사용자 결정: 서버가 필요한 보안 작업은 추후 진행한다.

## 현재 적용
- 페이지 검색 노출 방지 지시: noindex, nofollow, noarchive, nosnippet, noimageindex.
- 기존 referrer=no-referrer 및 CSP 유지.
- 공개 GitHub Pages 미리보기는 계속 사용한다.
- 위 설정은 협조적인 검색엔진에 대한 지시이며 로그인, 악성 봇 차단, 실자료 보호를 대신하지 않는다. 기존 검색 결과 삭제도 즉시 보장하지 않는다.

## 보류한 서버 작업
- 사내 도메인과 비공개 원본 서버, HTTPS 접근 통제, MFA 직원 인증.
- API마다 계정 활성 상태·역할·소속·대상 자료 권한 검증.
- 로그인 실패 및 요청 속도 제한, 봇 탐지, 감사 로그.
- 중앙 세션 폐기, CSRF 방어, 비공개 DB 및 암호화 백업.
- localStorage 업무 저장을 인증된 서버 API로 이전.
- 검증한 OCR 실행 파일·모델의 내부 배포 및 CSP 강화.
- 공개 원본 우회 경로 제거, 권한·장애·복원 인수 시험.

운영 서버·인증 서비스는 생성하거나 변경하지 않았다. 서버 보안은 적용 완료 상태가 아니다.
'키워드 검출'은 우선 검색엔진 수집·노출 방지로 해석했다. 사내 금칙어/개인정보 탐지를 뜻한다면 별도 요구사항으로 확인한다.

## 공식 참고
- https://developers.google.com/search/docs/crawling-indexing/robots/intro
- https://nginx.org/en/docs/http/ngx_http_auth_request_module.html
- https://oauth2-proxy.github.io/oauth2-proxy/configuration/overview/
- https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
