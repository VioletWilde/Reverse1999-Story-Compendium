import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(scriptDir);
const readableDir = path.join(rootDir, 'readable', 'story_reader_linked');
const outputRoot = path.join(rootDir, 'dist', 'ebooks');
const finalDir = path.join(outputRoot, 'by-chapter');
const stagingDir = path.join(outputRoot, '.by-chapter-build');

const editions = [
  { code: 'zh-CN', lang: 'zh-CN', mainfont: 'Microsoft YaHei', tocTitle: '目录' },
  { code: 'zh-TW', lang: 'zh-TW', mainfont: 'Microsoft JhengHei UI', tocTitle: '目錄' },
  { code: 'en', lang: 'en', mainfont: 'Georgia', tocTitle: 'Contents' },
  { code: 'ja', lang: 'ja', mainfont: 'Yu Gothic', tocTitle: '目次' },
  { code: 'ko', lang: 'ko', mainfont: 'Malgun Gothic', tocTitle: '목차' },
];
const categories = new Set(['mainline', 'activity', 'character', 'anecdote']);

function findTypst() {
  const direct = spawnSync('typst', ['--version'], { encoding: 'utf8', shell: true });
  if (direct.status === 0) return 'typst';
  return path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'typst.exe');
}

function safeTitle(markdown, fallback) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback;
}

function preprocess(markdown) {
  return markdown
    .replace(/<!-- reading-navigation:start -->[\s\S]*?<!-- reading-navigation:end -->/g, '')
    .replace(/<a id="([^"]+)"><\/a>\s*\n(#{1,6}\s+[^\n]+)/g,
      (match, id, heading) => `${heading.trimEnd()} {#${id}}`)
    .replace(/\[([^\]]+)\]\((?!#)[^)]+\.md(?:#[^)]*)?\)/g, '$1')
    .trim() + '\n';
}

async function collectEdition(edition) {
  const editionDir = path.join(readableDir, edition.code);
  const readme = await fs.readFile(path.join(editionDir, 'README.md'), 'utf8');
  const links = [...readme.matchAll(/\[([^\]]+)\]\(([^)]+\.md)\)/g)];
  const seen = new Set();
  const chapters = [];
  for (const match of links) {
    const relPath = decodeURIComponent(match[2]).replace(/\\/g, '/');
    const category = relPath.split('/')[0];
    if (!categories.has(category) || seen.has(relPath)) continue;
    seen.add(relPath);
    const sourcePath = path.join(editionDir, relPath);
    const markdown = await fs.readFile(sourcePath, 'utf8');
    chapters.push({
      edition, category, relPath, sourcePath, markdown,
      basename: path.basename(relPath, '.md'),
      title: safeTitle(markdown, path.basename(relPath, '.md')),
    });
  }
  return chapters;
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ ok: false, error: error.message, stdout, stderr }));
    child.on('close', (code) => resolve({ ok: code === 0, code, stdout, stderr }));
  });
}

async function renameWithRetry(source, destination) {
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      await fs.rename(source, destination);
      return;
    } catch (error) {
      lastError = error;
      if (!['EPERM', 'EBUSY'].includes(error.code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }
  throw lastError;
}

async function convertChapter(chapter, typst) {
  const { edition, category, basename, title } = chapter;
  const chapterDir = path.join(stagingDir, edition.code, category);
  const workDir = path.join(stagingDir, '.markdown', edition.code, category);
  await fs.mkdir(chapterDir, { recursive: true });
  await fs.mkdir(workDir, { recursive: true });
  const markdownPath = path.join(workDir, `${basename}.md`);
  const frontmatter = [
    '---', `title: "${title.replace(/"/g, '\\"')}"`, `lang: ${edition.lang}`,
    'rights: "Unofficial, non-commercial fan archive; game content belongs to its respective rights holders."',
    '---', '',
  ].join('\n');
  await fs.writeFile(markdownPath, frontmatter + preprocess(chapter.markdown), 'utf8');
  const epubPath = path.join(chapterDir, `${basename}.epub`);
  const pdfPath = path.join(chapterDir, `${basename}.pdf`);
  const common = ['-f', 'markdown-citations', '--toc', '--toc-depth=3',
    '--metadata', `lang=${edition.lang}`, '--metadata', `toc-title=${edition.tocTitle}`];
  const [epub, pdf] = await Promise.all([
    run('pandoc', [markdownPath, '-o', epubPath, '--split-level=2', ...common]),
    run('pandoc', [markdownPath, '-o', pdfPath, '--pdf-engine', typst,
      '-V', `mainfont=${edition.mainfont}`, ...common]),
  ]);
  return {
    locale: edition.code, category, title, source: chapter.relPath,
    epub: path.relative(stagingDir, epubPath).replace(/\\/g, '/'),
    pdf: path.relative(stagingDir, pdfPath).replace(/\\/g, '/'),
    epubOk: epub.ok, pdfOk: pdf.ok,
    errors: [
      ...(!epub.ok ? [`EPUB: ${epub.stderr || epub.error || epub.stdout}`] : []),
      ...(!pdf.ok ? [`PDF: ${pdf.stderr || pdf.error || pdf.stdout}`] : []),
    ],
  };
}

async function main() {
  const typst = findTypst();
  await fs.rm(stagingDir, { recursive: true, force: true });
  await fs.mkdir(stagingDir, { recursive: true });
  const all = (await Promise.all(editions.map(collectEdition))).flat();
  console.log(`准备生成 ${all.length} 章 × EPUB/PDF；现有整合册不会修改。`);

  const results = [];
  let cursor = 0;
  const workerCount = 4;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= all.length) return;
      const chapter = all[index];
      const result = await convertChapter(chapter, typst);
      results[index] = result;
      console.log(`[${index + 1}/${all.length}] ${chapter.edition.code}/${chapter.category}/${chapter.basename} ` +
        `${result.epubOk && result.pdfOk ? 'OK' : 'FAILED'}`);
    }
  }
  await Promise.all(Array.from({ length: workerCount }, worker));

  const failures = results.filter((row) => !row.epubOk || !row.pdfOk);
  const manifest = {
    format: 'reverse1999-per-chapter-ebooks-v1', generatedAt: new Date().toISOString(),
    combinedEditionsPreserved: true, chapterCount: all.length,
    epubCount: results.filter((row) => row.epubOk).length,
    pdfCount: results.filter((row) => row.pdfOk).length,
    failures, chapters: results,
  };
  await fs.writeFile(path.join(stagingDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await fs.rm(path.join(stagingDir, '.markdown'), { recursive: true, force: true });
  if (failures.length) {
    console.error(`${failures.length} 章转换失败；暂存结果保留在 ${stagingDir}`);
    process.exitCode = 1;
    return;
  }
  await fs.rm(finalDir, { recursive: true, force: true });
  await renameWithRetry(stagingDir, finalDir);
  console.log(`完成：${all.length} EPUB + ${all.length} PDF -> ${finalDir}`);
}

await main();
