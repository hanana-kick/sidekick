# 부위별 키프레임 애니메이션

기존 motion.to의 일회성 트윈과 별도로, 선언형 클립을 재생·정지·탐색할 수 있습니다. 모든 트랙은 렌더러의 기존 공통 시계를 사용하며 추가 타이머나 렌더 루프를 만들지 않습니다.

```js
bot.setPartAnimation({
  duration: 2, // 초
  loop: true,
  tracks: [
    { target: 'body', channel: 'rotation', keyframes: [
      {time: 0, value: [0, 0, -.1]},
      {time: 1, value: [0, 0, .1]},
      {time: 2, value: [0, 0, -.1]},
    ] },
    { target: {accessory: 'my-badge'}, channel: 'position', interpolation: 'smooth', keyframes: [
      {time: 0, value: [0, 0, 0]},
      {time: 1, value: [0, 0, .1]},
      {time: 2, value: [0, 0, 0]},
    ] },
    { target: 'leftEye', channel: 'weights', keyframes: [
      {time: 0, value: [0, 0]}, // [smile, blink]
      {time: 1, value: [1, 0]},
    ] },
  ],
});
bot.pausePartAnimation(); // 다른 봇 동작은 계속
bot.seekPartAnimation(.75);
bot.playPartAnimation(); // 현재 위치부터 재개
bot.clearPartAnimation(); // 기존 동작 채널로 복귀
```

## 타깃과 채널

- body / rotation: [x,y,z] 라디안 Euler 회전. 기존 몸체 방향(bodyOrientation)과 별도입니다.
- face / uv: [u,v], 각각 -.5..+.5.
- leftEye 또는 rightEye / weights: [smile,blink], 각각 0..1.
- {accessory: instanceId} / rotation, position, scale: 세 성분 벡터.
- {accessory: instanceId} / opacity: 0..1 숫자.

내장 액세서리와 장착 완료된 플러그인 액세서리 모두 instanceId로 지정합니다. 아직 로딩 중이거나 존재하지 않는 ID는 setPartAnimation에서 거절합니다. 장비를 제거하면 그 트랙의 대상은 화면에서 사라집니다. 같은 ID를 다시 장착하면 현재 클립 시점의 값이 적용되므로 새 장비에 이어 적용하고 싶지 않다면 클립을 먼저 clear하세요.

position은 부착점 로컬 모델 단위, scale은 부착점 원점 기준 배율입니다. rotation은 기존 transform과 같은 Euler 성분 선형 보간이며, quaternion 최단 회전이 아닙니다. 예를 들어 +π에서 -π는 0을 지나 회전합니다. 각 성분은 ±2π 이내입니다. 플러그인 메쉬의 로컬 +Z는 몸체 바깥 방향입니다. 몸체 이동·회전·모핑을 따르는 부착 프레임 위에서 액세서리 자신의 변환이 합성됩니다.

## 시간과 충돌 규칙

setPartAnimation은 클립 로컬 시간 0에서 시작합니다. pause/play/seekPartAnimation은 클립만 제어하며 봇 전체의 paused/time을 바꾸지 않습니다. 봇 전체를 paused로 두면 공통 시계도 멈추므로 클립 역시 멈춥니다. 기존 seek(seconds)는 공통 시계를 변경하므로 진행 중인 클립의 상대 시간에도 영향을 줍니다. 클립만 탐색하려면 seekPartAnimation을 사용하세요.

클립이 명시한 채널은 기존 motion.to/활동의 해당 표현보다 우선합니다. 지정하지 않은 채널은 계속 기존 동작을 따릅니다. 눈 weights 트랙은 해당 눈의 자동 깜빡임을 덮어씁니다. clearPartAnimation은 클립을 제거하고, 그동안 진행된 기존 동작의 현재 값으로 즉시 복귀합니다. 이전 프레임을 복원하거나 트윈을 되감지는 않습니다. 현재 API는 동시에 하나의 클립을 설치하며, 그 안에 여러 부위 트랙을 병렬로 넣습니다. 새 set은 이전 클립 전체를 대체합니다.

기본 보간은 linear이며 smooth는 구간별 smoothstep입니다. 키프레임 시간은 0..duration 안에서 엄격히 증가해야 합니다. 첫 키 이전과 마지막 키 이후는 끝 값을 유지합니다. 비반복 클립은 0..duration으로 클램프하고, 반복 클립은 duration으로 나눈 양의 나머지로 샘플링합니다. 반복에서 정확히 duration인 시점은 0입니다. 공개 seekPartAnimation은 0..86400초를 받습니다. 순수 samplePartAnimation 함수는 음수 시간도 처리합니다.

최대 128 트랙, 전체 4096 키프레임, 86400초이며 같은 타깃/채널 중복은 거절합니다. 한 클립 안에서 여러 액세서리를 서로 독립적으로 움직일 수 있습니다. body/face/eyes는 위의 정의된 채널만 지원하며 임의 정점 변형·스켈레톤 애니메이션은 포함하지 않습니다.

partAnimation getter는 클립과 현재 로컬 시간의 복사본입니다. 클립은 runtime 상태이며 기존 v7 design/scene JSON에 포함되지 않습니다. 필요하면 앱이 이 선언을 별도로 저장하고 검증된 setPartAnimation으로 복원하세요. 코드를 직렬화하거나 실행하지 않습니다.

감소된 동작(reduced motion)에서는 클립의 자동 재생을 위한 프레임 예약을 하지 않고 마지막으로 명시한 로컬 시간(설치 직후는 0, seek 후에는 그 시점)을 표시합니다. 이는 pause와 다릅니다. 환경 설정을 해제하면 공통 시계의 현재 위치를 다시 샘플링합니다. 감소된 동작 중에도 명시적 seek는 적용됩니다. 상수 트랙만 있거나 모든 대상 장비가 제거된 클립은 추가 프레임을 예약하지 않습니다. 장비가 다시 나타나면 현재 공통 시계의 클립 위치로 재개합니다.
