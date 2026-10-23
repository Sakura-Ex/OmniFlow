# 现有代码与 v2 设计差距评估

> **v2 收尾更新（2026-10-23）**：本轮已补保存基准与离开保护、TPS／字典／已建状态历史事务、批量补全一次撤销、系统剪贴板优先级，以及有效的模块边界检查、CI 配置、后端来源／请求体限制和异常日志。最新实测为前端 317、后端 183 项通过；详细覆盖及尚未完成的浏览器验收见[测试记录](testing.md)。下文旧快照中的对应缺口不再代表现状。全图快照性能、恢复机制、完整浏览器自动化等仍未因此解决；三种显示模式留到下一阶段。

评估日期：2026-09-22。依据当前工作区源代码与 technical-design-v2-proposal.md，不以旧设计的声明替代实现证据。本次没有修改业务代码。

> 历史时点说明（2026-10-23）：下文第 1–7 节完整保留 2026-09-22 的评估，源码行号和“当前”等用语均指该历史时点，不能作为现有缺陷清单。此后已实施单位表达式、稳定端口、纯修饰器管线、严格网络编译、版本化 LP HTTP、有界执行、分流器和诊断等改造。当前核验入口是 [T01–T24 证据矩阵](validation/v2-completion/acceptance-matrix.md)、[测试指南](testing.md) 与 [继续实施记录](validation/v2-completion/README.md)；未观察的 UI 和未完成的跨模块验收不在此自动宣称通过。

## 2026-10-23 实现核对：历史问题的当前落点

| 历史问题 | 当前实现及证据 | 仍需区分的验证范围 |
|---|---|---|
| 免费 Void 供给、自动排放、非完整守恒 | networkCompiler 使用最终端口、每 flow Net 等式和显式 Source/Delivery/Spill；HTTP 已移除旧图建模；真实 compiler/diagnostic/HTTP fixtures | 只有明确 fixture 与浏览器观察能证明对应场景；不把编译 schema 通过当端到端通过 |
| 同资源端口混合、Net 不稳定 | 持久 portId、结构化节点端口地址、确定 Net/指纹、复制重映射；ports/history/file tests | 复制、保存、撤销的定量求解与 UI 证据按矩阵独立登记 |
| 单位仅标签、TPS 缓存 | Unit/Quantity/UnitSystem 统一代数及显式环境；单位、环境、文件测试 | 原文第 5 节单 unitId/换算族接口是历史建议；现已采用可乘除整数次幂单位表达式，不应按旧建议补回第二套转换逻辑 |
| 大 M 和稠密业务建模 | 稀疏 COO/CSR、按优先级分层及带尺度容差的目标锁；真实慢配方、无界与残差测试 | 连续 LP 不保证最少整数安装或动态启动可行 |
| API 强制断言、结果错配 | LPRequest/LPResponse 的 Pydantic/Zod、三个请求身份、变量映射、session过期控制；HTTP/client/session tests | 运行中用户编辑的浏览器乱序交互仍以实际观察记录为准 |
| BOM/安装/启动不足 | installation、最终 bom_occupancy、运行与安装投影已进入当前领域模块 | T14/24 有实际 solver 响应投影，T14 浏览器显示 1.2/2/60%/BOM2；T12 是启动待确认检查而非动态证明，T19 自动固定负荷明确拒绝 |
| 同步阻塞、无预算和并发控制 | runtime 有界 worker/queue/native线程、排队预算、排队取消、health响应；7项运行测试 | 不支持强制中止已运行 native；AbortController 不是后端终止机制 |
| Splitter 未注册 | 独立 splitterNode、比例约束/连续变量、退化连接校验、编辑/存档/复制与7组真实求解fixtures | 分配比例不等于有外供或旁路时的消费比例 |
| 无结构化诊断或实测性能 | 有限弹性LP与独立诊断报告、满载余量；真实T03/T04，浏览器确认独立缺口报告；固定硬件数据集性能报告 | 诊断不是唯一原因/最小冲突集/可运行方案；后端性能不等于浏览器编译渲染性能 |

修饰器计算入口现从 modifier.registry / modifier.pipeline 导出纯计算定义；React 卡片在 modifier.ui.registry 独立注册，GT 共用规则在纯规则模块，compiler 每配方只运行一次管线。modifier.isolation.test 以阻止 React/UI 导入的方式验证入口隔离。IMachineModifier 仍保留可序列化 ui_schema 元数据，Context 中仍带 UnitSystem 和四组端口快照，这不等于计算依赖 React。设计草案中“Context→Effect”已落地；旧 Context→Context 和内嵌 renderBody 不能当当前契约。

本轮最终集成回归由协调 agent 验证：212 项前端测试、163 项后端测试通过且无 skip，31 组真实编译器 LP fixtures 包括独立同资源网、单位显示不变、安装与 100能力/60负荷/40余量发电；lint 零告警，build 通过且保留约 677 kB 主包大小告警。浏览器已观察 baseline、fractional、shortage、closed waste 和 splitter 堵塞/排放/容量/零支路，具体值及截图见验收矩阵和 ledger，其他 UI 路径不由这些结果自动推定。性能仍以带硬件、样本和阶段边界的实测文档为准。

以下保留历史评估原文。

## 1. 结论

现有项目有可复用的编辑器、资源注册、配方存储、修饰器、拓扑和 LP 调用基础，但计算链仍遵循旧模型。达到 v2 需要一次贯穿数据身份、编译、求解与结果解释的改造，不是补几个界面选项即可完成，也不需要重写整个应用。

当前最关键的缺口是：

1. 物料守恒、显式供应/排放和目标优先级尚未符合 v2。
2. resourceId 与 portId 没有真正分离，无法可靠表达同机同物料的独立网络。
3. 单位只有标签与部分时间换算，没有统一、受量纲约束的转换服务。
4. API 仍传业务节点，后端建模；v2 的通用稀疏 LP 边界尚未建立。
5. 运行结果缺少版本关联、验证与解释，存在已可复现的错误摘要。

不建议给出一个整体完成百分比：编辑器复用程度较高，但决定结果可信度的核心规则恰好仍需要调整。

## 2. 实际验证

已运行 `node node_modules/typescript/bin/tsc -b --noEmit`，退出码为 0。

使用项目 .venv 中的 Python 直接调用 `calculate_flow`，在内存中执行六个案例；未启动 HTTP 服务，未修改业务文件。Python 最初在沙箱内启动被拒，获准后在沙箱外完成。

| 案例 | 实际结果 | 判断 |
|---|---|---|
| 有限源输入矿石 10/s，转换并交付铁板 10/s | success，源和目标各为 10；system_inputs/outputs 都为空 | 复现系统摘要把正常物流抵消的问题 |
| 矿石输入为 Void，无 Source，交付 10/s 铁板 | success，运行 10 台；Void 矿石只进入摘要 | 复现隐式免费供应 |
| 必然生成主产品与废物，废物无显式出口 | success，主产品交付 10/s；排放未单独返回 | 复现自动溢流，缺少显式禁排策略 |
| 产物速率每台 0.00005/s、原料上限 1/s，目标 Maximize | success，但运行量与交付量都为 0 | 复现机器成本压过产出奖励 |
| 需求 1.2/s，每台产出 1/s | 返回 machines_exact=1.2、machines_actual=2、utilization=0.6 | 后端连续运行量与安装建议基础已具备 |
| Source 缺少必需的资源 id | 日志跳过错误节点，返回空 success | 复现静默丢弃非法输入 |

这些是后端函数级案例，不代表前端端到端验收或性能基准。源码中未发现已有 test/spec 测试文件，package.json 也没有测试脚本。

## 3. 模块差距

| 模块 | 已具备 | 与 v2 的差距 | 改造规模 |
|---|---|---|---|
| 编辑器与持久化 | 配方/源/目标、编辑器、项目、导入导出、撤销基础 | 缺少模型版本、假设展示、失效端口与结果过期提示 | 中，保留主体 |
| 资源与单位 | 类别、覆盖标签、TPS、每周期/每tick/每秒速率 | 缺少 unitId、换算族、单位倍率、量纲校验和统一转换入口 | 中到大，基础设施改造 |
| 修饰器 | Context、四组 IO、顺序执行、GT 插件、计算缓存 | 环境依赖隐式、无依赖图/轨迹；最终端口未驱动拓扑 | 中 |
| 拓扑编译 | 并查集、Net、Global、Void | 端口身份错误、随机 Net ID、无显式边界策略 | 大，重做身份与编译入口 |
| LP 建模 | Source/Target/Recipe 变量、边界、linprog | 跳过行、自动 Spill、大 M、无容量约束与分层目标 | 大，核心建模替换 |
| API/运行服务 | FastAPI、Pydantic、fetch | 非稀疏 LP 协议、无版本、无预算/执行池、状态合并 | 中到大 |
| 结果与 BOM | 连续台数、ceil、利用率、端点吞吐、BOM | 摘要错误、BOM 字段错配、缺少启动与安装语义 | 中 |
| Splitter | 未注册对应节点 | 编译列、端口与交互均需新增 | 中，可后置 |
| 诊断与验证 | 通用失败消息、debug matrix 端点 | 缺少来源映射、弹性诊断、残差检查、验收测试 | 中到大 |

## 4. 具体发现与定位

### 4.1 P0：会直接改变计算结果

- `backend/main.py:329`、`:393`：跳过 Void；仅 spill_index 中的行进入守恒等式。无正系数的输入不会受供给约束。
- `backend/main.py:326`：按正系数自动添加 Spill，没有显式排放策略。
- `backend/main.py:370`、`:378`：固定 −10000 与动态大 M，不能保证优先级。
- `backend/main.py:468`：以完整守恒矩阵回代生成系统进出料摘要，正常流量被抵消。
- `backend/main.py:249`：非法节点只记录日志并跳过；必须改为 invalid_model 并携带节点身份。
- `src/features/calculation/topology.ts:24`：端口键是 nodeId + 资源 ID，未使用独立稳定 portId。输入输出及加工/基建中相同资源会共享查找键。
- `src/features/modifier/modifier.pipeline.ts:145` 与 `payloadBuilder.ts:342`：先按资源 ID 合并，再翻译成 Net，独立端口的信息在路由前已丢失。
- `topology.ts:200`：枚举 base_* 而非最终计算端口。修饰器虽可能提前计算，拓扑仍不使用其最终 IO，所以单纯移动函数调用顺序不足以修复。
- `modifier.pipeline.ts:135`：只接受 DEFAULT_RESOURCE_CATEGORIES，自定义注册类别会在拍平阶段被静默过滤。
- `modifier.pipeline.ts:43`：周期 ≤ 0 时使用 1e9 代替速率，甚至忽略原始 amount 的比例；不能当作合法瞬时配方模型。

### 4.2 P1：结果、缓存与扩展边界

- `src/common/types/api.ts:11` 与 `src/features/calculation/capEx.ts:28` 读取 machine_actual，后端输出 machines_actual。BOM 会回退到小数 machines_exact。RecipeNode.tsx:59 已正确读取复数名称，因此这不是所有机器卡片都显示错误。
- `src/features/settings/settings.store.ts:12` 只更新 TPS；recipe.store.ts 缓存 _computed；payloadBuilder.ts:341 优先使用缓存。未发现 TPS 更新触发重算的路径。
- `modifier.pipeline.ts:92` 仍硬编码 gregtech 的 0.05 秒下限，与可变 TPS 环境不统一。
- `src/features/calculation/hooks/useCalculation.ts:77` 将 JSON 强制断言为响应类型，未做运行时协议校验；请求没有模型版本，返回后直接应用到当前画布。
- `backend/main.py:428` 把全部非成功且非无界状态当作 infeasible；没有区分超时与求解器错误。
- `src/features/file-io/hooks/useFileIO.ts:58` 的导出对象有文件 version:2，但不包含计算所需的 TPS、单位定义和资源注册表快照。项目数据库虽有 settings 字段，不等于该导出路径已经可复现。
- `src/features/modifier/modifier.types.ts` 的真实接口是 Context→Context，比旧文档的接口更统一；可保留算法，不需要因文档不一致全部重写。仍需显式环境、依赖验证、最终端口与状态输出。

### 4.3 避免误判的实现细节

- Source 吞吐在实际后端没有向整数取整，只将绝对值 ≤1e-6 清零。旧设计中的“Source 取整”问题并未照搬实现，但绝对阈值仍可能吞掉有效微小流量。
- Global 的虚拟节点是 virtualNode，后端不把它们创建成 Source/Target；不能认定代码已经给每个 Global 主动注入无限来源。缺供仍可能因跳过守恒而被隐式允许。
- topology.ts:133 用 category 构造 Global 名称，而 payloadBuilder.ts:277 又不采用 Global 名称，回退到完整资源 ID。中间拓扑与求解键不一致，但最终 payload 不会仅因这一行就把全部 energy 资源合成一个资源。
- Endpoint 当前按每秒编辑和展示，payload 直接传 amount 与现有 UI 一致；新增自动单位转换时应统一接入，而不是声称当前端点一定漏乘 TPS。
- 已有 _uid 可帮助迁移，但目前主要服务列表追踪，不能认为它已经是端到端的 portId。

### 4.4 性能与可维护性

- 后端逐行 np.zeros、np.append、tolist 再转 array，并另建 full_matrix，整个链路是稠密矩阵。
- async 路由直接同步执行 linprog，没有求解时间预算或有界任务池。
- topology 的 hasEdgeForKey 每端口扫描边，payloadBuilder 每边 nodes.find；前端预编译还有 O(P×E) 和 O(E×N) 的扫描，可用索引替代。
- Net 使用计数器与随机数生成，不支持相同模型的确定性指纹。
- `/api/debug-matrix` 再实现了一套矩阵构造逻辑。应让正式求解与 debug 共用同一 IR/矩阵结果，避免以后只修正其中一份。

## 5. 单位类方案

赞同创建统一类。建议以 `UnitSystem` 作为转换服务，定义与数值仍以普通 JSON 数据存储，避免类实例进入 Zustand、IndexedDB 或导出文件后丢失原型方法。

### 5.1 数据职责

```typescript
interface UnitDefinition {
  id: string
  symbol: string
  quantityKind: string       // volume、energy、power、temperature 等
  conversionFamily: string  // 只允许明确属于同族的单位互换
  scaleToCanonical: number
  offsetToCanonical: number // 流量换算要求为 0；状态温度可非零
}

interface UnitEnvironment {
  ticksPerSecond: number
  revision: string
}

type RateInput =
  | { kind: 'per_cycle'; value: number; amountUnitId: string; durationSeconds: number }
  | { kind: 'per_tick'; value: number; amountUnitId: string }
  | { kind: 'per_second'; value: number; amountUnitId: string }
  | { kind: 'native_rate'; value: number; rateUnitId: string }
```

`native_rate` 用于 W 等自身已是速率的单位，注册时明确它与相应量单位每秒的映射。不得给 W 再除一次秒，也不能让原生速率与任意 time_base 随意组合。

### 5.2 类的接口方向

```typescript
class UnitSystem {
  // 构造时注入不可变的单位定义、速率映射与环境快照。
  // 以下仅为拟议接口，不是已经落地的源码。
  canConvert(fromUnitId: string, toUnitId: string): boolean
  convert(value: number, fromUnitId: string, toUnitId: string): number
  toRate(input: RateInput, canonicalAmountUnitId: string): number
  fromRate(rate: number, canonicalAmountUnitId: string, display: RateDisplay): number
  ticksToSeconds(ticks: number): number
  secondsToTicks(seconds: number): number
}
```

`RateDisplay` 应为区分 per_tick、per_second、per_cycle、native_rate 的联合类型；per_cycle 必须显式携带周期。数值转换与格式化分开，转换函数不做四舍五入。

转换规则：

1. 每次编译注入同一个环境快照，类不能内部读取 React/Zustand。
2. 只有同一 conversionFamily 且语义兼容才允许 convert。除了物理维度，还需要 quantityKind，避免把语义不同的量误作别名。
3. L↔mL 可以按已声明比例换算；EU↔RF 不默认可换算。若代表不同资源、需要设备转换，即使插件给出能量等价关系，也不能据此自动合并物流网络。
4. mB↔L 的关系由游戏环境显式定义，不凭显示名称猜测。
5. 温度的绝对值与温差必须区分。带偏移单位禁止进入普通流量缩放路径。
6. 缺单位、非法数值、周期为零、TPS 非法均返回结构化错误，不回退成 0 或 1e9。
7. `probability` 和 `consumable` 属于生产语义，放在管线中；单位类只换算数量，不计算概率和损耗。
8. 核心计算使用标准单位；用户切换显示单位只修改显示配置。编辑单位时同时转换数值，以保持物理量不变。

示例：20 TPS 下 32 EU/t → 640 EU/s；每周期 2 L、周期 4 s → 0.5 L/s；0.5 L/s 显示为 500 mL/s。相同输入在 40 TPS 环境下应重新编译，32 EU/t → 1280 EU/s。

### 5.3 接入现有代码

建议新增 `src/common/units/`：单位 DTO、UnitSystem、转换错误与单元测试。此目录只依赖通用类型，不反向依赖 features。

逐步替换：

1. registry 的 base_unit/unit_override 字符串演进为可引用的 unitId，保留显示 symbol。
2. `common/utils/time.ts` 改为委托显式传入的 UnitSystem。
3. `normalizeRate` 的时间与单位部分调用 toRate；概率计算单独保留。
4. Endpoint 与 Recipe 共用输入/显示转换接口。
5. `rateFormat.ts` 只负责格式化已转换的值，不再自行读取 TPS。
6. 编译缓存键加入 environmentRevision、unitRegistryRevision 和 modifierVersion。
7. 导出包含单位定义与环境快照，类实例只在运行时创建。

## 6. 建议实施顺序

具体执行拆分见 [v2 可独立评审实施计划](v2-implementation-plan.md)：将下面六个批次细化为 12 个改动，包含依赖、接口影响、验收及迁移边界。

| 批次 | 交付 | 依赖与验收 |
|---|---|---|
| 1. 固化反例与协议小修 | 将本次六个案例固化为测试；修复 machines_actual；错误节点显式失败 | 给后续改造建立可运行基线 |
| 2. 单位与环境 | UnitSystem、单位注册、TPS 缓存失效、导入导出环境快照 | 单位往返、非法量纲、环境变化用例通过 |
| 3. 稳定端口与编译 IR | resourceId/portId/netId 分离、最终端口拓扑、来源映射、显式边界 | 同机双水路、动态端口与独立 Net 案例通过 |
| 4. 正确性求解核心 | 前端生成稀疏 LP、后端统一求解、完整守恒、分层目标、正确摘要 | v2 的守恒与目标反例全部通过 |
| 5. 结果与交互闭环 | 模型版本、过期结果、状态/残差、安装建议、BOM、基本冲突诊断 | 结果不会错配当前图，不误称最优或可启动 |
| 6. 补齐产品与性能 | Splitter、修饰器轨迹、瓶颈、执行池、基准 | 完整 v2 第一版验收与性能数据 |

工作量属于中等规模核心重构。建议按以上六个批次拆成约 8–12 个可独立评审的改动，而不是一次替换全部前后端；这个数量是工作拆分建议，不是工期承诺。

若先交付可用闭环，优先完成前五批；Splitter、精细边际分析和大规模性能优化可后置。不能后置物料守恒、端口身份或单位语义，否则新功能会继续建立在错误模型上。

## 7. 旧文件迁移边界

现有导出 version:2 与设计版本 v2 是两种不同版本号。新文件协议应单独升级，不能复用数字相同这一巧合。

迁移时：

- 为端口分配持久 portId；旧连线若能唯一对应则迁移，同资源多端口有歧义时保留原文件并要求用户修复。
- 旧 Void/隐式外供不要悄悄转成新严格模式的有效产线。提供一次迁移预览，列出新增外供边界与排放假设，由用户确认这些语义。
- 旧单位标签无法确认换算比例时，保留为独立自定义单位族，不猜成标准单位。
- 旧导出缺少 TPS 时明确显示采用的默认环境，避免宣称完全复现旧计算。
- 第一阶段保留旧读取器，通过迁移器生成新 Document；新旧编译器不要混用同一缓存或结果。
