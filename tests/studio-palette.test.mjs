import test from 'node:test';
import assert from 'node:assert/strict';
import { createShapePalette, materialSilhouettePath, matchingMaterialShapes, paletteNavigationIndex } from '../dist/playground/shape-palette.js';
import { MATERIAL_SHAPE_NAMES, MATERIAL_SHAPE_LABELS } from '../dist/src/core/shapes.js';
import { MATERIAL_SHAPE_CUBICS } from '../dist/src/core/material-shapes.js';

// Deliberately layout-free: this fixture tests interaction contracts without
// launching a browser or pretending to validate visual rendering/WebGL.
class MockElement {
  constructor(document, tagName) {
    this.ownerDocument = document; this.tagName = tagName; this.children = [];
    this.listeners = new Map(); this.attributes = new Map(); this.dataset = {};
    this.hidden = false; this.tabIndex = -1; this.textContent = ''; this.value = '';
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name); }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) ?? []; listeners.push(listener); this.listeners.set(name, listeners);
  }
  dispatch(name, values = {}) {
    const event = { key: '', prevented: false, preventDefault() { this.prevented = true; }, ...values };
    for (const listener of this.listeners.get(name) ?? []) listener(event);
    return event;
  }
  focus() { this.ownerDocument.activeElement = this; this.dispatch('focus'); }
  get offsetTop() {
    const index = (this.parent?.children ?? []).filter(child => !child.hidden).indexOf(this);
    return Math.floor(index / this.ownerDocument.columns) * 88;
  }
}
function fixture() {
  const document = { activeElement: null, columns: 7,
    createElement(tag) { return new MockElement(this, tag); },
    createElementNS(_namespace, tag) { return this.createElement(tag); },
  };
  const container = document.createElement('div'), search = document.createElement('input');
  const countStatus = document.createElement('span'), selectedStatus = document.createElement('span');
  const choices = []; let selection = 'square';
  const palette = createShapePalette({ container, search, countStatus, selectedStatus,
    onSelect(shape) { choices.push(shape); selection = shape; palette.sync(shape); },
  });
  palette.sync(selection);
  return { document, container, search, countStatus, selectedStatus, palette, choices,
    button: name => container.children.find(button => button.dataset.shape === name),
    visible: () => container.children.filter(button => !button.hidden),
  };
}

test('all 35 silhouette paths preserve every official cubic coordinate and orientation', () => {
  const paths = new Set();
  for (const name of MATERIAL_SHAPE_NAMES) {
    const path = materialSilhouettePath(name), cubics = MATERIAL_SHAPE_CUBICS[name];
    assert.match(path, /^M[^A-Za-z]* C/); assert.match(path, / Z$/);
    const coordinates = path.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi).map(Number);
    assert.deepEqual(coordinates, [cubics[0][0], cubics[0][1], ...cubics.flatMap(c => c.slice(2))], name);
    assert.equal((path.match(/C/g) ?? []).length, cubics.length);
    paths.add(path);
  }
  assert.equal(paths.size, 35);
});

test('palette exposes stable native buttons, labels, exact SVG paths and one selected tab stop', () => {
  const f = fixture(); assert.equal(f.container.children.length, 35);
  assert.deepEqual(f.container.children.map(button => button.dataset.shape), [...MATERIAL_SHAPE_NAMES]);
  for (const button of f.container.children) {
    const name = button.dataset.shape;
    assert.equal(button.tagName, 'button'); assert.equal(button.type, 'button');
    assert.equal(button.getAttribute('aria-label'), `${MATERIAL_SHAPE_LABELS[name]} 몸체 도형`);
    assert.equal(button.children[1].textContent, MATERIAL_SHAPE_LABELS[name]);
    assert.equal(button.children[0].tagName, 'svg'); assert.equal(button.children[0].getAttribute('aria-hidden'), 'true');
    assert.equal(button.children[0].children[0].getAttribute('d'), materialSilhouettePath(name));
  }
  assert.equal(f.button('square').tabIndex, 0);
  assert.deepEqual(f.container.children.filter(button => button.getAttribute('aria-pressed') === 'true'), [f.button('square')]);
  const original = [...f.container.children];
  f.button('heart').focus(); f.button('heart').dispatch('click');
  assert.deepEqual(f.choices, ['heart']); assert.equal(f.document.activeElement, f.button('heart'));
  assert.equal(f.button('heart').getAttribute('aria-pressed'), 'true'); assert.equal(f.button('square').getAttribute('aria-pressed'), 'false');
  assert.deepEqual(f.container.children, original);
  f.palette.sync('heart'); assert.equal(f.document.activeElement, f.button('heart'));
});

test('arrow navigation follows seven/five-column geometry and never selects until activation', () => {
  const f = fixture(); const first = f.button('circle'); first.focus();
  assert.equal(first.dispatch('keydown', { key: 'ArrowDown' }).prevented, true);
  assert.equal(f.document.activeElement, f.button(MATERIAL_SHAPE_NAMES[7]));
  f.document.columns = 5;
  f.document.activeElement.dispatch('keydown', { key: 'ArrowDown' });
  assert.equal(f.document.activeElement, f.button(MATERIAL_SHAPE_NAMES[12]));
  f.document.activeElement.dispatch('keydown', { key: 'ArrowUp' });
  assert.equal(f.document.activeElement, f.button(MATERIAL_SHAPE_NAMES[7]));
  f.document.activeElement.dispatch('keydown', { key: 'Home' }); assert.equal(f.document.activeElement, first);
  first.dispatch('keydown', { key: 'ArrowLeft' }); assert.equal(f.document.activeElement, f.button('heart'));
  f.document.activeElement.dispatch('keydown', { key: 'ArrowRight' }); assert.equal(f.document.activeElement, first);
  first.dispatch('keydown', { key: 'End' }); assert.equal(f.document.activeElement, f.button('heart'));
  assert.deepEqual(f.choices, []); assert.equal(f.button('square').getAttribute('aria-pressed'), 'true');
  assert.equal(f.document.activeElement.dispatch('keydown', { key: 'Tab' }).prevented, false);
  assert.equal(f.document.activeElement.dispatch('keydown', { key: 'ArrowLeft', ctrlKey: true }).prevented, false);
  assert.equal(f.container.children.filter(button => button.tabIndex === 0).length, 1);
});

test('search preserves selected shape and search focus, empty state and roving recovery', () => {
  const f = fixture(); f.palette.sync('verySunny'); f.search.focus();
  f.search.value = 'star'; f.search.dispatch('input');
  assert.equal(f.document.activeElement, f.search);
  assert.equal(f.visible().length, matchingMaterialShapes('star').length); assert.ok(f.visible().length < 35);
  assert.equal(f.button('verySunny').tabIndex, 0); assert.equal(f.button('square').hidden, true);
  f.search.value = 'no-such-material-shape'; f.search.dispatch('input');
  assert.equal(f.visible().length, 0); assert.match(f.countStatus.textContent, /검색 결과가 없습니다/);
  assert.equal(f.selectedStatus.textContent, '현재: Very Sunny');
  assert.equal(f.container.children.filter(button => button.tabIndex === 0).length, 0);
  assert.equal(f.document.activeElement, f.search);
  f.search.value = ''; f.search.dispatch('input'); assert.equal(f.visible().length, 35);
  assert.equal(f.button('verySunny').tabIndex, 0);
  f.button('square').focus(); f.search.value = 'heart'; f.palette.sync('verySunny');
  assert.equal(f.document.activeElement, f.button('heart'));
  f.search.value = 'no-results'; f.palette.sync('verySunny'); assert.equal(f.document.activeElement, f.search);
});

test('reset/import synchronization never steals focus and rapid selection keeps all nodes', () => {
  const f = fixture(), original = [...f.container.children];
  const reset = f.document.createElement('button'), importButton = f.document.createElement('button');
  f.button('heart').focus(); f.button('heart').dispatch('click');
  f.palette.sync('circle'); assert.equal(f.document.activeElement, f.button('heart'));
  assert.equal(f.button('heart').tabIndex, 0); assert.equal(f.button('circle').getAttribute('aria-pressed'), 'true');
  reset.focus(); f.palette.sync('square'); assert.equal(f.document.activeElement, reset); assert.equal(f.button('square').tabIndex, 0);
  importButton.focus(); f.palette.sync('puffy'); assert.equal(f.document.activeElement, importButton); assert.equal(f.button('puffy').tabIndex, 0);
  for (const name of ['verySunny', 'clover4Leaf', 'heart', 'pixelCircle', 'heart']) {
    f.button(name).focus(); f.button(name).dispatch('click'); assert.equal(f.document.activeElement, f.button(name));
  }
  assert.deepEqual(f.choices, ['heart', 'verySunny', 'clover4Leaf', 'heart', 'pixelCircle', 'heart']);
  assert.deepEqual(f.container.children, original); assert.equal(f.container.children.length, 35);
});

test('navigation and multilingual search edge cases are bounded', () => {
  assert.equal(paletteNavigationIndex('Home', 0, 0, 7), undefined);
  assert.equal(paletteNavigationIndex('ArrowDown', 33, 35, 7), 33);
  assert.equal(paletteNavigationIndex('ArrowUp', 2, 35, 7), 2);
  assert.equal(paletteNavigationIndex('ArrowDown', 5, 10, 7), 9);
  assert.equal(paletteNavigationIndex('ArrowRight', 0, 1, 0), 0);
  assert.equal(paletteNavigationIndex('Enter', 0, 35, 7), undefined);
  assert.equal(matchingMaterialShapes('  ').length, 35);
  assert.deepEqual(matchingMaterialShapes(' COOKIE '), MATERIAL_SHAPE_NAMES.filter(name => name.startsWith('cookie')));
  assert.deepEqual(matchingMaterialShapes('쿠키'), matchingMaterialShapes('cookie'));
  assert.deepEqual(matchingMaterialShapes('클로버'), matchingMaterialShapes('clover'));
});
