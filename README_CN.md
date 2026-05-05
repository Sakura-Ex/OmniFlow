# OmniFlow

<div align="center">

[English](README.md) | 中文

**游戏无关的工业产线求解器 — 可视化节点编辑器 × SciPy 线性规划**

[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react)](https://react.dev/)
[![React Flow](https://img.shields.io/badge/React_Flow-11.11-ff0072?logo=reactflow)](https://reactflow.dev/)
[![Zustand](https://img.shields.io/badge/Zustand-5.0-433e38)](https://zustand.docs.pmnd.rs/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?logo=vite)](https://vite.dev/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-latest-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![SciPy](https://img.shields.io/badge/SciPy-linprog-8CAAE6?logo=scipy)](https://scipy.org/)
[![Pydantic](https://img.shields.io/badge/Pydantic-2.x-E92063?logo=pydantic)](https://docs.pydantic.dev/)
[![Pure CSS](https://img.shields.io/badge/CSS-Dark_Industrial-1a1a2e)]()

</div>

---

## 简介

工业自动化游戏的复杂度早已超出人类心算的极限。当你的《我的世界》格雷科技产线包含 40+ 台多方块机器、跨维度流体供应、复数能源舱并行与定向超频时，任何电子表格或专用计算器都会在以下困境中崩溃：

> **硬编码地狱** — 现有工具深绑定特定模组版本，无法适应自定义整合包或跨游戏场景。
>
> **上下文歧义** — 同一资源（如水）在配方中是按次消耗的原料，在机器底座中却是按 Tick 持续消耗的冷却液。传统单维度数据模型无法表达这种本体与用法的正交关系。
>
> **算力瓶颈** — 手动穷举或迭代逼近面对非线性超频、概率副产、全局总线共享等多目标耦合时，要么发散，要么精度不可接受。

**OmniFlow** 将运筹学中的单纯形矩阵求解与工业控制台的节点图范式相结合，提供一个所见即所得、游戏无关、数学驱动的工业产线排程引擎。

---

## 核心设计理念

### 1. 游戏无关性

OmniFlow 的底层 **不包含任何硬编码的游戏逻辑**。系统通过可配置的 **全局资源注册表（Global Resource Registry，基于 Zustand）** 映射一切物理实体。从《我的世界》切换到《异星工厂》或《戴森球计划》，只需更换资源配置，核心求解管线无需任何代码修改。

```
Resource Registry  →  Category: 'gt:eu'  |  DisplayName: '格雷电力'  |  Unit: 'EU/t'  |  Routing: global
                    →  Category: 'item'   |  DisplayName: '物品'      |  Unit: '个'     |  Routing: wired
                    →  Category: 'fluid'  |  DisplayName: '流体'      |  Unit: 'mB'     |  Routing: wired
```

### 2. 本体与上下文的正交解耦

这是 OmniFlow 最核心的数据建模突破：

| 维度 | 存储位置 | 描述 |
|------|----------|------|
| **本体（Nature）** | `ResourceRegistry` 全局字典 | 物质的物理身份：水、EU 电力、铁锭；UI 颜色与基础单位 |
| **上下文（Context）** | 机器 Archetype 的 `fixed_utilities` 与配方端口的 `measure_mode` | 该资源在当前业务流程中的**度量方式**：按次（`per_cycle`）、按 Tick（`rate_per_tick`）、按秒（`rate_per_sec`），以及是否为只读催化剂（`consumable: false`） |

这一设计彻底解决了"同一种水既是配方原料又是冷却液"的行业建模痛点——物质本体仅定义一次，用法语义附着于机器底座与配方插槽，二者正交解耦。

### 3. 数学优先

前端承载全部业务逻辑（超频级联、并行度、阈值判断、概率产出）。在请求发送给后端前，通过 **预编译管线（Pre-compilation Pipeline）** 将所有离散的周期量和连续的速率量归一化为纯净的 **Rate/s（每秒速率）**，后端仅需以 `scipy.optimize.linprog` 求解标准形式的线性规划问题：

```
minimize  c^T x
subject to  A_ub x ≤ b_ub
            A_eq x = b_eq
            x ≥ 0
```

> 后端无状态、无模组知识，仅接收归一化后的向量与矩阵，30ms 内返回最优解。

---

## 关键架构

### 机器底座与插槽分离

将**机器固有属性**（能源类型、冷却介质、路由锁定）与**配方 I/O** 彻底分离：

```typescript
// gtElectric.ts — 格雷电力机器底座
{
  id: 'gt_electric',
  fixed_utilities: {
    'gt:eu': {
      type: 'gt:eu',
      routing_mode: 'global',      // 电力走全局总线，无需手动连线
      routing_locked: true,        // 用户不可更改路由类型
      measure_mode: 'rate_per_tick' // EU 按 Tick 消耗
    }
  },
  default_modifiers: ['gt_multiblock']  // 默认激活多方块能源舱修饰器
}
```

固定 utility 通过外键引用 `ResourceRegistry`，实现 UI 中**动态后缀拼接**（如 `EU/t`、`mB/s`）与**视觉降噪**（全局路由端口自动隐藏连线）。

### 智能拓扑与隐式路由

废弃繁琐的全手动连线，支持两种路由范式：

| 路由模式 | 语义 | 示例 |
|----------|------|------|
| `wired` | 必须建立物理拓扑连线 | 物品、流体管道 |
| `global` | 全局隐式共享网络 | 电力总线（gt:eu）、应力网络（create:su） |

计算引擎在构建拓扑网络时，自动为 `global` 路由的资源生成虚拟源节点（`Virtual_Global_Source`）与虚拟汇节点（`Virtual_Global_Target`），用户无需手动创建电力输入节点，大幅降低画布复杂度。

### 定向修饰器管线

实现严格的多阶段修饰器作用域隔离，完美兼容跨模组混合动力机器：

```
Phase 1: Collect Effects     — 遍历已激活的修饰器，收集各自的 ModifierEffect
Phase 2: Parallel             — 无损并行优先：统一乘以 parallelMultiplier
Phase 3: Targeted Overclock   — 定向指数超频在后：仅匹配 utility_type 的 utility 倍乘
          例：同时消耗 gt:eu 与 create:su 的混合机器
              • gt:eu 被超频倍乘（×4^n）
              • create:su 不受超频影响
Phase 4: Output Probability   — 概率产出（如副产物 5% 概率）
Phase 5: Duration & Rate      — 归一化到 Rate/s
```

以格雷科技多方块为例，`gt_multiblock` 修饰器严格执行：
1. 根据能源舱配置计算总输入 EU/t
2. 无损并行 = `min(floor(total_eu / recipe_eu), parallelLimit)`
3. 若剩余功率充足，执行超频（电压 ×4，完美超频时持续时间 ÷4，普通超频 ÷2）

### Zustand 驱动的资源注册表

全局资源分类注册表使用 Zustand 实现细粒度订阅，React 组件仅在其引用的特定资源分类变化时重渲染，避免 React Context 的全量更新灾难。配合 React Flow 内置的 `useNodesState` / `useEdgesState` 管理画布状态，保障 60fps 丝滑拖拽体验。

### 确定性预编译

每次请求前执行全量数据规范化流水线：

1. **`normalizeCanvasNode`** — 兼容旧字段迁移（`is_virtual` → `is_auto`），填充默认 mode
2. **`ensureRecipeDataShape`** — 应用 Archetype、过滤不兼容修饰器、填充默认 UI 状态
3. **`buildTopologicalNets`** — 构建拓扑网络，分离 wired/global 边，生成隐式路由
4. **`getCalculatedRates`** — 执行修饰器管线，将所有资源归一化到 Rate/s

---

## 工作原理

```
┌─────────────────────────────────────────────────┐
│                  React Flow 画布                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│  │ Source   │───▶│ Recipe   │───▶│ Target   │   │
│  │ 水 ∞     │    │ 电解机   │    │ 氢气 1.0 │   │
│  └──────────┘    └──────────┘    └──────────┘   │
│       │               │                           │
│  物理连线          全局总线（gt:eu）               │
└───────┼───────────────┼───────────────────────────┘
        │               │
        ▼               ▼
┌─────────────────────────────────────────────────┐
│                 预编译管线                        │
│  normalizeCanvasNode → ensureRecipeDataShape     │
│  → buildTopologicalNets → getCalculatedRates     │
│                                                  │
│  所有数据 → Rate/s（纯浮点向量）                   │
└──────────────────────┬──────────────────────────┘
                       │ POST /api/calculate
                       ▼
┌─────────────────────────────────────────────────┐
│          FastAPI + SciPy 线性规划求解器            │
│                                                  │
│  Pydantic 校验 → 节点分类                         │
│  → 化学计量矩阵 A 构建                             │
│  → 约束 c、bounds 构建                            │
│  → scipy.optimize.linprog（highs 方法）          │
│  → 结果聚合与取整                                  │
└──────────────────────┬──────────────────────────┘
                       │ 计算结果
                       ▼
┌─────────────────────────────────────────────────┐
│               结果映射与 UI 更新                   │
│                                                  │
│  machines_exact / machines_actual / utilization  │
│  actual_amounts per node / per port              │
│  system_inputs / system_outputs summary          │
│  total_eu_tick                                   │
└─────────────────────────────────────────────────┘
```

### 后端线性规划建模

**变量向量**: `x = [x_recipes | x_sources | x_sinks]`

**化学计量矩阵**: 列 = 配方，行 = 物品；产出为正，消耗为负。

**目标模式**:

| 目标模式 | 目标系数 | 约束 |
|----------|----------|------|
| `demand` | `c = 0` | `b_eq = amount`（精确需求） |
| `maximize` | `c = -10000` | `b_ub ≥ 0`（强力最大化） |
| `overflow` | `c = 0.001` | `b_eq = 0`（溢出排放） |

**约束**: 非目标物品满足 `Ax >= b`（允许副产物溢出）。目标物品严格遵循质量守恒。

---

## 开发与配置

### 环境要求

- **Node.js** >= 18
- **Python** >= 3.10

### 前端

```bash
# 安装依赖
npm install

# 启动开发服务器（http://localhost:5173）
npm run dev

# 类型检查与构建
npm run build

# 代码检查
npm run lint

# 预览生产构建
npm run preview
```

### 后端

```bash
cd backend

# 创建并激活虚拟环境（Windows）
python -m venv venv
venv\Scripts\activate

# 安装依赖
pip install fastapi uvicorn numpy scipy pydantic

# 启动后端（http://localhost:8000）
uvicorn main:app --reload
```

API 文档可访问 [http://localhost:8000/docs](http://localhost:8000/docs)（Swagger UI）。

### 数据持久化

画布数据通过 `localStorage` 持久化，key 为 `omniflow.canvas.v1`。支持通过文件 I/O 控件导出/导入为 `.json` 文件。

---

## 项目结构

```
OmniFlow/
├── src/
│   ├── App.tsx                     # 根组件 — React Flow 画布
│   ├── main.tsx                    # 入口文件
│   ├── index.css                   # 深色工业风全局样式（纯 CSS）
│   ├── flowConfig.ts               # 节点类型注册（recipeNode / sourceNode / targetNode）
│   ├── components/                 # React UI 组件
│   │   ├── RecipeNode.tsx          # 多态配方节点（gregtech / vanilla / enderio）
│   │   ├── SourceNode.tsx          # 输入源节点
│   │   ├── TargetNode.tsx          # 输出目标节点
│   │   ├── RecipeEditorModal.tsx   # 配方编辑弹窗
│   │   ├── EndpointEditorModal.tsx # 端点编辑弹窗
│   │   ├── SystemHUD.tsx           # 系统状态 HUD
│   │   ├── MenuBar.tsx             # 顶部菜单栏
│   │   └── SegmentedControl.tsx    # 分段控制器
│   ├── hooks/                      # 自定义 React Hooks
│   │   ├── useCanvasState.ts       # 节点/边状态（React Flow）
│   │   ├── useCanvasOperations.ts  # 添加/删除/连接操作
│   │   ├── useCalculation.ts       # 预编译 → POST → 结果映射管线
│   │   ├── useClipboard.ts         # 复制/粘贴/复制节点
│   │   ├── useFileIO.ts            # 文件导入/导出 + localStorage
│   │   ├── useKeyboardShortcuts.ts # 全局键盘快捷键
│   │   ├── useNodeEditor.ts        # 节点编辑弹窗状态
│   │   ├── useNodeOperations.ts    # 自动填充端点、节点数据更新
│   │   ├── useUndoRedo.ts          # 基于快照的撤销/重做（最多 20 步）
│   │   └── useTheme.ts             # 深色/浅色主题切换
│   ├── domain/canvas/
│   │   ├── initialState.ts         # 演示画布（格雷科技钢铁产线）
│   │   └── validators.ts           # 数据规范化与迁移
│   ├── modifiers/                  # 修饰器引擎
│   │   ├── calculate.ts            # 核心 5 阶段修饰器管线 + 速率归一化
│   │   ├── gtMultiblock.ts         # GT 多方块能源舱与超频逻辑
│   │   ├── chanceOutput.ts         # 概率产出修饰器
│   │   ├── registry.ts             # 修饰器注册表（ID → IMachineModifier）
│   │   ├── state.ts                # 默认 UI 状态工厂
│   │   ├── types.ts                # IMachineModifier 与 ModifierEffect 接口
│   │   └── index.ts                # 统一导出
│   ├── data/archetypes/            # 机器底座定义
│   │   ├── index.ts                # 注册表 + applyArchetypeToInputs
│   │   ├── gtElectric.ts           # GT 电力（固定 gt:eu utility + 全局路由）
│   │   ├── fluidNetworked.ts       # 流体冷却（utility:water 按秒）
│   │   ├── customGeneric.ts        # 空白底座
│   │   └── shared.ts               # Utility 数量推导辅助函数
│   ├── registry/                   # 全局资源分类注册表
│   │   ├── resourceRegistry.ts     # Zustand 存储（分类 CRUD + localStorage）
│   │   ├── defaults.ts             # 内置分类（item / fluid / energy / gt:eu / create:su …）
│   │   ├── types.ts                # ResourceCategoryDef 类型
│   │   ├── units.ts                # 单位定义
│   │   └── index.ts                # 统一导出
│   ├── types/
│   │   ├── recipe.ts               # RecipeNodeData / SourceNodeData / TargetNodeData
│   │   ├── api.ts                  # CalculateResponse 类型
│   │   └── types.ts                # Resource / MachineArchetype / UtilityDef / RoutingMode
│   └── utils/
│       └── topologicalNets.ts      # 拓扑网络分析 + 全局路由
├── backend/
│   └── main.py                     # FastAPI 应用 + Pydantic 模型 + SciPy LP 求解器
├── public/                         # 静态资源
├── vite.config.ts
├── tsconfig.json                   # TypeScript 项目引用根配置
├── tsconfig.app.json               # 前端 TS 配置
├── tsconfig.node.json              # Node 端 TS 配置（vite.config）
├── eslint.config.js                # ESLint 10 扁平配置
└── package.json
```

---

## 许可证

GPL-3.0 license
