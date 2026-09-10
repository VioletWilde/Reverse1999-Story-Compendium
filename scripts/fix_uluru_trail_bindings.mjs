import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(scriptDir);
const locale = process.argv[2] || 'zh-CN';
const trailHeadingByLocale = {
  'zh-CN': '小径',
  'zh-TW': '小徑',
  en: 'Trail',
  ja: '小径',
  ko: '오솔길',
};
const chapterDir = path.join(
  rootDir,
  'readable',
  'story_reader_linked',
  locale,
  'activity',
  'chapter_15101',
);

// 以游戏内 RUG 页面显示顺序为准。数字是 ChapterMapElement ID。
const assignment = new Map([
  [1510101, [
    15101002,
    15103002, 15103003, 15103004, 15103005,
    15104002, 15104003, 15104004, 15104005,
    15105002, 15105003, 15105004, 15105005,
  ]],
  [1510102, [15101003, 15101004, 15102001]],
  [1510103, [15101005]],
  [1510104, [15101006, 15102002]],
  [1510105, [15102003, 15108001]],
  [1510106, [15101008, 15104001]],
  [1510107, [
    15101007, 15101009, 15101010, 15101011,
    15102004, 15102005, 15103001, 15108002,
  ]],
  [1510108, [15101001, 15101012, 15102006, 15102007, 15108003]],
  [1510109, [15105001]],
  [1510110, []],
  [1510111, []],
  [1510112, []],
  [1510113, []],
  [1510114, [15101013, 15102008]],
  [1510115, []],
]);

function normalizeEol(text, eol) {
  return text.replace(/\r\n|\r|\n/g, eol);
}

function splitMarkdown(markdown, sourceName) {
  const eol = markdown.includes('\r\n') ? '\r\n' : '\n';
  const headingText = trailHeadingByLocale[locale];
  if (!headingText) throw new Error(`不支持的语言: ${locale}`);
  const heading = new RegExp(`^## ${headingText}\\s*$`, 'm').exec(markdown);
  if (!heading) return { body: markdown.trimEnd(), blocks: [], eol };

  const body = markdown.slice(0, heading.index).trimEnd();
  const trailText = markdown.slice(heading.index + heading[0].length).trim();
  const headers = [];
  const pattern = /^- \*\*.*\*\* \(`element (\d+)`\)\s*$/gm;
  let match;
  while ((match = pattern.exec(trailText)) !== null) {
    headers.push({ elementId: Number(match[1]), start: match.index });
  }

  const blocks = headers.map((header, index) => ({
    elementId: header.elementId,
    markdown: trailText.slice(header.start, headers[index + 1]?.start ?? trailText.length).trim(),
  }));
  if (trailText && blocks.length === 0) {
    throw new Error(`${sourceName} 含有小径正文，但未识别到 element 标题。`);
  }
  return { body, blocks, eol };
}

async function main() {
  const names = await fs.readdir(chapterDir);
  const jsonNames = names.filter((name) => /^151\d+.*\.json$/i.test(name)).sort();
  const episodes = new Map();
  const trails = new Map();
  const blocks = new Map();

  for (const jsonName of jsonNames) {
    const jsonPath = path.join(chapterDir, jsonName);
    const data = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
    const markdownName = `${path.basename(jsonName, '.json')}.md`;
    const markdownPath = path.join(chapterDir, markdownName);
    const markdown = splitMarkdown(await fs.readFile(markdownPath, 'utf8'), markdownName);

    episodes.set(Number(data.episode_id), {
      jsonName,
      jsonPath,
      markdownPath,
      data,
      ...markdown,
    });
    for (const trail of data.trails || []) {
      const id = Number(trail.element_id);
      if (trails.has(id)) throw new Error(`重复的小径 JSON: ${id}`);
      trails.set(id, trail);
    }
    for (const block of markdown.blocks) {
      if (blocks.has(block.elementId)) throw new Error(`重复的小径 Markdown: ${block.elementId}`);
      blocks.set(block.elementId, block.markdown);
    }
  }

  const expectedIds = [...assignment.values()].flat();
  if (new Set(expectedIds).size !== expectedIds.length) throw new Error('目标映射含重复 element ID。');
  const sourceIds = [...trails.keys()].sort((a, b) => a - b);
  const targetIds = [...expectedIds].sort((a, b) => a - b);
  if (JSON.stringify(sourceIds) !== JSON.stringify(targetIds)) {
    throw new Error(`目标映射与现有小径集合不一致。现有 ${sourceIds.length}，目标 ${targetIds.length}。`);
  }
  if (blocks.size !== trails.size || [...trails.keys()].some((id) => !blocks.has(id))) {
    throw new Error('JSON 与 Markdown 的小径集合不一致。');
  }

  for (const [episodeId, elementIds] of assignment) {
    const episode = episodes.get(episodeId);
    if (!episode) throw new Error(`缺少剧情单元 ${episodeId}`);

    episode.data.trails = elementIds.map((elementId) => ({
      ...trails.get(elementId),
      owner_episode_id: episodeId,
    }));
    await fs.writeFile(episode.jsonPath, `${JSON.stringify(episode.data, null, 2)}\n`, 'utf8');

    let markdown = episode.body;
    if (elementIds.length > 0) {
      const joined = elementIds
        .map((elementId) => normalizeEol(blocks.get(elementId), episode.eol))
        .join(`${episode.eol}${episode.eol}`);
      markdown += `${episode.eol}${episode.eol}## ${trailHeadingByLocale[locale]}${episode.eol}${episode.eol}${joined}`;
    }
    await fs.writeFile(episode.markdownPath, `${markdown}${episode.eol}`, 'utf8');

    const titles = elementIds.map((elementId) => trails.get(elementId).title).join('、') || '无';
    console.log(`${episodeId}: ${titles}`);
  }

  console.log(`已重排 ${locale} chapter_15101 的 ${trails.size} 条小径。`);
}

await main();
