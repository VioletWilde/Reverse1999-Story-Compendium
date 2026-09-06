(() => {
  const root = document.documentElement;
  const savedTheme = localStorage.getItem('r1999-theme');
  if (savedTheme) root.dataset.theme = savedTheme;

  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    const titleDark = button.dataset.titleDark || '切换深色模式';
    const titleLight = button.dataset.titleLight || '切换浅色模式';
    const refresh = () => {
      const dark = root.dataset.theme === 'dark';
      button.textContent = dark ? '☀' : '☾';
      button.title = dark ? titleLight : titleDark;
      button.setAttribute('aria-label', dark ? titleLight : titleDark);
    };
    refresh();
    button.addEventListener('click', () => {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('r1999-theme', root.dataset.theme);
      refresh();
    });
  });

  const progress = document.querySelector('[data-progress]');
  if (progress) {
    const updateProgress = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.width = `${max > 0 ? (scrollY / max) * 100 : 0}%`;
    };
    addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  document.querySelectorAll('[data-language-select]').forEach((select) => {
    select.addEventListener('change', () => {
      if (select.value) location.href = select.value;
    });
  });

  const panels = [...document.querySelectorAll('[data-language-panel]')];
  if (!panels.length) return;

  const tabs = [...document.querySelectorAll('[data-set-language]')];
  const search = document.querySelector('[data-search]');
  const empty = document.querySelector('[data-empty]');
  const params = new URLSearchParams(location.search);
  const supported = panels.map((panel) => panel.dataset.languagePanel);
  const browserLanguage = (navigator.language || '').toLowerCase();
  const inferred = browserLanguage.startsWith('zh-tw') || browserLanguage.startsWith('zh-hk')
    ? 'zh-TW'
    : browserLanguage.startsWith('zh') ? 'zh-CN'
    : browserLanguage.startsWith('ja') ? 'ja'
    : browserLanguage.startsWith('ko') ? 'ko' : 'en';
  let language = params.get('lang') || localStorage.getItem('r1999-language') || inferred;
  if (!supported.includes(language)) language = 'zh-CN';

  const filter = () => {
    const panel = panels.find((item) => item.dataset.languagePanel === language);
    const query = (search?.value || '').trim().toLocaleLowerCase();
    let visible = 0;
    panel?.querySelectorAll('[data-chapter]').forEach((card) => {
      const matches = !query || card.dataset.search.includes(query);
      card.hidden = !matches;
      if (matches) visible += 1;
    });
    panel?.querySelectorAll('[data-category]').forEach((category) => {
      category.hidden = !category.querySelector('[data-chapter]:not([hidden])');
    });
    if (empty) empty.hidden = visible !== 0;
  };

  const activate = (nextLanguage) => {
    language = nextLanguage;
    localStorage.setItem('r1999-language', language);
    panels.forEach((panel) => { panel.hidden = panel.dataset.languagePanel !== language; });
    tabs.forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.setLanguage === language)));
    if (search) {
      const activeTab = tabs.find((tab) => tab.dataset.setLanguage === language);
      search.placeholder = activeTab?.dataset.searchPlaceholder || 'Search';
      search.value = '';
    }
    filter();
  };

  tabs.forEach((tab) => tab.addEventListener('click', () => activate(tab.dataset.setLanguage)));
  search?.addEventListener('input', filter);
  activate(language);
})();
