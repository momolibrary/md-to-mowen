## [1.9.1](https://github.com/momolibrary/md-to-mowen/compare/v1.9.0...v1.9.1) (2026-06-29)


### Bug Fixes

* 修复 codeblock 发布时 [400] CODEC 错误 ([00850c1](https://github.com/momolibrary/md-to-mowen/commit/00850c1c8e1a461e0e81c1c0741cf5cb8b5f3f39))

# [1.9.0](https://github.com/momolibrary/md-to-mowen/compare/v1.8.3...v1.9.0) (2026-06-29)


### Bug Fixes

* 修复 ESLint 空接口报错 ([b261df8](https://github.com/momolibrary/md-to-mowen/commit/b261df878cdeba90922c66cc4e03bc111d67c4ad))


### Features

* 围栏代码块自动转为整块 codeblock，移除 codeBlockStyle 选项 ([ba99ad1](https://github.com/momolibrary/md-to-mowen/commit/ba99ad1f545ed9ac28516badfedd1524503cb2b3))

## [1.8.3](https://github.com/momolibrary/md-to-mowen/compare/v1.8.2...v1.8.3) (2026-06-29)


### Bug Fixes

* 更新笔记访问地址为 note.mowen.cn/detail/ 格式 ([780e1a1](https://github.com/momolibrary/md-to-mowen/commit/780e1a101dbace5fe475356bdfff3cc61ad628ed))

## [1.8.2](https://github.com/momolibrary/md-to-mowen/compare/v1.8.1...v1.8.2) (2026-06-29)


### Bug Fixes

* 更新 CLI 集成测试指向新入口 ([58800e5](https://github.com/momolibrary/md-to-mowen/commit/58800e5a3bc73c54e8e6ca197c7306d79ddd86dd))

## [1.8.1](https://github.com/momolibrary/md-to-mowen/compare/v1.8.0...v1.8.1) (2026-06-29)


### Bug Fixes

* 移除未使用的 parseSvgSize 函数 ([d3b7930](https://github.com/momolibrary/md-to-mowen/commit/d3b7930dd4ec6d056f94e1e1dd8315f60e5949a3))
* 重构表格渲染高度计算，Satori 自动测算实现四边等距 ([120b941](https://github.com/momolibrary/md-to-mowen/commit/120b9418b486600aa05f81237f20a00aff3be6b4))

# [1.8.0](https://github.com/momolibrary/md-to-mowen/compare/v1.7.0...v1.8.0) (2026-06-29)


### Bug Fixes

* satori 测试使用 bundled 字体替代系统字体 ([5cddde0](https://github.com/momolibrary/md-to-mowen/commit/5cddde0e8ee55646d93b663ef6866c6c5b9689d8))


### Features

* 表格渲染从 Playwright 迁移到 Satori + resvg-js ([eb0faa1](https://github.com/momolibrary/md-to-mowen/commit/eb0faa1dd399235afada5e064333197f0c99fd97))

# [1.7.0](https://github.com/momolibrary/md-to-mowen/compare/v1.6.0...v1.7.0) (2026-06-29)


### Features

* 发布 v1.6.0 ([a6c77ea](https://github.com/momolibrary/md-to-mowen/commit/a6c77ea1c790bb26518f0f957f6aa6036e836443))

# [1.5.0](https://github.com/momolibrary/md-to-mowen/compare/v1.4.1...v1.5.0) (2026-06-29)


### Bug Fixes

* 移除未使用的 import ([279d9a5](https://github.com/momolibrary/md-to-mowen/commit/279d9a57aa77af8a62cbcae17cbbca559e3031e5))


### Features

* 添加 install-skill 命令，支持 Claude Code 和 Cursor 技能安装 ([5a018a2](https://github.com/momolibrary/md-to-mowen/commit/5a018a2aeb2e4582d0b7117cd020387a63ee49a2))

## [1.4.1](https://github.com/momolibrary/md-to-mowen/compare/v1.4.0...v1.4.1) (2026-06-28)


### Bug Fixes

* CI 先构建再测试 ([dbf91b1](https://github.com/momolibrary/md-to-mowen/commit/dbf91b1fc69ce175040513a163679ca64ad4bfbd))
* plugin.json 版本同步为 1.4.0，npm 包包含 skills 目录 ([1d236b1](https://github.com/momolibrary/md-to-mowen/commit/1d236b1ceea51971ffe46369fe585656de990837))
* 修复 bin 路径、依赖和 CI 配置 ([04cbb1f](https://github.com/momolibrary/md-to-mowen/commit/04cbb1f1c7a8fd3bb9d053e6e0ed63344d0fe0cc))
* 修复 ESLint 错误，更新测试期望值 ([777d690](https://github.com/momolibrary/md-to-mowen/commit/777d690c391ef63a8e012a5a1f02abfb1434a929))
* 更新 Release 工作流脚本 ([3fb91a5](https://github.com/momolibrary/md-to-mowen/commit/3fb91a5f33c5f5bb079bcd28c557fe71f773bcee))
* 更新测试期望值和 lock 文件 ([eac45f8](https://github.com/momolibrary/md-to-mowen/commit/eac45f86826a04a177860f82c3d9e54d54fcffa9))

# [1.4.0](https://github.com/momolibrary/md-to-mowen/compare/v1.3.1...v1.4.0) (2026-06-28)


### Bug Fixes

* 修复 -V 版本显示为 0.0.0 的问题 (#MAR-7) ([#15](https://github.com/momolibrary/md-to-mowen/issues/15)) ([2652cff](https://github.com/momolibrary/md-to-mowen/commit/2652cff9cff6f702e7e79446032fe8e133e8129e)), closes [#MAR-7](https://github.com/momolibrary/md-to-mowen/issues/MAR-7)
* 修复 preprocessHighlight 导入冲突 ([8ef9f53](https://github.com/momolibrary/md-to-mowen/commit/8ef9f535cbf572440f0983cea7155fe27e287614))


### Features

* highlight 标记全链路支持 (closes [#27](https://github.com/momolibrary/md-to-mowen/issues/27)) ([#30](https://github.com/momolibrary/md-to-mowen/issues/30)) ([60d23ad](https://github.com/momolibrary/md-to-mowen/commit/60d23ade1553d9914282960c98dfbca88261b3f7))
* PDF 嵌入 (pdf) 块类型支持 (closes [#29](https://github.com/momolibrary/md-to-mowen/issues/29)) ([#32](https://github.com/momolibrary/md-to-mowen/issues/32)) ([468d1ca](https://github.com/momolibrary/md-to-mowen/commit/468d1ca8109aa22a359f9a7242195b9062d0b2fe))
* status 命令 — 查看已发布笔记状态 (closes [#20](https://github.com/momolibrary/md-to-mowen/issues/20)) ([#23](https://github.com/momolibrary/md-to-mowen/issues/23)) ([67398ad](https://github.com/momolibrary/md-to-mowen/commit/67398ad9638b654b5c60a1f34566a09c091b4a41))
* 内链笔记 (note) 块类型支持 (closes [#28](https://github.com/momolibrary/md-to-mowen/issues/28)) ([#31](https://github.com/momolibrary/md-to-mowen/issues/31)) ([034cfed](https://github.com/momolibrary/md-to-mowen/commit/034cfedf11572e748a047d85e59f1c0deaa36130))
* 批量发布进度条与 ETA 显示 (closes [#21](https://github.com/momolibrary/md-to-mowen/issues/21)) ([#24](https://github.com/momolibrary/md-to-mowen/issues/24)) ([d5b9167](https://github.com/momolibrary/md-to-mowen/commit/d5b91677455de3b8fde882182babf8bcdd01b31f))
* 支持空行保留、高亮语法(==text==)和图片默认无标题 ([4db6e3a](https://github.com/momolibrary/md-to-mowen/commit/4db6e3a03fe81af7daea88633e37321006beafb8)), closes [#20](https://github.com/momolibrary/md-to-mowen/issues/20)
* 有损转换警告机制 (closes [#22](https://github.com/momolibrary/md-to-mowen/issues/22)) ([#25](https://github.com/momolibrary/md-to-mowen/issues/25)) ([17633dc](https://github.com/momolibrary/md-to-mowen/commit/17633dce0d45f5046ec6b8038caa4cdad0cfde9f))
* 添加端到端开发 skill (e2e-dev) ([46da7c2](https://github.com/momolibrary/md-to-mowen/commit/46da7c2cb25c89f554ea3e22ee491ce168d4d529))

## [1.3.1](https://github.com/momolibrary/md-to-mowen/compare/v1.3.0...v1.3.1) (2026-05-28)


### Bug Fixes

* move playwright to dependencies and add postinstall script for chromium ([#18](https://github.com/momolibrary/md-to-mowen/issues/18)) ([288178c](https://github.com/momolibrary/md-to-mowen/commit/288178c6cc2d91877f81bd4fe97ced9b0eaf5642))
* 修复列表项内超链接和格式丢失的 bug ([#19](https://github.com/momolibrary/md-to-mowen/issues/19)) ([0f20330](https://github.com/momolibrary/md-to-mowen/commit/0f20330e63b732c02911c13376d3bbadb9d7069f))

# [1.3.0](https://github.com/momolibrary/md-to-mowen/compare/v1.2.1...v1.3.0) (2026-05-15)


### Features

* 支持 Claude 插件安装方式 ([f1136b0](https://github.com/momolibrary/md-to-mowen/commit/f1136b0454152d20fc0a28405583da617d7cd9d9))

## [1.2.1](https://github.com/momolibrary/md-to-mowen/compare/v1.2.0...v1.2.1) (2026-05-14)


### Bug Fixes

* add header image ([314728e](https://github.com/momolibrary/md-to-mowen/commit/314728ee91627e16cfba2bb1d49dc610e6ad7c86))

# [1.2.0](https://github.com/momolibrary/md-to-mowen/compare/v1.1.1...v1.2.0) (2026-05-06)


### Features

* 元数据文件原子写入与备份 (#MAR-4) ([781bb6c](https://github.com/momolibrary/md-to-mowen/commit/781bb6cb117605b41b0e7a52dad51f186eb84c4b)), closes [#MAR-4](https://github.com/momolibrary/md-to-mowen/issues/MAR-4)
* 元数据文件并发写入锁 (#MAR-5) ([a90bb70](https://github.com/momolibrary/md-to-mowen/commit/a90bb70805ada44d24d82300e501bbca6689cca9)), closes [#MAR-5](https://github.com/momolibrary/md-to-mowen/issues/MAR-5)
* 支持批量发布整个目录的 Markdown 文件 ([#2](https://github.com/momolibrary/md-to-mowen/issues/2)) ([c1067d4](https://github.com/momolibrary/md-to-mowen/commit/c1067d4d204b17ec95065bc19a8670594ed16536))
* 支持独立的隐私设置命令 ([2153bf8](https://github.com/momolibrary/md-to-mowen/commit/2153bf8747be22f03903486b4fd1a4b41f241da2))
* 支持配置文件持久化常用选项 ([d26b5d9](https://github.com/momolibrary/md-to-mowen/commit/d26b5d9507ccf9b81206a2abc16a51a8b7c58b47))

## [1.1.1](https://github.com/momolibrary/md-to-mowen/compare/v1.1.0...v1.1.1) (2026-05-05)


### Bug Fixes

* 取消过期 release 任务避免分支落后 ([629716b](https://github.com/momolibrary/md-to-mowen/commit/629716ba97274c0f7e531a981b3ab32ca65a75b3))

# [1.1.0](https://github.com/momolibrary/md-to-mowen/compare/v1.0.2...v1.1.0) (2026-05-05)


### Features

* 支持元数据持久化，自动追踪 file→noteId 映射 ([#1](https://github.com/momolibrary/md-to-mowen/issues/1)) ([cb10c55](https://github.com/momolibrary/md-to-mowen/commit/cb10c557b968558524dd345fac72be0e611238c1))

## [1.0.2](https://github.com/momolibrary/md-to-mowen/compare/v1.0.1...v1.0.2) (2026-05-05)


### Bug Fixes

* add metadata.json to .gitignore ([fdeff2b](https://github.com/momolibrary/md-to-mowen/commit/fdeff2bf9e3d97a5b717b7f4d6876282ae7ccb70))

## [1.0.1](https://github.com/momolibrary/md-to-mowen/compare/v1.0.0...v1.0.1) (2026-05-04)


### Bug Fixes

* exclude pipeline cache from npm package ([73ae925](https://github.com/momolibrary/md-to-mowen/commit/73ae92514ae5f6741b0fbfcecbc153e3e4e99176))

# 1.0.0 (2026-05-04)


### Bug Fixes

* load .env from project root, not cwd ([eae4276](https://github.com/momolibrary/md-to-mowen/commit/eae42763c8da0157ce9fe296305c6f8c2c3051f7))
* resolve all TypeScript strict type errors for build ([af7d533](https://github.com/momolibrary/md-to-mowen/commit/af7d5339b4c0407e24256d2d215bc8df14766939))
* resolve upload pipeline issues for full sample.md publish ([81bea7e](https://github.com/momolibrary/md-to-mowen/commit/81bea7ef7a967ac37b31e6dcdcd9010713f7dc4c))


### Features

* add audio node support with show-note (MAST + NoteAtom + pipeline) ([2a9f4e0](https://github.com/momolibrary/md-to-mowen/commit/2a9f4e02d6b6fffb2b9fa38b5364d699740792d6))
* add bidirectional conversion (NoteAtom → MAST → Markdown) ([2d2bcd1](https://github.com/momolibrary/md-to-mowen/commit/2d2bcd10a49f7b385ce1e263aa158dd32dd93f41))
* add config command and multi-path .env search ([6f844a1](https://github.com/momolibrary/md-to-mowen/commit/6f844a180a7f6981283cd5f1f4322f2647f43d97))
* add publishMdToMowen API and to-markdown CLI command ([6f40752](https://github.com/momolibrary/md-to-mowen/commit/6f407527a48ca802fa554bcd38d936ad2d816532))
* implement pipeline stage 2 — Markdown → HAST → MAST ([7f234d9](https://github.com/momolibrary/md-to-mowen/commit/7f234d9cecbdb45af32d6901f8ae480dded8b7b8))
* implement pipeline stage 3 — asset processing ([2fbd995](https://github.com/momolibrary/md-to-mowen/commit/2fbd99582b51b18d671527468abdf501394d5fc9))
* implement pipeline stages 4-5 + dry-run mode ([f04655b](https://github.com/momolibrary/md-to-mowen/commit/f04655bba304bdeecab67a12d5af76a36f0e048d))
* make CLI globally runnable via npm link ([2df3529](https://github.com/momolibrary/md-to-mowen/commit/2df35295a5ae1b50039dc5a019db093d70b41435))
* write pipeline cache to out/pipeline-cache/ by default ([ab8d819](https://github.com/momolibrary/md-to-mowen/commit/ab8d819294aa20de49ab71c614fdfc308cee9ecd))
