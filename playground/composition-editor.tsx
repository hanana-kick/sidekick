import { studioText, studioFormat, studioMessage } from './studio-locales.js';
import { prepareBotUsage } from './site-product-usage.js';
import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldLabel, FieldGroup, FieldDescription } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { ChoiceField, ColorField, RangeField } from './studio-controls';
import { defaultComposition, ogAvatarScene, paintComposition, parseCompositionDocument, serializeComposition } from './composition';
import type { Composition } from './composition';
import { captureCompositionAvatar } from './composition-capture';
import type { StudioController, StudioState } from './studio-controller';
export function downloadSceneFile(blob: Blob, name: string): void { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function CompositionPreview({ controller, state, composition, canvasRef, refresh, onChange }: { controller: StudioController; state: StudioState; composition: Composition; canvasRef: RefObject<HTMLCanvasElement | null>; refresh: number; onChange: (next: Composition) => void }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(true);
  const latestComposition = useRef(composition); latestComposition.current = composition;
  const cachedBitmap = useRef<ImageBitmap | null>(null);
  useEffect(() => { if (cachedBitmap.current && canvasRef.current) paintComposition(canvasRef.current, composition, cachedBitmap.current); }, [composition, canvasRef]);
  useEffect(() => () => { cachedBitmap.current?.close(); cachedBitmap.current = null; }, []);
  const drag = useRef<{ kind: 'character' | 'text'; x: number; y: number; initial: Composition } | null>(null);
  useEffect(() => {
    let cancelled = false; setBusy(true);
    const timer = setTimeout(() => { void (async () => {
      let bitmap: ImageBitmap | undefined;
      try { await document.fonts.ready; bitmap = await createImageBitmap(await controller.snapshot()); if (!cancelled && canvasRef.current) { cachedBitmap.current?.close(); cachedBitmap.current = bitmap; paintComposition(canvasRef.current, latestComposition.current, bitmap); bitmap = undefined; setError(''); } }
      catch (cause) { if (!cancelled) setError(String(cause)); }
      finally { bitmap?.close(); if (!cancelled) setBusy(false); }
    })(); }, Math.max(state.duration, state.motionDuration) + 80);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [controller, state.design, state.bodyOrientation, state.zoom, state.activity, state.paused, state.gaze, state.motion, state.time, state.duration, state.motionDuration, canvasRef, refresh]);
  return <div className="composition-preview" aria-label={studioText("장면 미리보기")}><canvas ref={canvasRef} aria-label={studioFormat('{width} × {height} 장면, 캐릭터나 글자를 드래그해 이동', { width: composition.width, height: composition.height })} onPointerDown={event => { const rect = event.currentTarget.getBoundingClientRect(), x = (event.clientX - rect.left) / rect.width * 100, y = (event.clientY - rect.top) / rect.height * 100; const characterDistance = Math.hypot(x - composition.characterX, y - composition.characterY), textDistance = Math.hypot(x - composition.textX, y - composition.textY); drag.current = { kind: characterDistance < textDistance ? 'character' : 'text', x, y, initial: composition }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { const d = drag.current; if (!d) return; const rect = event.currentTarget.getBoundingClientRect(), dx = (event.clientX - rect.left) / rect.width * 100 - d.x, dy = (event.clientY - rect.top) / rect.height * 100 - d.y, clamp = (v: number) => Math.max(0, Math.min(100, v)); onChange({ ...d.initial, [d.kind + 'X']: clamp(d.initial[d.kind === 'character' ? 'characterX' : 'textX'] + dx), [d.kind + 'Y']: clamp(d.initial[d.kind === 'character' ? 'characterY' : 'textY'] + dy) }); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} /><span className="composition-status" role="status">{studioMessage(error) || (busy ? studioText("장면 렌더링 중…") : `${composition.width} × ${composition.height} · ${studioText("정지 프레임")}`)}</span></div>;
}
export function CompositionPanel({ controller, composition: p, onChange, canvasRef, onRefresh }: { controller: StudioController; composition: Composition; onChange: (next: Composition) => void; canvasRef: RefObject<HTMLCanvasElement | null>; onRefresh: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const patch = (next: Partial<Composition>): void => onChange({ ...p, ...next });
  const position = (key: 'characterX' | 'characterY' | 'textX' | 'textY', label: string) => <RangeField id={`scene-${key}`} label={label} value={p[key]} min={0} max={100} step={.5} suffix="%" onChange={value => patch({ [key]: value })} />;
  async function exportPNG(): Promise<void> {
    if (exporting) return; setExporting(true);
    try { const bitmap = await createImageBitmap(await captureCompositionAvatar(controller.exportScene())); const canvas = document.createElement('canvas'); try { await document.fonts.ready; paintComposition(canvas, p, bitmap); } finally { bitmap.close(); } const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error(studioText("PNG 생성 실패"))), 'image/png')); downloadSceneFile(blob, 'sidekick.composition.png'); controller.report(studioFormat('{width} × {height} 장면 PNG를 내보냈습니다.', { width: p.width, height: p.height })); }
    catch (cause) { controller.report(String(cause), true); } finally { setExporting(false); }
  }
  return <FieldGroup>
    <div className="section-heading"><h2>{studioText("장면 구성")}</h2><Button id="scene-refresh" variant="outline" size="sm" onClick={onRefresh}>{studioText("새 프레임")}</Button></div>
    <FieldDescription>{studioText("캐릭터와 텍스트를 배치해 OG 이미지·카드를 만듭니다. 미리보기의 캐릭터나 텍스트를 드래그해 이동하세요. 미리보기는 현재 캐릭터의 정지 프레임이며 몸체 방향 탭에서 방향을 조절할 수 있습니다.")}</FieldDescription>
    <Button id="scene-og-preset" variant="outline" onClick={() => { if (controller.importJSON(JSON.stringify(ogAvatarScene()))) { onChange(defaultComposition()); onRefresh(); prepareBotUsage(window, 'preset_apply', controller.getSnapshot().design, { site_page: 'studio', site_section: 'scene', preset: 'sidekick_og' }, controller.getSnapshot())(); } }}>{studioText("Sidekick OG 프리셋 적용")}</Button>
    <FieldDescription>{studioText("프리셋은 캐릭터도 Ghostish · 안경 · 베레모 · 보타이 · 웃음으로 바꿉니다.")}</FieldDescription>
    <ChoiceField id="scene-size" label={studioText("캔버스 프리셋")} value={`${p.width}x${p.height}`} onChange={value => { const [width, height] = value.split('x').map(Number); patch({ width: width!, height: height! }); }} options={[{ value: '1200x630', label: 'OG · 1200 × 630' }, { value: '1080x1080', label: studioText("정사각형 · 1080 × 1080") }, { value: '1920x1080', label: studioText("와이드 · 1920 × 1080") }, ...(!['1200x630','1080x1080','1920x1080'].includes(`${p.width}x${p.height}`) ? [{ value: `${p.width}x${p.height}`, label: `${p.width} × ${p.height}` }] : [])]} />
    <div className="scene-dimensions">{(['width', 'height'] as const).map(key => <Field key={key}><FieldLabel htmlFor={`scene-${key}`}>{key === 'width' ? studioText("너비") : studioText("높이")} (px)</FieldLabel><Input id={`scene-${key}`} type="number" min={320} max={4096} value={p[key]} onChange={event => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 320 && value <= 4096 && value * p[key === 'width' ? 'height' : 'width'] <= 8388608) patch({ [key]: value }); }} /></Field>)}</div>
    <ColorField id="scene-background" label={studioText("장면 배경")} value={p.background} onChange={background => patch({ background })} />
    <Separator /><h3 className="section-title">{studioText("캐릭터 배치")}</h3>
    {position('characterX', studioText("가로 위치"))}{position('characterY', studioText("세로 위치"))}
    <RangeField id="scene-character-height" label={studioText("캐릭터 높이")} value={p.characterHeight} min={10} max={140} suffix="%" onChange={characterHeight => patch({ characterHeight })} />
    <Separator /><h3 className="section-title">{studioText("텍스트")}</h3>
    <Field><FieldLabel htmlFor="scene-text">{studioText("내용")}</FieldLabel><Textarea id="scene-text" value={p.text} maxLength={200} onChange={event => patch({ text: event.target.value })} /></Field>
    {position('textX', studioText("텍스트 가로 위치"))}{position('textY', studioText("텍스트 세로 위치"))}
    <RangeField id="scene-font-size" label={studioText("글자 크기")} value={p.fontSize} min={12} max={300} suffix="px" onChange={fontSize => patch({ fontSize })} />
    <ChoiceField id="scene-font" label={studioText("글꼴")} value={p.font} onChange={font => patch({ font: font as Composition['font'] })} options={[{ value: 'sans', label: studioText("Sans · Geist") }, { value: 'serif', label: studioText("Serif · Georgia") }, { value: 'mono', label: studioText("Monospace") }]} />
    <ColorField id="scene-text-color" label={studioText("글자 색상")} value={p.textColor} onChange={textColor => patch({ textColor })} />
    <Separator /><div className="code-actions"><Button id="export-composition-png" disabled={exporting} onClick={() => void exportPNG()}>{exporting ? studioText("고해상도 렌더링 중…") : studioText("장면 PNG 저장")}</Button><Button id="export-composition-json" variant="outline" onClick={() => downloadSceneFile(new Blob([serializeComposition(p, controller.exportScene())], { type: 'application/json' }), 'sidekick.composition.json')}>{studioText("장면 JSON 저장")}</Button><Button id="import-composition-json" variant="outline" onClick={() => file.current?.click()}>{studioText("장면 JSON 열기")}</Button></div>
    <FieldDescription>{studioText("장면 PNG는 캔버스 전체를 저장합니다. 상단 PNG 저장은 기존처럼 캐릭터만 투명하게 잘라 저장합니다. JSON에는 배치와 캐릭터가 함께 포함됩니다.")}</FieldDescription>
    <input ref={file} type="file" accept=".json,application/json" hidden onChange={event => { const selected = event.target.files?.[0]; event.target.value = ''; if (selected) void (async () => { try { if (selected.size > 131072) throw new Error(studioText("128 KiB 이하 파일을 선택하세요.")); const doc = parseCompositionDocument(await selected.text()); if (controller.importJSON(JSON.stringify(doc.avatar))) { onChange(doc.composition); onRefresh(); } } catch (cause) { controller.report(String(cause), true); } })(); }} />
    <span hidden>{canvasRef.current ? 'ready' : ''}</span>
  </FieldGroup>;
}
