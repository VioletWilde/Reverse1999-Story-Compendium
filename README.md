# 《重返未来：1999》剧情文本档案

本仓库整理并保存《重返未来：1999》的剧情文本，方便在浏览器中按章节阅读。无需安装软件，也不需要了解 Git：选择语言后，点击章节名称即可开始。

> [!WARNING]
> **剧透提示：** 本仓库包含主线、活动、角色剧情和轶事的大量剧情内容，包括关键情节与结局，请根据自己的游戏进度阅读。

## 开始阅读

| 语言 | 阅读入口 |
| --- | --- |
| 简体中文 | [进入简体中文剧情目录](readable/story_reader_linked/zh-CN/README.md) |
| 繁體中文 | [進入繁體中文劇情目錄](readable/story_reader_linked/zh-TW/README.md) |
| English | [Open the English story index](readable/story_reader_linked/en/README.md) |
| 日本語 | [日本語ストーリー目次を開く](readable/story_reader_linked/ja/README.md) |
| 한국어 | [한국어 스토리 목차 열기](readable/story_reader_linked/ko/README.md) |

阅读版按“主线、活动、角色剧情、轶事”分类，并在对应剧情单元内收录小径文本。每章正文的顶部和底部都有上一章、返回目录与下一章链接，手机浏览器也可以直接使用。

## 电子书版本（EPUB / PDF）

如果希望在电纸书阅读器、手机阅读应用或打印场景中阅读，可以使用电子书版本：

- `story_*.epub` 与 `story_*.pdf`：此前生成的五语整合册，作为历史版本保留，不再更新；
- `by-chapter/`：当前剧情＋小径版本，每章分别提供一份 EPUB 和一份 PDF。可在release发布页获取

鉴于可能存在网络波动，也提供相对应的网盘下载地址：
[点击下载](https://pan.baidu.com/s/1P14HOX3aTgKdA_smfOwwLg?pwd=kggh)

维护者可以运行 `npm run build:ebooks`（需要 pandoc 与 typst）重新生成分章电子书；该命令不会覆盖旧整合册。

## 更新说明（2026/9/24）
- 五种语言统一为剧情＋小径章节整合版，每章一份 Markdown 文档。
- 章节及剧情单元标题采用“编号 · 标题”格式，并加入上一章、目录与下一章导航。
- 简体中文已补充国服 3.9～4.0 的主线、活动、角色故事和轶事。

## 收录说明

- `readable`：面向读者的分语言、分章节版本，推荐从这里阅读。
- `structured`：整理过程中生成的结构化文本、映射和校验资料。
- `exports`：供数据处理或进一步整理使用的导出数据。
- 不同语言客户端所含资源可能不同，因此部分语言会出现正文缺失、标题暂缺或附录数量不同的情况；各语言目录会保留相应说明。

## 剧透与版权说明

- 本仓库是由玩家维护的**非官方、非商业**剧情文本归档，与游戏开发商、发行商及其他权利人无隶属或合作关系。
- 《重返未来：1999》的名称、角色、剧情文本及相关游戏内容的权利归其各自权利人所有。
- 本仓库仅用于资料保存、检索与个人阅览，不主张对游戏原始内容享有权利，也不授权将其用于商业用途。
- 若你是相关权利人并希望反馈内容问题，请通过本仓库的 [Issues](https://github.com/VioletWilde/Reverse-1999-story-archive/issues) 联系维护者。

## 反馈问题

如果发现错字、缺句、标题或章节顺序错误，可以在 [Issues](https://github.com/VioletWilde/Reverse-1999-story-archive/issues) 中提交反馈。请尽量注明语言、剧情分类、章节名称和出错位置；不熟悉 Git 或编程也没有关系。

<details>
<summary>给维护者与数据研究者</summary>

阅读版由结构化数据生成。重新生成章节后，可运行 `scripts/update_reading_navigation.ps1` 更新 Markdown 导航，再运行 `npm run build:ebooks` 生成分章 EPUB 与 PDF（`dist/ebooks/by-chapter/`，依赖 pandoc 和 typst）。

</details>
