import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(scriptDir);
const sourceRoot = path.join(rootDir, 'readable', 'story_reader_linked');
const tempRoot = path.join(rootDir, 'tmp', 'pdfs', 'story_reader_linked_all');
const pdfOutputDir = path.join(rootDir, 'output', 'pdf');
const epubOutputDir = path.join(rootDir, 'output', 'epub');

const editions = [
  {
    code: 'zh-CN',
    title: '《重返未来：1999》剧情文本档案',
    subtitle: '简体中文 · 新文本分册',
    language: 'zh-CN',
    font: 'Microsoft YaHei',
    tocTitle: '目录',
    transcriptTitle: '正文',
    rights: '非官方、非商业的玩家归档；游戏内容的权利归其各自权利人所有。',
  },
  {
    code: 'zh-TW',
    title: '《重返未來：1999》劇情文本檔案',
    subtitle: '繁體中文 · 新文本分冊',
    language: 'zh-TW',
    font: 'Microsoft JhengHei UI',
    tocTitle: '目錄',
    transcriptTitle: '正文',
    rights: '非官方、非商業的玩家歸檔；遊戲內容的權利歸其各自權利人所有。',
  },
  {
    code: 'en',
    title: 'Reverse: 1999 Story Archive',
    subtitle: 'English · Linked-text Edition',
    language: 'en',
    font: 'Georgia',
    tocTitle: 'Contents',
    transcriptTitle: 'Transcript',
    rights: 'Unofficial, non-commercial fan archive. All game content belongs to its respective rights holders.',
  },
  {
    code: 'ja',
    title: '『リバース：1999』ストーリーテキストアーカイブ',
    subtitle: '日本語・リンクテキスト版',
    language: 'ja',
    font: 'Yu Gothic',
    tocTitle: '目次',
    transcriptTitle: '本文',
    rights: '非公式・非商用のファンアーカイブです。ゲームコンテンツの権利は各権利者に帰属します。',
  },
  {
    code: 'ko',
    title: '《리버스: 1999》 스토리 텍스트 아카이브',
    subtitle: '한국어 · 링크 텍스트판',
    language: 'ko',
    font: 'Malgun Gothic',
    tocTitle: '목차',
    transcriptTitle: '본문',
    rights: '비공식·비상업 팬 아카이브입니다. 게임 콘텐츠의 권리는 각 권리자에게 있습니다.',
  },
];

function markdownLinks(markdown) {
  const links = [];
  const pattern = /\[([^\]]+)\]\(([^)]+\.md(?:#[^)]*)?)\)/g;
  let match;
  while ((match = pattern.exec(markdown)) !== null) {
    const href = decodeURIComponent(match[2].split('#')[0]).replace(/\\/g, '/');
    links.push({ label: match[1].trim(), href });
  }
  return links;
}

function safePath(baseDir, relativePath) {
  const resolvedBase = path.resolve(baseDir);
  const resolved = path.resolve(baseDir, relativePath);
  if (resolved !== resolvedBase && !resolved.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error(`索引链接超出数据目录: ${relativePath}`);
  }
  return resolved;
}

function headingId(prefix, value) {
  return `${prefix}-${String(value).replace(/[^A-Za-z0-9_-]+/g, '-')}`;
}

function preprocessEpisode(markdown, edition) {
  let text = markdown.replace(/^\uFEFF/, '');
  text = text.replace(/<!-- reading-navigation:start -->[\s\S]*?<!-- reading-navigation:end -->/g, '');
  text = text.replace(/<br\s*\/?>/gi, '  \n');
  text = text.replace(/^#\s+[^\n]+\r?\n/, '');
  text = text.replace(/^\s*-\s*[^\n]+\r?\n\s*-\s*[^\n]+\r?\n/, '');
  const transcriptPattern = new RegExp(`^##\\s+${edition.transcriptTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm');
  text = text.replace(transcriptPattern, '');
  text = text.replace(/\[([^\]]+)\]\((?!#)[^)]+\.md(?:#[^)]*)?\)/g, '$1');
  text = text.replace(/^(#{2,6})(\s+)/gm, (full, hashes, whitespace) => {
    return `${'#'.repeat(Math.min(6, hashes.length + 2))}${whitespace}`;
  });
  return text.trim();
}

async function readUtf8(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function collectBook(edition) {
  const editionDir = path.join(sourceRoot, edition.code);
  const rootIndex = await readUtf8(path.join(editionDir, '_index.md'));
  const sections = [];
  const seenEpisodes = new Set();

  for (const sectionLink of markdownLinks(rootIndex)) {
    if (!sectionLink.href.endsWith('/_index.md')) continue;
    const sectionIndexPath = safePath(editionDir, sectionLink.href);
    const sectionDir = path.dirname(sectionIndexPath);
    const sectionIndex = await readUtf8(sectionIndexPath);
    const section = { title: sectionLink.label, chapters: [] };

    for (const chapterLink of markdownLinks(sectionIndex)) {
      if (!chapterLink.href.endsWith('/_index.md')) continue;
      const chapterIndexPath = safePath(sectionDir, chapterLink.href);
      const chapterDir = path.dirname(chapterIndexPath);
      const chapterIndex = await readUtf8(chapterIndexPath);
      const chapter = { title: chapterLink.label.replace(/\s+—\s+.*$/, ''), episodes: [] };

      for (const episodeLink of markdownLinks(chapterIndex)) {
        if (path.basename(episodeLink.href) === '_index.md') continue;
        const episodePath = safePath(chapterDir, episodeLink.href);
        const episodeKey = path.relative(editionDir, episodePath).replace(/\\/g, '/');
        if (seenEpisodes.has(episodeKey)) continue;
        seenEpisodes.add(episodeKey);
        const episodeId = path.basename(episodeLink.href, '.md').match(/^\d+/)?.[0] || chapter.episodes.length + 1;
        chapter.episodes.push({
          id: episodeId,
          title: episodeLink.label.replace(/\s+—\s+.*$/, ''),
          content: preprocessEpisode(await readUtf8(episodePath), edition),
        });
      }

      if (chapter.episodes.length > 0) section.chapters.push(chapter);
    }
    if (section.chapters.length > 0) sections.push(section);
  }
  return sections;
}

function buildMarkdown(edition, sections, pageBreaks) {
  const out = [
    '---',
    `title: "${edition.title.replace(/"/g, '\\"')}"`,
    `subtitle: "${edition.subtitle.replace(/"/g, '\\"')}"`,
    `lang: ${edition.language}`,
    `rights: "${edition.rights.replace(/"/g, '\\"')}"`,
    '---',
    '',
  ];

  for (const [sectionIndex, section] of sections.entries()) {
    if (pageBreaks) out.push('```{=typst}', '#pagebreak(weak: true)', '```', '');
    out.push(`# ${section.title} {#${headingId('section', sectionIndex + 1)}}`, '');
    for (const [chapterIndex, chapter] of section.chapters.entries()) {
      if (pageBreaks) out.push('```{=typst}', '#pagebreak(weak: true)', '```', '');
      out.push(`## ${chapter.title} {#${headingId(`chapter-${sectionIndex + 1}`, chapterIndex + 1)}}`, '');
      for (const episode of chapter.episodes) {
        out.push(`### ${episode.title} {#${headingId('episode', episode.id)}}`, '', episode.content, '');
      }
    }
  }
  return out.join('\n');
}

function findTypst() {
  const available = spawnSync('typst', ['--version'], { encoding: 'utf8', shell: false });
  if (available.status === 0) return 'typst';
  return path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'typst.exe');
}

function runPandoc(args, label) {
  const result = spawnSync('pandoc', args, {
    encoding: 'utf8',
    shell: false,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`pandoc 生成失败 (${label}):\n${result.stderr || result.stdout}`);
  if (result.stderr?.trim()) process.stderr.write(result.stderr);
}

async function buildEdition(edition) {
  const sections = await collectBook(edition);
  const chapterCount = sections.reduce((sum, section) => sum + section.chapters.length, 0);
  const episodeCount = sections.reduce(
    (sum, section) => sum + section.chapters.reduce((inner, chapter) => inner + chapter.episodes.length, 0),
    0,
  );
  if (episodeCount !== 950) throw new Error(`${edition.code} 阅读单元数异常: ${episodeCount}`);

  const editionTempDir = path.join(tempRoot, edition.code);
  await fs.mkdir(editionTempDir, { recursive: true });
  const pdfMarkdownPath = path.join(editionTempDir, `${edition.code}-pdf.md`);
  const epubMarkdownPath = path.join(editionTempDir, `${edition.code}-epub.md`);
  const pdfMarkdown = buildMarkdown(edition, sections, true);
  const epubMarkdown = buildMarkdown(edition, sections, false);
  await fs.writeFile(pdfMarkdownPath, pdfMarkdown, 'utf8');
  await fs.writeFile(epubMarkdownPath, epubMarkdown, 'utf8');

  const pdfPath = path.join(pdfOutputDir, `story_reader_linked_${edition.code}.pdf`);
  const epubPath = path.join(epubOutputDir, `story_reader_linked_${edition.code}.epub`);
  console.log(`\n== ${edition.code}: ${sections.length} 类 / ${chapterCount} 章 / ${episodeCount} 单元 ==`);

  runPandoc([
    pdfMarkdownPath, '-o', pdfPath,
    '-f', 'markdown-citations',
    '--pdf-engine', findTypst(),
    '--toc', '--toc-depth=3',
    '-V', `mainfont=${edition.font}`,
    '-V', 'papersize=a4',
    '--metadata', `lang=${edition.language}`,
    '--metadata', `toc-title=${edition.tocTitle}`,
  ], `${edition.code} PDF`);
  console.log(`PDF: ${pdfPath}`);

  runPandoc([
    epubMarkdownPath, '-o', epubPath,
    '-f', 'markdown-citations',
    '--toc', '--toc-depth=3', '--split-level=2',
    '--metadata', `lang=${edition.language}`,
    '--metadata', `toc-title=${edition.tocTitle}`,
  ], `${edition.code} EPUB`);
  console.log(`EPUB: ${epubPath}`);
}

async function main() {
  await fs.mkdir(tempRoot, { recursive: true });
  await fs.mkdir(pdfOutputDir, { recursive: true });
  await fs.mkdir(epubOutputDir, { recursive: true });
  for (const edition of editions) await buildEdition(edition);
  console.log('\n五种语言的 PDF 与 EPUB 已全部生成。');
}

await main();
