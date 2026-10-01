# 페이지 안에서 자동 적용하고 복구하기

## 설치

`scripts/install.js` 전체를 읽어 선택한 탭의 페이지 JavaScript 실행 도구에 전달한다. 외부 스크립트 다운로드, eval, DOM script 태그 삽입을 추가하지 않는다. 도구가 함수 본문을 받으면 해당 표현식의 결과를 반환하도록 감싸고, 표현식을 받으면 그대로 전달한다.

반환값의 `installed: true`를 확인한다. 반복 실행은 중복 패치하지 않는다. 다른 도구가 이후 함수를 교체하면 configure가 실패한다. 이 경우 restore 결과를 확인하고 충돌을 보고한다.

## 규칙 적용

실제 관측값 또는 현재 코드로 확인한 값만 입력한다. 아래는 D-1 요청이 POST이고 현재 origin에 있다는 사실이 확인됐을 때의 예다.

```js
window.__examBrowserQA.configure({
  url: new URL('/api/quiz/submitAnswer', location.origin).href,
  method: 'POST',
  mode: 'network-error'
})
```

A-3은 관측한 axios 조회 요청을 골라 `mode: 'http-401'`로 설정한다. 응답 본문만 바꾸는 것이 아니라 fetch Response 또는 XHR에서 읽는 status를 401로 만든다. 실제 서버나 로그인 쿠키는 변경하지 않는다. HTTP 네트워크 로그에 서버 401이 찍히는 방식은 아니다.

설정은 항상 한 규칙이다. origin, pathname, HTTP method를 정확히 비교한다. 쿼리는 비교와 저장에서 제외하므로 같은 경로의 다른 문제/파일도 영향을 받을 수 있다. query 단위 격리가 필수면 지원하지 않는다고 말한다. 와일드카드나 전체 요청 차단을 임의로 추가하지 않는다.

## 확인

```js
window.__examBrowserQA?.status() ?? { installed: false }
```

`installed: true`, 규칙 일치, hits=0이면 설정 완료일 뿐이다. 앱의 다음 실제 요청에서 hits가 증가해야 앱에 적용된 것이다. 캐시 때문에 요청이 없으면 실패가 아니다. 요청을 유발하려고 임의로 새로고침하지 않는다.

도구에서 만든 fetch/XHR는 그 도구의 실행 환경만 확인한다. 앱과 같은 JavaScript 환경에서 실행되는지 확인할 수 없으면 앱 적용 미확인으로 남긴다. 위험한 제출 대신 조회 케이스로 먼저 확인할 수 있지만, 사용자가 지정한 케이스를 임의로 바꾸지 않는다.

## 복구

```js
window.__examBrowserQA?.restore() ?? { restored: true, reason: '현재 실행 환경에 helper 없음' }
```

`restored: true`면 원래 함수를 복원했다. 대기 중인 모의 XHR는 abort로 종료하며 서버로 재전송하지 않는다. 타 도구가 래퍼를 바꿨다면 `conflicts`와 `mockDisabled: true`를 보고한다. 그 도구의 함수를 덮어쓰지 않는다. 새로고침이나 전체 페이지 이동으로 초기화할 수 있지만 시험 상태에 영향을 주므로 사용자 선택이 필요하다.

## 구현 범위

- fetch network-error: Promise를 TypeError로 거절한다. http-401: 모의 Response를 반환한다.
- XHR network-error: 서버에 send하지 않고 status 0, readystatechange, error, loadend를 발생시킨다. http-401: status 401, JSON 오류 본문, load, loadend로 axios가 응답 오류를 처리하게 한다.
- 브라우저 네트워크 스택 전체를 구현하지 않는다. XHR의 모든 중간 readyState, 업로드 progress, responseXML, 타이밍을 재현하지 않는다. axios 비동기 JSON 요청이 주 대상이다.
- 일치하는 동기 XHR는 지원 오류로 중단하며 서버에 전송하지 않는다.
- 이미 전송한 요청, worker, iframe, 저장된 원본 함수, HTML 이미지/스크립트 탐색 요청, WebSocket, WebRTC는 가로채지 않는다. navigator.onLine도 바꾸지 않는다.
- 설치/규칙 확인과 앱 동작 확인을 구분한다. 자동 복구가 앱의 이미 열린 오류 화면, 시험 퇴장, 캐시까지 되돌리는 것은 아니다.

이벤트 의미 참고: [MDN XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest_API/Using_XMLHttpRequest).
