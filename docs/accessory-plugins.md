# 액세서리 플러그인 API (v1)

플러그인은 앱이 신뢰하는 JavaScript 모듈입니다. 모듈 로더와 메쉬 생성 함수는 앱 스레드에서 실행되며, 검증된 메쉬 데이터만 렌더링 워커로 전달됩니다. 워커 내부에서 코드를 다운로드하거나 평가하지 않습니다. 임의 URL을 입력받아 실행하는 API는 없습니다.

## 등록, 초기 로드, 지연 로드

```js
import { AccessoryPluginRegistry } from '@hanana-kick/sidekick';
import badge from './badge.js';

const assets = new AccessoryPluginRegistry(); // 앱 단위로 공유
assets.register(badge);
await assets.load('example/badge'); // 초기 로드: 메쉬를 미리 준비
await bot.equipPluginAccessory(assets, 'example/badge', {
  slot: 'mouth', color: '#ff6633', id: 'my-badge',
});

// 또는 위 eager 등록 대신 사용: 같은 ID를 중복 등록하지 않습니다.
const lazyAssets = new AccessoryPluginRegistry();
lazyAssets.registerLazy('example/badge', () => import('./badge.js'));
await bot.equipPluginAccessory(lazyAssets, 'example/badge', {slot: 'mouth'});
bot.removePluginAccessory('mouth');
```

register는 모듈의 메타데이터를 등록합니다. 실제 createMesh 호출은 load 또는 첫 equip에서 실행됩니다. registerLazy는 첫 load/equip 때 import까지 실행합니다. 같은 레지스트리의 같은 ID는 여러 봇이 동시에 요청해도 로더와 createMesh를 한 번만 실행합니다. 재호출은 캐시를 사용하지만, 각 소비자에게 별도 소유의 배열을 반환합니다. 다른 레지스트리는 별도 캐시입니다.

실패는 캐시됩니다. 네트워크 등의 원인을 해결한 뒤 await assets.retry(id)로 명시적으로 재시도합니다. 자동 반복 다운로드는 하지 않습니다. 앱 종료 시 assets.dispose()로 캐시를 해제합니다. 이미 장착된 봇은 자체 데이터로 계속 표시되지만 새 로드는 거절됩니다. 개별 봇 제거 시 공유 레지스트리를 dispose하지 마세요.

## 제작자 메쉬 계약

[실행 가능한 예제 모듈](../examples/accessory-plugins/badge.js)을 참고하세요.

- apiVersion: 1, 고유 id, 허용 slots, createMesh()를 제공합니다.
- slots: head, eyes, mouth, neck, leftEar, rightEar. 한 슬롯에 하나의 플러그인 액세서리만 표시합니다.
- createMesh는 {vertices: Float32Array, indices: Uint16Array} 또는 그 Promise를 반환합니다.
- 정점은 [x, y, z, nx, ny, nz]의 반복입니다. 법선은 단위벡터이며 삼각형은 바깥에서 보아 반시계 방향입니다.
- 최대 16,384 정점, 32,768 삼각형. 유한한 좌표, 유효한 인덱스만 허용합니다. SharedArrayBuffer는 허용하지 않습니다.
- 메쉬 원점은 선택한 부착점입니다. +X는 접선, +Y는 종접선, +Z는 바깥쪽 법선입니다. 메쉬 로컬 +Z는 화면의 위쪽이나 비행 높이가 아닙니다.
- 단위는 픽셀이 아닌 몸체 모델 단위이며 scale=1입니다. 몸체의 기본 가로·세로 크기는 약 1.18 모델 단위입니다. 메쉬가 몸체를 뚫지 않도록 적절한 +Z 여유를 두세요.
- 검증상 좌표 한도 ±16은 안전 상한이지 화면 표시 보장이 아닙니다. 봇의 고정 프레이밍을 바꾸지 않으므로 큰 메쉬는 잘릴 수 있습니다. 장착 때문에 자동 확대·축소하지 않습니다.

## 몸체 부착 프레임과 여러 접점

```js
import {
  getAccessoryAttachmentFrame,
  getAccessoryAttachmentFrames,
  attachmentPointToBody,
} from '@hanana-kick/sidekick/core';

const frame = getAccessoryAttachmentFrame(bot.design.body, 'head');
const bodyPoint = attachmentPointToBody(frame, [0, 0, 0.02]);
const [left, right] = getAccessoryAttachmentFrames(bot.design.body, ['leftEye', 'rightEye']);
```

프레임은 position, tangent, bitangent, normal, matrix, scale을 제공합니다. matrix는 열 우선 4×4 모델 행렬이며 원점을 부착점으로 옮기고 세 축을 정렬합니다. 슬롯 외에 leftEye/rightEye 보조 접점을 조회할 수 있습니다. 모두 몸체 로컬 공간이므로 봇의 화면 위치·회전은 포함하지 않습니다.

렌더러는 현재 shape morph의 윤곽·프로필과 squash로 부착점을 계산합니다. 기본 메쉬는 강체로 이동하며 정점을 매 프레임 재생성하지 않습니다. 선택적인 맞춤 메타데이터와 변형 레시피는 아래 SDK 확장 계약을 따릅니다. 공개 조회 함수는 기본적으로 전달한 body의 정적인 형상을 사용하며, 고급 렌더러는 options.contour/profile/squash로 현재 보간 상태를 전달할 수 있습니다.

여러 접점 조회는 안경 브리지·밴드 등을 제작하는 데 참고할 수 있습니다. 기본 계약은 주 슬롯에 강체 장착하며, 선택적인 paired-affine 눈 쌍 변형과 표면 연결 튜브는 SDK에서 제공합니다. 임의 다중 접점 제약 해결, 천 시뮬레이션, 관통 방지, 모든 몸체에 대한 자동 맞춤은 제공하지 않습니다. 런타임 mesh factory는 한 번 실행되므로 shape 변경 때 다시 호출되지 않습니다.

## 상태, 경쟁 요청, 렌더링

- 같은 슬롯의 새 equip/remove가 이전 요청을 취소하며 이전 Promise는 {finished:false}로 완료됩니다. 취소된 로드의 늦은 완료는 장착되지 않습니다.
- 실패하면 기존 정상 액세서리를 유지합니다. 성공한 장착은 {finished:true}입니다. 이는 상태 커밋을 뜻하며 GPU 표시 프레임 완료를 뜻하지 않습니다.
- disconnect는 진행 중인 장착을 취소합니다. 이미 장착된 메쉬는 reconnect/렌더러 복구 시 재사용합니다. 연결 전 명시적 장착도 지원합니다.
- 플러그인이 장착된 슬롯의 기존 내장 액세서리는 가려집니다. remove 후 다시 나타납니다. 원래 design은 바꾸지 않습니다. v1 플러그인 교체는 즉시 적용되며 별도 crossfade는 없습니다.
- 같은 검증된 삼각형 메쉬를 WebGL2와 Canvas2D fallback 모두 실제로 렌더링합니다. 워커 재시작 시 데이터가 재전달됩니다. GPU 업로드는 렌더러 세대마다 필요합니다.
- 인스턴스 id는 내장 장비를 포함해 고유해야 하며 __proto__/constructor/prototype은 사용할 수 없습니다. 지연 로드 완료 시점에도 충돌을 재검사합니다.
- bot.pluginAccessories는 id/pluginId/slot/color의 복사본입니다. 메쉬 버퍼를 노출하지 않습니다.

## 저장·복원 범위

이 API는 기존 v7 AvatarDesign/scene JSON과 별도의 런타임 장비입니다. design, serializeScene, 스튜디오 디자인 내보내기에 플러그인 메쉬나 참조가 포함되지 않습니다. 같은 모습을 복원하려면 앱이 bot.pluginAccessories의 메타데이터를 별도로 저장하고, 신뢰한 레지스트리를 다시 등록한 뒤 각 항목에 equipPluginAccessory를 호출하세요. 저장된 ID를 임의 코드 URL로 해석하지 마세요. 픽셀 snapshot은 실제 렌더링 결과를 포함합니다.

개별 액세서리의 위치·회전·배율·투명도 키프레임은 [부위별 애니메이션 API](part-animation.md)를 사용합니다.

## SDK 및 제작자 장착 데이터

0.18부터 제작 전용 `@hanana-kick/sidekick/plugin-sdk`와 독립 SDK ZIP을 제공합니다. [SDK 가이드](plugin-sdk.md)를 참고하세요. 선택적 메쉬 `parts`는 연속적인 인덱스 범위별 재질 색상/배율을 정의합니다. 선택적 `attachment`는 `contained-front` 배치와 제작자가 제공한 도형별 장착 테이블을 담는 직렬화 가능한 데이터입니다. 현재 보이는 몸체의 변형 비중으로 보간되며 플러그인 코드가 Worker 안에서 실행되지는 않습니다. 기존 단일 메쉬와 단순 부착점 계약은 유지됩니다.

## 선택적 SDK 맞춤 확장

`attachment.mode`는 `contained-front`, `crown-envelope`, `perimeter-front`, `eye-plane` 중 하나입니다. 외부 제작자가 도형별 중립 장착값을 제공하며 실행기가 현재 변형에 맞게 보간합니다. `geometry.deformation`의 `paired-affine` 레시피와 `geometry.surfaceConnectors`는 제한된 수치 데이터만 포함합니다. 콜백, 문자열 수식, 내장 프리셋 선택자는 허용하지 않습니다.

맞춤 애셋은 파생 튜브를 포함해 최대 2,048 정점·4,096 삼각형이며, 전체 맞춤 장착은 한 봇당 4,096 정점·8,192 삼각형으로 제한합니다. 제한을 넘는 교체는 기존 장착을 유지한 채 실패합니다. 기본 강체 메쉬의 16,384/32,768 제한과 구분하세요.

[SDK 제작 가이드](plugin-sdk.md)는 측정 채널 제작 도우미, 변형의 구체적인 제한, 중립 장착과 명시적 애니메이션의 합성 순서, 여섯 슬롯의 실제 외부 애셋 예제를 설명합니다. 동일한 맞춤 입력은 캐시되며 동적 메쉬가 변할 때만 GPU 버퍼를 갱신합니다. 메쉬 팩토리를 매 프레임 호출하거나 실행 코드를 워커에 보내지 않습니다.
