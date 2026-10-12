'use strict';
// One searchable dropdown of every implementation in the class, the same
// picker as in the Sorting Sandbox: "Tree (AVL) · alice [Python]". Typing
// filters by structure, student, file variant or language. Language tags
// appear (for Dart, too) as soon as the class writes in more than one language.
function pickerNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}
function pickerIcon(name, className = '') {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('class', `ui-icon ${className}`.trim());
  node.setAttribute('viewBox', '0 0 24 24');
  node.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `/vendor/tabler-icons.svg#ti-${name}`);
  node.append(use);
  return node;
}
const pickerKey = item => item ? `${item.student}\u0000${item.kind}:${item.variant ?? ''}` : '';

class ImplementationPicker {
  constructor(container, {onSelect}) {
    this.container = container;
    this.onSelect = onSelect;
    this.items = [];
    this.value = '';
    this.open = false;
    this.active = 0;
    this.filtered = [];

    this.button = pickerNode('button', 'picker-button');
    this.button.type = 'button';
    this.button.setAttribute('aria-haspopup', 'listbox');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.setAttribute('aria-label', 'Choose student and data structure');
    this.filter = pickerNode('input', 'picker-filter');
    this.filter.type = 'search';
    this.filter.placeholder = 'Filter by structure, student or language…';
    this.filter.setAttribute('aria-label', 'Filter implementations');
    this.filter.setAttribute('autocomplete', 'off');
    this.filter.setAttribute('spellcheck', 'false');
    this.options = pickerNode('div', 'picker-options');
    this.options.setAttribute('role', 'listbox');
    this.options.setAttribute('aria-label', 'Implementations');
    this.popover = pickerNode('div', 'picker-popover');
    this.popover.hidden = true;
    this.popover.append(this.filter, this.options);
    container.append(this.button, this.popover);

    this.button.addEventListener('click', () => this.toggle());
    this.button.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' && !this.open) {
        event.preventDefault();
        this.toggle(true);
      }
    });
    this.filter.addEventListener('input', () => {
      this.active = 0;
      this.renderOptions();
    });
    this.filter.addEventListener('keydown', event => this.keydown(event));
    document.addEventListener?.('pointerdown', event => {
      if (this.open && !container.contains?.(event.target)) this.toggle(false);
    });
    this.render();
  }

  /** [{student, kind, variant, name, language}] in display order. */
  setItems(items) {
    this.items = items;
    this.mixed = new Set(items.map(item => item.language)).size > 1;
    this.render();
  }

  setValue(item) {
    this.value = pickerKey(item);
    this.render();
  }

  get selected() {
    return this.items.find(item => pickerKey(item) === this.value) ?? null;
  }

  toggle(force) {
    const open = force ?? !this.open;
    if (open === this.open || (open && this.button.disabled)) return;
    this.open = open;
    this.popover.hidden = !open;
    this.button.setAttribute('aria-expanded', String(open));
    if (open) {
      this.filter.value = '';
      this.active = Math.max(0, this.items.findIndex(item => pickerKey(item) === this.value));
      this.renderOptions();
      this.filter.focus();
      this.options.children[this.active]?.scrollIntoView?.({block: 'nearest'});
    }
  }

  keydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.toggle(false);
      this.button.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.filtered.length) return;
      this.active = (this.active + (event.key === 'ArrowDown' ? 1 : -1) + this.filtered.length) %
        this.filtered.length;
      this.renderOptions();
      this.options.children[this.active]?.scrollIntoView?.({block: 'nearest'});
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const choice = this.filtered[this.active];
      if (choice) this.choose(choice);
    }
  }

  choose(item) {
    this.toggle(false);
    this.button.focus();
    if (pickerKey(item) !== this.value) this.onSelect(item);
  }

  describe(item, parent) {
    parent.append(pickerNode('span', 'picker-name', item.name),
      pickerNode('span', 'picker-author', item.student));
    if (this.mixed) parent.append(pickerNode('span', 'picker-language', item.language));
  }

  render() {
    const item = this.selected;
    this.button.replaceChildren();
    if (item) {
      this.describe(item, this.button);
      this.button.title = `${item.name} · ${item.student} · ${item.language}`;
    } else {
      this.button.append(pickerNode('span', 'picker-placeholder',
        this.items.length ? 'Choose an implementation' : 'No implementations yet'));
      this.button.title = '';
    }
    this.button.append(pickerIcon('chevron-down', 'picker-chevron'));
    if (this.open) this.renderOptions();
  }

  renderOptions() {
    const words = this.filter.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    this.filtered = this.items.filter(item => {
      const text = `${item.name} ${item.student} ${item.kind} ${item.variant} ${item.language}`.toLowerCase();
      return words.every(word => text.includes(word));
    });
    if (this.active >= this.filtered.length) this.active = Math.max(0, this.filtered.length - 1);
    this.options.replaceChildren(...this.filtered.map((item, index) => {
      const selected = pickerKey(item) === this.value;
      const option = pickerNode('div',
        `picker-option${index === this.active ? ' active' : ''}${selected ? ' selected' : ''}`);
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(selected));
      option.addEventListener('pointerdown', event => event.preventDefault());
      option.addEventListener('click', () => this.choose(item));
      option.addEventListener('pointermove', () => {
        if (this.active === index) return;
        this.active = index;
        for (const [i, child] of [...this.options.children].entries()) child.classList.toggle('active', i === index);
      });
      this.describe(item, option);
      const check = pickerNode('span', 'picker-check');
      if (selected) check.append(pickerIcon('check'));
      option.append(check);
      return option;
    }));
    if (!this.filtered.length) {
      this.options.append(pickerNode('div', 'picker-empty', this.items.length
        ? 'No implementation matches this filter.'
        : 'The class repository has no implementations yet.'));
    }
  }
}
