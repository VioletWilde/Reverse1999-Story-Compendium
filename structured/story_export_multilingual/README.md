# Reverse: 1999 多语言剧情导出

- `episode_script_map.md/json`：剧情关卡、标题、脚本与小径总映射。
- `trail_story_map.md`：167 条小径到所属关卡及剧情脚本的映射。
- `mapping_report.json`：匹配依据、分类、标题卡与本地归档校验结果。
- `zh-CN`、`zh-TW`、`en`、`ko`、`ja`：按类别组织的逐脚本 Markdown。

播放顺序来自 `configs/story/groups` 剧情图，不采用 JSON 物理排列。
客户端脚本原文是正文权威来源；本地 story archive 只用于标题校验。
小径描述与交互文本当前仅从简中运行时语言字典恢复，其他语言脚本正文仍完整导出。
