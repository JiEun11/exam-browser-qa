# exam-browser-qa

QA 링크를 확인하고 점검 케이스를 제안한 뒤, 사용자 Chrome에서 API 실패 조건을 모의하는 Claude 스킬입니다.

## 설치

[exam-browser-qa.zip](exam-browser-qa.zip)을 다운로드해 Claude의 스킬 업로드 기능으로 등록합니다. Chrome 연결 등 실행 환경별 준비는 [설치 안내](references/setup.md)를 참고하세요. 사용자는 Node.js나 테스트 의존성을 설치할 필요가 없습니다.

## 사용

```text
exam-browser-qa 스킬을 사용해 줘.
QA할 링크: [필수 URL]
피그마 시안: [선택]
점검하고 싶은 에러 케이스: [선택]
```

선택 입력이 없으면 QA 화면에서 확인한 기능으로 케이스를 제안합니다. 케이스 표를 사용자가 확인한 뒤 선택한 조건을 적용합니다.

QA 링크와 케이스가 확정된 뒤에는 “로그인 만료 페이지 세팅해줘”처럼 요청할 수 있습니다. “원래대로”라고 요청하면 모의 규칙을 해제합니다.

## 동작과 한계

- 페이지의 fetch와 XMLHttpRequest를 일시 교체해 선택한 요청의 네트워크 실패 또는 401을 모의합니다.
- 앱 소스, 서버, 로그인 쿠키는 변경하지 않습니다. 제출과 초기화 등 데이터 변경 동작은 기본적으로 QA 담당자가 수행합니다.
- 새로고침과 전체 페이지 이동 시 패치가 사라집니다. 기존 WebSocket, WebRTC, 실제 회선 단절은 재현하지 않습니다.
- 페이지 JavaScript 실행 도구가 필요합니다. 격리된 실행 환경에서는 앱에 적용되지 않을 수 있어 실제 앱 요청으로 확인해야 합니다.
- 복구해도 앱에 표시된 만료 화면은 남을 수 있습니다.

## 개발 검증

Node.js 22 이상에서 실행합니다.

```sh
npm install
npm test
```

테스트는 로컬 HTTP 서버와 jsdom에서 요청 미전송, 정상 요청 유지, axios 401 처리, 복구를 확인합니다. 실제 Claude in Chrome 연결 및 화면 표시 검증은 아직 수행하지 않았습니다.

스킬 지침은 [SKILL.md](SKILL.md), 케이스 참고는 [cases.md](references/cases.md)에 있습니다. ZIP에는 실행에 필요한 SKILL.md, references, scripts만 포함합니다. 지침이나 스크립트를 바꾸면 ZIP도 함께 갱신해야 합니다.
