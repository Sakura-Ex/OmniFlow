# OmniFlow 技术债审查 — 2026-10-23

> **v2 收尾更新（2026-10-23）**：本轮已补保存基准与离开保护、TPS／字典／已建状态历史事务、批量补全一次撤销、系统剪贴板优先级，以及有效的模块边界检查、CI 配置、后端来源／请求体限制和异常日志。最新实测为前端 317、后端 183 项通过；详细覆盖及尚未完成的浏览器验收见[测试记录](testing.md)。下文旧快照中的对应缺口不再代表现状。全图快照性能、恢复机制、完整浏览器自动化等仍未因此解决；三种显示模式留到下一阶段。

> 历史审查记录，非当前实现总表。主体以 PR-01～05 为审查基线；文末“菜单改造后的增量设计审查”属于后续独立快照。下文的“尚未实现”“当前”“未验证”等描述只适用于各自审查时点。后续实现及验证记录见 [v2 验收台账](validation/v2-completion/README.md)和[测试说明](testing.md)；当前交互目标与已知差距见[交互设计手册](interaction-design-handbook.md)。保留历史证据，不将旧问题自动视为仍存在或已修复。

历史源码定位说明：下文行号对应审查快照，可能不再匹配当前文件。`src/features/calculation/payloadBuilder.ts` 已删除，当前编译入口为 `networkCompiler.ts`；原 `src/features/canvas/hooks/useClipboard.ts` 已迁移至 `src/features/file-io/hooks/useClipboard.ts`。保留原引用作为历史证据，查看旧实现需使用相应 Git 历史，不按旧路径恢复已淘汰模块。

本报告先完成工作区审查，随后按用户授权修复 PR-01～05 已交付链路中的明确缺陷（见下方修复记录）。保留仓库原有未提交修改，README 的本次修订叠加在原修改之上。历史设计和实施计划只用于辨别既有迁移债，不作为已经实现的证明。

复核基线：**v2 已实现到 PR-05，PR-06–12 尚未执行。** 正式入口保留旧模型是实施计划的明确安排，不是 PR-05 漏接。上一版报告把“当前存在的局限”“已交付功能的实现缺陷”和“后续交付项”统一计入技术债并给出 13 项 P1，口径不准确；该总数和优先级汇总撤回。下方的阶段归属优先于对最终 v2 目标的比较。

结论：实施计划、PR-05 契约文档和测试说明基本一致；主要文档问题是本报告原来的归类、设计草案的状态标记，以及 README 将目标架构/性能写成当前事实。审查时复现的 GT 单位等价错误、旧 API 结果身份覆盖、注册表提交回滚和文档撤销不完整已在本轮修复。不能为修正文档而掩盖这些现有行为，也不能为满足整套 v2 设计而提前补做 PR-06–12。

## PR-01～05 修复记录（2026-10-23）

下文编号条目保留审查时的证据和路径，修复状态以本节为准。

| 原编号 | 本轮结果 |
|---|---|
| TD-06 | 后端始终按图节点 ID 返回结果；前端和 CapEx 移除配方 ID 回退，覆盖端点同名及重复模板实例 |
| TD-08 | 旧 CapEx 在显式环境中先换算为规范单位再相加，拒绝同资源不同维度；未接入 PR-08 的最终占用模型或新 HUD |
| TD-10 | GT 超频先按原周期计算功率，再按最终周期还原声明值；每 tick、每秒、每周期能量保持等价 |
| TD-12 | 计算流水线拒绝空白资源类别/ID；编辑文档仍允许保存不可运行草稿 |
| TD-15 | 历史快照包含单位环境和注册表；恢复环境前清空旧配方，恢复后按原环境编译；文件导入采用同样的安全顺序 |
| TD-18/19 | 注册表整批提交；应用后读取新状态；拒绝未完成身份和重复 ID 覆盖；失败时不关闭编辑器 |
| TD-20 | 剪贴板使用 v4 文档校验并携带环境。环境不同则拒绝粘贴，提示通过文件导入保留含义；剪贴板 hook 移入 file-io，复用已有文档边界 |
| TD-21 | 剪切在等待系统剪贴板之前删除已复制选择，避免等待期间选择变化后误删 |
| TD-32 | 删除没有消费者的第二条功率预览路径；提交先走可捕获错误的预览，再保存有效配置 |
| TD-43 | 注册表/TPS 模态打开时禁用全局画布快捷键；完整焦点约束仍待浏览器验收 |

未修改 PR-06～12 的图编译、路由切换、新占用模型、异步执行池等功能；也未扩展未挂载的项目管理骨架（TD-16/17/23）或进行架构边界工具重整（TD-24）。这些条目仍开放，不计入本轮完成项。

验证：Vitest **160 passed / 14 files**；pytest **160 passed, 4 skipped**；build、lint 通过。4 个跳过用例保留为后续阶段验收，不属于重复测试。旧的配方 ID 回退断言已替换，未删除有效回归或契约夹具。新增剪贴板 hook 测试隔离 React hook 容器、执行真实业务回调，不等同浏览器端到端验收。本轮未运行浏览器交互验收；构建仍提示主包超过 500 kB（631.36 kB）。

## 阶段复核：先判归属，再谈修复

判定顺序：用户确认的交付阶段 → `v2-implementation-plan.md` 的具体范围/排除项 → `solver-lp.md`、`testing.md` 和实现记录 → 实际代码与复现。总体设计描述最终目标，历史 gap assessment 描述过去状态，均不能越过实施阶段判定当前交付失败。

| 阶段 | 当前应具备的能力 | 本次判断 |
|---|---|---|
| PR-01 | 旧接口非法输入/状态处理、machines_actual 消费、测试基线 | 已交付；结果字典身份冲突属于该现有链路的问题。未承诺完整成功响应 schema 或新守恒模型 |
| PR-02 | 单位代数、显式环境、现有调用方接入和存档 | 已交付；GT 单位等价、导入撤销环境及混合单位展示需要补漏，不据此否定单位核心实现 |
| PR-03 | 独立 portId、连接/复制/历史/存档身份稳定 | 已交付；不是“整个 v2 编译器已完成”，也没有明确承诺概率插件按单个端口配置 |
| PR-04 | 只读 Context→Effect、最终端口、资格、轨迹、占用输出 | 已交付；占用输出不等于 PR-08 的完整 BOM 已接入。插件 UI 解耦是结构优化，不是该 PR 必做验收 |
| PR-05 | 独立稀疏 LP、分层目标、有限预算、残差和契约 | 已交付；函数级调用、不新增用户入口、旧路由保留均符合计划。本次没有证据认定 PR-05 求解核心存在缺陷 |
| PR-06/07 | 严格网络编译、正式入口切换、结果版本/校验/汇总 | 未实施，不计为 PR-01–05 缺陷 |
| PR-08/11/12 | 完整安装/BOM、执行池、发布性能与端到端验收 | 未实施，按原计划推进，不单独制造“欠债修复”工作 |

### 45 条原始记录的重新归属

保留编号便于追踪，不再把这些条目统称为 45 个 bug。分类为：**12 条后续计划、15 条现有实现问题、17 条结构改进/契约待明确、1 条原有文档维护项**。现有实现问题包含尚未挂载主界面的项目骨架缺陷，不等于 15 条全部在主流程中触发。文档冲突的新增复核见下一节，不拿它们凑缺陷数量。

| 分类 | 原编号 | 阶段/处理结论 |
|---|---|---|
| 后续计划 | 01、02、03 | PR-06/07：守恒、显式排放、目标编译；旧入口反例是真实局限，不证明 PR-05 失败 |
| 后续计划 | 04、05 | PR-07：边界汇总、SystemHUD 和 Net 结果解释 |
| 后续计划 | 07 | PR-07 残差接入 + PR-08 安装容差；旧流量阈值作为迁移验收保留 |
| 后续计划 | 09 | PR-08：最终占用到安装/BOM 的消费；PR-04 已输出占用数据 |
| 后续计划 | 13、14、45 | PR-07 明文包含请求 revision、过期结果、成功响应校验；不提前列为本阶段 P1 |
| 后续计划 | 33 | PR-07 明文删除旧路由建模与 debug 重复构造；现阶段不重构一遍即将删除的代码 |
| 后续计划 | 34 | PR-11 运行隔离/队列，PR-07 接入已有 solver 限额；不能把函数预算与 HTTP 并发混为一谈 |
| 现有实现 | 06、10、12 | 旧 API 身份覆盖、GT 时间基准错误、可运行 Recipe 空资源身份。证据明确；修代码及回归测试 |
| 现有实现（交界） | 08、15 | 混合单位 BOM 与导入撤销环境：不能仅改文档。08 可并入 PR-08，但应记录 PR-02 接入的现有限制；15 属已提供的文档/撤销功能完整性 |
| 现有实现 | 18、19、20、21、24、32、43 | 注册表提交/冲突、剪贴板、架构检查、草稿异常、快捷键隔离；不是等待未来求解器即可自动解决 |
| 现有实现（未接入路径） | 16、17、23 | DB 加载/reset、dirty、项目异步状态；修复优先级低于当前主流程，启用项目功能前验收 |
| 结构改进/契约待明确 | 11、29、30、31 | 概率目标是资源还是端口、存档是否锁实现版本、参数缺省/拒绝策略、未知范式回退。现有行为可确认，但“应改成什么”不能全凭最终设计推断 |
| 结构改进 | 22、25、26、27、28 | 项目骨架与实际存储分离、反向依赖、双份状态、DTO 漂移、core/UI 耦合；逐步整理，不否定 PR-01–05 已交付 |
| 结构改进（有混合子项） | 35、36、37 | 编译/单位重复开销需测量后优化；37 的 implemented 绕过历史可局部补测，不必整体重做历史框架 |
| 工程改进 | 38、39、40、41、42 | CI、浏览器回归、strict、部署配置、视口/恢复。PR-01 明确不引入整套浏览器测试；这些不是已承诺验收失败，发布相关部分归 PR-12 |
| 文档维护 | 44 | 注释与示例漂移；ID 工具重复属于小型维护改进，不能按纯文档问题全部关闭 |

### 文档究竟哪里有问题

1. **本报告原版归类错误（已修正）**：将按计划未交付的工作与实现缺陷混算，并把旧入口六个反例描述为一组待紧急修复事项。六个反例中，前四个加普通 Net 缺供属于后续编译/入口验收；只有结果身份覆盖是本次发现的旧契约实现问题。
2. **实施计划/PR-05 文档没有这个错误**：两者明确写了 PR-01–05 已完成、PR-06–12 未执行、PR-07 切入口；`testing.md` 也明确成功 schema 与 request revision 留给 PR-07，四项 skip 属未来验收。无需为迁就旧报告改动这些边界。
3. **设计草案状态过时**：`technical-design-v2-proposal.md:3` 仍写“待采纳”，与已按该路线完成 PR-05 不一致。应标注它是分阶段实施中的总体目标，以实施计划界定完成范围。历史差距评估中的早期单 unitId 设想也不能覆盖 PR-02 后来确认的单位表达式方案。
4. **历史 gap assessment 需要醒目的时点说明**：原文日期 2026-09-22，端口/单位/通用 LP 尚缺的判断是当时事实。应保留历史而非改写成今天的代码，但入口应提示已有 PR-01–05 进展。
5. **README 对现状和目标混写**：英文 README 的“receiving only normalized vectors and matrices”“within 30ms”、中文 README:72 的对应说法与正式旧接口不符，也没有当前硬件/数据集性能证据；当前传 nodes/edges 并由旧后端建模。两份 README 还把“不包含任何硬编码游戏逻辑/只需更换配置”写得过满，现有 GT 插件、范式默认映射确实在代码中。应说明“通用 LP 核心无游戏语义，游戏行为由插件实现”，不能承诺纯配置适配任何游戏。
6. **旧技术文档不能继续被当作现行插件契约**：`technical-design.md:390` 仍说 evaluate 原地修改 Context；PR-04 已改只读 Context→Effect。README 中“过滤不兼容修饰器”也与现在明确拒绝不符。应标历史/被替代章节并指向现行说明，不能把代码退回旧文档行为。

本轮只修正审查报告和两个状态/历史入口说明；README、旧技术文档已有用户未提交改动，本轮记录准确的修订点而不整篇重写它们。

## 范围与证据

检查覆盖：前端计算与拓扑、单位、修饰器、画布与配方状态、编辑与撤销、文件/剪贴板、资源注册表、项目/IndexedDB、HTTP 与两个求解实现、测试入口、构建及静态检查配置。对组件和工程文件采用重点阅读与全目录检索；不是对每个 CSS 声明逐行验收。

以下保留 45 条原始观察的代码证据。每项标题已添加阶段分类；后续计划没有当前缺陷优先级，结构建议的 P2/P3 仅表示建议排序，不代表已承诺功能失败。实测证明某行为存在，并不自动证明它违反本阶段契约。

- **实测**：运行了最小复现，观察到问题。
- **代码确认**：控制流或配置直接证明缺口；未宣称已经做浏览器交互复现。
- **结构债**：现状已经增加维护/扩展成本，不等同于用户可见故障。
- **P1**：应优先处理的错误结果、数据一致性或数据损失风险。
- **P2**：应计划整改的可靠性、维护性和扩展性问题。
- **P3**：低风险工程改进。

### 实际验证结果

| 检查 | 结果 |
|---|---|
| 现有前端测试 | 11 个文件，147 项通过 |
| 现有后端测试 | 156 项通过，4 项跳过 |
| 生产构建 | 通过；单个 JS 包 630.43 kB，gzip 187.02 kB，仍有大包警告 |
| ESLint | 通过，但越界依赖探针也通过，不能据此证明架构边界合规 |
| 临时开启 TypeScript `--strict` | 通过；当前配置没有启用，可低成本纳入常规门禁 |
| 前端问题特征探针 | 9 项通过：断言的是“当前确实存在该错误行为”，不是修复验收通过 |
| 后端正确性探针 | 6 项预期行为断言全部失败，见下文；故障已复现 |
| 浏览器端到端、可访问性、并发压力、大图性能 | 未执行，不把静态判断当成实测性能或交互结果 |
| 依赖漏洞/许可证联网审计 | 未执行，本文不作“无漏洞”结论 |

Python 在沙箱中无法启动，经工具批准在沙箱外执行本地测试成功；这不是后端测试失败。临时测试和越界探针已在首轮审查结束前移除；本轮追加阶段复核，并更新总体设计状态与历史评估入口说明。

### 最小复现记录

1. 调用 [test_v2_acceptance.py](<D:/Github Projects/OmniFlow/backend/tests/test_v2_acceptance.py>) 中四个被跳过测试的原始测试函数，以新测试包装运行：边界汇总找不到 `Net_ore`；Void 缺供仍返回 `success`；无排放口的废料仍返回 `success`；慢配方最大化预期 `0.00005/s`，实际 `0`。
2. 从现有 `production_graph` 删除 Source、清空 edges，保留普通 `Net_ore` 消耗：仍返回 `success`。问题不限于 Void。
3. 将同一 fixture 的 Recipe `recipe_id` 改为 `target`：机器结果随后被 Target 结果覆盖，返回字典只剩 source/target 的 `actual_amounts`，没有机器数。
4. `readCalculationResponse` 接收 HTTP 200、`{status:'success',system_inputs:{ore:'bad'}}`：返回成功，错误类型未被拒绝。
5. `computeCapexList` 对同种不可消耗资源的 1 L 与 1000 mL，各安装一台：输出 1001；预期应在明确单位下输出 2 L 或 2000 mL。
6. 设置 `systemInputs={ore:42}` 后新增节点：旧汇总仍在，`isDirty` 仍为 false。`loadFromDB` 加载空画布后也保留旧汇总。`resetCanvas` 不清空 recipe store。
7. 未知 archetype `missing-plugin` 不被拒绝，进入 generic 范式回退；空 Recipe 资源 ID 能通过 payload 编译；time multiplier 的字符串 `not-a-number` 被当作默认 1，编译仍 eligible。
8. GT 配方 4 秒，32 EU/t，MV 1 A（128 EU/t）能源仓。等价的 2560 EU/cycle 输入与 32 EU/t 输入均超频到 2 秒，但前者得到 5120 EU/s，后者为正确的 2560 EU/s。按周期表示的输入算成了 256 EU/t，超过能源仓容量。
9. 在 `features/settings` 下临时导入 `features/canvas/canvas.store`：`@/features/...` 与 `../canvas/...` 两种写法运行 ESLint 都返回 0。规则明文禁止该依赖。

## A. 计算正确性与结果解释

### TD-01 · 后续计划 PR-06/07 · 消耗-only 与 Void 网络遗漏守恒【实测；既有迁移债】

阶段判定：归属 PR-06/07，此处保留现状证据与未来验收，不判为 PR-01–05 交付失败，也不要求提前修补旧路径。

证据：[backend/main.py:404](<D:/Github Projects/OmniFlow/backend/main.py:404>)、`:471`；[src/features/calculation/topology.ts:60](<D:/Github Projects/OmniFlow/src/features/calculation/topology.ts:60>) 附近将未连接端口命名为 Void。后端只给具有正系数的非 Void 行建立等式。没有任何供应的输入因此可以被免费消耗。

整改：严格编译每个网络的守恒行，未连接输入必须采用明确的外供/禁用策略；不能通过字符串前缀跳过负系数行。验收：普通 Net 缺供、Global 缺供、Void 缺供均不能成功生产。与计划 PR-06/07 合并处理。

### TD-02 · 后续计划 PR-06/07 · 所有有产出的网络自动获准排废【实测；既有迁移债】

阶段判定：归属 PR-06/07，此处保留现状证据与未来验收，不判为 PR-01–05 交付失败，也不要求提前修补旧路径。

证据：[backend/main.py:404](<D:/Github Projects/OmniFlow/backend/main.py:404>)、`:420`。spill 变量不受用户排放许可控制；大罚项仍允许为满足需求丢弃副产物。

整改：编译显式排放边界；默认禁止无出口废料，仅对允许排放的边界创建变量。验收：同一强制副产物模型在添加/移除排放口时正确切换可行性。

### TD-03 · 后续计划 PR-06/07 · 固定权重没有实现目标优先级【实测；既有迁移债】

阶段判定：归属 PR-06/07，此处保留现状证据与未来验收，不判为 PR-01–05 交付失败，也不要求提前修补旧路径。

证据：[backend/main.py:448](<D:/Github Projects/OmniFlow/backend/main.py:448>)、`:456`。机器成本 1、产出奖励 10000、spill 罚 1000000 混在同一目标；低速配方被机器成本压制而停产。

整改：接入已有 [backend/solver/service.py](<D:/Github Projects/OmniFlow/backend/solver/service.py>) 的分层目标，不再调大常数。验收：慢配方、单位等价变化、多目标顺序与 spill 政策分别独立验证。

### TD-04 · 后续计划 PR-07 · 系统进出量实际上是守恒残差【实测；既有迁移债】

阶段判定：归属 PR-07，此处保留现状证据与未来验收，不判为 PR-01–05 交付失败，也不要求提前修补旧路径。

证据：[backend/main.py:546](<D:/Github Projects/OmniFlow/backend/main.py:546>)。`full_matrix` 同时含 Source、Sink 和 spill，平衡后相乘自然趋近零；10/s 的真实外供与交付没有正确汇总。

整改：从显式外部边界变量生成 gross input/output；残差另列为校验证据。验收：10/s fixture 清晰返回 10/s 外供、10/s 交付及接近零的残差。

### TD-05 · 后续计划 PR-07 · HUD 再次净额化，且把“未出现在汇总”误当作中间品【代码确认】

阶段判定：归属 PR-07，此处保留现状证据与未来验收，不判为 PR-01–05 交付失败，也不要求提前修补旧路径。

证据：[SystemHUD.tsx:95](<D:/Github Projects/OmniFlow/src/features/canvas/components/SystemHUD.tsx:95>) 将输入与输出按资源相减；[IntermediateProductsPanel.tsx:75](<D:/Github Projects/OmniFlow/src/features/canvas/components/IntermediateProductsPanel.tsx:75>) 从所有基础资源中减去汇总键，剩余全部显示 0。同种资源同时流入流出时被抵消；未计算/闲置节点也可能显示为中间品；动态最终端口未进入该分类。

整改：显示层消费明确的边界与内部流量结果，分别保留 gross 和 net，不用“键缺失”推断物理含义。验收：同物料两侧边界、闲置节点、未求解、动态端口。

### TD-06 · 实现问题 P1 · Recipe ID 与图节点 ID 共用结果字典命名空间【实测】

证据：[backend/main.py:521](<D:/Github Projects/OmniFlow/backend/main.py:521>) 优先使用 `recipe_id`；之后 Source/Target 直接按 node ID 写入。前端 [canvas.store.ts:266](<D:/Github Projects/OmniFlow/src/features/canvas/canvas.store.ts:266>) 附近及 [capEx.ts:25](<D:/Github Projects/OmniFlow/src/features/calculation/capEx.ts:25>) 又双重回退查找。

整改：旧入口先统一按 node ID 返回，配方模板 ID 仅作元数据；新 LP 入口通过明确变量映射还原。验收：重复 recipe_id、recipe_id 等于其他 node ID、两个实例引用同一配方。

### TD-07 · 后续计划 PR-07/08 · 数值阈值改变结果，而非仅影响显示【代码确认】

阶段判定：归属 PR-07/08，此处保留现状证据与未来验收，不判为 PR-01–05 交付失败，也不要求提前修补旧路径。

证据：[backend/main.py:518](<D:/Github Projects/OmniFlow/backend/main.py:518>) 使用 `ceil(exact-1e-8)`，`:533`、`:540` 把绝对值不大于 1e-6 的流量设零。小的有效运行量可能得到零安装数；节点流量与原解不再一致。旧入口也只验证解向量长度/有限性，未回代所有约束和上下界。

整改：复用新求解器的残差证据，保留原始解；安装取整使用显式且经过边界验证的策略，显示清零只在格式化层做。验收：微量流、整数附近机器数、不同尺度和异常成功解。

### TD-08 · 实现问题 P2 · BOM 对不同单位直接相加【实测】

证据：[src/features/calculation/capEx.ts:43](<D:/Github Projects/OmniFlow/src/features/calculation/capEx.ts:43>) 对 `r.amount * machines` 直接累加，没有单位归一化，也不携带输出单位。

整改：占用数量转成统一的量单位后聚合，保留单位身份；不要用流量换算替代库存数量换算。验收：L/mL、kg/g、自定义不可换算单位、混合显示前缀。

### TD-09 · 后续计划 PR-08 · BOM 没有使用最终占用语义【代码确认】

阶段判定：归属 PR-08，此处保留现状证据与未来验收，不判为 PR-01–05 交付失败，也不要求提前修补旧路径。

证据：[capEx.ts:33](<D:/Github Projects/OmniFlow/src/features/calculation/capEx.ts:33>) 使用基础输入/输出四组资源；[modifier.pipeline.ts](<D:/Github Projects/OmniFlow/src/features/modifier/modifier.pipeline.ts>) 已生成 `bom_occupancy`，却没有被该函数消费。并行槽位、修饰器动态占用、运行/安装基数会丢失；概率为 0 的输出也会被当作基建资源。

整改：BOM 消费最终占用与安装/运行数量，明确哪些是投入占用、哪些是产物。验收：4 槽位催化剂、per_installed_machine、动态占用、零概率产品。与 PR-08 合并。

### TD-10 · 实现问题 P1 · GT 超频对按周期能量重复缩放【实测】

证据：[gtOverclocker.ts:276](<D:/Github Projects/OmniFlow/src/features/modifier/modifiers/gregtech/gtOverclocker.ts:276>) 缩短周期，同时 `:279` 将原始 amount 乘 4^oc。对每周期能量，缩短周期又增加一次功率；对每刻输入则不会。

整改：以目标物理功率表达 effect，再按最终周期和原输入时间基准还原数量，或在统一规范化的功率层操作。不要只为 per_cycle 添补丁。验收：EU/t、EU/s、EU/cycle、带前缀的等价输入在普通/完美超频下物理结果一致，最终功率不超过设备容量。

### TD-11 · 改进建议 P2 · 概率修饰器仍按资源名定位，不能独立操作同资源端口【代码确认；扩展债】

证据：[modifiers/chanceOutput.ts:38](<D:/Github Projects/OmniFlow/src/features/modifier/modifiers/chanceOutput.ts:38>) 仅比较 `r.id`；[gregtech/gtProbabilityOutput.ts:55](<D:/Github Projects/OmniFlow/src/features/modifier/modifiers/gregtech/gtProbabilityOutput.ts:55>) 使用 category:id；[modifier.state.ts:37](<D:/Github Projects/OmniFlow/src/features/modifier/modifier.state.ts:37>) 还硬编码 chance_output 的 UI 特例。

契约判断：PR-03 要求连线按 portId 定位，并未要求所有修饰器的目标选择都按端口。若该插件语义是“影响某资源的所有输出”，按资源定位可以成立；但 chance_output 只用裸 id，跨类别语义仍须明确。若产品需要逐端口设置，再将配置迁移为 portId，资源名只作标签，并在修饰器自己的配置生成逻辑中提供候选项。验收：同名跨类别、同资源双输出、重排/复制/删除端口，旧配置需明确迁移歧义。

### TD-12 · 实现问题 P2 · 资源身份验证在 Recipe 与 Endpoint 间不一致【实测】

证据：`ResourceSchema` 允许空 category/id；[payloadBuilder.ts:68](<D:/Github Projects/OmniFlow/src/features/calculation/payloadBuilder.ts:68>) 只对 Endpoint 检查空 ID；管线校验数值与 portId，却不拒绝空 Recipe 资源身份。空 ID 可编译成 `item:`。

整改：草稿允许未完成状态，但“可运行模型”统一检查非空资源身份、类别与编码规则。验收：两个节点族相同的空白/非法身份输入得到同样的可定位诊断。

## B. 文档状态、操作与持久化

### TD-13 · 后续计划 PR-07 · 异步计算无请求与文档版本保护【代码确认】

阶段判定：归属 PR-07，此处保留现状证据与未来验收，不判为 PR-01–05 交付失败，也不要求提前修补旧路径。

证据：[useCalculation.ts:44](<D:/Github Projects/OmniFlow/src/features/calculation/hooks/useCalculation.ts:44>) 捕获输入，`:81` 在 await 后直接写入当前 store。没有 revision、请求 ID 校验、取消、超时或 in-flight 状态。

影响：慢请求覆盖快请求；编辑/加载文档后旧响应写入新图；晚到的失败清掉较新的成功结果。整改：文档 revision + 请求身份 + 当前运行状态统一控制提交，取消过期请求。验收：乱序完成、编辑中返回、切换文档后返回、卸载/断网。

### TD-14 · 后续计划 PR-07 · 编辑与环境变化不使已发布结果失效【实测及代码确认】

阶段判定：归属 PR-07，此处保留现状证据与未来验收，不判为 PR-01–05 交付失败，也不要求提前修补旧路径。

证据：[canvas.store.ts:141](<D:/Github Projects/OmniFlow/src/features/canvas/canvas.store.ts:141>)、`:172`、`:218` 的图修改不失效结果；[recipe.store.ts:177](<D:/Github Projects/OmniFlow/src/features/recipe/recipe.store.ts:177>) 修改环境仅重算预览。旧机器数、利用率、汇总/BOM 仍可与新端口速率一起显示；Undo/Redo 也没有统一结果失效步骤。

整改：语义编辑统一递增文档 revision，结果携带来源 revision；可保留历史结果但必须标注过期。移动/选中等纯 UI 变化不应触发重新求解。

### TD-15 · 实现问题 P1 · 导入可撤销，但撤销不恢复环境和注册表【代码确认】

证据：[useFileIO.ts:77](<D:/Github Projects/OmniFlow/src/features/file-io/hooks/useFileIO.ts:77>) 先拍历史，再替换环境/registry；[useUndoRedo.ts:9](<D:/Github Projects/OmniFlow/src/features/canvas/hooks/useUndoRedo.ts:9>) 只存 nodes/edges，恢复配方时使用当前环境。

影响：撤销导入后旧图处于新 TPS/单位环境；旧自定义单位可能已经消失。整改：历史事务采用完整可编辑文档快照或等价操作日志。验收：不同 TPS、同 ID 不同单位定义、不同自定义资源的文档导入—撤销—重做往返。

### TD-16 · 实现问题 P2 · 加载/重置的跨 store 生命周期不完整【实测；部分属尚未接入路径】

证据：[canvas.store.ts:152](<D:/Github Projects/OmniFlow/src/features/canvas/canvas.store.ts:152>) 的 loadFromDB 保留旧汇总/错误；`:158` resetCanvas 不清 recipe store，且未重置 viewport。

整改：统一加载/关闭文档的事务入口，清理配方、结果、历史、视口和文档身份。当前 App 尚未接入项目切换，不能把这项描述为已在用户项目切换中复现的数据串线。

### TD-17 · 实现问题 P2 · isDirty 没有实际维护路径【实测及检索确认】

证据：[canvas.store.ts:151](<D:/Github Projects/OmniFlow/src/features/canvas/canvas.store.ts:151>) 有 markDirty，但业务代码未调用；新增/编辑/连线也不设置 dirty，保存入口没有与其形成闭环。

整改：以可编辑文档 revision 与已保存 revision 派生 dirty；不要在各按钮散落 markDirty。验收：语义修改变脏、保存变净、纯选择不变脏、保存失败仍为脏。

### TD-18 · 实现问题 P1 · 资源注册表“应用”后重置到旧草稿【代码确认】

证据：[ResourceRegistryPanel.tsx:199](<D:/Github Projects/OmniFlow/src/features/resource-registry/components/ResourceRegistryPanel.tsx:199>) 更新 store 后，`:224` 用当前闭包里的旧 categories/overrides/entries 重置 draft。

影响：首次“应用”已保存新值，但界面草稿回旧值；再按“确定/应用”可能把刚保存的修改覆盖掉。整改：校验完整草稿后一次提交，并用提交后的同一快照更新草稿。验收：“修改→应用→确定”及连续应用不回滚。

### TD-19 · 实现问题 P2 · 注册表身份冲突和批量提交缺少保护【代码确认】

证据：[ResourceRegistryPanel.tsx:127](<D:/Github Projects/OmniFlow/src/features/resource-registry/components/ResourceRegistryPanel.tsx:127>)、`:165` 附近，新分类 ID/override key 可覆盖已有项；handleApply 先逐项删除再逐项添加，各动作又可能修改环境、触发全量配方重算。

整改：在 store 边界校验身份冲突与引用关系，准备完整下一状态后原子提交。分类删除不能默默留下引用而没有诊断。验收：重复 ID、重复 override、应用中校验失败不产生半提交状态。

### TD-20 · 实现问题 P2 · 剪贴板绕过文档校验且不携带单位环境【代码确认】

证据：[useClipboard.ts:117](<D:/Github Projects/OmniFlow/src/features/canvas/hooks/useClipboard.ts:117>) 只验证 nodes/edges 是数组；payload 仅这两项，没有版本、单位定义、资源表。后续直接 normalize/注册配方。

影响：跨窗口复制自定义单位会变成未知单位；结构不合法的数据会在操作中途抛错。整改：建立有版本的子图 DTO，复用文档的验证/迁移与依赖收集，先全部准备成功再提交。验收：坏 position/data、未知插件、跨环境单位冲突、部分失败无残留。

### TD-21 · 实现问题 P2 · 剪切异步等待后删除当前选择【代码确认】

证据：[useClipboard.ts:133](<D:/Github Projects/OmniFlow/src/features/canvas/hooks/useClipboard.ts:133>) await handleCopy 后调用 onDeleteSelected，没有固定复制时的节点身份。

影响：剪贴板权限等待期间更改选择，复制的是 A、删除的可能是 B。整改：剪切事务捕获 node IDs 与 revision，删除该集合；在文档已切换时中止。验收：模拟延迟 clipboard.writeText 并变更选择。

### TD-22 · 改进建议 P2 · 项目数据库与实际保存路径并存但未接通【结构债】

证据：[App.tsx](<D:/Github Projects/OmniFlow/src/App.tsx>) 未挂载 ProjectList/useProjects；实际 [useFileIO.ts:95](<D:/Github Projects/OmniFlow/src/features/file-io/hooks/useFileIO.ts:95>) 保存固定 localStorage key。项目 service 创建空 canvas，但代码检索未发现 App 将编辑后图保存至 db.canvases 的调用。resourceRegistry 字段也未随 switchProject 读写。

整改：明确项目功能当前为未接入骨架，不把它当作完成的隔离/保存方案。接入时由文档服务统一读写完整快照；或在未实现阶段隔离该骨架，避免两套“保存成功”语义。

### TD-23 · 实现问题 P2 · 项目异步动作缺少错误收尾与竞态控制【代码确认；尚未接入主界面】

证据：[project.store.ts:36](<D:/Github Projects/OmniFlow/src/features/project/project.store.ts:36>) loadProjectList 无 finally，失败会卡住 loading；`:56` switchProject 可并发、按完成顺序提交，且仅切环境；保存环境只在切离项目时发生。[project.service.ts:50](<D:/Github Projects/OmniFlow/src/features/project/project.service.ts:50>) 读后写 settings 没有事务保护。

整改：统一异步状态、错误返回、切换令牌、保存时机与事务；当前模块被启用前补齐。验收：数据库拒绝、连续 A→B→C、切换失败、关闭页面前最后一轮环境修改。

## C. 可维护性与可扩展性

### TD-24 · 实现问题 P2 · 架构边界检查没有实际拦截依赖【实测】

证据：[eslint.config.js:42](<D:/Github Projects/OmniFlow/eslint.config.js:42>)、`:73` 配置了层次，但上述禁止依赖探针两种路径均通过。当前配置没有把“无法识别/解析的内部依赖”当成失败。

整改：修复 TypeScript/别名解析与元素识别，配置未知内部依赖检查，并永久保留一个“允许/禁止各一例”的配置回归测试。不能只增补 allow 列表让扫描通过。具体解析失效位置仍需在整改时进一步定位。

### TD-25 · 改进建议 P2 · 领域层反向依赖 UI/编排层【代码确认；结构债】

证据：[calculation/capEx.ts:4](<D:/Github Projects/OmniFlow/src/features/calculation/capEx.ts:4>) 依赖 canvas.utils；[recipe/recipe.store.ts](<D:/Github Projects/OmniFlow/src/features/recipe/recipe.store.ts>) 同时依赖 canvas.utils、resource-registry、data；[calculation/hooks/useCalculation.ts](<D:/Github Projects/OmniFlow/src/features/calculation/hooks/useCalculation.ts>) 反向依赖 canvas/recipe；[recipe/components/RecipeEditorModal.tsx](<D:/Github Projects/OmniFlow/src/features/recipe/components/RecipeEditorModal.tsx>) 依赖 canvas 的 SettingsUI，后者又使用 recipe 的表单类型。

整改：把资源遍历等纯领域操作放到自然所属的通用/配方领域模块；跨 store 编排移到应用协调层；配方专属 SettingsUI 归 recipe。新增计算入口无需拖入画布 UI。不要为解决这些具体依赖另建万能 services 层。

### TD-26 · 改进建议 P2 · 配方存在权威 store 与 node.data 两套可编辑副本【代码确认；结构债】

证据：[canvas.store.ts](<D:/Github Projects/OmniFlow/src/features/canvas/canvas.store.ts>) addRecipeNode 放完整配方进 node.data；[useNodeEditor.ts:59](<D:/Github Projects/OmniFlow/src/features/recipe/hooks/useNodeEditor.ts:59>) 保存编辑器时只更新 node label，完整内容在 recipe store；[RecipeNode.tsx:56](<D:/Github Projects/OmniFlow/src/features/canvas/components/RecipeNode.tsx:56>) mode/manual_machines 又从 node.data 读；历史和导出分别手动回填权威数据。

整改：图节点只保存视图/配方引用，配方所有可编辑字段统一从权威 store 取，求解结果独立存放；文档事务负责两者映射。验收：所有编辑入口、导入、复制、撤销后视图/保存/求解一致。

### TD-27 · 改进建议 P2 · 数据实体和验证模型重复，已出现字段命名漂移【代码确认】

证据：[common/db/omniflowDb.ts:10](<D:/Github Projects/OmniFlow/src/common/db/omniflowDb.ts:10>)、[features/project/project.types.ts:16](<D:/Github Projects/OmniFlow/src/features/project/project.types.ts:16>)、[common/schemas/project.schema.ts:13](<D:/Github Projects/OmniFlow/src/common/schemas/project.schema.ts:13>) 都定义 Project；DB/schema 用 default_system/default_archetype，feature 类型用 defaultSystem/defaultArchetype。项目读取未调用对应 schema。

整改：持久化 DTO 由同一 schema 推导，领域模型如需不同命名应有显式 mapper；在 DB 读取/迁移边界验证。对前后端 LP 契约保留现有共享 fixture，避免手写规则长期漂移。

### TD-28 · 改进建议 P2 · 修饰器计算注册表直接携带 React UI【代码确认；扩展债】

证据：[modifier.types.ts:114](<D:/Github Projects/OmniFlow/src/features/modifier/modifier.types.ts:114>) 的 renderBody 与 evaluate 同接口；GT 求解模块直接导入 CardBody。计算管线导入 registry 因而连入 UI 依赖。

影响：移到 Worker、独立编译包或非 React 环境需要先解耦；规则测试和打包也携带界面代码。整改：保留 modifier ID，将核心规则与 UI 扩展注册分开；版本/依赖检查仍归管线，不复制两套算法。

### TD-29 · 改进建议 P2 · 存档只记录插件 API 版本，未记录规则实现版本【代码确认；扩展债】

证据：CanvasDocument 有 pluginApiVersion:2；active_modifiers 存 definition_id/uiState，没有 definition version。computationKey 包含当前注册表版本，只能防止缓存过期，不能证明旧存档按原规则复现。

契约判断：PR-04 已要求且已实现缓存包含插件版本，并未明确承诺文件锁定历史实现。若存档承诺跨插件升级复现，应再记录实际使用的规则版本/指纹并定义迁移；若默认使用最新规则，则应明确告知。无需把整个运行时代码塞入文件。验收：保持 API v2 但修改某个 modifier.version 的加载路径。

### TD-30 · 改进建议 P2 · 插件参数没有独立运行时 schema【实测及代码确认】

证据：Recipe schema 的 uiState/hardware_specs 是 unknown record；[timeMultiplier.ts:26](<D:/Github Projects/OmniFlow/src/features/modifier/modifiers/timeMultiplier.ts:26>) 等 `Number(value)||1` 将 NaN/0 静默回退；部分概率参数 clamp，其他插件采用不同策略。UI min/max 并不是导入时的验证。

契约判断：需要先区分合法缺省与显式非法输入；默认值与钳制不天然是 bug。建议每个插件拥有参数 schema/default/migration，再按明确契约解析后 evaluate，草稿错误通过结构化诊断返回。验收：空值、NaN 字符串、越界、旧字段、未知字段和合法 0 的一致语义。

### TD-31 · 改进建议 P2 · 未知范式静默变为 generic【实测】

证据：[data/archetypes/index.ts:26](<D:/Github Projects/OmniFlow/src/data/archetypes/index.ts:26>) 对显式未知 ID 与未提供 ID 都回退 custom_generic，而返回的 recipe 仍可能保留原未知 archetype_id。

契约判断：getMachineArchetype 的现有注释明确允许未知 ID 回退，PR-04 明确禁止的是未知修饰器静默过滤，不能直接等同。建议决定旧文件兼容是否允许此回退；若要求可复现，则把未知已声明范式保留为不可运行草稿并提示缺规则，同时更新契约和迁移。验收：拼错 ID、缺插件、真正未指定范式三种情况区分。

### TD-32 · 实现问题 P2 · 错误隔离不完整，草稿预览仍有未保护的计算路径【代码确认】

证据：[RecipeEditorModal.tsx](<D:/Github Projects/OmniFlow/src/features/recipe/components/RecipeEditorModal.tsx>) livePayload 调用安全 preview，但 livePowerPreview 直接调用 resolveRecipePowerProfile；该函数经 gtEuPerTick 调用 positive(duration)。GT 草稿周期为 0 等情况会从渲染计算抛出。onSubmit 在安全 preview 之前直接 ensureRecipeDataShape，范式切换留下不兼容 modifier 时也会先抛错。[main.tsx](<D:/Github Projects/OmniFlow/src/main.tsx>) 没有 ErrorBoundary。

整改：同一草稿编译结果提供全部预览，避免第二条未经保护的功率计算；保存前返回定位错误；在编辑器/应用层提供恢复边界。验收：清空周期、切换范式、未知单位时界面可继续修复，不导致整页失效。

## D. 性能与运行可靠性

### TD-33 · 后续计划 PR-07 · 正式入口仍使用稠密矩阵，并维护两套构造代码【代码确认】

阶段判定：归属 PR-07，此处保留现状证据与未来验收，不判为 PR-01–05 交付失败，也不要求提前修补旧路径。

证据：[backend/main.py:361](<D:/Github Projects/OmniFlow/backend/main.py:361>)、`:419`、`:546` 多次构建/扩展稠密矩阵；`:567` 的 debug 再写一遍变量、spill、目标和约束规则。新 sparse solver 已有实现与测试，但正式路由没有调用它。

整改：由一个编译结果提供求解和诊断，共用稀疏求解核心；切换前保留旧协议的明确适配边界。验收：正式/诊断系数逐项一致及大稀疏模型内存实测。不要继续分别修两份旧构造算法。

### TD-34 · 后续计划 PR-11 · async 路由执行同步求解，正式 API 没有资源预算【代码确认】

阶段判定：归属 PR-11，此处保留现状证据与未来验收，不判为 PR-01–05 交付失败，也不要求提前修补旧路径。

证据：[backend/main.py:303](<D:/Github Projects/OmniFlow/backend/main.py:303>)、`:492` 直接 linprog，无 time_limit；旧 CalculateRequest 的 nodes/edges/资源字典无规模上限。新 SolverLimits 未保护此入口。

整改：有界执行池/排队、服务端规模与时限、取消/断连语义、过载响应；限制需覆盖解析/编译阶段。验收：一个慢请求期间另一轻请求、队列饱和、超时、超大模型。本文未做压力实测，不给出吞吐数字。

### TD-35 · 改进建议 P2 · 同一图在多处重复编译，热点未按语义缓存【代码确认】

证据：[GraphIssuesPanel.tsx:17](<D:/Github Projects/OmniFlow/src/features/canvas/components/GraphIssuesPanel.tsx:17>) 每条边重新 graphPorts；graphPorts 每次重跑涉及节点的完整 modifier pipeline；payloadBuilder 又先拓扑再逐配方重跑；connectionIssue 对 ports 两次线性 find；拓扑 find 没有路径压缩。拖动更新 nodes 也会触发问题面板重算。

整改：按配方/环境语义 revision 编译一次最终端口，建立 nodeId+portId 索引，让校验/拓扑/payload 共用；先测大图再考虑 Worker。验收：节点移动不重跑物理编译，修改一条配方只失效依赖部分。

### TD-36 · 改进建议 P2 · 单位环境反复构造和递归展开【代码确认；性能债】

证据：`UnitSystem` 构造中两次 new UnitRegistry，注册表深拷贝并逐定义验证；SourceNode/TargetNode/RecipeNode 每次 render 新建系统；管线也逐配方新建；normalize 对每个因子查数组和递归展开。

整改：按不可变 environment 快照复用实例，注册表按 ID 索引并缓存已验证展开；不要把 class 实例写入持久化 store。验收：环境修改失效、普通节点拖动复用，测长派生单位链和大注册表。

### TD-37 · 改进建议 P2 · 历史/复制使用全图 JSON 克隆和比较【代码确认；性能债】

证据：[useUndoRedo.ts:44](<D:/Github Projects/OmniFlow/src/features/canvas/hooks/useUndoRedo.ts:44>) 每次快照 deepClone + JSON.stringify；[canvas.utils.ts:22](<D:/Github Projects/OmniFlow/src/features/canvas/canvas.utils.ts:22>) 泛型 clone 实际依赖 JSON，非有限数/非 JSON 值会改变。多节点 autofill 每个节点单独拍快照；toggle implemented 直接更新 recipe store 又绕开历史。

整改：先统一操作事务与可序列化文档 DTO、明确“一次用户操作一次历史”，再按实测决定结构共享或命令日志；不必立即引入复杂事件溯源。验收：批量 autofill 一次撤销、implemented 切换、非法草稿往返和大图交互延迟。

## E. 工程防线、交付与交互

### TD-38 · 改进建议 P2 · 没有仓库内自动 CI 门禁【代码确认】

证据：`.github` 仅 issue templates；package.json 有检查脚本，但没有工作流自动跑前后端测试、构建、lint 和契约 fixtures。

整改：增加与本地一致的 CI，并固定运行时版本；若外部系统已有 CI，应把入口/证据记录进仓库再调整此结论。验收：故意破坏前端、后端、边界规则时 PR 检查失败。

### TD-39 · 改进建议 P2 · 测试大量覆盖纯函数，缺少用户操作与生命周期回归【代码确认】

证据：[vitest.config.ts](<D:/Github Projects/OmniFlow/vitest.config.ts>) 使用 node 环境、仅 `src/**/*.test.ts`；没有浏览器测试配置。现有 UI 证据主要是历史截图。四个正确性验收按计划 skip，正常绿灯仅代表当前阶段已执行的范围，不能代表完整 v2 已通过；这是测试说明已披露的边界，不是隐瞒失败。

整改：优先补异步乱序、注册表应用、导入撤销、GT 单位等价、BOM、剪贴板、数据库切换的少量高价值集成/浏览器案例；跳过项明确关联待完成工作。无覆盖率阈值本身不列为缺陷。

### TD-40 · 改进建议 P3 · TypeScript strict 未加入日常构建【实测及配置确认】

证据：[tsconfig.app.json](<D:/Github Projects/OmniFlow/tsconfig.app.json>)、[tsconfig.node.json](<D:/Github Projects/OmniFlow/tsconfig.node.json>) 没有 strict；本次 app 配置临时 `--strict --noEmit` 已通过。

整改：启用 strict 并在 CI 保持，另外将关键 `Node[]` 收窄为领域判别联合，避免 ReactFlow 默认宽泛 data 绕过检查。strict 通过不等于外部 JSON 已验证，TD-12/20/30 仍需各自处理。

### TD-41 · 改进建议 P2 · 开发网络配置被硬编码进默认运行路径【代码确认；部署债】

证据：[backend/main.py:73](<D:/Github Projects/OmniFlow/backend/main.py:73>) 允许所有 origin 且 allow_credentials=true；[vite.config.ts](<D:/Github Projects/OmniFlow/vite.config.ts>) 开放 0.0.0.0/cors；[useCalculation.ts:66](<D:/Github Projects/OmniFlow/src/features/calculation/hooks/useCalculation.ts:66>) 默认拼 `http://<hostname>:7998`，HTTPS 页面未配置后端时会遇到 mixed content。

整改：明确开发/部署配置，按环境指定 origin 与 backend URL（或同源代理），启动时校验配置。用户本机开发场景不因此被宣称已发生安全事件；公开部署前必须处理预算和暴露面。

### TD-42 · 改进建议 P3 · 文件保存没有视口，单槽本地保存缺少恢复机制【代码确认】

证据：CanvasDocument.ui 仅 nodes/edges；[useFileIO.ts](<D:/Github Projects/OmniFlow/src/features/file-io/hooks/useFileIO.ts>) 固定 key 覆盖写入；App 的 ReactFlow 实例 viewport 没有同步回保存路径。图位置能保存，但缩放/平移不往返。无自动恢复/备份记录。

整改：文档视图状态加入可选 viewport 并迁移默认值；按产品需求提供最近恢复快照/写入失败反馈，不把未实现的“自动保存”描述成现有功能。验收：保存加载视口、存储配额失败、旧格式加载。

### TD-43 · 实现问题 P2 · 模态交互与全局快捷键隔离不完整【代码确认；待浏览器验收】

证据：[App.tsx:230](<D:/Github Projects/OmniFlow/src/App.tsx:230>) isEditing 只包括两个节点编辑器，不包括资源注册表/TPS 面板；快捷键只忽略 input/textarea/select，焦点在注册表按钮时 Delete/Undo 仍可作用于背景画布。EndpointEditorModal 缺 dialog 语义；其他弹窗虽有 aria-modal，但无统一焦点约束/返回与 Escape 策略。

整改：共用模态生命周期和快捷键 scope，补可访问名称、焦点管理与关闭行为。验收：键盘打开/Tab/关闭恢复焦点，任何设置面板打开时不会误删背景图。

### TD-44 · 文档维护 P3 · 注释、示例和兼容层状态继续漂移【代码确认；维护债】

证据：[project.store.ts:22](<D:/Github Projects/OmniFlow/src/features/project/project.store.ts:22>) switchProject 仍声称无 DB round-trip；SettingsUI 的 buildRateMap 注释声称 category:id，实际按 portId；rateFormat 的示例未带必需 units 参数；resource registry 的 resolve 注释称 LRU-like，实际是无上限 Map；两处 makeId 另写 Date.now/Math.random 而非复用 generateId。新旧 types/schema、默认 TPS、旧协议辅助字段仍需明确退役边界。

整改：随所属模块修复同步更新注释/示例，合并 ID 工具，列出旧适配器退役条件；避免一次性只修文案掩盖行为缺陷。原有未提交文档修改不在本次直接改写。

### TD-45 · 后续计划 PR-07 · 成功响应缺少运行时验证【实测】

阶段判定：归属 PR-07，此处保留现状证据与未来验收，不判为 PR-01–05 交付失败，也不要求提前修补旧路径。

证据：[src/features/calculation/calculationClient.ts:35](<D:/Github Projects/OmniFlow/src/features/calculation/calculationClient.ts:35>) 仅检查 status 后强制断言 CalculateResponse；新 LPResponseSchema 没有用于此旧 HTTP 入口。字符串流量、缺失端点结果等可能被当作成功；canvas.store 对缺失字段还有空对象和零流量回退。

整改：为实际 HTTP 契约验证成功结果的完整字段、有限数值、节点覆盖与身份一致性；发布结果前校验，失败保留结构化协议错误。新协议切换后复用已有 LPResponseSchema 并验证请求身份。验收：HTTP 200 但错字段类型、缺结果、负/非有限数、未知节点及旧请求响应。

## 整改顺序与合并方式

1. **先修正文档口径**：保留 PR-01–05 完成状态，把总体目标、阶段交付、当前限制分开；撤回“13 项 P1”的混合汇总。
2. **当前功能补漏**：优先处理 GT 等价能耗、旧结果身份覆盖、注册表应用回滚、导入撤销环境；校验边界规则真实生效。混合单位 BOM 作为已知实现缺口，可与 PR-08 合并，避免重复改造旧 BOM。
3. **继续原定 PR-06 → PR-07**：严格网络编译接独立 LP 核心，再整体切入口；一并完成 schema、revision、过期结果、汇总与删除旧重复代码。不要在旧入口提前搭第二套过渡方案。
4. **按计划完成 PR-08～12**：完整 BOM/安装、诊断、Splitter、执行池、发布验证各归原阶段。四项已标 skip 的测试在对应阶段转绿，不为了当前全绿改掉预期。
5. **结构改进随所属模块收敛**：依赖方向、DTO、单一配方源优先于无证据大重构；纯性能建议先测量。参数默认、概率目标、未知范式和版本锁定先明确契约，再选择实现，而不是一律判 bug。

## 不应误判为缺陷的事项

- 独立 sparse solver 已做稀疏构造、分层目标、服务端限额、残差验证与超时候选校验，并有 89 项专门测试；正式入口尚未使用符合 PR-05 的明确边界，不构成该阶段缺陷。
- 端口身份已从资源身份分离，拓扑名称确定；同资源多端口不能再沿用旧评估中的“全部尚未实现”说法。
- 单位/TPS 已显式传入核心管线，缓存包含环境和规则版本；目前债务主要在重复编译、BOM、规则等价性和最终结果失效闭环。
- 大多 Zustand 订阅已有聚焦 selector；不能笼统称“全 store 订阅导致一切重渲染”。实际热点见 TD-35/36。
- 缺少 Splitter、精细瓶颈/IIS、启动可达性证明等属于尚未交付的规划功能；只有当前行为错误或现有结构增加扩展成本才在本报告列债。不能把未来路线图全算成已发生 bug。
- 本地 backend/logs、__pycache__、dist 是被忽略产物；不把它们在磁盘上存在描述成已提交污染。

## 仍需专项验证的边界

本次没有进行真实浏览器完整回归、大规模模型压测、跨浏览器/移动端兼容性、IndexedDB 升级/损坏恢复演练、依赖供应链或公开服务渗透测试。LP 契约极端尺度、单位派生图复杂度、外部文件体积上限也应在接入正式入口时做预算测试。以上是明确未验证范围，不是“确认存在额外故障”。技术债筛查不能证明绝对没有遗漏；这份清单优先给出可定位、可复现、可验收的整改依据。

## 菜单改造后的增量设计审查（2026-10-23）

以下以当前代码为准，与前文历史阶段状态分开；除删除入口外，本轮仅审查，不混入大范围重构。

| 优先级 | 问题与证据 | 影响及建议 |
|---|---|---|
| 已修复 | ReactFlow 自带删除快捷键与应用删除入口并存 | 关闭库的 deleteKeyCode；统一在弹窗/菜单守卫后的应用入口执行。补上选中连线删除、节点专用删除回归。 |
| P2 | TpsSettingsPanel、ResourceRegistryPanel、RecipeNode 的已建开关没有统一历史事务 | 撤销后再编辑可能未清空 redo，重做可覆盖新修改。统一文档级 commit/undo 事务，不在组件逐个补特殊分支。 |
| P2 | useClipboard.ts 先取 copyBufferRef，仅缓存为空才读系统剪贴板 | 首次本地复制后可能一直粘贴旧内容。明确系统剪贴板优先、读取失败才回退，并覆盖跨窗口复制。 |
| P2 | useNodeOperations.ts 补全端点每次单节点调用 takeSnapshot | 批量补全成为多次撤销。批量入口包住一次事务，底层节点操作只返回变更。 |
| P3 | canvas.store.ts 的 isDirty 没有统一保存基准 | 网络配置设脏，其他修改与保存未形成闭环；不能直接用于可靠“未保存”提示。统一图、配方、环境、注册表的文档快照身份与保存基准。 |
| P3 | 诊断翻译兼容层匹配历史原始文本 | 文案改动可能影响匹配。当前有参数与未知消息保真测试，后续改为稳定诊断码+参数；不让 locale 进入求解核心。 |

以上历史、剪贴板与保存问题来自源码路径审查，未在本轮逐一完成浏览器复现；不能当作已修复。构建仍有主包大于 500 kB 的提示，应按编辑器/设置等使用频率评估按需加载，而非为消除提示随意拆包。
