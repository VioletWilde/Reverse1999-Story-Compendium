import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(scriptDir);
const sourceDir = path.join(rootDir, 'readable', 'story_reader_linked', 'zh-CN');
const tempDir = path.join(rootDir, 'tmp', 'pdfs', 'story_reader_linked_zh-CN');
const outputDir = path.join(rootDir, 'output', 'pdf');
const combinedPath = path.join(tempDir, 'story_reader_linked_zh-CN.md');
const outputPath = path.join(outputDir, 'story_reader_linked_zh-CN_experimental_r2.pdf');

const book = {
  title: '《重返未来：1999》剧情文本档案',
  subtitle: '简体中文 · 新文本分册实验版',
  language: 'zh-CN',
  font: 'Microsoft YaHei',
  rights: '非官方、非商业的玩家归档；游戏内容的权利归其各自权利人所有。',
};

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

function preprocessEpisode(markdown) {
  let text = markdown.replace(/^\uFEFF/, '');
  text = text.replace(/<!-- reading-navigation:start -->[\s\S]*?<!-- reading-navigation:end -->/g, '');
  text = text.replace(/<br\s*\/?>/gi, '  \n');
  text = text.replace(/^#\s+[^\n]+\r?\n/, '');
  text = text.replace(/^\s*-\s*章节：[^\n]*\r?\n\s*-\s*剧情单元：[^\n]*\r?\n/m, '');
  text = text.replace(/^##\s+正文\s*$/m, '');
  text = text.replace(/^(#{2,6})(\s+)/gm, (full, hashes, whitespace) => {
    return `${'#'.repeat(Math.min(6, hashes.length + 2))}${whitespace}`;
  });
  return text.trim();
}

async function readUtf8(filePath) {
  return fs.readFile(filePath, 'utf8');
}

async function collectBook() {
  const rootIndex = await readUtf8(path.join(sourceDir, '_index.md'));
  const sections = [];
  const seenEpisodes = new Set();

  for (const sectionLink of markdownLinks(rootIndex)) {
    if (!sectionLink.href.endsWith('/_index.md')) continue;
    const sectionIndexPath = safePath(sourceDir, sectionLink.href);
    const sectionDir = path.dirname(sectionIndexPath);
    const sectionIndex = await readUtf8(sectionIndexPath);
    const section = { title: sectionLink.label, href: sectionLink.href, chapters: [] };

    for (const chapterLink of markdownLinks(sectionIndex)) {
      if (!chapterLink.href.endsWith('/_index.md')) continue;
      const chapterIndexPath = safePath(sectionDir, chapterLink.href);
      const chapterDir = path.dirname(chapterIndexPath);
      const chapterIndex = await readUtf8(chapterIndexPath);
      const chapter = { title: chapterLink.label.replace(/\s+—\s+.*$/, ''), episodes: [] };

      for (const episodeLink of markdownLinks(chapterIndex)) {
        if (path.basename(episodeLink.href) === '_index.md') continue;
        const episodePath = safePath(chapterDir, episodeLink.href);
        const episodeKey = path.relative(sourceDir, episodePath).replace(/\\/g, '/');
        if (seenEpisodes.has(episodeKey)) continue;
        seenEpisodes.add(episodeKey);
        const episodeId = path.basename(episodeLink.href, '.md').match(/^\d+/)?.[0] || chapter.episodes.length + 1;
        chapter.episodes.push({
          id: episodeId,
          title: episodeLink.label.replace(/\s+—\s+.*$/, ''),
          content: preprocessEpisode(await readUtf8(episodePath)),
        });
      }

      if (chapter.episodes.length > 0) section.chapters.push(chapter);
    }

    if (section.chapters.length > 0) sections.push(section);
  }

  return sections;
}

function buildMarkdown(sections) {
  const out = [
    '---',
    `title: "${book.title}"`,
    `subtitle: "${book.subtitle}"`,
    `lang: ${book.language}`,
    `rights: "${book.rights}"`,
    '---',
    '',
  ];

  for (const [sectionIndex, section] of sections.entries()) {
    out.push('```{=typst}', '#pagebreak(weak: true)', '```', '');
    out.push(`# ${section.title} {#${headingId('section', sectionIndex + 1)}}`, '');
    for (const [chapterIndex, chapter] of section.chapters.entries()) {
      out.push('```{=typst}', '#pagebreak(weak: true)', '```', '');
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

function runPandoc(inputPath, pdfPath) {
  const args = [
    inputPath,
    '-o', pdfPath,
    '-f', 'markdown-citations',
    '--pdf-engine', findTypst(),
    '--toc',
    '--toc-depth=3',
    '-V', `mainfont=${book.font}`,
    '-V', 'papersize=a4',
    '--metadata', `lang=${book.language}`,
    '--metadata', 'toc-title=目录',
  ];
  const result = spawnSync('pandoc', args, {
    encoding: 'utf8',
    shell: false,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`pandoc 生成失败:\n${result.stderr || result.stdout}`);
  }
  if (result.stderr?.trim()) process.stderr.write(result.stderr);
}

async function main() {
  await fs.mkdir(tempDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  const sections = await collectBook();
  const chapterCount = sections.reduce((sum, section) => sum + section.chapters.length, 0);
  const episodeCount = sections.reduce(
    (sum, section) => sum + section.chapters.reduce((inner, chapter) => inner + chapter.episodes.length, 0),
    0,
  );
  if (episodeCount === 0) throw new Error('没有从新分册索引中发现可构建的正文。');

  const combined = buildMarkdown(sections);
  await fs.writeFile(combinedPath, combined, 'utf8');
  console.log(`已收集 ${sections.length} 类、${chapterCount} 章、${episodeCount} 个阅读单元。`);
  console.log(`合并文本 ${(Buffer.byteLength(combined) / 1024 / 1024).toFixed(2)} MiB。`);

  runPandoc(combinedPath, outputPath);
  console.log(outputPath);
}

await main();
