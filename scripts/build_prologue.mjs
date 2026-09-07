// 从原始剧情脚本 JSON 生成五种语言的“序章”章节 Markdown（主线 000 章）。
// 数据源：structured/story_text_repull_20260904/configs/story/steps/json_story_step_*.json
// 每个脚本内联 8 语言文本，数组顺序：0=zh-CN 1=zh-TW 2=en 3=ko 4=ja。
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(scriptDir);
const stepsDir = path.join(rootDir, 'structured', 'story_text_repull_20260904', 'configs', 'story', 'steps');
const groupsDir = path.join(rootDir, 'structured', 'story_text_repull_20260904', 'configs', 'story', 'groups');
const readableDir = path.join(rootDir, 'readable');

// 序章 13 个脚本，按游戏关卡 0-1 ~ 0-6 分为 6 个 Part
const parts = [
  { stage: '0-1', scripts: [100001, 100011, 100012] },
  { stage: '0-2', scripts: [100002, 100003] },
  { stage: '0-3', scripts: [100004, 100005] },
  { stage: '0-4', scripts: [100006] },
  { stage: '0-5', scripts: [100007] },
  { stage: '0-6', scripts: [100008, 100015, 100016, 100017] }
];

// 各语言章名与 Part 名（游戏图鉴官方名称）
const localizedNames = {
  'zh-CN': { chapter: '此即明日', parts: ['摇滚电台', '国王小径', '传送', '隐形海盗', '暴雨序幕', '活着的过去'] },
  'zh-TW': { chapter: '此即明日', parts: ['搖滾電臺', '國王小徑', '傳送', '隱形海盜', '暴雨序幕', '活著的過去'] },
  'en': { chapter: 'This Is Tomorrow', parts: ["Rock 'n' Roll Radio", "King's Trail", 'Teleport', 'Invisible Pirate', 'The Storm Overture', 'The Living Past'] },
  'ja': { chapter: 'ディス・イズ・トゥモロー', parts: ['ロックンロールラジオ', 'キングスロード', 'テレポート', '見えない海賊', 'ストームの序幕', '生きている過去'] },
  'ko': { chapter: '다가온 미래', parts: ['로큰롤 라디오', '국왕의 오솔길', '텔레포트', '보이지 않는 해적', '폭풍우 서막', '살아있는 과거'] }
};

const editions = [
  {
    code: 'zh-CN', langIndex: 0, dir: 'story_zh_CN_chapter_edition',
    fileName: '000-此即明日.md',
    metaLines: ['- 分类：主线', '- 章节 ID：`000`', '- 剧情单元：`6`'],
    tocHeading: '目录', partTitle: (n, stage) => `Part ${n} · ${localizedNames['zh-CN'].parts[n - 1]}`,
    scriptHeading: (n, internalTitle, scriptId) => `### ${internalTitle} \`script ${scriptId}\``,
    dialogue: (name, text) => `**${name}**：${text}`,
    card: (text) => `> 【标题卡】${text}`,
    choice: (text) => `- 【选项】${text}`
  },
  {
    code: 'zh-TW', langIndex: 1, dir: 'story_zh_TW_chapter_edition',
    fileName: '000-此即明日.md',
    metaLines: ['- 分類: 主線', '- 章節 ID: `000`', '- 劇情單元: `6`'],
    tocHeading: '目錄', partTitle: (n, stage) => `Part ${n} · ${localizedNames['zh-TW'].parts[n - 1]}`,
    scriptHeading: (n, internalTitle, scriptId) => `### 段落 ${n} \`script ${scriptId}\``,
    dialogue: (name, text) => `**${name}**: ${text}`,
    card: (text) => `> **標題卡:** ${text}`,
    choice: (text) => `- **選項:** ${text}`
  },
  {
    code: 'en', langIndex: 2, dir: 'story_en_chapter_edition',
    fileName: '000-This Is Tomorrow.md',
    metaLines: ['- Category: Main Story', '- Chapter ID: `000`', '- Story Units: `6`'],
    tocHeading: 'Contents', partTitle: (n, stage) => `Part ${n} · ${localizedNames['en'].parts[n - 1]}`,
    scriptHeading: (n, internalTitle, scriptId) => `### Segment ${n} \`script ${scriptId}\``,
    dialogue: (name, text) => `**${name}**: ${text}`,
    card: (text) => `> **Title Card:** ${text}`,
    choice: (text) => `- **Choice:** ${text}`
  },
  {
    code: 'ja', langIndex: 4, dir: 'story_ja_chapter_edition',
    fileName: '000-ディス・イズ・トゥモロー.md',
    metaLines: ['- 分類: メインストーリー', '- 章 ID: `000`', '- ストーリーユニット: `6`'],
    tocHeading: '目次', partTitle: (n, stage) => `Part ${n} · ${localizedNames['ja'].parts[n - 1]}`,
    scriptHeading: (n, internalTitle, scriptId) => `### セグメント ${n} \`script ${scriptId}\``,
    dialogue: (name, text) => `**${name}**: ${text}`,
    card: (text) => `> **タイトルカード:** ${text}`,
    choice: (text) => `- **選択肢:** ${text}`
  },
  {
    code: 'ko', langIndex: 3, dir: 'story_ko_chapter_edition',
    fileName: '000-다가온 미래.md',
    metaLines: ['- 분류: 메인 스토리', '- 챕터 ID: `000`', '- 스토리 유닛: `6`'],
    tocHeading: '목차', partTitle: (n, stage) => `Part ${n} · ${localizedNames['ko'].parts[n - 1]}`,
    scriptHeading: (n, internalTitle, scriptId) => `### 구간 ${n} \`script ${scriptId}\``,
    dialogue: (name, text) => `**${name}**: ${text}`,
    card: (text) => `> **타이틀 카드:** ${text}`,
    choice: (text) => `- **선택지:** ${text}`
  }
];

function pickLang(arr8, langIndex) {
  if (!Array.isArray(arr8)) return '';
  const value = arr8[langIndex];
  if (typeof value === 'string' && value.trim()) return value;
  const fallback = arr8[0];
  return typeof fallback === 'string' ? fallback : '';
}

// 去除游戏原文中的富文本标签（现有章节均不含 HTML 标签），并将换行折叠为空格
function stripMarkup(text) {
  return text.replace(/<\/?b>/g, '').replace(/<[^>]+>/g, '').replace(/\s*\n\s*/g, ' ');
}

async function loadScript(scriptId) {
  const filePath = path.join(stepsDir, `json_story_step_${scriptId}.json`);
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw.replace(/^﻿/, ''));
}

async function loadGroup(scriptId) {
  const filePath = path.join(groupsDir, `json_story_group_${scriptId}.json`);
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw.replace(/^﻿/, ''));
}

// 从步骤选项数据（索引 10）中为跳转边的标签匹配 8 语言文本：
// 优先按目标步骤 ID 匹配（选项末位为目标 ID），其次按简中文本匹配
function matchChoiceOption(stepOptions, choice) {
  if (!Array.isArray(stepOptions)) return null;
  const byTarget = stepOptions.find((x) =>
    Array.isArray(x) && Array.isArray(x[4]) && x[x.length - 1] === choice.to);
  if (byTarget) return byTarget;
  const norm = (s) => String(s).replace(/\s+/g, '');
  const byLabel = stepOptions.find((x) =>
    Array.isArray(x) && Array.isArray(x[4]) && norm(x[4][0]) === norm(choice.label));
  if (byLabel) return byLabel;
  const withText = stepOptions.filter((x) => Array.isArray(x) && Array.isArray(x[4]) && x[4][0]);
  return withText.length === 1 ? withText[0] : null;
}

// 按 group 文件中的跳转图还原叙事顺序（含选项分支的展开与汇合）
function orderSteps(steps, edges) {
  const byId = new Map(steps.map((s) => [s[0], s]));
  const outgoing = new Map();
  const indegree = new Map();
  for (const rawEdge of edges) {
    // 边列表的每一项可能是一条边，也可能是多条边的数组
    const edgeList = Array.isArray(rawEdge[0]) ? rawEdge : [rawEdge];
    for (const edge of edgeList) {
      const [from, to, label] = edge;
      if (!byId.has(from) || !byId.has(to)) continue;
      if (!outgoing.has(from)) outgoing.set(from, []);
      outgoing.get(from).push({ to, label });
      indegree.set(to, (indegree.get(to) || 0) + 1);
    }
  }
  const start = steps.map((s) => s[0]).find((id) => !indegree.has(id)) ?? steps[0][0];

  const ordered = [];
  const visited = new Set();
  function walk(id) {
    let current = id;
    while (current != null && byId.has(current) && !visited.has(current)) {
      visited.add(current);
      const outs = outgoing.get(current) || [];
      if (outs.length > 1 && outs.some((o) => o.label)) {
        // 选项分支：先记录选项，再依次展开各分支至汇合点
        // 从步骤选项数据（索引 10）中按简中文本匹配出 8 语言文本
        const stepOptions = Array.isArray(byId.get(current)[10]) ? byId.get(current)[10] : [];
        const choices = outs.filter((o) => o.label).map((o) => {
          const opt = matchChoiceOption(stepOptions, o);
          return { ...o, labelTexts: opt ? opt[4] : [o.label] };
        });
        ordered.push({ step: byId.get(current), choices });
        // 求所有分支的共同后继（汇合点）
        const reach = (startId) => {
          const set = new Set();
          let n = startId;
          while (n != null && byId.has(n) && !set.has(n)) {
            set.add(n);
            const o = outgoing.get(n) || [];
            n = o.length === 1 && !o[0].label ? o[0].to : (o[0] ? o[0].to : null);
          }
          return set;
        };
        let merge = null;
        const branchSets = choices.map((c) => reach(c.to));
        for (const candidate of branchSets[0]) {
          if (branchSets.every((s) => s.has(candidate))) { merge = candidate; break; }
        }
        for (const choice of choices) {
          let n = choice.to;
          while (n != null && n !== merge && byId.has(n) && !visited.has(n)) {
            visited.add(n);
            ordered.push({ step: byId.get(n), choices: [] });
            const o = outgoing.get(n) || [];
            n = o[0] ? o[0].to : null;
          }
        }
        current = merge;
      } else {
        ordered.push({ step: byId.get(current), choices: [] });
        // 单选项（只有一条带标签的出边）也要渲染选项行
        if (outs.length === 1 && outs[0].label) {
          const stepOptions = Array.isArray(byId.get(current)[10]) ? byId.get(current)[10] : [];
          const opt = matchChoiceOption(stepOptions, outs[0]);
          ordered.push({ step: null, choices: [{ ...outs[0], labelTexts: opt ? opt[4] : [outs[0].label] }] });
        }
        current = outs[0] ? outs[0].to : null;
      }
    }
  }
  walk(start);
  // 图中未覆盖的步骤按 ID 升序附后（兜底）
  for (const s of [...steps].sort((a, b) => a[0] - b[0])) {
    if (!visited.has(s[0])) ordered.push({ step: s, choices: [] });
  }
  return ordered;
}

// 序章开场 PV 中的菲茨杰拉德引文（视频字幕，不在脚本 JSON 中；各语言均显示同一英文原文）
const openingQuote = [
  '> IT ELUDED US THEN, BUT THAT\'S NO MATTER—TOMORROW WE WILL RUN FASTER,',
  '> STRETCH OUT OUR ARMS FARTHER....AND ONE FINE MORNING———',
  '> SO WE BEAT ON, BOATS AGAINST THE CURRENT, BORNE BACK CEASELESSLY INTO THE PAST.',
  '>',
  '> — FRANCIS SCOTT KEY FITZGERALD'
];

function renderScript(data, edges, edition, scriptId, { prependOpening = false } = {}) {
  const lines = [];
  if (prependOpening) lines.push(...openingQuote);
  const ordered = orderSteps(data[2], edges);
  for (const { step, choices } of ordered) {
    // 标题卡（步骤索引 9）
    if (step && Array.isArray(step[9])) {
      for (const card of step[9]) {
        if (Array.isArray(card) && Array.isArray(card[1])) {
          const text = stripMarkup(pickLang(card[1], edition.langIndex)).trim();
          if (text) lines.push(edition.card(text));
        }
      }
    }
    // 台词/旁白（步骤索引 2；名字在 11、内容在 15）
    // 对话类型 0 = 不进入剧情文本记录（PV/复现/重复镜头），类型 1/2/6 = 正式文本
    const dlg = step ? step[2] : null;
    if (Array.isArray(dlg) && [1, 2, 6].includes(dlg[0])) {
      const text = stripMarkup(pickLang(dlg[15], edition.langIndex)).trim();
      if (text) {
        const name = stripMarkup(pickLang(dlg[11], edition.langIndex)).trim();
        lines.push(name ? edition.dialogue(name, text) : text);
      }
    }
    // 选项（来自跳转图的分支标签）
    for (const choice of choices) {
      const text = stripMarkup(pickLang(choice.labelTexts, edition.langIndex)).trim();
      if (text) lines.push(edition.choice(text));
    }
  }
  // 去除连续的重复行（剧情回放/复现步骤产生的重复）
  return lines.filter((line, i) => i === 0 || line !== lines[i - 1]);
}

async function main() {
  const scripts = new Map();
  const groups = new Map();
  for (const part of parts) {
    for (const id of part.scripts) {
      scripts.set(id, await loadScript(id));
      groups.set(id, await loadGroup(id));
    }
  }

  for (const edition of editions) {
    edition.chapterTitle = localizedNames[edition.code].chapter;
    const out = [];
    let bodyNodes = 0;
    out.push(`# ${edition.chapterTitle}`);
    out.push('');
    for (const line of edition.metaLines) out.push(line);
    out.push('');
    out.push(`## ${edition.tocHeading}`);
    out.push('');
    parts.forEach((part, i) => {
      out.push(`- [${edition.partTitle(i + 1, part.stage)}](#episode-000${i + 1})`);
    });
    out.push('');
    out.push('---');

    let segmentNo = 0;
    parts.forEach((part, i) => {
      out.push('');
      out.push(`<a id="episode-000${i + 1}"></a>`);
      out.push(`## ${edition.partTitle(i + 1, part.stage)}`);
      for (const scriptId of part.scripts) {
        const data = scripts.get(scriptId);
        segmentNo += 1;
        out.push('');
        out.push(edition.scriptHeading(segmentNo, data[0], scriptId));
        out.push('');
        const lines = renderScript(data, groups.get(scriptId) || [], edition, scriptId, { prependOpening: scriptId === 100001 });
        bodyNodes += lines.length;
        out.push(lines.join('\n\n'));
      }
      out.push('');
    });

    const targetDir = path.join(readableDir, edition.dir, 'mainline');
    const targetPath = path.join(targetDir, edition.fileName);
    await fs.writeFile(targetPath, out.join('\n').trimEnd() + '\n', 'utf8');
    console.log(`${edition.code}: ${targetPath} (正文节点 ${bodyNodes})`);
  }
}

await main();
