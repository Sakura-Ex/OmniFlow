# 稀疏 LP 契约与执行服务

`backend/solver/` 只处理标准连续 LP，不识别节点、配方、Source、Target、资源或画布。当前正式 `/api/calculate` 与 `/api/debug` 已统一接入该模块及有界运行池；旧业务节点请求、Void 跳过、自动 Spill 和大 M 建模已移除。前端 `networkCompiler.ts` 生成数学模型及保留在客户端的领域来源映射。本文的 PR-05 验证数字只描述历史独立阶段，当前集成验收见文末。

## 调用和契约

```python
from backend.solver import LPRequest, SolverLimits, solve_lp

request = LPRequest.model_validate(payload)
response = solve_lp(request, limits=SolverLimits(max_variables=10_000))
wire_data = response.model_dump(mode="json")
```

也可以直接传未校验字典。Pydantic 对象也会重新校验，防止构造或修改后绕过检查。结构、数值、索引、身份、边界或资源限制错误返回 `invalid_model`，不调用优化器。

- Python 契约：[`backend/solver/schema.py`](../backend/solver/schema.py)。
- TypeScript 类型及 Zod 运行时校验：[`src/common/types/lp.ts`](../src/common/types/lp.ts)，独立于仍在使用的旧 `api.ts`。
- 共享数学模型：[`fixtures/lp/models.json`](../fixtures/lp/models.json)，由 pytest 真实求解、由 Vitest 校验契约。
- 六状态响应：[`fixtures/lp/responses.json`](../fixtures/lp/responses.json)。真实模型使用 SciPy，T21 超时和执行异常使用确定性替身，计时归零。运行 `python -m fixtures.lp.generate_responses` 可刷新。

协议版本 `omniflow.lp.v1`，显式携带 `request_id`、`document_revision`、`compiler_fingerprint`。解析成功则原样回传身份；结构解析失败时身份为 `null`。当前客户端运行时校验响应，核对请求 ID、修订号、指纹及变量身份，并由 CalculationSession 丢弃编辑或新请求之后到达的旧响应。本数学服务不拥有画布状态。

变量必须提供 `lower`、`upper`，无界端为 JSON `null`；支持负下界、自由变量和小数。没有隐含巨大上界。等式为 `A_eq x = rhs`，不等式为 `A_ub x <= rhs`，稀疏索引从 0 开始。

变量 ID、跨等式及不等式的行 ID、目标 ID 分别唯一。不同身份类别可重名，残差 `kind` 区分原始行和目标锁。重复矩阵坐标及目标列**相加**，Python 使用 `math.fsum`，只移除合并后严格为零的系数。零系数等式的 rhs 非零、或零系数不等式 rhs 为负，直接返回带 row_id 的 `infeasible`，微小矛盾也不会被删掉。

数值必须有限，拒绝字符串、布尔值、NaN、Infinity；索引和修订号要求 JavaScript 安全整数。重复项合并溢出、归一化溢出或把非零系数下溢为零都返回 `invalid_model`。未知字段及协议版本也明确拒绝。

## 分层目标

每个 `objectives` 元素代表**一个已聚合目标层**。`priority` 为显式非负整数，越小越优先，输入数组顺序不决定优先级。重复优先级被拒绝；调用方必须先决定同级语义，归一化加权生成一层，或增加固定配比变量和约束。

每层统一最小化，最大化由负系数表达：

```text
g(x) = Σ coefficients[col] × x[col] / normalization_scale
g(x) <= z + abs_tolerance + rel_tolerance × |z|
```

第二行在该层获得已验证最优值 z 后作为稀疏锁加入。scale 必须有限且为正，两项容差显式提供且非负，容差以**归一化目标单位**表示。显示单位将原始系数放大 k 时，scale 也放大 k，归一化 LP、锁和解不变。结果记录原始 value、normalized_value、scale、两项容差、lock_upper、每层最优性和残差。不使用大 M。

无目标时执行一次零目标可行性阶段，`objective_id=null`，`model_stats.objective_layers=0`。无变量的常数模型通过同一残差校验器处理，不调用不支持零变量的 SciPy。

## 可行性与状态

每个候选解须通过维度、有限性、全部等式、不等式、变量边界和先前所有目标锁的回代。每个接受阶段携带当时完整 feasibility；最终解再次验证全部锁。

服务器默认绝对可行性容差 1e-7、相对容差 1e-9。行阈值为 `absTol + relTol × max(|rhs|, Σ |a_i| |x_i|)`；边界阈值为 `absTol + relTol × max(|x|, |lower|, |upper|)`。输出逐行活动量、残差、余量、容差、越界量和 passed，以及变量边界和最大误差。目标允许的退让和数值可行性容差分别记录，不声称无容差的严格字典序。

| 状态 | 含义 | solution |
|---|---|---|
| success | 全部层证明最优且回代通过 | 已验证解 |
| infeasible | 原始硬约束不可行 | null |
| unbounded | 当前层没有有限最优值，停止后续层 | null |
| limit_reached | 总预算耗尽或优化器达到限制 | 可选的已验证解 |
| invalid_model | 请求或服务器限制校验失败 | null |
| solver_error | 执行异常、未知状态、非法向量或残差失败 | null |

设计草案顶层 optimal 在本契约命名为 success，与应用现有终态用语一致；仅全部层 proven_optimal=true 时可返回。阶段状态仍为 optimal。新旧请求用版本区分，不可互换。

后层若报不可行，但先前已经有满足全部当前锁的验证方案，则返回 solver_error/objective_lock_infeasible，不能声称原始模型不可行。任何层无界都会停止，不加隐含上界。

超时阶段的候选值须通过全部原始约束及先前锁；无有效新解时保留先前解，返回前再次验证。未完成层 proven_optimal=false 或尚未执行，不能展示为全部最优。Pydantic 和 Zod 响应校验都拒绝非有限响应、错误状态附带解、成功阶段缺失、矛盾最优标记、错位变量证据或伪造汇总 passed。

## 预算、资源与迁移

默认上限为 50,000 变量、100,000 总行、1,000,000 个提交矩阵及目标项、32 层、60,000 ms。重复项也计入提交规模。服务器 SolverLimits 可进一步降低限额，请求无权改写；Pydantic 还有固定 wire 上限。SolverLimits 的 max_threads 默认为 1，并显式传给 HiGHS 的 threads 选项；SciPy 提示该选项将原样转发，不仅依赖环境变量。

直接调用 solve_lp 时，计时从模型解析前开始，覆盖校验、稀疏构造、全部层和回代，queue_ms 为 0。每次 HiGHS 使用剩余秒数；solve_ms 累加优化器耗时。HTTP 运行池从请求体解析前启动总预算，排队后只把剩余预算交给 solve_lp；响应 queue_ms 表示请求开始到派发（含解析/校验），total_ms 表示请求开始到运行结果完成。最终 HTTP 响应序列化及客户端收发不在服务器 total_ms 内。

COO 直接转 CSR，目标锁通过稀疏 vstack 添加，无稠密矩阵中间态。SciPy 必需的一维目标向量及右端向量为稠密向量，长度随变量或行数线性增长。

数学核心 solve_lp 保持同步函数；backend/solver/runtime.py 负责有界执行，默认 2 个专用工作线程、8 个排队请求、每次求解 1 个 HiGHS 原生线程。排队时间计入请求总预算；队列满返回 HTTP 503/queue_full，重复活动 request_id 返回 HTTP 409/duplicate_request_id。DELETE /api/calculate/{request_id} 仅取消未派发任务，返回 cancelled；运行中的调用不会被伪装成已终止。超时 HTTP 可以先返回 limit_reached，但工作槽直到原生调用真实结束才释放。HiGHS 时间限制与层间检查不能保证 Python 预处理或原生调用被墙钟硬中止；本实现没有强制进程终止承诺。`/api/health` 可用于检查事件循环是否响应。

## 验证

仓库根目录、安装 backend/requirements-dev.txt 后运行：

```text
python -m pytest backend/tests/test_sparse_solver.py -q
node node_modules/vitest/vitest.mjs run src/common/types/lp.test.ts
node node_modules/typescript/bin/tsc -b
node node_modules/eslint/bin/eslint.js src/common/types/lp.ts src/common/types/lp.test.ts
```

覆盖 T09 慢配方优先最大化、T16 真正无界、T21 第二层超时保留带锁残差证据的方案、T23 非法数值/索引/边界和小数变量；另有显示单位尺度与容差、重复项和精度抵消、矛盾零行、空模型、逐层回代、共享预算、执行异常及跨语言六状态契约。

本次独立验证结果：上述 pytest **89 passed**，LP 契约 Vitest **66 passed**，TypeScript 构建检查及上述两个文件 ESLint 均通过。在当前 Windows 环境中使用 `.venv\Scripts\python.exe` 运行 Python 命令；该解释器需要允许本地环境执行，Node 入口直接运行锁定依赖中的 runner。

以上 89/66 为 PR-05 历史独立测试结果，不是当前全仓测试总数。2026-10-23 协调 agent 的最终集成回归为前端 212、后端 163 全通过，无跳过；lint 零告警，build 通过且保留约 677 kB 主包大小告警。当前已增加 31 组编译器真实求解 fixtures（含 T07/T08/T10/T14/T18/T24）、版本化 HTTP、执行池及诊断测试，详见 [测试指南](testing.md) 与 [T01–T24 证据映射](validation/v2-completion/acceptance-matrix.md)。[后端性能实测](validation/v2-completion/performance-backend.md) 记录固定硬件与数据集的 P50/P95、队列和原生内存；函数级正确性测试不替代浏览器或性能验收。


## 当前 HTTP、诊断与发布边界

- 前后端共同部署 `omniflow.lp.v1`。旧 `{nodes, edges}` 请求明确失败，不降级到旧数学语义。文件 v5、插件 API v2 和 LP v1 是独立版本，不可互换。
- 两条 POST 路由返回同一完整 LPResponse。数学终态通常为 HTTP 200，invalid_model 为 422，solver_error 为 500；503/409 的运行池失败同样保持 LP envelope。JSON 解析错误不回显输入内容。
- `/api/debug` 当前执行同一次求解并返回阶段/残差证据，不是独立矩阵构建器，也不是无求解成本的 inspect 接口。
- 前端 `diagnostics.ts` 通过同一 LP wire 构造独立、有限的弹性诊断请求。只放松明确允许的资源守恒/容量行，不放松未知行、固定比例、状态或原变量边界；按每行明确尺度惩罚假设缺口，并显示假设及解释的非唯一性。
- 诊断使用原计算剩余总预算、独立 request_id 和指纹；客户端继续应用原模型修订检查。诊断失败保持原 infeasible，诊断向量不进入物流/BOM。满载只报告余量/活动约束，没有验证边际收益时不宣称增容有用。
- 同级多目标的聚合、来源映射、固定安装/BOM、启动检查、Net 语义由前端领域模块拥有。数学后端不解释 portId 或资源身份。
