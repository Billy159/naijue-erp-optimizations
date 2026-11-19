# 奈爵 ERP 应用层性能修复交接

本仓库是 APP289 源码快照，原提交 `cb1155328d46286569e166246000c66e53ec8365`，原源码树 `24fdaa9d88adf34aeac71033d954522dcd734a99`。源码、构建配置和定向测试可用。现场数据、运行凭据、生产配置和历史回执留在本地。以本仓库 `main` 当前提交作为审查和 PR 对照基线。

## 先对照旧版实现

先读 [旧版参考源码索引](reference-source/README.md)。按本次修改项定位旧文件和 APP289 的实际入口，在 PR 说明哪部分做法沿用、按新版的权限、接口、原生表和数据版本怎么适配。旧源码目录只供参考，实际改动只落在 APP289 对应文件。若旧版只有类似思路或同样缺少优化，以当前正式入口和业务语义设计修复。

## 工作范围

**保留现有后端数据结构。** 这批提交不改数据库表、列、类型、索引、触发器、迁移、权限、持久化数据格式、公开请求或响应字段。可以优化现有 SQL、后端读取或汇总实现、前端请求和应用内临时处理。只允许新旧版本都能继续读取现有数据的改动。遇到确实需要存新数据、改表或新增公开接口的事项，先交付可独立完成的部分，把理由、最小差分和影响写进 PR 供本地另行裁决，不把结构改动混进本批。

按顺序把下面六项改完。开 `codex/dot-app-performance-20261119`，从现有代码出发，按问题分开提交。以现有正式入口 `apps/web/demo-replica/frontend/production-bootstrap.ts` 和 `apps/api/src/postgres-read-api.ts` 确认接线。保留权限、分页、精确汇总、数据隔离和原业务结果。优先用合成数据重现，再改代码，最后跑原测试和修改项的针对性检查。

1. **销货和调拨列表**。`adapters/postgres/src/ordinary-document-list-reader.ts`、`apps/web/demo-replica/frontend/runtime/documents/{sales-session.ts,transfers-session.ts,ordinary-list-totals.ts}`。同一筛选、用户权限和可证明的数据版本下，避免每次翻页又拉全范围合计。产生写入、同步或权限变化时，旧合计失效。精确条数、显示顺序、筛选、跨页和 409 行为保留。先做可小步交付的请求去重，再处理深分页计划。
2. **设置保存读回**。`apps/web/demo-replica/frontend/runtime/catalogue/dictionary-page.tsx`。保存后当前用搜索逐页找同一个 ID。优先复用允许按原 ID 和版本读回的现有入口。若当前没有等价的精确读取能力，沿用已授权入口并将新增接口方案列为待裁决。原筛选、翻页、删除和并发变更提示继续可用。
3. **发布压缩包 SHA-256**。`scripts/release/pack.mjs`、`scripts/release/pack.test.mjs`。用文件流计算归档 SHA 和长度，保留原归档字节、清单、解包校验、错误处理和输出格式。
4. **库存宽查询**。`adapters/postgres/src/inventory-query-reader.ts`。看 `catalogStatus` 和页内 `stock_facts` 路径，减少同一次请求内重复的仓库×SKU 查询及资格证明。按官方数据语义区分明确零和未知，库存总量、当前页、授权仓库范围必须一致。先量少仓和多仓两类合成用例，保留可复测的数字。
5. **商品图片**。`adapters/media/src/controlled-product-media.ts`、`apps/api/src/product-media-http.ts`。在保留每次访问权限、图片当前版本检查、私有路径和完整性保证的前提下，减少同一不可变版本重复读文件的开销。换账号、权限撤销、版本变化、文件变化和请求中断须仍按原结果处理。
6. **全量库存导出**。`apps/api/src/inventory-http.ts`、`adapters/postgres/src/inventory-query-reader.ts`。沿当前数据库一致快照、按页读取和有限临时文件流程，减少重复组装或不必要的内存复制。保留先确认完整成功再交付的约定、输出顺序、限制和失败后清理；导出中途失败不可发半份成果。

导入 SQL、库存余额索引、历史调拨整单复核、正式服务器操作和发布由本地团队承接。此次 Dot 只提交应用和工具源码，测试用合成数据，独立提交以便本地选择合并。

## 验证与交付

使用 Node `24.21.0` 和现有锁文件。在仓库根 `npm ci` 后按改动运行下列现有定向测试。新增最少量用例来覆盖每项原来会重复处理的场景、权限变化或失败路径。依赖安装、缺少本地正式资料、浏览器和 PostgreSQL 测试可用性如实报告。

```sh
node --experimental-transform-types --test tests/ordinary-document-list-postgres-protocol.test.ts tests/inventory-query.test.ts tests/inventory-query-postgres-protocol.test.ts tests/dictionary-read-postgres-protocol.test.ts tests/controlled-product-media.test.ts apps/api/src/inventory-http.test.ts apps/api/src/product-media-http.test.ts scripts/release/pack.test.mjs
```

推送工作分支，开指向本仓库 `main` 的草稿 PR 并停在待合并状态。交付 PR 链接、基线 SHA、最终 SHA、逐项改了哪些文件、实跑命令与结果、同一模拟输入的优化前后数据、未通过或未测项。逐项附旧代码参考路径、在 APP289 中的适配以及未直接采用的原因，说明数据库结构、持久化、公开数据格式与业务口径如何保持兼容。说明哪些提交可以单独取回。若某项依赖缺失，只续做其余独立项并在 PR 标明阻塞。由本地 Codex 对照原工程复跑、检查接口和合并，Dot 的工作分支不直接替换生产。
