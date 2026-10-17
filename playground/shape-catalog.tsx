import { useLayoutEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { MaterialShapeName } from '../src/core/shapes.js';
import { createShapePalette } from './shape-palette.js';
import type { ShapePalette } from './shape-palette.js';

/** Palette owns persistent native SVG buttons; React owns its surrounding form. */
export function ShapeCatalog({ selected, onSelect, resetKey }: { selected: MaterialShapeName; onSelect: (shape: MaterialShapeName) => void; resetKey: number }) {
  const container = useRef<HTMLDivElement>(null), search = useRef<HTMLInputElement>(null);
  const countStatus = useRef<HTMLSpanElement>(null), selectedStatus = useRef<HTMLSpanElement>(null);
  const palette = useRef<ShapePalette | undefined>(undefined), onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  useLayoutEffect(() => {
    // The effect can be replayed without creating duplicate nodes or listeners.
    if (!palette.current && container.current && search.current && countStatus.current && selectedStatus.current) {
      palette.current = createShapePalette({ container: container.current, search: search.current, countStatus: countStatus.current, selectedStatus: selectedStatus.current, onSelect: shape => onSelectRef.current(shape) });
    }
    palette.current?.sync(selected);
  }, [selected]);
  useLayoutEffect(() => { if (search.current) search.current.value = ''; palette.current?.sync(selected); }, [resetKey]);
  return <section aria-labelledby="shape-catalog-heading" className="catalog-section">
    <div className="section-heading"><h2 id="shape-catalog-heading">몸체 도형</h2><span className="section-meta">35 Material shapes</span></div>
    <Field><FieldLabel htmlFor="shape-search" className="sr-only">도형 검색</FieldLabel>
      <div className="catalog-search"><Search aria-hidden="true" /><Input ref={search} id="shape-search" type="search" placeholder="도형 검색 · Star, 쿠키, 클로버…" autoComplete="off" aria-controls="material-shape" aria-describedby="shape-search-status" /></div>
      <FieldDescription id="shape-palette-help">윤곽을 눌러 선택하세요. 방향키로 이동 · Enter로 선택</FieldDescription>
    </Field>
    <div ref={container} id="material-shape" className="shape-palette" role="group" aria-labelledby="shape-catalog-heading" aria-describedby="shape-palette-help selected-shape" />
    <div className="catalog-status"><span ref={selectedStatus} id="selected-shape" /><span ref={countStatus} id="shape-search-status" role="status" aria-live="polite" /></div>
  </section>;
}
