import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(scriptDir);
const readableDir = path.join(rootDir, 'readable');
const distDir = path.join(rootDir, 'dist');
const outputDir = path.join(distDir, 'ebooks');
const buildDir = path.join(outputDir, '.build');

const editions = [
  {
    code: 'zh-CN', source: 'story_zh_CN_chapter_edition',
    title: '《重返未来：1999》剧情文本档案（简体中文）',
    lang: 'zh-CN', mainfont: 'Microsoft YaHei',
    partTitles: { mainline: '主线', activity: '活动', character: '角色剧情', anecdote: '轶事', appendix_unbound: '未绑定旁支附录' },
    tocTitle: '目录'
  },
  {
    code: 'zh-TW', source: 'story_zh_TW_chapter_edition',
    title: '《重返未來：1999》劇情文本檔案（繁體中文）',
    lang: 'zh-TW', mainfont: 'Microsoft JhengHei UI',
    partTitles: { mainline: '主線', activity: '活動', character: '角色劇情', anecdote: '軼事', appendix_unbound: '未綁定旁支附錄' },
    tocTitle: '目錄'
  },
  {
    code: 'en', source: 'story_en_chapter_edition',
    title: 'Reverse: 1999 Story Archive (English)',
    lang: 'en', mainfont: 'Georgia',
    partTitles: { mainline: 'Main Story', activity: 'Event Stories', character: 'Character Stories', anecdote: 'Anecdotes', appendix_unbound: 'Unbound Appendix' },
    tocTitle: 'Contents'
  },
  {
    code: 'ja', source: 'story_ja_chapter_edition',
    title: '『リバース：1999』ストーリーテキストアーカイブ（日本語）',
    lang: 'ja', mainfont: 'Yu Gothic',
    partTitles: { mainline: 'メインストーリー', activity: 'イベントストーリー', character: 'キャラクターストーリー', anecdote: '逸話', appendix_unbound: '未分類付録' },
    tocTitle: '目次'
  },
  {
    code: 'ko', source: 'story_ko_chapter_edition',
    title: '《리버스: 1999》 스토리 텍스트 아카이브(한국어)',
    lang: 'ko', mainfont: 'Malgun Gothic',
    partTitles: { mainline: '메인 스토리', activity: '이벤트 스토리', character: '캐릭터 스토리', anecdote: '일화', appendix_unbound: '미분류 부록' },
    tocTitle: '목차'
  }
];

const sectionOrder = ['mainline', 'activity', 'character', 'anecdote', 'appendix_unbound'];

function findTypst() {
  const result = spawnSync('typst', ['--version'], { encoding: 'utf8', shell: true });
  if (result.status === 0) return 'typst';
  const localAppData = process.env.LOCALAPPDATA || '';
  const wingetLinks = path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'typst.exe');
  return wingetLinks;
}

function preprocessChapter(markdown, chapterTocTitle) {
  let text = markdown;
  // 移除顶部/底部的阅读导航块
  text = text.replace(/<!-- reading-navigation:start -->[\s\S]*?<!-- reading-navigation:end -->/g, '');
  // 移除章节内的局部目录（与书籍级目录重复），含结尾分隔线
  if (chapterTocTitle) {
    const tocPattern = new RegExp(`^## ${chapterTocTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$[\\s\\S]*?^---\\s*$`, 'm');
    text = text.replace(tocPattern, '');
  }
  // 原始 HTML 锚点转换为 pandoc 标题显式标识符，保证书内目录链接在 EPUB 与 PDF 中都有效
  text = text.replace(/<a id="([^"]+)"><\/a>\s*\n(#{1,6}\s+[^\n]+)/g, (m, id, heading) => {
    return heading.replace(/\s*\{#[^}]+\}\s*$/, '').trimEnd() + ` {#${id}}`;
  });
  // 跨文件链接替换为纯文本（电子书中无法跳转），保留书内锚点链接
  text = text.replace(/\[([^\]]+)\]\((?!#)[^)]+\.md(?:#[^)]*)?\)/g, '$1');
  return text.trim();
}

async function collectChapters(editionDir) {
  const readmePath = path.join(editionDir, 'README.md');
  const readme = await fs.readFile(readmePath, 'utf8');
  const chapters = [];
  const seen = new Set();
  const linkPattern = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
  let match;
  while ((match = linkPattern.exec(readme)) !== null) {
    const relPath = decodeURIComponent(match[2]).replace(/\\/g, '/');
    // 仅收录分类目录下的章节文件，忽略返回首页等外部链接
    const section = relPath.split('/')[0];
    if (!sectionOrder.includes(section)) continue;
    if (seen.has(relPath)) continue;
    seen.add(relPath);
    const absPath = path.join(editionDir, relPath);
    try {
      const content = await fs.readFile(absPath, 'utf8');
      chapters.push({ relPath, section, content });
    } catch {
      console.warn(`  跳过缺失文件: ${relPath}`);
    }
  }
  return chapters;
}

function buildCombinedMarkdown(edition, chapters) {
  const parts = [];
  parts.push('---');
  parts.push(`title: "${edition.title.replace(/"/g, '\\"')}"`);
  parts.push(`lang: ${edition.lang}`);
  parts.push('rights: "非官方、非商业的玩家归档；游戏内容的权利归其各自权利人所有。"');
  parts.push('---');
  parts.push('');

  let currentSection = null;
  for (const chapter of chapters) {
    if (chapter.section !== currentSection) {
      currentSection = chapter.section;
      const partTitle = edition.partTitles[currentSection] || currentSection;
      parts.push(`# ${partTitle}\n`);
    }
    parts.push(preprocessChapter(chapter.content, edition.tocTitle));
    parts.push('');
  }
  return parts.join('\n');
}

function runPandoc(args, label) {
  const result = spawnSync('pandoc', args, { encoding: 'utf8', shell: false, maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    console.error(`  pandoc 失败 (${label}):`);
    console.error(result.stderr || result.stdout);
    return false;
  }
  if (result.stderr) {
    console.warn(`  pandoc 警告 (${label}): ${result.stderr.trim().split('\n').slice(0, 5).join('\n  ')}`);
  }
  return true;
}

async function main() {
  await fs.mkdir(buildDir, { recursive: true });
  const typst = findTypst();

  for (const edition of editions) {
    console.log(`\n== ${edition.code} ==`);
    const editionDir = path.join(readableDir, edition.source);
    const chapters = await collectChapters(editionDir);
    console.log(`  章节数: ${chapters.length}`);
    if (chapters.length === 0) continue;

    const combined = buildCombinedMarkdown(edition, chapters);
    const combinedPath = path.join(buildDir, `${edition.code}.md`);
    await fs.writeFile(combinedPath, combined, 'utf8');
    console.log(`  合并文本: ${(Buffer.byteLength(combined) / 1024 / 1024).toFixed(1)} MB`);

    const epubPath = path.join(outputDir, `story_${edition.code}.epub`);
    const pdfPath = path.join(outputDir, `story_${edition.code}.pdf`);

    console.log('  生成 EPUB...');
    runPandoc([
      combinedPath, '-o', epubPath,
      '-f', 'markdown-citations',
      '--toc', '--toc-depth=2', '--split-level=1',
      '--metadata', `lang=${edition.lang}`,
      '--metadata', `toc-title=${edition.tocTitle}`
    ], 'epub');

    console.log('  生成 PDF...');
    runPandoc([
      combinedPath, '-o', pdfPath,
      '-f', 'markdown-citations',
      '--pdf-engine', typst,
      '--toc', '--toc-depth=2',
      '-V', `mainfont=${edition.mainfont}`,
      '--metadata', `lang=${edition.lang}`,
      '--metadata', `toc-title=${edition.tocTitle}`
    ], 'pdf');
  }

  console.log(`\n完成。输出目录: ${outputDir}`);
}

await main();
