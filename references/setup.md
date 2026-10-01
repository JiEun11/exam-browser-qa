# 실행 환경별 최초 준비

스킬은 절차를 제공한다. Chrome 제어 권한이나 DevTools 도구를 설치하는 프로그램이 아니다. 확장 설치와 사이트 접근 허용은 사용자가 수행한다. 최초 등록 이후에는 매번 재설치를 안내하지 않는다.

## 공통: 스킬 등록

배포 ZIP을 Claude의 스킬 업로드 기능으로 등록하고 활성화한다. 메뉴는 현재 표시된 UI를 따른다. 스킬 메뉴가 없으면 계정/조직의 스킬 및 코드 실행 허용 상태를 확인한다. ZIP 안에는 `exam-browser-qa/SKILL.md`와 `references/`, `scripts/`가 함께 있어야 한다.

참고: [사용자 스킬 제작](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills), [스킬 사용](https://support.claude.com/en/articles/12512180-use-skills-in-claude).

## Chrome 사이드 패널

1. [공식 Chrome 안내](https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome)에 있는 Chrome Web Store 링크에서 Claude in Chrome을 설치한다.
2. 확장을 열어 Claude 계정으로 로그인한다.
3. 테스트할 시험실을 열고 해당 사이트의 접근 요청을 확인해 허용한다
4. “exam-browser-qa 스킬로 이 QA 링크의 점검 케이스를 먼저 정리해 줘: [QA 링크]”라고 요청한다. 피그마 링크와 직접 점검할 에러 케이스가 있으면 함께 전달한다.
5. 스킬 내용과 현재 탭을 모두 사용할 수 있는지 확인한다. 해당 계정/사이드 패널에서 스킬이 로드되지 않으면 스킬을 사용할 수 있는 Claude 작업 환경으로 이동하도록 안내한다. 모든 패널 버전에서 지원된다고 단정하지 않는다.

## Claude 웹 또는 데스크톱에서 사용자 Chrome 연결

Chrome 확장 준비 후 현재 Claude 환경의 브라우저 연결 안내에 따라 사용자 Chrome을 연결한다. 데스크톱 연결이나 앱 실행이 요구되면 해당 안내를 따른다. Claude 내장 브라우저로 자동 대체하지 않는다. 브라우저 종류, 대상 탭, 사이트 접근 가능 여부를 확인한 뒤 시작한다.

현재 탭의 페이지 JavaScript 실행 기능을 확인한다. 이 스킬은 DevTools 조작 권한을 요구하지 않는다. 네트워크 조회나 페이지 클릭만 가능하면 자동 세팅을 수행할 수 없다.

## Claude Code

동일한 폴더를 프로젝트의 `.claude/skills/exam-browser-qa/` 또는 개인 스킬 위치에 배치한다. `claude --chrome`으로 시작하고 `/chrome`에서 연결을 확인한다. 비개발자에게 CLI 설치를 필수로 요구하지 않는다.

참고: [Claude Code의 Chrome 연결](https://code.claude.com/docs/en/chrome).

## 페이지 JavaScript 실행을 사용할 수 없을 때

현재 도구와 정책에서 JavaScript 실행이 허용되는 연결이 필요하다고 알린다. 실행 제한을 우회하지 않는다. 사용자가 DevTools를 직접 조작하는 방식으로 자동 전환하지 않는다.

실행 기능이 있어도 도구의 격리된 환경에서만 적용될 수 있다. 실제 앱 요청에 적용됐는지 스킬의 확인 절차로 구분한다. 비개발자가 콘솔에 코드를 붙여 넣거나 매번 파일을 수정할 필요는 없다.
