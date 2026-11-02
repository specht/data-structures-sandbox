// Dark or light, and the color theme of each (themes.css): one swatch menu in
// the top bar. The local server keeps dark/light in .settings.yaml next to the
// app (ignored by Git) and writes it into the page, so the page never flashes
// the wrong colors; the color theme of each mode is a personal choice kept in
// this browser. A sandbox with an older page may still have the sun/moon
// switch (#theme-toggle); it keeps working.
(() => {
  const root = document.documentElement;
  if (!root) return;
  const paletteKey = 'data-structure-sandbox.v1.palette';
  const savedPalettes = () => {
    try { return JSON.parse(localStorage.getItem(paletteKey) || '{}') || {}; } catch (_) { return {}; }
  };
  /** [{id, label}] of a mode, from themes.css; the first is the default. */
  const themesOf = mode => typeof getComputedStyle !== 'function' ? [] :
    getComputedStyle(root).getPropertyValue(`--themes-${mode}`)
    .replace(/"/g, '').split(',').map(entry => entry.trim()).filter(Boolean)
    .map(entry => { const [id, label] = entry.split(':'); return { id, label: label || id }; });
  const paletteFor = mode => {
    const themes = themesOf(mode), saved = savedPalettes()[mode];
    return themes.some(theme => theme.id === saved) ? saved : themes[0]?.id;
  };
  const menu = document.getElementById('palette-menu');
  const toggle = document.getElementById('palette-toggle');

  function paint() {
    const mode = root.dataset.theme === 'light' ? 'light' : 'dark';
    const dot = toggle?.querySelector('.palette-swatch-dot');
    if (dot) { dot.dataset.swatchMode = mode; dot.dataset.swatch = root.dataset.palette ?? ''; }
    const current = themesOf(mode).find(theme => theme.id === root.dataset.palette);
    if (toggle) {
      toggle.title = `Theme: ${current?.label ?? 'default'} (${mode}). Choose dark or light and the colors`;
      toggle.setAttribute('aria-label', toggle.title);
    }
    for (const item of menu?.querySelectorAll('.palette-swatch') ?? []) {
      const active = item.dataset.swatchMode === mode && item.dataset.swatch === root.dataset.palette;
      item.setAttribute('aria-checked', String(active));
      item.classList.toggle('selected', active);
    }
  }
  const apply = theme => {
    root.dataset.theme = theme;
    const palette = paletteFor(theme);
    if (palette) root.dataset.palette = palette; else delete root.dataset.palette;
    const button = document.getElementById('theme-toggle');
    if (button) {
      const next = theme === 'light' ? 'dark' : 'light';
      button.title = `Switch to the ${next} theme`;
      button.setAttribute('aria-label', button.title);
      button.querySelector('use')?.setAttribute('href', `/vendor/tabler-icons.svg#ti-${next === 'light' ? 'sun' : 'moon'}`);
    }
    paint();
    window.dispatchEvent(new CustomEvent('sandbox-theme', { detail: theme }));
  };
  const switchTo = theme => {
    if (root.dataset.theme === theme) return;
    apply(theme);
    fetch('/api/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme }),
    }).catch(() => {}); // without the server, the theme still applies until the next reload
  };

  function buildMenu() {
    if (!menu) return;
    menu.replaceChildren();
    for (const [mode, title] of [['dark', 'Dark'], ['light', 'Light']]) {
      const group = document.createElement('div');
      group.className = 'palette-group';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', `${title} themes`);
      const heading = document.createElement('span');
      heading.className = 'palette-heading';
      heading.textContent = title;
      group.append(heading);
      for (const theme of themesOf(mode)) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'palette-swatch';
        item.setAttribute('role', 'menuitemradio');
        item.dataset.swatchMode = mode;
        item.dataset.swatch = theme.id;
        item.title = `${title}: ${theme.label}`;
        const sample = document.createElement('span');
        sample.className = 'palette-sample';
        sample.setAttribute('aria-hidden', 'true');
        const name = document.createElement('span');
        name.className = 'palette-name';
        name.textContent = theme.label;
        item.append(sample, name);
        item.addEventListener('click', () => {
          const all = savedPalettes();
          all[mode] = theme.id;
          try { localStorage.setItem(paletteKey, JSON.stringify(all)); } catch (_) {}
          if (root.dataset.theme === mode) apply(mode); else switchTo(mode);
        });
        group.append(item);
      }
      menu.append(group);
    }
    paint();
  }
  const open = on => {
    if (!menu || !toggle) return;
    menu.hidden = !on;
    toggle.setAttribute('aria-expanded', String(on));
    if (on) (menu.querySelector('.palette-swatch.selected') ?? menu.querySelector('.palette-swatch'))?.focus();
  };

  const start = () => {
    buildMenu();
    apply(root.dataset.theme === 'light' ? 'light' : 'dark');
    document.getElementById('theme-toggle')?.addEventListener('click', () =>
      switchTo(root.dataset.theme === 'light' ? 'dark' : 'light'));
    toggle?.addEventListener('click', () => open(menu.hidden));
    document.addEventListener('click', event => {
      if (menu && !menu.hidden && !event.target.closest?.('.palette-picker')) open(false);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && menu && !menu.hidden) { open(false); toggle.focus(); }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
