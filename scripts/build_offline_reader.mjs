import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(scriptDir);
const readableDir = path.join(rootDir, 'readable');
const sourceAssetsDir = path.join(rootDir, 'web-reader');
const distDir = path.join(rootDir, 'dist');
const packageName = 'Reverse-1999-剧情网页版';
const outputDir = path.join(distDir, packageName);

async function loadMarked() {
  try {
    return (await import('marked')).marked;
  } catch (originalError) {
    const require = createRequire(import.meta.url);
    try {
      const resolved = require.resolve('marked');
      return (await import(pathToFileURL(resolved).href)).marked;
    } catch {
      throw new Error('缺少 marked。请先运行 npm install，再执行 npm run build:reader。', { cause: originalError });
    }
  }
}

const marked = await loadMarked();
marked.use({ gfm: true, breaks: false });

const editions = [
  {
    code: 'zh-CN', source: 'story_zh_CN_chapter_edition', folder: '简体中文', label: '简体中文',
    title: '简体中文剧情', search: '搜索章节名称或编号', spoiler: '包含关键情节与结局，请根据自己的游戏进度阅读。',
    labels: { mainline: '主线', activity: '活动', character: '角色剧情', anecdote: '轶事', appendix_unbound: '未绑定附录' },
    ui: { previous: '上一篇', next: '下一篇', index: '返回目录', archive: '剧情文本档案', catalog: '章节目录', count: '篇', themeToDark: '切换深色模式', themeToLight: '切换浅色模式' }
  },
  {
    code: 'zh-TW', source: 'story_zh_TW_chapter_edition', folder: '繁體中文', label: '繁體中文',
    title: '繁體中文劇情', search: '搜尋章節名稱或編號', spoiler: '包含關鍵情節與結局，請依照自己的遊戲進度閱讀。',
    labels: { mainline: '主線', activity: '活動', character: '角色劇情', anecdote: '軼事', appendix_unbound: '未綁定附錄' },
    ui: { previous: '上一篇', next: '下一篇', index: '返回目錄', archive: '劇情文本檔案', catalog: '章節目錄', count: '篇', themeToDark: '切換深色模式', themeToLight: '切換淺色模式' }
  },
  {
    code: 'en', source: 'story_en_chapter_edition', folder: 'English', label: 'English',
    title: 'English Stories', search: 'Search by chapter title or ID', spoiler: 'Contains major plot points and endings. Read according to your progress in the game.',
    labels: { mainline: 'Main Story', activity: 'Event Stories', character: 'Character Stories', anecdote: 'Anecdotes', appendix_unbound: 'Unbound Appendix' },
    ui: { previous: 'Previous', next: 'Next', index: 'Story index', archive: 'Story Archive', catalog: 'Chapter index', count: 'entries', themeToDark: 'Switch to dark mode', themeToLight: 'Switch to light mode' }
  },
  {
    code: 'ja', source: 'story_ja_chapter_edition', folder: '日本語', label: '日本語',
    title: '日本語ストーリー', search: '章のタイトルまたは番号を検索', spoiler: '重要な展開や結末が含まれています。ゲームの進行状況に合わせてお読みください。',
    labels: { mainline: 'メインストーリー', activity: 'イベントストーリー', character: 'キャラクターストーリー', anecdote: '逸話', appendix_unbound: '未分類付録' },
    ui: { previous: '前へ', next: '次へ', index: '目次へ戻る', archive: 'ストーリーアーカイブ', catalog: '章の目次', count: '篇', themeToDark: 'ダークモードに切り替え', themeToLight: 'ライトモードに切り替え' }
  },
  {
    code: 'ko', source: 'story_ko_chapter_edition', folder: '한국어', label: '한국어',
    title: '한국어 스토리', search: '챕터 제목 또는 번호 검색', spoiler: '중요한 전개와 결말이 포함되어 있습니다. 게임 진행 상황에 맞춰 읽어 주세요.',
    labels: { mainline: '메인 스토리', activity: '이벤트 스토리', character: '캐릭터 스토리', anecdote: '일화', appendix_unbound: '미분류 부록' },
    ui: { previous: '이전', next: '다음', index: '목차로', archive: '스토리 아카이브', catalog: '챕터 목차', count: '편', themeToDark: '다크 모드로 전환', themeToLight: '라이트 모드로 전환' }
  }
];

const categoryOrder = ['mainline', 'activity', 'character', 'anecdote', 'appendix_unbound'];
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const stripNavigation = (markdown) => markdown.replace(/\n?<!-- reading-navigation:start -->[\s\S]*?<!-- reading-navigation:end -->\n?/g, '\n');
const numericId = (name) => name.match(/^(\d+)/)?.[1] || name;
const numericSort = (a, b) => Number(numericId(a.name)) - Number(numericId(b.name)) || a.name.localeCompare(b.name);
const encodePath = (value) => value.split('/').map((segment) => encodeURIComponent(segment)).join('/');
const hrefBetween = (fromFile, toFile) => encodePath(path.relative(path.dirname(fromFile), toFile).split(path.sep).join('/'));

function pageFrame({ title, assetPrefix, header, body, pageClass = '', lang = 'zh-CN' }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="${assetPrefix}assets/style.css">
  <script>try{const t=localStorage.getItem('r1999-theme');if(t)document.documentElement.dataset.theme=t}catch{}</script>
</head>
<body class="${pageClass}">
  <div class="progress" data-progress></div>
  ${header}
  ${body}
  <footer class="footer">Reverse: 1999 · Unofficial, non-commercial fan archive</footer>
  <script src="${assetPrefix}assets/app.js"></script>
</body>
</html>`;
}

function siteHeader(assetPrefix, edition, languageOptions = '') {
  return `<header class="site-header">
  <a class="brand" href="${assetPrefix}开始阅读.html?lang=${edition.code}">
    <span class="brand-mark">◈</span><span class="brand-name">Reverse: 1999</span><span class="brand-sub">${escapeHtml(edition.ui.archive)}</span>
  </a>
  <div class="header-actions">
    ${languageOptions}
    <button class="quiet-button" type="button" data-theme-toggle data-title-dark="${escapeHtml(edition.ui.themeToDark)}" data-title-light="${escapeHtml(edition.ui.themeToLight)}" aria-label="${escapeHtml(edition.ui.themeToDark)}">☾</button>
  </div>
</header>`;
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(path.join(outputDir, 'assets'), { recursive: true });
await fs.copyFile(path.join(sourceAssetsDir, 'style.css'), path.join(outputDir, 'assets', 'style.css'));
await fs.copyFile(path.join(sourceAssetsDir, 'app.js'), path.join(outputDir, 'assets', 'app.js'));

const documents = [];
for (const edition of editions) {
  for (const category of categoryOrder) {
    const categoryDir = path.join(readableDir, edition.source, category);
    try {
      const entries = (await fs.readdir(categoryDir, { withFileTypes: true }))
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
        .sort(numericSort);
      for (const entry of entries) {
        const sourcePath = path.join(categoryDir, entry.name);
        const markdown = await fs.readFile(sourcePath, 'utf8');
        const title = markdown.match(/^#\s+(.+)$/m)?.[1].trim() || path.basename(entry.name, '.md');
        const outputPath = path.join(outputDir, edition.folder, edition.labels[category], entry.name.replace(/\.md$/i, '.html'));
        documents.push({ edition, category, id: numericId(entry.name), name: entry.name, title, markdown, outputPath });
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

const byIdentity = new Map(documents.map((doc) => [`${doc.edition.code}:${doc.category}:${doc.id}`, doc]));

for (const edition of editions) {
  for (const category of categoryOrder) {
    const group = documents.filter((doc) => doc.edition === edition && doc.category === category);
    for (let index = 0; index < group.length; index += 1) {
      const doc = group[index];
      const previous = group[index - 1];
      const next = group[index + 1];
      await fs.mkdir(path.dirname(doc.outputPath), { recursive: true });

      const languageOptions = editions.map((candidate) => {
        const counterpart = byIdentity.get(`${candidate.code}:${doc.category}:${doc.id}`);
        const target = counterpart ? hrefBetween(doc.outputPath, counterpart.outputPath) : '';
        return `<option value="${target}"${candidate === edition ? ' selected' : ''}${counterpart ? '' : ' disabled'}>${escapeHtml(candidate.label)}</option>`;
      }).join('');

      const languageSelect = `<select class="language-select" data-language-select aria-label="Language">${languageOptions}</select>`;
      const indexHref = hrefBetween(doc.outputPath, path.join(outputDir, '开始阅读.html')) + `?lang=${edition.code}`;
      const nav = `<nav class="reader-nav">
        ${previous ? `<a href="${hrefBetween(doc.outputPath, previous.outputPath)}">← ${escapeHtml(edition.ui.previous)}<br><small>${escapeHtml(previous.title)}</small></a>` : '<span class="disabled">←</span>'}
        <a class="index" href="${indexHref}">⌂ ${escapeHtml(edition.ui.index)}</a>
        ${next ? `<a class="next" href="${hrefBetween(doc.outputPath, next.outputPath)}">${escapeHtml(edition.ui.next)} →<br><small>${escapeHtml(next.title)}</small></a>` : '<span class="next disabled">→</span>'}
      </nav>`;

      let storyHtml = marked.parse(stripNavigation(doc.markdown));
      storyHtml = storyHtml.replace(/href="([^"]+)\.md(#[^"]*)?"/g, 'href="$1.html$2"');
      const body = `<main class="reader-shell">${nav}<article class="story">${storyHtml}</article>${nav.replace('reader-nav', 'reader-nav bottom')}</main>`;
      const html = pageFrame({
        title: `${doc.title} · ${edition.ui.archive}`,
        assetPrefix: '../../',
        header: siteHeader('../../', edition, languageSelect),
        body,
        pageClass: 'reader-page',
        lang: edition.code
      });
      await fs.writeFile(doc.outputPath, html, 'utf8');
    }
  }
}

const languageTabs = editions.map((edition) => `<button class="language-tab" type="button" role="tab" aria-selected="false" data-set-language="${edition.code}" data-search-placeholder="${escapeHtml(edition.search)}">${escapeHtml(edition.label)}</button>`).join('');
const panels = editions.map((edition) => {
  const categories = categoryOrder.map((category) => {
    const group = documents.filter((doc) => doc.edition === edition && doc.category === category);
    if (!group.length) return '';
    const cards = group.map((doc) => {
      const href = hrefBetween(path.join(outputDir, '开始阅读.html'), doc.outputPath);
      const search = `${doc.id} ${doc.title}`.toLocaleLowerCase();
      return `<a class="chapter-card" data-chapter data-search="${escapeHtml(search)}" href="${href}"><span class="chapter-id">${escapeHtml(doc.id)}</span><span class="chapter-title">${escapeHtml(doc.title)}</span><span class="chapter-arrow">↗</span></a>`;
    }).join('');
    return `<section class="category" data-category><div class="category-heading"><h2>${escapeHtml(edition.labels[category])}</h2><span class="category-count">${group.length} ${escapeHtml(edition.ui.count)}</span></div><div class="chapter-grid">${cards}</div></section>`;
  }).join('');
  return `<div class="language-panel" data-language-panel="${edition.code}" hidden><p class="eyebrow">${escapeHtml(edition.title)}</p>${categories}</div>`;
}).join('');

const homeBody = `<main>
  <section class="hero"><p class="eyebrow">Timekeeper's Reading Room</p><h1>剧情，仍在<br>纸页间继续。</h1><p class="hero-lede">选择语言、搜索章节，然后开始阅读。网页包完全离线运行，不需要安装软件。</p></section>
  <aside class="spoiler-note"><div><strong>剧透提示</strong>　此档案包含关键情节与结局，请根据自己的游戏进度阅读。</div></aside>
  <section class="catalog-shell">
    <div class="catalog-tools">
      <div class="search-wrap"><label for="chapter-search">搜索章节</label><input id="chapter-search" class="search-input" type="search" data-search autocomplete="off" placeholder="搜索章节名称或编号"></div>
      <div class="language-tabs" role="tablist" aria-label="Language">${languageTabs}</div>
    </div>
    ${panels}
    <p class="empty-state" data-empty hidden>没有找到匹配的章节。</p>
  </section>
</main>`;

const homeHtml = pageFrame({
  title: 'Reverse: 1999 剧情文本档案',
  assetPrefix: '',
  header: siteHeader('', editions[0]),
  body: homeBody,
  pageClass: 'catalog-page',
  lang: 'zh-CN'
});
await fs.writeFile(path.join(outputDir, '开始阅读.html'), homeHtml, 'utf8');

await fs.writeFile(path.join(outputDir, '使用说明.txt'), `Reverse: 1999 剧情文本档案\r\n\r\n1. 解压整个 ZIP 文件。\r\n2. 双击“开始阅读.html”。\r\n3. 使用浏览器选择语言、搜索并阅读章节。\r\n\r\n本阅读包可完全离线使用，请勿单独移动其中的 HTML 或 assets 文件。\r\n`, 'utf8');

console.log(`Generated ${documents.length} story pages in ${outputDir}`);
