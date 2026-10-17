import { MATERIAL_SHAPE_CUBICS } from '../src/core/material-shapes.js';
import { MATERIAL_SHAPE_LABELS, MATERIAL_SHAPE_NAMES } from '../src/core/shapes.js';
import type { MaterialShapeName } from '../src/core/shapes.js';

/** Use the exact normalized, Y-down official cubics. SVG uses the same Y axis. */
export function materialSilhouettePath(name: MaterialShapeName): string {
  const cubics = MATERIAL_SHAPE_CUBICS[name], first = cubics[0]!;
  return `M${first[0]} ${first[1]} ${cubics.map(c => `C${c[2]} ${c[3]} ${c[4]} ${c[5]} ${c[6]} ${c[7]}`).join(' ')} Z`;
}
function materialGroup(name: MaterialShapeName): string {
  if (/cookie/i.test(name)) return '쿠키';
  if (/sunny/i.test(name)) return '별 햇살';
  if (/burst|boom/i.test(name)) return '별 방사형';
  if (/clover/i.test(name)) return '클로버 유기형';
  if (/flower/i.test(name)) return '꽃 유기형';
  if (/puffy|soft|heart/i.test(name)) return '유기형';
  if (/pixel/i.test(name)) return '픽셀 개성형';
  if (/bun|ghost|arrow|fan|slanted/i.test(name)) return '개성형';
  return '기하학 기본형';
}
export function matchingMaterialShapes(query: string): MaterialShapeName[] {
  const normalized = query.trim().toLocaleLowerCase();
  return MATERIAL_SHAPE_NAMES.filter(name => `${name} ${MATERIAL_SHAPE_LABELS[name]} ${materialGroup(name)} ${/sunny|burst|boom/i.test(name) ? 'star 별' : ''}`.toLocaleLowerCase().includes(normalized));
}
/** Arrow keys move focus only; native Enter/Space activate the focused button. */
export function paletteNavigationIndex(key: string, index: number, count: number, columns: number): number | undefined {
  if (!count) return undefined;
  const width = Math.max(1, Math.floor(columns));
  switch (key) {
    case 'ArrowRight': return (index + 1) % count;
    case 'ArrowLeft': return (index + count - 1) % count;
    case 'ArrowDown': return (Math.floor(index / width) + 1) * width < count ? Math.min(index + width, count - 1) : index;
    case 'ArrowUp': return index >= width ? index - width : index;
    case 'Home': return 0;
    case 'End': return count - 1;
    default: return undefined;
  }
}
interface ShapePaletteOptions {
  container: HTMLElement;
  search: HTMLInputElement;
  countStatus: HTMLElement;
  selectedStatus: HTMLElement;
  onSelect: (shape: MaterialShapeName) => void;
}
export interface ShapePalette { sync: (selected: MaterialShapeName) => void }

/** Persistent nodes preserve focus while selection, reset, import and sliders sync. */
export function createShapePalette(options: ShapePaletteOptions): ShapePalette {
  const { container, search, countStatus, selectedStatus, onSelect } = options;
  const document = container.ownerDocument;
  const buttons = new Map<MaterialShapeName, HTMLButtonElement>();
  let selected: MaterialShapeName = 'square';
  const visibleButtons = (): HTMLButtonElement[] => [...buttons.values()].filter(button => !button.hidden);
  const setRoving = (target: HTMLButtonElement | undefined): void => {
    for (const button of buttons.values()) button.tabIndex = button === target ? 0 : -1;
  };
  for (const name of MATERIAL_SHAPE_NAMES) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'shape-tile'; button.dataset.shape = name;
    button.setAttribute('aria-label', `${MATERIAL_SHAPE_LABELS[name]} 몸체 도형`);
    button.setAttribute('aria-pressed', 'false'); button.tabIndex = -1;
    button.title = `${MATERIAL_SHAPE_LABELS[name]} · ${materialGroup(name)}`;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '-0.08 -0.08 1.16 1.16');
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', materialSilhouettePath(name)); svg.append(path);
    const label = document.createElement('span'); label.className = 'shape-tile-label'; label.textContent = MATERIAL_SHAPE_LABELS[name];
    const check = document.createElement('span'); check.className = 'shape-tile-check'; check.textContent = '✓'; check.setAttribute('aria-hidden', 'true');
    button.append(svg, label, check);
    button.addEventListener('focus', () => setRoving(button));
    button.addEventListener('click', () => onSelect(name));
    button.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const visible = visibleButtons(), index = visible.indexOf(button);
      // Read actual wrapped rows, so keyboard navigation follows every responsive layout.
      const firstTop = visible[0]?.offsetTop ?? 0;
      const columns = visible.filter(item => Math.abs(item.offsetTop - firstTop) < 1).length;
      const next = paletteNavigationIndex(event.key, index, visible.length, columns);
      if (next === undefined) return;
      event.preventDefault(); setRoving(visible[next]); visible[next]!.focus();
    });
    buttons.set(name, button); container.append(button);
  }
  function sync(next: MaterialShapeName): void {
    selected = next;
    const focused = [...buttons.values()].find(button => button === document.activeElement);
    const matches = new Set(matchingMaterialShapes(search.value));
    for (const [name, button] of buttons) {
      button.hidden = !matches.has(name);
      button.setAttribute('aria-pressed', String(name === selected));
    }
    const selectedButton = buttons.get(selected);
    const target = focused && !focused.hidden ? focused : selectedButton && !selectedButton.hidden ? selectedButton : visibleButtons()[0];
    setRoving(target);
    // Never steal focus from search/reset/import. If a focused tile is filtered out,
    // move to a visible tile, or back to search when no results remain.
    if (focused?.hidden) (target ?? search).focus();
    const countText = matches.size ? `${matches.size} / ${MATERIAL_SHAPE_NAMES.length}개 도형` : '검색 결과가 없습니다. 다른 이름이나 분류를 입력하세요.';
    if (countStatus.textContent !== countText) countStatus.textContent = countText;
    selectedStatus.textContent = `현재: ${MATERIAL_SHAPE_LABELS[selected]}`;
  }
  search.addEventListener('input', () => sync(selected));
  return { sync };
}
