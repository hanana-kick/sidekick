import { emotionScenarioGroup } from './emotion-scenarios.js';
/** Application intentions, grouped by what the companion helps the user do. */
export const scenarioGroups = [
  { id: 'work', title: '작업 상태', groups: [
    { id: 'waiting', title: '대기와 진행', cases: [
      { id: 'loading', title: '로딩 인디케이터 주시', sentence: '봇이 로딩 인디케이터를 보면서 기다리고 있다.', kind: 'wait', app: 'loading', hint: '데이터를 불러오는 동안 기다리고, 완료 버튼을 누르면 작업을 마칩니다.' },
      { id: 'upload', title: '파일 업로드 기다리기', sentence: '봇이 업로드 진행 상황을 보면서 기다리고 있다.', kind: 'wait', app: 'upload', hint: '진행률을 올려 보세요. 실제 파일을 전송하지 않는 업로드 시나리오입니다.' },
    ] },
    { id: 'results', title: '결과 피드백', cases: [
      { id: 'success', title: '저장 완료 축하', sentence: '봇이 저장된 결과를 바라보며 완료를 축하하고 있다.', kind: 'celebrate', app: 'success', hint: '저장을 누르면 결과 카드와 봇이 함께 성공 상태로 바뀝니다.' },
      { id: 'failure', title: '실패 후 재시도 안내', sentence: '봇이 실패한 작업을 알려주고 재시도를 기다리고 있다.', kind: 'attention', app: 'failure', hint: '실패한 요청을 확인하고 재시도하면 대기 상태로 돌아갑니다.' },
    ] },
  ] },
  { id: 'content', title: '콘텐츠 검토', groups: [
    { id: 'lists', title: '목록과 선택', cases: [
      { id: 'review', title: '리스트 순차 검토', sentence: '봇이 리스트의 각 항목을 차례로 검토하고 있다.', kind: 'review', app: 'review', hint: '세 항목을 순서대로 검토합니다. 현재 항목과 전체 진행 상황을 함께 확인하세요.' },
      { id: 'selection', title: '선택 항목에 집중', sentence: '봇이 사용자가 선택한 항목을 바라보며 집중하고 있다.', kind: 'attention', app: 'selection', hint: '항목을 직접 선택하면 봇의 관심 대상이 그 항목으로 바뀝니다.' },
    ] },
    { id: 'reading', title: '읽기와 탐색', cases: [
      { id: 'paragraph', title: '문단별 읽기 안내', sentence: '봇이 지금 읽고 있는 문단을 안내하고 있다.', kind: 'attention', app: 'paragraph', hint: '다음 문단을 누를 때만 읽는 위치를 옮깁니다. 자동 검토와 다른 사용자 주도 흐름입니다.' },
      { id: 'search', title: '검색 결과 검토', sentence: '봇이 새로 검색된 결과를 차례로 살펴보고 있다.', kind: 'review', app: 'search', hint: '검색어로 결과를 좁힌 뒤 검토하세요. 결과가 없으면 검토를 시작하지 않습니다.' },
    ] },
  ] },
  { id: 'guidance', title: '사용자 안내', groups: [
    { id: 'forms', title: '폼 입력', cases: [
      { id: 'input', title: '입력할 위치 안내', sentence: '봇이 입력란을 바라보며 사용자의 입력을 기다리고 있다.', kind: 'wait', app: 'input', hint: '이름을 입력하고 확인하면 기다림을 끝냅니다. 입력값은 서버로 보내지 않습니다.' },
      { id: 'validation', title: '잘못된 입력 안내', sentence: '봇이 수정이 필요한 입력란을 알려주고 있다.', kind: 'attention', app: 'validation', hint: '형식 검사를 실행하면 문제가 있는 입력란으로 관심을 옮깁니다.' },
    ] },
    { id: 'navigation', title: '행동과 단계', cases: [
      { id: 'action', title: '다음 행동 안내', sentence: '봇이 다음에 누를 버튼을 안내하고 있다.', kind: 'attention', app: 'action', hint: '다음 행동 버튼을 누르면 안내를 마치고 완료를 표시합니다.' },
      { id: 'onboarding', title: '단계별 온보딩', sentence: '봇이 현재 온보딩 단계의 요소를 안내하고 있다.', kind: 'attention', app: 'onboarding', hint: '이전·다음 버튼으로 단계를 바꾸세요. 각 단계는 실제로 다른 요소를 안내합니다.' },
    ] },
  ] },
];
scenarioGroups.push(emotionScenarioGroup);
export const scenarios = scenarioGroups.flatMap(major => major.groups.flatMap(middle => middle.cases.map(item => ({ ...item, major: major.title, middle: middle.title }))));
export const scenarioById = id => scenarios.find(item => item.id === id) ?? scenarios[0];
