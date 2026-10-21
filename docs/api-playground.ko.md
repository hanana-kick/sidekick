# API 플레이그라운드: 사이트 미리보기와 봇 제어

사이트 미리보기가 중심이며 오른쪽 아래 **봇 제어** 버튼으로 설정·실행·JavaScript/React 코드·진단 패널을 엽니다. 닫기 또는 Escape로 닫으면 버튼에 포커스가 돌아옵니다. 모달이 아니므로 뒤쪽 사이트도 사용할 수 있습니다. 닫아도 봇, 입력값, 생성 코드, Studio 설정, 언어·프레임워크는 유지됩니다. 작은 화면에서는 한 열로 표시되고 패널 내부에서 스크롤됩니다.

기본 데모는 부모 페이지에 있습니다. 빈 곳을 눌러 봇을 이동하거나 `moveToElement`의 대상으로 `#preview-target`을 사용하세요. 표시·작업·집 예제를 실행하면 대상이 있는 기본 데모로 돌아갑니다. 기술 레슨 및 편집기 해시 링크는 패널을 열고, Guide의 시나리오 문맥 링크는 기존 전용 실습 화면을 유지합니다.

## 다른 사이트 불러오기

완전한 HTTP(S) URL을 입력하고 **불러오기**를 누르세요. 주소 쿼리만으로 외부 사이트를 자동 로드하지 않습니다. HTTPS 페이지에서는 HTTP 미리보기를 거부하고, URL 안의 사용자 이름·비밀번호 및 다른 프로토콜도 허용하지 않습니다. 새로고침은 마지막으로 불러온 URL을 다시 요청하며 미제출 입력값은 사용하지 않습니다. **기본 데모**로 돌아오면 iframe을 제거합니다.

외부 사이트는 CSP frame-ancestors 또는 X-Frame-Options로 임베딩을 막을 수 있습니다. 이를 우회하거나 프록시로 헤더를 제거하지 않습니다. iframe의 load 이벤트로 성공을 확정할 수 없으므로 “미리보기 요청됨”으로 안내합니다. 빈 화면이면 기본 데모를 사용하세요.

봇은 부모 페이지의 뷰포트 위에 표시될 뿐 외부 사이트에 주입되지 않습니다. iframe 내부 요소 선택과 포인터 추적은 지원하지 않습니다. 기본적으로 iframe 클릭·스크롤은 해당 사이트로 전달됩니다. **사이트 대신 클릭을 받아 봇 이동**을 켜면 사이트 조작을 대신하는 클릭 레이어가 생깁니다. 기본값은 꺼짐이며 다시 끄면 사이트를 조작할 수 있습니다. 닫힌 제어 패널은 클릭이나 키보드 포커스를 가로채지 않습니다.

iframe은 렌더링용 스크립트만 허용하는 불투명 출처 sandbox를 사용합니다. 폼 제출, 팝업, 다운로드, 상위 페이지 이동 및 장치 권한은 허용하지 않습니다. 로그인·저장소가 필요한 사이트는 제대로 표시되지 않을 수 있습니다. 브라우저의 쿠키·네트워크 정책은 적용되며 익명 탐색을 보장하지 않습니다.

## 분석과 검증

입력 URL·경로·쿼리·해시·텍스트는 미리보기 요청에만 사용하며 저장소, 페이지 주소 기록, 생성 코드, GA4에 넣지 않습니다. 사이트 전용 허용 목록 분석은 유지되고 라이브러리에는 포함되지 않습니다. 실제 URL 로드는 해당 사이트에 네트워크 요청을 보내며 referrer는 보내지 않습니다.

단위 테스트는 패널 상태·포커스·입력 보존, URL 검증, 자동 로드 방지, sandbox, 로드 상태 표시, 데모 복구, 분석 제외를 검사합니다. 준비된 브라우저 테스트는 320/1280px, 키보드, 클릭 통과, 임베딩 거부를 검사합니다. 시각 검증은 지원되는 CI에서 실제 브라우저 실행 결과를 확인해야 합니다.

참고: [iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe), [frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).


## 텍스트 대사 API

say(text, options)는 음성 없이 일반 텍스트 말풍선을 표시하고 즉시 void를 반환합니다. 새 호출은 기존 대사와 타이머를 교체하며 큐에 쌓지 않습니다. clearSpeech()는 void를 반환하고 여러 번 호출해도 안전합니다. 완료 Promise나 종료 이벤트는 없습니다.

duration은 0–60000ms이며 기본값은 5000입니다. 0은 수동 해제까지 유지합니다. placement는 auto(기본값), top, bottom이며 공간이 부족하면 반대편으로 전환합니다. dismissible의 기본값은 false입니다. 닫기 버튼을 사용할 때 dismissLabel로 접근 가능한 현지화 이름을 지정하세요.

공백뿐인 문자열, 1000자를 초과하는 문자열, 잘못된 옵션은 기존 대사를 변경하지 않고 TypeError를 던집니다. HTML을 해석하지 않습니다. 문서 숨김, 화면 밖 이동, exit(), 숨김 presence 및 DOM 제거 시 대사가 사라지고 다시 표시되지 않습니다. 앱의 초기화에서는 clearSpeech()를 호출하세요.

작은 DOM 말풍선은 봇의 보수적인 DOM 경계를 따라가며 현재 iframe/뷰포트 안에 제한됩니다. 실제 픽셀 윤곽 추적은 아닙니다. 긴 텍스트는 제한된 영역 안에서 줄바꿈되며 스크롤할 수 있습니다. 넘치는 메시지만 키보드 포커스와 포인터·터치 스크롤을 허용하며 닫기 버튼은 스크롤 영역 밖에 유지됩니다. 전체 텍스트는 polite 상태 알림으로도 제공됩니다. 포커스를 이동하지 않고 닫기 버튼과 넘치는 텍스트 외에는 클릭을 가로채지 않습니다. 추가 렌더 루프, GPU 패스, 오디오 또는 확대된 캔버스가 없습니다.

```js
const bot = document.querySelector('sidekick-avatar');
bot.say("여기가 더 저렴해요!", {
  duration: 5000, placement: 'auto',
  dismissible: true, dismissLabel: "대사 닫기"
});
// React: botRef.current?.say(text, options);
// Reset / cleanup:
bot.clearSpeech();
```

TypeScript: `SpeechOptions` from `@hanana-kick/sidekick/register` or `@hanana-kick/sidekick/react`. Method-only API; no HTML attributes or declarative React speech props.

배치 제한: 봇의 CSS zoom 또는 조상 요소의 transform(개별 translate/rotate/scale 포함), perspective, CSS zoom은 기존 대사를 바꾸기 전에 TypeError를 발생시킵니다. body와 html에는 filter, backdrop-filter, contain, will-change, content-visibility 등 고정 위치 기준을 바꾸는 스타일을 사용하지 마세요. 봇 자체의 transform은 지원합니다. 대사가 표시되는 동안 이 제한을 유지하고 조상의 배치를 바꾸기 전에 clearSpeech()를 호출하세요.
