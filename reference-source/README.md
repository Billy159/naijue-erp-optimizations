# 以前做过的性能与读写优化

本目录是旧提交的参考原件，16 份源码逐文件从 Git 提取。应用与测试的起点仍是仓库根目录的 APP289 源码。旧代码单独放置，避免把旧数据库结构、授权方式、数据含义或接口带入 APP289。改动前请先比较新旧两个入口的查询条件、权限和版本，再决定复用哪一段思路。交付时逐项写明采用了哪个旧文件、做了什么适配，以及哪些因新版差异不采用。

## 找文件

| 本次任务 | 旧源码位置 | 可参考的做法和新版差异 |
| --- | --- | --- |
| 销货、调拨列表 | [旧销货查询](20261020-64861890/server/domain/sales/query.ts)、[旧调拨查询](20261020-64861890/server/domain/transfers/query.ts)、[旧维护摘要读取](20261020-64861890/server/domain/documents/list-query.ts)、[旧摘要表设计](20261020-64861890/server/database/sql/document-list-read-v1.sql) | 参考先按授权取查询范围，把列表只需的摘要同单据详情分开。APP289 用原生 `sales_header`、`transfer_header` 和新普通读适配器，且总计依赖当前读取版本。优先复用当前端的同一查询状态，保留权限变化、数据变化、金额、数量和一致快照规则。旧表 DDL 仅用于理解实现。 |
| 库存宽查询 | [旧库存分页](20261020-64861890/server/domain/inventory/page-query.ts)、[旧当前库存 SQL](20261020-64861890/server/domain/inventory/current-stock-sql.ts)、[旧库存读与状态](20261020-64861890/server/domain/inventory/current-stock.ts)、[旧库存表设计](20261020-64861890/server/database/sql/current-standard-stock-v2.sql) | 参考只给当前页补明细、按需读取成员和批量查。新版余额存在性、库存证明、合法零值和未知值仍以 APP289 为准。旧的库存代次和补零口径不能作为新系统业务事实。 |
| 设置保存读回 | [旧 F03 字典项保存](20261031-73764e68/apps/web/demo-replica/frontend/runtime/catalogue/dictionary-page.tsx)、[旧 ID 定位读法](20261020-64861890/server/domain/documents/document-read.ts) | 旧 F03 已验证按回执 targetId 及版本识别结果、失败后只重读。它本身仍是分页查找。旧单据直读可参考 ID 定位；字典项要接当前已授权的适用入口，保留已提交、未读回、权限变化和版本竞争的判断。 |
| 图片 | [旧媒体存储](20261020-64861890/server/media/store.ts)、[旧图片路由](20261020-64861890/server/media/routes.ts) | 参考原图与缩略图分开、按图像版本定位。APP289 需强制每次访问核当前权限、图片版本、私有映射与文件完整性，缓存只可复用经过同等验证的内容，不能照搬旧路由策略。 |
| 库存导出 | [旧分批库存查询](20261020-64861890/server/domain/inventory/current-export-query.ts)、[旧工作簿流式生成](20261020-64861890/frontend/export-workbook-stream.js) | 参考按游标取有序数据、小块生成工作簿。新版保留一致快照、输出字段与顺序、整份确认成功后交付和临时文件清理。遇到中断或权限错误时维持原错误行为。 |
| 发布包校验 | [旧打包脚本](20261020-64861890/scripts/package-release.mjs)、[APP289 中现有的分块哈希实现](../scripts/release/backup-current.py) | 旧打包同样全读归档，仅用于对照清单和校验行为。分块读取可参考现有备份代码，应用到新版 `scripts/release/pack.mjs`，归档字节、清单与失败条件保持原值。 |
| 历史单据明细定位 | [旧历史改单按明细 ID 索引](20261026-9968f185/packages/application/src/history-revision-service.ts) | 参考在同一批相同明细上建一次内存索引、保留顺序和正反分支。这个优化属于旧改单服务；正式历史写入和迁移校验由本地承接。 |

## 来源版本

- `20261020-64861890` 来自旧 `merged-source` 的提交 `64861890f720279d345cb32a9ab13eb6b9e65ae9`。这是旧源码交付点。
- `20261031-73764e68` 来自 F03 字典项读回提交 `73764e684ceba379e1976174332a0e52a1615ad0`。
- `20261026-9968f185` 来自历史改单优化提交 `9968f18517de8a3c3ad478e10820149edf90cf65`。

以上是代码参考。正式运行证据与接口行为以 APP289 当前源码和相应环境实测为准。
