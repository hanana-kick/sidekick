import { seedStudioPreviewSession } from './studio-session.js';
import { getSiteLocale, subscribeSiteLocale, localizedSiteHref } from './site-i18n.js';
import { studioText, studioLabel, studioFormat, studioShapeLabel, studioAccessoryLabel, studioMessage } from './studio-locales.js';
import { mountSiteHeader } from './shared-header.js';
import { recordSiteEvent, setSiteSection, siteAnalyticsConsent, siteAnalyticsConsentVersion } from './site-analytics.js';
import { recordSettingChange } from './site-setting-analytics.js';
import { settingValueCategory, eyeSemanticState } from './product-analytics-schema.js';
import { createBotPreviewTracker } from './bot-preview-analytics.js';
import { prepareBotUsage } from './site-product-usage.js';
import { migrateScene } from '../src/core/scene.js';
import { createElement, memo, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowDownToLine, CircleHelp, Copy, FileJson, FileUp, ImageDown, Move, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import type { Activity, AccessoryPreset } from '../src/core/design.js';
import { BODY_ORIENTATION_PRESETS } from '../src/core/body-orientation.js';
import type { BodyOrientationPreset } from '../src/core/body-orientation.js';
import type { EyeExpression } from '../src/core/expressions.js';
import type { TrackingMode } from '../src/core/tracking.js';
import type { SidekickAvatar } from '../src/element/avatar.js';
import { EQUIPMENT_GROUPS, SLOT_NAMES, StudioController } from './studio-controller.js';
import type { StudioState } from './studio-controller.js';
import { ChoiceField, ColorField, RangeField } from './studio-controls';
import { ShapeCatalog } from './shape-catalog';
import { sceneSnippets } from './studio-snippets';
import { studioBaseURL } from './studio-assets';

import { CompositionPanel, CompositionPreview } from './composition-editor';
import { defaultComposition } from './composition';

const ASSET_BASE = studioBaseURL(import.meta.env?.BASE_URL ?? '/', import.meta.url);
const ACTIVITY_LABELS: Record<Activity, string> = { idle: '대기', thinking: '생각 중', listening: '듣는 중', speaking: '말하는 중', celebrating: '축하', still: '정적' };
const BODY_ORIENTATION_LABELS: Record<BodyOrientationPreset, string> = { front: '정면', 'three-quarter': '사선 45°', side: '측면 90°' };
function recordStudioSetting(setting_key: string, value: unknown, site_section: string, debounce = false, change_source: 'control' | 'preset' = 'control'): void {
  const value_category = settingValueCategory(setting_key, value);
  if (value_category !== null) recordSettingChange(window, { site_page: 'studio', site_section, setting_key, value_category, change_source }, { debounce });
}
function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** One stable element with an immutable initial scene; later edits belong to the controller. */
const AvatarPreview = memo(function AvatarPreview({ controller }: { controller: StudioController }) {
  useSyncExternalStore(subscribeSiteLocale, getSiteLocale, getSiteLocale);
  const ref = useRef<SidekickAvatar | null>(null);
  const initial = useRef(controller.exportScene());
  useLayoutEffect(() => { if (!ref.current) return; seedStudioPreviewSession(ref.current, initial.current); return controller.bindAvatar(ref.current); }, [controller]);
  return createElement('sidekick-avatar', { design: initial.current.design, ref, id: 'flat', 'render-style': 'flat', interaction: 'box', 'aria-label': studioText("캐릭터 미리보기, 드래그로 몸체 방향 조절") });
});

function AppearancePanel({ state, controller, resetKey }: { state: StudioState; controller: StudioController; resetKey: number }) {
  return <FieldGroup>
    <ShapeCatalog selected={state.design.body.shape} onSelect={shape => { controller.selectShape(shape); recordStudioSetting('body_shape', shape, 'appearance'); }} resetKey={resetKey} />
    <ColorField id="body-color" label={studioText("몸체 색상")} value={state.design.body.color} onChange={color => { controller.patch({ body: { color } }); recordStudioSetting('body_color_family', color, 'appearance', true); }} />
    <Separator />
    <section id="eyes-panel" aria-labelledby="eyes-heading"><h2 id="eyes-heading" className="section-title">{studioText("눈")}</h2><FieldGroup>
      <ColorField id="eye-color" label={studioText("눈 색상")} value={state.design.eyes.color} onChange={color => { controller.patch({ eyes: { color } }); recordStudioSetting('eye_color_family', color, 'appearance', true); }} />
      <FieldDescription>{studioText("눈의 비율과 간격은 도형에 자연스럽게 맞춰집니다. 표정은 애니메이션 탭에서 조절하세요.")}</FieldDescription>
    </FieldGroup></section>
    <Separator />
    <section aria-labelledby="equipment-heading"><h2 id="equipment-heading" className="section-title">{studioText("액세서리")}</h2>
      <FieldDescription>{studioText("슬롯마다 하나씩. 같은 항목을 다시 누르면 해제됩니다.")}</FieldDescription>
      <FieldGroup className="equipment-groups">{EQUIPMENT_GROUPS.map(({ slot, presets }) => {
        const equipped = state.design.accessories.find(item => item.slot === slot);
        return <FieldSet key={slot} className="equipment-slot" data-equipment-slot={slot}>
          <FieldLegend variant="label">{studioLabel(SLOT_NAMES[slot])}<span className="slot-status" id={`${slot}-slot-status`}>{equipped ? studioAccessoryLabel(equipped.preset) : studioText("비어 있음")}</span></FieldLegend>
          <ToggleGroup type="single" variant="outline" value={equipped?.preset ?? ''} onValueChange={preset => { controller.setEquipment(slot, preset as AccessoryPreset | ''); recordStudioSetting(`accessory_${slot === 'leftEar' ? 'left_ear' : slot === 'rightEar' ? 'right_ear' : slot}`, preset || 'none', 'appearance'); }} aria-label={studioFormat('{slot} 액세서리', { slot: studioLabel(SLOT_NAMES[slot]) })} className="equipment-choices equipment-palette">
            {presets.map(preset => <ToggleGroupItem key={preset} value={preset} data-accessory={preset} data-equipment={slot} aria-label={`${studioLabel(SLOT_NAMES[slot])} ${studioAccessoryLabel(preset)}`}><img src={`${ASSET_BASE}accessory-previews/${preset}.png`} alt="" width={72} height={72} loading="lazy" /><span>{studioAccessoryLabel(preset)}</span></ToggleGroupItem>)}
          </ToggleGroup>
          {equipped && <ColorField id={`accessory-color-${slot}`} label={studioFormat('{slot} {accessory} 색상', { slot: studioLabel(SLOT_NAMES[slot]), accessory: studioAccessoryLabel(equipped.preset) })} value={equipped.color} onChange={color => { controller.colorAccessory(equipped.id, color); recordStudioSetting(`accessory_${slot === 'leftEar' ? 'left_ear' : slot === 'rightEar' ? 'right_ear' : slot}_color_family`, color, 'appearance', true); }} />}
        </FieldSet>;
      })}</FieldGroup>
      <FieldDescription className="equipment-note">{studioText("보타이와 스카프는 목 슬롯을 공유합니다. 왼쪽과 오른쪽 귀걸이는 각각 선택할 수 있습니다.")}</FieldDescription>
    </section>
  </FieldGroup>;
}

function AnimationPanel({ state, controller }: { state: StudioState; controller: StudioController }) {
  return <FieldGroup>
    <section aria-labelledby="activity-heading"><div className="section-heading"><h2 id="activity-heading">{studioText("움직임")}</h2>
      <Button id="pause" variant="outline" size="sm" aria-pressed={state.paused} onClick={() => { controller.togglePause(); recordStudioSetting('paused', controller.getSnapshot().paused, 'animation'); }}>{state.paused ? <Play data-icon="inline-start" /> : <Pause data-icon="inline-start" />}{state.paused ? studioText("재생") : studioText("일시 정지")}</Button></div>
      <ToggleGroup type="single" variant="outline" value={state.activity} onValueChange={activity => { if (activity) { controller.setActivity(activity as Activity); recordStudioSetting('activity', activity, 'animation'); } }} aria-label={studioText("봇 상태")} className="activity-options">
        {Object.entries(ACTIVITY_LABELS).map(([activity, label]) => <ToggleGroupItem key={activity} value={activity} data-activity={activity}>{studioLabel(label)}</ToggleGroupItem>)}
      </ToggleGroup>
      <FieldSet className="tracking-control"><FieldLegend variant="label">{studioText("마우스 시선 추적")}</FieldLegend>
        <ToggleGroup type="single" variant="outline" value={state.trackingMode} onValueChange={mode => { if (mode) { controller.setTrackingMode(mode as TrackingMode); recordStudioSetting('tracking_mode', mode, 'animation'); } }} aria-label={studioText("마우스 시선 추적 모드")} aria-describedby="mouse-tracking-help">
          <ToggleGroupItem id="tracking-off" value="off">{studioText("꺼짐")}</ToggleGroupItem>
          <ToggleGroupItem id="mouse-tracking" value="eyes">{studioText("눈만")}</ToggleGroupItem>
          <ToggleGroupItem id="tracking-eyes-and-body" value="eyes-and-body">{studioText("눈과 몸")}</ToggleGroupItem>
        </ToggleGroup>
        <FieldDescription id="mouse-tracking-help">{studioText("눈만 또는 눈과 몸이 페이지의 마우스를 따라봅니다. 몸 움직임은 기존 모션 위에 부드럽게 더해지며 몸체 방향을 바꾸지 않습니다. 장면 JSON에 저장됩니다.")}</FieldDescription>
      </FieldSet>
      <div className="motion-actions"><Button id="look-left" variant="ghost" size="sm" onClick={() => controller.look(-.9)}>{studioText("왼쪽 보기")}</Button><Button id="look-center" variant="ghost" size="sm" onClick={() => controller.look(0)}>{studioText("정면 보기")}</Button><Button id="look-right" variant="ghost" size="sm" onClick={() => controller.look(.9)}>{studioText("오른쪽 보기")}</Button><Button id="face-motion" variant="outline" size="sm" aria-pressed={state.movedFace} onClick={controller.toggleFace}>{studioText("얼굴 이동")}</Button></div>
    </section>
    <Separator />
    <FieldSet><FieldLegend>{studioText("도형 전환")}</FieldLegend>
      <RangeField id="shape-duration" label={studioText("전환 시간")} value={state.duration} min={0} max={1500} step={50} suffix="ms" onChange={value => { controller.setDuration(value); recordStudioSetting('shape_duration', value, 'animation', true); }} />
      <ChoiceField id="shape-easing" label={studioText("전환 느낌")} value={state.easing} onChange={value => { controller.setEasing(value as 'smooth' | 'linear'); recordStudioSetting('shape_easing', value, 'animation'); }} options={[{ value: 'smooth', label: studioText("부드럽게") }, { value: 'linear', label: studioText("일정하게") }]} />
      <FieldDescription>{studioText("빠르게 다시 골라도 현재 윤곽에서 이어집니다. 모션 줄이기 설정에서는 즉시 적용합니다.")}</FieldDescription>
    </FieldSet>
    <Separator />
    <section className="expression-panel" aria-labelledby="expression-heading"><h2 id="expression-heading" className="section-title">{studioText("표정 애니메이션")}</h2>
      <FieldDescription>{studioText("외형과 별개인 애니메이션 상태입니다. 좌우 눈의 웃음과 감기 가중치를 독립적으로 조절하세요.")}</FieldDescription>
      <FieldGroup className="expression-controls">{(['left', 'right'] as const).map(side => {
        const weights = state.design.eyes[side].weights;
        const preset = weights.smile === 0 && weights.blink === 0 ? 'neutral' : weights.smile === 1 && weights.blink === 0 ? 'smile' : weights.smile === 0 && weights.blink === 1 ? 'blink' : 'custom';
        return <FieldSet key={side} className="eye-controls"><FieldLegend variant="label">{side === 'left' ? studioText("왼쪽 눈") : studioText("오른쪽 눈")}</FieldLegend>
          <ChoiceField id={`${side}-expression`} label={studioText("가중치 프리셋")} value={preset} onChange={value => { controller.setExpression(side, value as EyeExpression); recordStudioSetting(`${side}_expression`, value, 'animation'); }} options={[{ value: 'neutral', label: studioText("기본") }, { value: 'smile', label: studioText("웃음") }, { value: 'blink', label: studioText("감기") }, { value: 'custom', label: studioText("직접 혼합"), disabled: true }]} />
          {(['smile', 'blink'] as const).map(key => <RangeField key={key} id={`${side}-${key}-weight`} label={studioText(key === 'smile' ? "웃음 가중치" : "감기 가중치")} value={weights[key]} min={0} max={1} step={.01} format={value => `${Math.round(value * 100)}%`} onChange={value => { controller.setWeight(side, key, value); recordStudioSetting(`${side}_expression`, eyeSemanticState(controller.getSnapshot().design.eyes[side]), 'animation', true); }} />)}
        </FieldSet>;
      })}</FieldGroup>
    </section>
  </FieldGroup>;
}

function BodyOrientationPanel({ state, controller }: { state: StudioState; controller: StudioController }) {
  const preset = (Object.keys(BODY_ORIENTATION_PRESETS) as BodyOrientationPreset[]).find(name => (['yaw', 'pitch', 'roll'] as const).every(axis => Math.abs(state.bodyOrientation[axis] - BODY_ORIENTATION_PRESETS[name][axis]) < .0001)) ?? '';
  return <FieldGroup><div className="section-heading"><h2>{studioText("몸체 방향")}</h2><Button id="reset-body-orientation" variant="ghost" size="sm" onClick={() => { controller.resetBodyOrientation(); recordStudioSetting('body_orientation', 'front', 'orientation', false, 'preset'); }}><RotateCcw data-icon="inline-start" />{studioText("방향 초기화")}</Button></div>
    <ToggleGroup type="single" variant="outline" value={preset} onValueChange={value => { if (value) { controller.setBodyOrientationPreset(value as BodyOrientationPreset); recordStudioSetting('body_orientation', value, 'orientation', false, 'preset'); } }} aria-label={studioText("몸체 방향 프리셋")} className="body-orientation-presets">
      {(Object.keys(BODY_ORIENTATION_LABELS) as BodyOrientationPreset[]).map(name => <ToggleGroupItem key={name} value={name} data-body-orientation-preset={name}>{studioLabel(BODY_ORIENTATION_LABELS[name])}</ToggleGroupItem>)}
    </ToggleGroup>
    <RangeField id="body-yaw" label={studioText("좌우 각도 · Yaw")} value={state.bodyOrientation.yaw} min={-360} max={360} suffix="°" onChange={value => { controller.setBodyOrientation({ yaw: value }); recordStudioSetting('body_yaw', value, 'orientation', true); }} />
    <RangeField id="body-pitch" label={studioText("상하 각도 · Pitch")} value={state.bodyOrientation.pitch} min={-90} max={90} suffix="°" onChange={value => { controller.setBodyOrientation({ pitch: value }); recordStudioSetting('body_pitch', value, 'orientation', true); }} />
    <RangeField id="body-roll" label={studioText("몸체 기울기 · Roll")} value={state.bodyOrientation.roll} min={-180} max={180} suffix="°" onChange={value => { controller.setBodyOrientation({ roll: value }); recordStudioSetting('body_roll', value, 'orientation', true); }} />
    <div className="section-heading"><h2>{studioText("확대")}</h2><Button id="reset-zoom" variant="ghost" size="sm" onClick={() => { controller.resetZoom(); recordStudioSetting('zoom', 1, 'orientation', false, 'preset'); }}>{studioText("확대 초기화")}</Button></div>
    <RangeField id="zoom" label={studioText("확대 · Zoom")} value={state.zoom} min={.5} max={3} step={.01} format={value => `${Math.round(value * 100)}%`} onChange={zoom => { controller.setZoom(zoom); recordStudioSetting('zoom', zoom, 'orientation', true); }} />
    <FieldDescription>{studioText("드래그로 회전하고 휠·트랙패드 또는 두 손가락으로 확대하세요. 확대는 중앙 기준이며 높은 배율에서는 화면 밖이 잘릴 수 있습니다. PNG도 현재 보이는 부분을 저장합니다.")}</FieldDescription>
  </FieldGroup>;
}

function JSONPanel({ state, controller }: { state: StudioState; controller: StudioController }) {
  const textarea = useRef<HTMLTextAreaElement>(null), fileInput = useRef<HTMLInputElement>(null);
  const snippetScene = controller.exportScene(), snippets = sceneSnippets(snippetScene);
  async function importFile(file: File): Promise<void> {
    const consent = siteAnalyticsConsent(window), version = siteAnalyticsConsentVersion(window);
    if (await controller.importFile(file) && consent && siteAnalyticsConsentVersion(window) === version) {
      prepareBotUsage(window, 'bot_apply', controller.getSnapshot().design, { site_page: 'studio', site_section: 'json', apply_kind: 'file' }, controller.getSnapshot())();
    }
  }
  function applyJSON(): void {
    if (controller.importJSON()) prepareBotUsage(window, 'bot_apply', controller.getSnapshot().design, { site_page: 'studio', site_section: 'json', apply_kind: 'json' }, controller.getSnapshot())();
  }
  async function copySnippet(kind: 'html' | 'react'): Promise<void> {
    const completed = prepareBotUsage(window, 'bot_copy', snippetScene.design, { site_page: 'studio', site_section: 'json', format: kind }, snippetScene);
    try { await navigator.clipboard.writeText(snippets[kind]); completed(); controller.report(studioFormat('{kind} 코드를 복사했습니다.', { kind: kind === 'html' ? 'HTML' : 'React' })); }
    catch {
      const range = document.createRange(), element = document.getElementById(kind === 'html' ? 'api-example' : 'react-example');
      if (element) { range.selectNodeContents(element); const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); }
      controller.report(studioText("선택된 코드를 직접 복사하세요."), true);
    }
  }
  async function copyJSON(): Promise<void> {
    // The draft may not be applied, or may be invalid. Never attribute it to the live bot.
    let copiedDesign: unknown, copiedScene: unknown; try { const scene = migrateScene(state.jsonDraft).scene; copiedDesign = scene.design; copiedScene = scene; } catch { /* Invalid drafts have no bot combination. */ }
    const completed = prepareBotUsage(window, 'bot_copy', copiedDesign, { site_page: 'studio', site_section: 'json', format: 'json' }, copiedScene);
    try { await navigator.clipboard.writeText(state.jsonDraft); completed(); controller.report(studioText("JSON을 복사했습니다.")); }
    catch { textarea.current?.select(); controller.report(studioText("선택된 JSON을 직접 복사하세요."), true); }
  }
  return <FieldGroup>
    <div className="section-heading"><h2>{studioText("장면 JSON")}</h2><Badge variant="outline">Scene v3 · Design v7</Badge></div>
    <FieldDescription>{studioText("디자인·몸체 방향·시선·추적·모션 설정을 함께 저장합니다. 이전 디자인 JSON도 가져올 수 있습니다.")}</FieldDescription>
    {state.recovery && !state.recoverySaved && <Alert id="saved-design-warning" variant="destructive"><CircleHelp /><AlertTitle>{studioText("저장 원본을 보존했습니다")}</AlertTitle><AlertDescription>{studioText("적용할 수 없는 저장 데이터를 아래에 열었습니다. 수정하거나 원본을 내려받으세요. 변경 전 원본 백업이 실패하면 자동 저장하지 않습니다.")}</AlertDescription></Alert>}
    <Field data-invalid={!!state.jsonError}><FieldLabel htmlFor="design-json">{studioText("장면 데이터")}</FieldLabel><Textarea ref={textarea} id="design-json" spellCheck={false} value={state.jsonDraft} onChange={event => controller.editJSON(event.target.value)} aria-invalid={!!state.jsonError} aria-describedby="json-error" className="json-editor" /><div id="json-error"><FieldError>{studioMessage(state.jsonError)}</FieldError></div></Field>
    <input ref={fileInput} id="import-scene-file" type="file" accept=".json,application/json" hidden onChange={event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (file) void importFile(file);
    }} />
    <div className="code-actions"><Button id="choose-scene-file" variant="outline" onClick={() => fileInput.current?.click()}><FileUp data-icon="inline-start" />{studioText("JSON 파일 열기")}</Button><Button id="import-json" onClick={applyJSON}>{studioText("JSON 적용")}</Button><Button id="copy-json" variant="outline" onClick={() => void copyJSON()}><Copy data-icon="inline-start" />{studioText("복사")}</Button>
      {state.recovery && <Button id="export-recovery-json" variant="outline" onClick={() => { download(new Blob([state.recovery!.raw], { type: 'application/json' }), 'sidekick.saved-original.design.json'); controller.report(studioText("저장 원본 JSON을 내보냈습니다.")); }}><ArrowDownToLine data-icon="inline-start" />{studioText("저장 원본")}</Button>}
    </div>
    <Separator />
    <section aria-labelledby="api-heading"><h2 id="api-heading" className="section-title">{studioText("현재 장면을 코드로 사용하기")}</h2>
      <FieldDescription>{studioText("몸체 방향·장비·표정·마우스 추적을 포함한 현재 설정입니다. 패키지를 설치한 번들러 프로젝트에서 사용하세요.")} <a id="usage-guide" href="https://github.com/hanana-kick/sidekick#readme" target="_blank" rel="noreferrer">{studioText("설치 · 전체 속성 가이드")}</a></FieldDescription>
      <details className="usage-example" open><summary>{studioText("HTML · 웹컴포넌트")}</summary><Button id="copy-html" variant="outline" size="sm" onClick={() => void copySnippet('html')}><Copy data-icon="inline-start" />{studioText("HTML 복사")}</Button><pre id="api-example">{snippets.html}</pre></details>
      <details className="usage-example"><summary>React · JSX</summary><Button id="copy-react" variant="outline" size="sm" onClick={() => void copySnippet('react')}><Copy data-icon="inline-start" />{studioText("React 복사")}</Button><pre id="react-example">{snippets.react}</pre></details>
    </section>
  </FieldGroup>;
}

function SiteHeaderBrand() {
  const host = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => host.current ? mountSiteHeader(host.current, 'studio', ASSET_BASE) : undefined, []);
  return <div className="site-header-brand" ref={host} />;
}

export function StudioApp({ controller }: { controller: StudioController }) {
  useSyncExternalStore(subscribeSiteLocale, getSiteLocale, getSiteLocale);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [tab, setTab] = useState(state.recovery ? 'json' : 'appearance'), [resetKey, setResetKey] = useState(0);
  const settingsScroll = useRef<HTMLDivElement>(null);
  const [composition, setComposition] = useState(defaultComposition), [sceneMode, setSceneMode] = useState(false), [sceneRefresh, setSceneRefresh] = useState(0);
  const compositionCanvas = useRef<HTMLCanvasElement>(null);
  const section = tab === 'bodyOrientation' ? 'orientation' : tab;
  const analyticsSection = useRef(section); analyticsSection.current = section;
  useLayoutEffect(() => { setSiteSection(window, 'studio', section); }, [section]);
  useLayoutEffect(() => {
    const tracker = createBotPreviewTracker({
      hasConsent: () => siteAnalyticsConsent(window), consentVersion: () => siteAnalyticsConsentVersion(window),
      record: (name, properties) => recordSiteEvent(window, name, properties),
    }, controller.getSnapshot().design);
    const unsubscribe = controller.subscribe(() => tracker.observe(controller.getSnapshot().design, analyticsSection.current));
    return () => { unsubscribe(); tracker.dispose(); };
  }, [controller]);
  function changeTab(value: string): void { setTab(value); if (value === 'scene') setSceneMode(true); if (settingsScroll.current) settingsScroll.current.scrollTop = 0; }
  function reset(): void { controller.reset(); setResetKey(key => key + 1); prepareBotUsage(window, 'preset_apply', controller.getSnapshot().design, { site_page: 'studio', site_section: section, preset: 'default' }, controller.getSnapshot())(); }
  async function exportPNG(): Promise<void> {
    const completed = prepareBotUsage(window, 'bot_export', controller.getSnapshot().design, { site_page: 'studio', site_section: section, format: 'png' }, controller.getSnapshot());
    try { download(await controller.snapshot(), 'sidekick.png'); completed(); controller.report(studioText("투명 PNG를 내보냈습니다.")); } catch (error) { controller.report(String(error), true); } }
  return <div className="studio-shell">
    <header className="app-header"><SiteHeaderBrand /></header>
    <div className="studio-toolbar" aria-label={studioText("Studio 파일 작업")}>
      <div className="header-actions"><Button id="reset" variant="ghost" onClick={reset} aria-label={studioText("디자인 초기화")}><RotateCcw data-icon="inline-start" /><span className="action-label">{studioText("초기화")}</span></Button><Button id="export-png" variant="outline" onClick={() => void exportPNG()} aria-label={studioText("PNG 저장")}><ImageDown data-icon="inline-start" /><span className="action-label">{studioText("PNG 저장")}</span></Button><Button id="export-json" onClick={() => { download(new Blob([controller.exportJSON()], { type: 'application/json' }), 'sidekick.scene.json'); prepareBotUsage(window, 'bot_export', controller.getSnapshot().design, { site_page: 'studio', site_section: section, format: 'json' }, controller.getSnapshot())(); controller.report(studioText("장면 JSON을 내보냈습니다.")); }}><FileJson data-icon="inline-start" /><span>{studioText("JSON 내보내기")}</span></Button></div>
    </div>
    <main className="workspace">
      <section className="stage" aria-label={studioText("고정 캐릭터 미리보기")}>
        <div className="stage-header"><div><h1>{studioText("나만의 작은 동료.")}</h1><p>{studioText("형태를 고르고, 개성을 더하세요.")} <a href={localizedSiteHref(`${ASSET_BASE}api-playground.html`)} className="underline">{studioText("API 체험")}</a></p></div><ToggleGroup type="single" variant="outline" size="sm" value={state.background} onValueChange={value => { if (value) controller.setBackground(value as StudioState['background']); }} aria-label={studioText("미리보기 배경")} className="background-options">{([['checker', studioText("투명")], ['light', studioText("밝게")], ['dark', studioText("어둡게")]] as const).map(([value, label]) => <ToggleGroupItem key={value} value={value} data-background={value}>{studioLabel(label)}</ToggleGroupItem>)}</ToggleGroup></div>
        <div className="previews" data-background={state.background} data-scene-mode={sceneMode}><div className="preview"><AvatarPreview controller={controller} /></div>{sceneMode && <CompositionPreview controller={controller} state={state} composition={composition} canvasRef={compositionCanvas} refresh={sceneRefresh} onChange={setComposition} />}</div>
        <footer className="preview-footer"><ToggleGroup type="single" size="sm" value={sceneMode ? "scene" : "character"} onValueChange={value => { if (value) setSceneMode(value === "scene"); }} aria-label={studioText("편집 화면")}><ToggleGroupItem value="character">{studioText("캐릭터")}</ToggleGroupItem><ToggleGroupItem value="scene">{studioText("장면")}</ToggleGroupItem></ToggleGroup><span className="preview-shape">{studioShapeLabel(state.design.body.shape)}<Badge variant="secondary">{studioText("Flat")}</Badge></span><span className="preview-hint"><Move aria-hidden="true" />{studioText("드래그 회전 · 휠/핀치 확대")}</span></footer>
      </section>
      <aside className="inspector" aria-label={studioText("캐릭터 디자인 설정")}>
        <Tabs value={tab} onValueChange={changeTab} className="settings-tabs"><div className="settings-nav"><TabsList className="w-full" aria-label={studioText("디자인 항목")}><TabsTrigger value="appearance" id="appearance-tab" aria-controls="appearance-panel">{studioText("외형")}</TabsTrigger><TabsTrigger value="animation" id="animation-tab" aria-controls="animation-panel">{studioText("애니메이션")}</TabsTrigger><TabsTrigger value="bodyOrientation" id="body-orientation-tab" aria-controls="body-orientation-panel">{studioText("몸체 방향")}</TabsTrigger><TabsTrigger value="scene" id="scene-tab" aria-controls="scene-panel">{studioText("장면")}</TabsTrigger><TabsTrigger value="json" id="json-tab" aria-controls="json-panel">JSON</TabsTrigger></TabsList></div>
          <div ref={settingsScroll} className="settings-scroll" data-testid="settings-scroll">
            {state.warnings.length > 0 && <Alert id="migration-warning" className="migration-warning"><AlertTitle>{studioText("이전 디자인을 v7으로 변환했습니다")}</AlertTitle><AlertDescription>{state.warnings.map(warning => studioMessage(warning)).join(' ')}</AlertDescription></Alert>}
            <TabsContent value="appearance" forceMount hidden={tab !== 'appearance'} id="appearance-panel" aria-labelledby="appearance-tab"><AppearancePanel state={state} controller={controller} resetKey={resetKey} /></TabsContent>
            <TabsContent value="animation" forceMount hidden={tab !== 'animation'} id="animation-panel" aria-labelledby="animation-tab"><AnimationPanel state={state} controller={controller} /></TabsContent>
            <TabsContent value="bodyOrientation" forceMount hidden={tab !== 'bodyOrientation'} id="body-orientation-panel" aria-labelledby="body-orientation-tab"><BodyOrientationPanel state={state} controller={controller} /></TabsContent>
            <TabsContent value="scene" forceMount hidden={tab !== 'scene'} id="scene-panel" aria-labelledby="scene-tab"><CompositionPanel controller={controller} composition={composition} onChange={setComposition} canvasRef={compositionCanvas} onRefresh={() => setSceneRefresh(n => n + 1)} /></TabsContent>
            <TabsContent value="json" forceMount hidden={tab !== 'json'} id="json-panel" aria-labelledby="json-tab"><JSONPanel state={state} controller={controller} /></TabsContent>
          </div>
        </Tabs>
        <footer className="inspector-footer"><span id="status" role="status" aria-live="polite" data-error={state.statusError}>{studioMessage(state.status)}</span></footer>
      </aside>
    </main>
  </div>;
}
