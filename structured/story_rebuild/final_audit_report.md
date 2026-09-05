# 剧情文本重建最终审计

## 结论

- 已合成四类可读章节：987 个剧情单元、78 个章节、107634 条正文节点。
- 每个已输出单元都有章节标题、单元标题和正文；正文文件、剧情图遍历及空正文检查均通过。
- 副标题缺口共 123 个：其中 122 个源配置本来没有副标题字段，真正存在键但尚未解析的只有 1 个。
- 再拉取的 `configs/story` 与原包哈希一致；因此当前缺口不是正文资源包下载不全。
- 仍有候选剧情脚本未安全归属到具体章节。它们保留在待确认清单中，没有凭标题相似度强行合并。

## 四类输出

| 分类 | 章节 | 剧情单元 | 正文节点 |
|---|---:|---:|---:|
| 主线 | 14 | 288 | 31336 |
| 活动 | 19 | 356 | 40784 |
| 角色剧情 | 19 | 159 | 17083 |
| 轶事 | 26 | 184 | 18431 |

## 完整性检查

- 空正文：0
- 缺失剧本文件：0
- 剧情图覆盖失败：0
- 校验警告：0
- 占位单元标题：0
- 占位章节标题：0
- 使用繁体中文标题回退：191
- 使用繁体中文副标题回退：85
- 使用社区档案或内部名标题回退：18
- 使用英文副标题回退：1

## 尚待补抓

- 未绑定脚本：890；其中候选剧情脚本：211。
- 候选分类：activity=209, mainline=2。
- 主线候选：101037 第十章10-25（48 行）；800008 【S02】啁啾表【收藏品】（22 行）
- 唯一有键但未解析的副标题：episode 1510104 / language_10004141
- 运行时补抓状态：blocked_no_debug_privilege。 Windows refused process-memory access (WinError 5; SeDebugPrivilege unavailable).
- 下一步不是重复下载正文包，而是以管理员权限运行现有只读扫描，补齐运行时章节名、简体元数据与候选脚本绑定。

## 关键产物

- 阅读库：`C:\Users\airey\reverse1999\output\story_reader_complete_verified`
- 重建绑定：`C:\Users\airey\reverse1999\output\story_rebuild\episode_script_bindings_rebuilt.json`
- 未归属清单：`C:\Users\airey\reverse1999\output\story_rebuild\unresolved_scripts.json`
- 机器可读校验：`C:\Users\airey\reverse1999\output\story_rebuild\final_validation.json`
