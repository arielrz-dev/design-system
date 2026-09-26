/**
 * Docs site interactions: theme, Cmd/Ctrl+K search, Preview/Code tabs, copy.
 */

const THEME_KEY = 'ds-docs-theme';

function applyTheme(theme) {
  const root = document.documentElement;
  const isDark = theme === 'dark';
  if (isDark) root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');

  const toggle = document.getElementById('docs-theme-toggle');
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(isDark));
    toggle.setAttribute('aria-label', isDark ? 'Activar tema claro' : 'Activar tema oscuro');
  }
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'dark' ? 'dark' : 'light');

  document.getElementById('docs-theme-toggle')?.addEventListener('click', () => {
    const next =
      document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });
}

function initSearchHotkey() {
  const input = document.getElementById('docs-search');
  if (!(input instanceof HTMLInputElement)) return;

  const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
  const kbd = document.querySelector('.docs-header__kbd');
  if (kbd) kbd.innerHTML = isMac ? '<kbd>⌘</kbd><kbd>K</kbd>' : '<kbd>Ctrl</kbd><kbd>K</kbd>';

  document.addEventListener('keydown', (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
    if (event.altKey || event.shiftKey) return;
    event.preventDefault();
    input.focus();
    input.select();
  });

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    document.querySelectorAll('[data-docs-searchable]').forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const hay = (el.getAttribute('data-docs-searchable') || '').toLowerCase();
      el.hidden = q.length > 0 && !hay.includes(q);
    });
  });
}

function initCardTabs() {
  document.querySelectorAll('.docs-card').forEach((card) => {
    const tabs = card.querySelectorAll('.docs-card__tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-docs-tab');
        tabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
        card.querySelectorAll('.docs-card__panel').forEach((panel) => {
          if (!(panel instanceof HTMLElement)) return;
          panel.hidden = panel.getAttribute('data-docs-panel') !== target;
        });
      });
    });
  });
}

/**
 * @param {HTMLButtonElement} button
 * @param {string} text
 */
async function copyText(button, text) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  } catch {
    return;
  }

  const label = button.querySelector('[data-docs-copy-label]');
  const prev = label?.textContent || button.textContent || 'Copiar';
  button.classList.add('docs-copy--copied');
  if (label) label.textContent = 'Copiado';
  else button.textContent = 'Copiado';

  let live = button.querySelector('.docs-copy__status');
  if (!(live instanceof HTMLElement)) {
    live = document.createElement('span');
    live.className = 'docs-copy__status';
    live.setAttribute('aria-live', 'polite');
    button.appendChild(live);
  }
  live.textContent = 'Copiado al portapapeles';

  window.clearTimeout(Number(button.dataset.docsCopyTimer || 0));
  button.dataset.docsCopyTimer = String(
    window.setTimeout(() => {
      button.classList.remove('docs-copy--copied');
      if (label) label.textContent = prev;
      else button.textContent = prev;
      live.textContent = '';
    }, 1500),
  );
}

function initCopyButtons() {
  document.querySelectorAll('[data-docs-copy]').forEach((el) => {
    if (!(el instanceof HTMLButtonElement)) return;
    el.addEventListener('click', () => {
      const direct = el.getAttribute('data-docs-copy');
      if (direct) {
        void copyText(el, direct);
        return;
      }
      const target = el.getAttribute('data-docs-copy-target');
      if (!target) return;
      const node = document.querySelector(target);
      if (!node) return;
      void copyText(el, (node.textContent || '').trim());
    });
  });
}

function initNavCurrent() {
  const links = Array.from(document.querySelectorAll('.docs-nav__link[href^="#"]'));
  if (links.length === 0) return;

  const sections = links
    .map((link) => {
      const id = link.getAttribute('href')?.slice(1);
      const section = id ? document.getElementById(id) : null;
      return section ? { link, section } : null;
    })
    .filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const match = sections.find((s) => s.section === entry.target);
        if (!match) return;
        links.forEach((l) => l.removeAttribute('aria-current'));
        match.link.setAttribute('aria-current', 'true');
      });
    },
    { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
  );

  sections.forEach(({ section }) => observer.observe(section));
}

function boot() {
  initTheme();
  initSearchHotkey();
  initCardTabs();
  initCopyButtons();
  initNavCurrent();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
