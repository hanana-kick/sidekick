import { createElement, memo, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowDownToLine, CircleHelp, Copy, FileJson, ImageDown, Move, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import type { Activity, AccessoryPreset } from '../src/core/design.js';
import { CAMERA_PRESETS } from '../src/core/camera.js';
import type { CameraPreset } from '../src/core/camera.js';
import type { EyeExpression } from '../src/core/expressions.js';
import { MATERIAL_SHAPE_LABELS } from '../src/core/shapes.js';
import type { SidekickAvatar } from '../src/element/avatar.js';
import { ACCESSORY_NAMES, EQUIPMENT_GROUPS, SLOT_NAMES, StudioController } from './studio-controller.js';
import type { StudioState } from './studio-controller.js';
import { ChoiceField, ColorField, RangeField } from './studio-controls';
import { ShapeCatalog } from './shape-catalog';

const ACTIVITY_LABELS: Record<Activity, string> = { idle: '대기', thinking: '생각 중', listening: '듣는 중', speaking: '말하는 중', celebrating: '축하', still: '정적' };
const CAMERA_LABELS: Record<CameraPreset, string> = { front: '정면', 'three-quarter': '사선 45°', side: '측면 90°' };
function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A single stable element. No design prop/effect and no changing React key. */
const AvatarPreview = memo(function AvatarPreview({ controller }: { controller: StudioController }) {
  const ref = useRef<SidekickAvatar | null>(null);
  useLayoutEffect(() => ref.current ? controller.bindAvatar(ref.current) : undefined, [controller]);
  return createElement('sidekick-avatar', { ref, id: 'flat', 'render-style': 'flat', interaction: 'box', 'aria-label': '캐릭터 미리보기, 드래그로 카메라 각도 조절' });
});

function AppearancePanel({ state, controller, resetKey }: { state: StudioState; controller: StudioController; resetKey: number }) {
  return <FieldGroup>
    <ShapeCatalog selected={state.design.body.shape} onSelect={controller.selectShape} resetKey={resetKey} />
    <ColorField id="body-color" label="몸체 색상" value={state.design.body.color} onChange={color => controller.patch({ body: { color } })} />
    <Separator />
    <section id="eyes-panel" aria-labelledby="eyes-heading"><h2 id="eyes-heading" className="section-title">눈</h2><FieldGroup>
      <ColorField id="eye-color" label="눈 색상" value={state.design.eyes.color} onChange={color => controller.patch({ eyes: { color } })} />
      <FieldDescription>눈의 비율과 간격은 도형에 자연스럽게 맞춰집니다. 표정은 애니메이션 탭에서 조절하세요.</FieldDescription>
    </FieldGroup></section>
    <Separator />
    <section aria-labelledby="equipment-heading"><h2 id="equipment-heading" className="section-title">액세서리</h2>
      <FieldDescription>슬롯마다 하나씩. 같은 항목을 다시 누르면 해제됩니다.</FieldDescription>
      <FieldGroup className="equipment-groups">{EQUIPMENT_GROUPS.map(({ slot, presets }) => {
        const equipped = state.design.accessories.find(item => item.slot === slot);
        return <FieldSet key={slot} className="equipment-slot" data-equipment-slot={slot}>
          <FieldLegend variant="label">{SLOT_NAMES[slot]}<span className="slot-status" id={`${slot}-slot-status`}>{equipped ? ACCESSORY_NAMES[equipped.preset] : '비어 있음'}</span></FieldLegend>
          <ToggleGroup type="single" variant="outline" value={equipped?.preset ?? ''} onValueChange={preset => controller.setEquipment(slot, preset as AccessoryPreset | '')} aria-label={`${SLOT_NAMES[slot]} 액세서리`} className="equipment-choices">
            {presets.map(preset => <ToggleGroupItem key={preset} value={preset} data-accessory={preset} data-equipment={slot} aria-label={`${SLOT_NAMES[slot]} ${ACCESSORY_NAMES[preset]}`}>{ACCESSORY_NAMES[preset]}</ToggleGroupItem>)}
          </ToggleGroup>
          {equipped && <ColorField id={`accessory-color-${slot}`} label={`${SLOT_NAMES[slot]} ${ACCESSORY_NAMES[equipped.preset]} 색상`} value={equipped.color} onChange={color => controller.colorAccessory(equipped.id, color)} />}
        </FieldSet>;
      })}</FieldGroup>
      <FieldDescription className="equipment-note">보타이와 스카프는 목 슬롯을 공유합니다. 왼쪽과 오른쪽 귀걸이는 각각 선택할 수 있습니다.</FieldDescription>
    </section>
  </FieldGroup>;
}

function AnimationPanel({ state, controller }: { state: StudioState; controller: StudioController }) {
  return <FieldGroup>
    <section aria-labelledby="activity-heading"><div className="section-heading"><h2 id="activity-heading">움직임</h2>
      <Button id="pause" variant="outline" size="sm" aria-pressed={state.paused} onClick={controller.togglePause}>{state.paused ? <Play data-icon="inline-start" /> : <Pause data-icon="inline-start" />}{state.paused ? '재생' : '일시 정지'}</Button></div>
      <ToggleGroup type="single" variant="outline" value={state.activity} onValueChange={activity => { if (activity) controller.setActivity(activity as Activity); }} aria-label="봇 상태" className="activity-options">
        {Object.entries(ACTIVITY_LABELS).map(([activity, label]) => <ToggleGroupItem key={activity} value={activity} data-activity={activity}>{label}</ToggleGroupItem>)}
      </ToggleGroup>
      <div className="motion-actions"><Button id="look-left" variant="ghost" size="sm" onClick={() => controller.look(-.9)}>왼쪽 보기</Button><Button id="look-center" variant="ghost" size="sm" onClick={() => controller.look(0)}>정면 보기</Button><Button id="look-right" variant="ghost" size="sm" onClick={() => controller.look(.9)}>오른쪽 보기</Button><Button id="face-motion" variant="outline" size="sm" aria-pressed={state.movedFace} onClick={controller.toggleFace}>얼굴 이동</Button></div>
    </section>
    <Separator />
    <FieldSet><FieldLegend>도형 전환</FieldLegend>
      <RangeField id="shape-duration" label="전환 시간" value={state.duration} min={0} max={1500} step={50} suffix="ms" onChange={controller.setDuration} />
      <ChoiceField id="shape-easing" label="전환 느낌" value={state.easing} onChange={value => controller.setEasing(value as 'smooth' | 'linear')} options={[{ value: 'smooth', label: '부드럽게' }, { value: 'linear', label: '일정하게' }]} />
      <FieldDescription>빠르게 다시 골라도 현재 윤곽에서 이어집니다. 모션 줄이기 설정에서는 즉시 적용합니다.</FieldDescription>
    </FieldSet>
    <Separator />
    <section className="expression-panel" aria-labelledby="expression-heading"><h2 id="expression-heading" className="section-title">표정 애니메이션</h2>
      <FieldDescription>외형과 별개인 애니메이션 상태입니다. 좌우 눈의 웃음과 감기 가중치를 독립적으로 조절하세요.</FieldDescription>
      <FieldGroup className="expression-controls">{(['left', 'right'] as const).map(side => {
        const weights = state.design.eyes[side].weights;
        const preset = weights.smile === 0 && weights.blink === 0 ? 'neutral' : weights.smile === 1 && weights.blink === 0 ? 'smile' : weights.smile === 0 && weights.blink === 1 ? 'blink' : 'custom';
        return <FieldSet key={side} className="eye-controls"><FieldLegend variant="label">{side === 'left' ? '왼쪽 눈' : '오른쪽 눈'}</FieldLegend>
          <ChoiceField id={`${side}-expression`} label="가중치 프리셋" value={preset} onChange={value => controller.setExpression(side, value as EyeExpression)} options={[{ value: 'neutral', label: '기본' }, { value: 'smile', label: '웃음' }, { value: 'blink', label: '감기' }, { value: 'custom', label: '직접 혼합', disabled: true }]} />
          {(['smile', 'blink'] as const).map(key => <RangeField key={key} id={`${side}-${key}-weight`} label={`${key === 'smile' ? '웃음' : '감기'} 가중치`} value={weights[key]} min={0} max={1} step={.01} format={value => `${Math.round(value * 100)}%`} onChange={value => controller.setWeight(side, key, value)} />)}
        </FieldSet>;
      })}</FieldGroup>
    </section>
  </FieldGroup>;
}

function CameraPanel({ state, controller }: { state: StudioState; controller: StudioController }) {
  const preset = (Object.keys(CAMERA_PRESETS) as CameraPreset[]).find(name => (['yaw', 'pitch', 'roll'] as const).every(axis => Math.abs(state.camera[axis] - CAMERA_PRESETS[name][axis]) < .0001)) ?? '';
  return <FieldGroup><div className="section-heading"><h2>보는 각도</h2><Button id="reset-camera" variant="ghost" size="sm" onClick={controller.resetCamera}><RotateCcw data-icon="inline-start" />각도 초기화</Button></div>
    <ToggleGroup type="single" variant="outline" value={preset} onValueChange={value => { if (value) controller.setCameraPreset(value as CameraPreset); }} aria-label="카메라 프리셋" className="camera-presets">
      {(Object.keys(CAMERA_LABELS) as CameraPreset[]).map(name => <ToggleGroupItem key={name} value={name} data-camera-preset={name}>{CAMERA_LABELS[name]}</ToggleGroupItem>)}
    </ToggleGroup>
    <RangeField id="view-yaw" label="좌우 각도 · Yaw" value={state.camera.yaw} min={-360} max={360} suffix="°" onChange={yaw => controller.setCamera({ yaw })} />
    <RangeField id="view-pitch" label="상하 각도 · Pitch" value={state.camera.pitch} min={-90} max={90} suffix="°" onChange={pitch => controller.setCamera({ pitch })} />
    <RangeField id="view-roll" label="화면 기울기 · Roll" value={state.camera.roll} min={-180} max={180} suffix="°" onChange={roll => controller.setCamera({ roll })} />
    <FieldDescription>미리보기를 드래그해도 같은 각도가 바뀝니다. 카메라 각도는 디자인 JSON과 별개인 미리보기 설정입니다.</FieldDescription>
  </FieldGroup>;
}

function JSONPanel({ state, controller }: { state: StudioState; controller: StudioController }) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  async function copyJSON(): Promise<void> {
    try { await navigator.clipboard.writeText(state.jsonDraft); controller.report('JSON을 복사했습니다.'); }
    catch { textarea.current?.select(); controller.report('선택된 JSON을 직접 복사하세요.', true); }
  }
  return <FieldGroup>
    <div className="section-heading"><h2>디자인 JSON</h2><Badge variant="outline">v7</Badge></div>
    <FieldDescription>같은 디자인을 코드에서도 사용할 수 있습니다. 이전 버전은 검증 후 변환합니다.</FieldDescription>
    {state.recovery && !state.recoverySaved && <Alert id="saved-design-warning" variant="destructive"><CircleHelp /><AlertTitle>저장 원본을 보존했습니다</AlertTitle><AlertDescription>적용할 수 없는 저장 데이터를 아래에 열었습니다. 수정하거나 원본을 내려받으세요. 변경 전 원본 백업이 실패하면 자동 저장하지 않습니다.</AlertDescription></Alert>}
    <Field data-invalid={!!state.jsonError}><FieldLabel htmlFor="design-json">디자인 데이터</FieldLabel><Textarea ref={textarea} id="design-json" spellCheck={false} value={state.jsonDraft} onChange={event => controller.editJSON(event.target.value)} aria-invalid={!!state.jsonError} aria-describedby="json-error" className="json-editor" /><div id="json-error"><FieldError>{state.jsonError}</FieldError></div></Field>
    <div className="code-actions"><Button id="import-json" onClick={() => controller.importJSON()}>JSON 적용</Button><Button id="copy-json" variant="outline" onClick={() => void copyJSON()}><Copy data-icon="inline-start" />복사</Button>
      {state.recovery && <Button id="export-recovery-json" variant="outline" onClick={() => { download(new Blob([state.recovery!.raw], { type: 'application/json' }), 'sidekick.saved-original.design.json'); controller.report('저장 원본 JSON을 내보냈습니다.'); }}><ArrowDownToLine data-icon="inline-start" />저장 원본</Button>}
    </div>
    <Separator />
    <section aria-labelledby="api-heading"><h2 id="api-heading" className="section-title">Web Component API</h2><pre id="api-example">{`import { createDesign } from '@hanana-kick/sidekick';\n\nconst bot = document.querySelector('sidekick-avatar');\nawait bot.setDesign(createDesign({\n  body: { shape: 'verySunny' },\n  eyes: { color: '#24242c' }\n}));\nawait bot.setShape('cookie9Sided', {\n  duration: 450, easing: 'smooth'\n});\nawait bot.setExpression('left', 'smile');\nbot.setCamera({ yaw: 35, pitch: 12 });\nbot.setActivity('thinking');`}</pre></section>
  </FieldGroup>;
}

export function StudioApp({ controller }: { controller: StudioController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [tab, setTab] = useState(state.recovery ? 'json' : 'appearance'), [resetKey, setResetKey] = useState(0);
  const settingsScroll = useRef<HTMLDivElement>(null);
  function changeTab(value: string): void { setTab(value); if (settingsScroll.current) settingsScroll.current.scrollTop = 0; }
  function reset(): void { controller.reset(); setResetKey(key => key + 1); }
  async function exportPNG(): Promise<void> { try { download(await controller.snapshot(), 'sidekick.png'); controller.report('투명 PNG를 내보냈습니다.'); } catch (error) { controller.report(String(error), true); } }
  return <div className="studio-shell">
    <header className="app-header"><a className="brand" href="/" aria-label="Sidekick Studio 홈"><Sparkles aria-hidden="true" /><span>sidekick<span className="brand-studio">studio</span></span></a>
      <div className="header-actions"><Button id="reset" variant="ghost" onClick={reset} aria-label="디자인 초기화"><RotateCcw data-icon="inline-start" /><span className="action-label">초기화</span></Button><Button id="export-png" variant="outline" onClick={() => void exportPNG()} aria-label="PNG 저장"><ImageDown data-icon="inline-start" /><span className="action-label">PNG 저장</span></Button><Button id="export-json" onClick={() => { download(new Blob([controller.exportJSON()], { type: 'application/json' }), 'sidekick.design.json'); controller.report('디자인 JSON을 내보냈습니다.'); }}><FileJson data-icon="inline-start" /><span>JSON 내보내기</span></Button></div>
    </header>
    <main className="workspace">
      <section className="stage" aria-label="고정 캐릭터 미리보기">
        <div className="stage-header"><div><h1>나만의 작은 동료.</h1><p>형태를 고르고, 개성을 더하세요.</p></div><ToggleGroup type="single" variant="outline" size="sm" value={state.background} onValueChange={value => { if (value) controller.setBackground(value as StudioState['background']); }} aria-label="미리보기 배경" className="background-options">{([['checker', '투명'], ['light', '밝게'], ['dark', '어둡게']] as const).map(([value, label]) => <ToggleGroupItem key={value} value={value} data-background={value}>{label}</ToggleGroupItem>)}</ToggleGroup></div>
        <div className="previews" data-background={state.background}><div className="preview"><AvatarPreview controller={controller} /></div></div>
        <footer className="preview-footer"><span className="preview-shape">{MATERIAL_SHAPE_LABELS[state.design.body.shape]}<Badge variant="secondary">Flat</Badge></span><span className="preview-hint"><Move aria-hidden="true" />드래그로 돌려보기</span></footer>
      </section>
      <aside className="inspector" aria-label="캐릭터 디자인 설정">
        <Tabs value={tab} onValueChange={changeTab} className="settings-tabs"><div className="settings-nav"><TabsList className="w-full" aria-label="디자인 항목"><TabsTrigger value="appearance" id="appearance-tab" aria-controls="appearance-panel">외형</TabsTrigger><TabsTrigger value="animation" id="animation-tab" aria-controls="animation-panel">애니메이션</TabsTrigger><TabsTrigger value="camera" id="camera-tab" aria-controls="camera-panel">카메라</TabsTrigger><TabsTrigger value="json" id="json-tab" aria-controls="json-panel">JSON</TabsTrigger></TabsList></div>
          <div ref={settingsScroll} className="settings-scroll" data-testid="settings-scroll">
            {state.warnings.length > 0 && <Alert id="migration-warning" className="migration-warning"><AlertTitle>이전 디자인을 v7으로 변환했습니다</AlertTitle><AlertDescription>{state.warnings.join(' ')}</AlertDescription></Alert>}
            <TabsContent value="appearance" forceMount hidden={tab !== 'appearance'} id="appearance-panel" aria-labelledby="appearance-tab"><AppearancePanel state={state} controller={controller} resetKey={resetKey} /></TabsContent>
            <TabsContent value="animation" forceMount hidden={tab !== 'animation'} id="animation-panel" aria-labelledby="animation-tab"><AnimationPanel state={state} controller={controller} /></TabsContent>
            <TabsContent value="camera" forceMount hidden={tab !== 'camera'} id="camera-panel" aria-labelledby="camera-tab"><CameraPanel state={state} controller={controller} /></TabsContent>
            <TabsContent value="json" forceMount hidden={tab !== 'json'} id="json-panel" aria-labelledby="json-tab"><JSONPanel state={state} controller={controller} /></TabsContent>
          </div>
        </Tabs>
        <footer className="inspector-footer"><span id="status" role="status" aria-live="polite" data-error={state.statusError}>{state.status}</span></footer>
      </aside>
    </main>
  </div>;
}
