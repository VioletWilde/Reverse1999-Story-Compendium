# Issue #2 阅读版修订

> 后续更新：2026-11-23 已按 UTTU 可读取剧情完成补录。本文保留当时的来源、数量与核对结果；当前收录范围见 [UTTU 全量补录](../uttu_completion_20261123/README.md)。

本次为五种语言各补回 34 个剧情单元，并修正错配、空白及截断。各语言目录已同步，原有小径和关卡锚点均保留。

| 篇目 | 修订 | 核对 |
| --- | --- | --- |
| 河港与海之间 | 01–08 按 `activity179_episode` 重绑为 `310801–310811` | [灰机 Wiki](https://res1999.huijiwiki.com/wiki/%E6%B2%B3%E6%B8%AF%E4%B8%8E%E6%B5%B7%E4%B9%8B%E9%97%B4-01) · [UTTU](https://uttu.merui.net/story/character/barcarola/) |
| 不老春 | 09 改回 `203414`，开头是芦草结在室内整理记录 | [灰机 Wiki](https://res1999.huijiwiki.com/wiki/%E4%B8%8D%E8%80%81%E6%98%A5) · [UTTU 第 09 节](https://uttu.merui.net/story/event/3_4/en/?part=9) |
| 夜游十字街 | 07 由无对白的 `310512` 接入 `310513` 和 `310514` | [灰机 Wiki](https://res1999.huijiwiki.com/wiki/%E7%BA%B8%E4%BF%A1%E5%9C%88%E5%84%BF%C2%B7%E5%A4%9C%E6%B8%B8%E5%8D%81%E5%AD%97%E8%A1%97) · [UTTU 第 07 节](https://uttu.merui.net/story/character/flutterpage/en/?part=7) |
| 长夜鸣笛 | 简中 07 改回 `203109`，10 补回 `203114` | [灰机 Wiki](https://res1999.huijiwiki.com/wiki/%E9%95%BF%E5%A4%9C%E9%B8%A3%E7%AC%9B) · [UTTU](https://uttu.merui.net/story/event/3_1/) |
| 人们向何处去 | 简中 13 补回 `203620` | [UTTU 第 13 节](https://uttu.merui.net/story/event/3_6/en/?part=13) |
| 美梦后记 | 简中 02 补 `302303–302304`，05 补 `302308` | [灰机 Wiki](https://res1999.huijiwiki.com/wiki/%E5%9F%83%E9%87%8C%E5%85%8B%C2%B7%E7%BE%8E%E6%A2%A6%E5%90%8E%E8%AE%B0) · [UTTU](https://uttu.merui.net/story/anecdote/erick/) |
| 此即明日 | 01 的简中和英文页补录开场 CG 题词 | [UTTU 第 01 节](https://uttu.merui.net/story/main/chapter-0/en/?part=1) · [英文 Wiki 题词](https://reverse1999.fandom.com/wiki/Rock_%27n%27_Roll_Radio) |
| 补收整节 | 活动 12 节、角色剧情 14 节、轶事 8 节 | [灰机 Wiki 活动目录](https://res1999.huijiwiki.com/wiki/%E6%B4%BB%E5%8A%A8%E5%88%97%E8%A1%A8) · [UTTU 剧情目录](https://uttu.merui.net/story/) |

## 来源与校验

- 简中正文取自 2026-11-09 国服 4.1 快照。四种国际服语言新增或换入的正文取自 [`v1.2.0` 的官方多语脚本快照](https://github.com/VioletWilde/Reverse1999-Story-Compendium/tree/f6e18439f0aae81d74c3d9a8a9a80b7bcae53c08/structured/story_resources)，原有国际服 3.9 正文继续沿用。简中题词按 `xuzhangkaichangpv.mp4` 的画面补录，英文题词依据 UTTU 并与英文 Wiki 核对。
- [逐节绑定及来源记录](issue-2.json) 记录脚本、源文件校验值及 255 项 UTTU 分节核对。按语言与脚本统计可对照的较长文本行，365 组中最低匹配率为 87.5%。该比对用于核查段落归属，行数差异可能来自断句、演出文字或语言版本差异。
- 《向雨林深处》第 03、07 节保留原有档案锚点，其余正式关卡使用活动内关卡 ID。没有独立关卡 ID 的 00 节以本章编号加 `00` 作为阅读版锚点。
- [47 篇整篇覆盖核对](coverage-audit.md) 列出 Issue 中的角色剧情及轶事和客户端配置位置。

后续又对照 UTTU 检查全部已收录章节，修正四节串档、两篇轶事篇名，并为每种语言补入《不老春》14 个论坛话题、64 条帖子与回复。检查范围、空正文和仍缺少的整篇故事见 [2026-11-22 全量核对报告](../story_reader_audit_20261122/README.md)。
