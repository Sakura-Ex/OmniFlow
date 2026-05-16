# OmniFlow 第二阶段：数据存储架构重构技术方案

***

## 1. 背景与动机

### 1.1 当前状态

第一阶段使用 JSON v2 格式存储画板数据，结构如下：

```
CanvasPayloadV2 {
  version: 2
  ui: { nodes: Node[], edges: Edge[] }
  domain: { recipes: Record<string, RecipeNodeData> }
}
```

存储方式为浏览器 localStorage + JSON 文件导入/导出。所有数据在内存中全量加载，无服务端持久化。

### 1.2 架构定位

OmniFlow 的部署架构：

```
[浏览器前端]  ←── POST /api/calculate ──→  [后端服务器]
  数据存储层                                     LP 求解
  IndexedDB                                     无状态
  ProjectRecipe / Canvas                 不存储用户数据
```

- 后端仅提供 `/api/calculate` 和 `/api/debug` 两个求解端点，**不存储任何用户数据**。
- 所有用户数据存储在浏览器 IndexedDB 中。
- 后端无状态，可水平扩展，适合公开部署。

### 1.3 现存问题

| 问题 | 表现 | 影响 |
|---|---|---|
| 全量加载 | 每次操作读写整个 JSON 对象 | 画板超过 200 节点时序列化/反序列化耗时 > 500ms |
| 无查询能力 | 搜索配方需遍历全部节点做字符串匹配 | 无法支持高效过滤与分页 |
| 单画板扁平结构 | 所有配方平铺在 `domain.recipes` 中 | 无法组织子画板/层级化产线 |
| 无版本控制 | 覆盖保存即丢失历史 | 误操作无法回退 |
| localStorage 容量限制 | 单键值 5MB，同步阻塞主线程 | 大画板写入时页面卡顿 |

### 1.4 第二阶段目标

1. **引入 Project 概念**：以项目为容器组织画板、配方池、标签和导入记录。
2. **分离配方池与画板节点**：配方全量数据存入 `ProjectRecipe` 表（项目级一行一配方）。画板节点仅存 `recipeRef` 指针和 `modifiers` 覆写。加载项目时，`ProjectRecipe` 表全量拉取到 Zustand Store 构建 `Record<string, Recipe>` 字典，运行时通过 `store.recipes[node.recipeRef]` 完成 O(1) 内存级联。
3. **支持配方搜索**：在配方库上按名称、系统、标签、输入/输出物质等多维度过滤。
4. **支持配方导入**：解析多种格式（JSON、CSV），写入配方库，不绑定画板。
5. **支持子画板**：画板内嵌子画板节点，实现层级化产线管理。
6. **存储升级**：从 localStorage 迁移至 IndexedDB，全异步非阻塞。

***

## 2. 前端存储方案选型

### 2.1 候选方案对比

| 维度 | IndexedDB (Dexie.js) | localStorage | OPFS (源私有文件系统) | SQLite WASM |
|---|---|---|---|---|
| **容量上限** | 浏览器配额（Chrome ~60% 磁盘） | 5MB | 浏览器配额 | 浏览器配额 |
| **查询能力** | 复合索引、范围查询、filter | 无（全量遍历） | 无（纯文件读写） | 完整 SQL + FTS5 |
| **异步/同步** | 异步，不阻塞主线程 | **同步阻塞** | 异步 | 异步 |
| **数据类型** | 结构化克隆（对象、ArrayBuffer、Blob） | 仅字符串 | 文件 | 结构化数据 |
| **事务支持** | 读写事务 | 无 | 无 | ACID |
| **库体积** | Dexie.js ~25KB gzip | 零 | 零 | sql.js ~1MB gzip |
| **浏览器兼容** | 所有现代浏览器 | 所有浏览器 | Chrome 86+, Firefox 111+, Safari 16.4+ | 所有现代浏览器 |
| **查询性能（万级）** | 索引查询 < 10ms，filter < 50ms | O(n) 阻塞 | 不适用 | 毫秒级 |
| **学习成本** | 低（Dexie 封装良好） | 零 | 中 | 高 |

### 2.2 推荐方案：IndexedDB + Dexie.js

选型理由：

| 决策点 | 理由 |
|---|---|
| **异步非阻塞** | 解决当前 localStorage 同步阻塞主线程的问题，大画板写入不再卡顿 |
| **容量足够** | 浏览器配额通常 > 1GB，远超 OmniFlow 的预期数据量（< 10 万条配方） |
| **查询能力** | Dexie 的复合索引 + 范围查询可覆盖结构化过滤需求；filter() 支持任意条件 |
| **社区成熟** | Dexie.js v4.x 已稳定发布，TypeScript 支持完善，npm 周下载量 300 万+ |
| **零后端依赖** | 纯浏览器方案，后端不受影响 |

**不选 OPFS 的理由**：OPFS 以文件为粒度，不支持索引和条件查询，不适合配方这类结构化数据的检索场景。

**不选 SQLite WASM 的理由**：功能过剩。WebAssembly 加载 ~1MB 体积，对于 OmniFlow 的数据量级（< 10 万条），Dexie 的查询性能已经足够。

### 2.3 Dexie 版本选型

选用 **Dexie.js v4.4.x**。v4 相比 v3 的关键改进：

- IndexedDB 3.0 `getAll()` 优化，范围查询性能提升。
- TypeScript 原生支持。
- 稳定版本，2026 年仍在维护。

***

## 3. 数据模型设计

### 3.1 实体关系（5 张表）

```
Project (1)
  ├── Canvas (1..N)                     画板（邻接表 parentId 实现无限嵌套）
  ├── ProjectRecipe (0..N)              项目配方池（一行一配方）
  │     └── sourceLibraryId ───→        追溯来源（外部库 ID）
  ├── Tag (0..N)                        标签
  └── ImportRecord (0..N)              导入记录
```

### 3.2 核心设计原则：引用模式（Reference Model）

配方全量数据存入 `ProjectRecipe` 表。画板节点只存 `recipeRef` 指针和用户级覆写（`modifiers` / `mode` / `manualMachines` / `hardwareSpecs`），**不存 inputs/outputs**。

```
ProjectRecipe（项目配方池）                  Canvas.nodes（画板节点）
┌──────────────────────────┐              ┌──────────────────────────┐
│  id: "pr-001"            │              │  id: "node-1"            │
│  recipeId: "电解水"       │              │  type: "recipeNode"      │
│  inputs: water:1000      │  ── recipeRef  │  data: {                 │
│  outputs: hydrogen:2000  │     指向 ───→  │    recipeRef: "pr-001"   │  ← 轻量指针
│  system: gregtech        │              │    modifiers: [...]      │  ← 用户覆写
│  sourceLibraryId: "..."  │              │    mode: "auto"          │
└──────────────────────────┘              └──────────────────────────┘
  一处修改，全图谱自动同步                      不存 inputs/outputs 全量数据
```

| 职责 | ProjectRecipe | Canvas.nodes[].data |
|---|---|---|
| 存 inputs / outputs / baseDuration | ✓（一行一配方，去重） | ✗（只存指针） |
| 存用户级覆写（modifiers / mode 等） | ✗ | ✓ |
| 修改后所有节点自动跟随后效 | ✓（一处改，全图谱同步） | N/A（只存指针，不需改动） |
| 可被搜索 | ✓ | ✗ |
| 可被多个节点引用 | ✓（N 个节点指向同一行） | ✗ |

**跨表查询如何绕过**：打开项目时，将该项目的 `ProjectRecipe` 全量拉取到 Zustand Store，构建为 `Record<string, ProjectRecipe>` 字典。图计算管线运行时，通过 `store.recipes[node.recipeRef]` 进行 O(1) 内存读取。不需要 IndexedDB 级别的 Join。

### 3.3 Dexie 数据库定义

```typescript
// src/db/omniflowDb.ts
import Dexie, { Table } from 'dexie'

// ─── 实体类型 ───

interface Project {
  id: string
  name: string
  description: string
  tags: string[]
  settings: {
    tps: number
    default_system?: string
    default_archetype?: string
  }
  resourceRegistry: Record<string, any>   // [合并] 原 ResourceRegistry 单例
  createdAt: string
  updatedAt: string
}

// Canvas 表：主画板与子画板统一，邻接表模型
interface Canvas {
  id: string
  projectId: string                       // FK → Project.id
  parentId: string | null                 // NULL = 主画板，有值 = 子画板
  name: string

  // NoSQL 优势：nodes 和 edges 作为 JSON 数组直接存入，O(1) 读写
  nodes: Node[]                           // Node.data 只含 recipeRef + modifiers 覆写
  edges: Edge[]

  viewport: { x: number; y: number; zoom: number }
  createdAt: string
  updatedAt: string
}

// Node 内部结构（嵌入 Canvas.nodes）
interface RecipeNodeData {
  recipeRef: string                       // → ProjectRecipe.id（指针）
  mode: 'auto' | 'limit'
  manualMachines: number | null
  activeModifiers: ActiveModifier[]       // 用户挂载的修饰器
  modifierStates: Record<string, unknown>
  hardwareSpecs: Record<string, unknown>
  // 不存 inputs / outputs / durationSeconds 等全量数据
}

// 项目配方池（项目级，一行一配方）
type ProjectRecipeSource = 'import' | 'manual'

interface ProjectRecipe {
  id: string
  projectId: string                       // FK → Project.id
  recipeId: string                        // 用户定义的配方标识符
  machineName: string
  system: string
  archetypeId: string
  durationSeconds: number
  inputs: Resource[]
  outputs: Resource[]
  sourceLibraryId: string | null          // 追溯来源（外部库 ID，null = 手动创建）
  metadata: Record<string, unknown>
  source: ProjectRecipeSource
  importRecordId?: string
  createdAt: string
  updatedAt: string
}

interface Tag {
  id: string
  projectId: string
  name: string
  color: string
  createdAt: string
}

interface ImportRecord {
  id: string
  projectId: string
  sourceFormat: string                    // json / csv / omniflow_v2
  fileName: string
  fileHash: string                        // SHA-256，去重
  recipeCount: number
  successCount: number
  errorCount: number
  errors: ImportError[]
  importedAt: string
}

// ─── 数据库定义 ───

class OmniFlowDB extends Dexie {
  projects!: Table<Project, string>
  canvases!: Table<Canvas, string>
  projectRecipes!: Table<ProjectRecipe, string>
  tags!: Table<Tag, string>
  importRecords!: Table<ImportRecord, string>

  constructor() {
    super('OmniFlow')

    this.version(1).stores({
      // & = 主键, * = MultiEntry 索引, [a+b] = 复合索引
      projects: '&id, name, *tags, updatedAt, createdAt',

      // parentId 索引用于子画板树查询
      canvases: '&id, projectId, parentId, [projectId+parentId]',

      projectRecipes: [
        '&id, projectId, recipeId, machineName, system, *tags',
        'source, importRecordId',
        '[projectId+recipeId]'
      ].join(','),

      tags: '&id, projectId, [projectId+name]',
      importRecords: '&id, projectId, fileHash'
    })
  }
}

export const db = new OmniFlowDB()
```

### 3.4 索引策略

| 表 | 索引 | 用途 |
|---|---|---|
| `projectRecipes` | `projectId` | 按项目查询配方池 |
| `projectRecipes` | `recipeId` | 按配方标识搜索 |
| `projectRecipes` | `machineName` | 按机器名搜索 |
| `projectRecipes` | `system` | 按游戏系统过滤 |
| `projectRecipes` | `*tags` | 按标签过滤（MultiEntry） |
| `projectRecipes` | `source` | 区分导入/手动 |
| `projectRecipes` | `[projectId+recipeId]` | 项目内配方唯一性 |
| `canvases` | `projectId` | 项目下画板列表 |
| `canvases` | `parentId` | 子画板树查询 |

### 3.5 搜索方案

搜索只在 **ProjectRecipe** 上执行。采用分层搜索策略：

```
用户输入搜索关键词 q
  ↓
第 1 层：复合索引精确匹配
  projectRecipes.where('system').equals(q)
  projectRecipes.where('recipeId').startsWith(q)
  ↓
第 2 层：索引预过滤 + filter 后过滤
  projectRecipes.where('projectId').equals(pid)
    .and(r => matchByName(r, q))
  ↓
第 3 层：按物质 ID 搜索（inputs / outputs）
  projectRecipes.where('projectId').equals(pid)
    .and(r => r.inputs.some(i => i.id.includes(q)))
```

**性能预期**（1 万条配方）：

| 搜索类型 | 方案 | 预期耗时 |
|---|---|---|
| system 精确匹配 | 索引直达 | < 5ms |
| recipeId 前缀匹配 | `startsWith` 索引范围 | < 10ms |
| machineName 模糊包含 | 索引按 projectId 预过滤 + filter | < 30ms |
| 输入/输出物质搜索 | filter + some() | < 50ms |
| 多维组合（system + tag + 关键词） | 先取交集再用 filter | < 100ms |

> **可选增强**：若后期搜索量超过 Dexie filter 的性能阈值，可引入 [MiniSearch](https://github.com/lucaong/minisearch)（~5KB gzip）在内存中构建倒排索引，搜索延迟降至 < 5ms。

***

## 4. Project 管理

### 4.1 项目 CRUD（纯前端）

```typescript
// src/services/projectService.ts

class ProjectService {
  // 列出所有项目（按更新时间降序）
  async list(): Promise<Project[]> {
    return db.projects
      .orderBy('updatedAt')
      .reverse()
      .toArray()
  }

  // 创建项目 + 初始化根画板
  async create(name: string, description?: string): Promise<string> {
    const projectId = generateId()
    const now = toISO()

    await db.transaction('rw', db.projects, db.canvases, async () => {
      await db.projects.add({
        id: projectId,
        name,
        description: description || '',
        tags: [],
        settings: { tps: 20 },
        resourceRegistry: {},
        createdAt: now,
        updatedAt: now
      })

      await db.canvases.add({
        id: generateId(),
        projectId,
        parentId: null,
        name: '主画板',
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        createdAt: now,
        updatedAt: now
      })
    })

    return projectId
  }

  // 删除项目（级联删除所有关联数据）
  async delete(projectId: string): Promise<void> {
    const canvases = await db.canvases
      .where('projectId').equals(projectId)
      .toArray()
    const canvasIds = canvases.map(c => c.id)

    await db.transaction('rw',
      db.projects, db.canvases,
      db.projectRecipes, db.tags, db.importRecords,
      async () => {
        await db.projects.delete(projectId)
        await db.canvases.where('projectId').equals(projectId).delete()
        await db.projectRecipes.where('projectId').equals(projectId).delete()
        await db.tags.where('projectId').equals(projectId).delete()
        await db.importRecords.where('projectId').equals(projectId).delete()
      }
    )
  }
}
```

### 4.2 画板操作

```typescript
class CanvasService {
  // 增量保存 layout（nodes 仅序列化轻量节点，不含配方全量数据）
  async saveLayout(canvasId: string, nodes: unknown[], edges: unknown[]): Promise<void> {
    const now = toISO()
    await db.canvases.update(canvasId, { nodes, edges, updatedAt: now })

    const canvas = await db.canvases.get(canvasId)
    if (canvas) {
      await db.projects.update(canvas.projectId, { updatedAt: now })
    }
  }

  // 加载画板：读 layout + 拉取项目级配方池到 Zustand Store
  async loadCanvas(canvasId: string): Promise<{ canvas: Canvas; recipes: ProjectRecipe[] }> {
    const canvas = await db.canvases.get(canvasId)
    if (!canvas) throw new Error('画板不存在')

    // 配方全量数据从 ProjectRecipe 表拉取，一次加载，全局共享
    const recipes = await db.projectRecipes
      .where('projectId').equals(canvas.projectId)
      .toArray()

    return { canvas, recipes }
  }
}
```

### 4.3 前端状态树：内存级联

```
打开项目
    │
    ▼
db.projectRecipes.where('projectId').equals(id).toArray()
    │  全量拉取（几千行，毫秒级）
    ▼
Zustand recipeStore = Record<string, ProjectRecipe>
    │  构建字典
    ▼
管线运行时:
  store.recipes[node.data.recipeRef]  ← O(1) 内存读取
  → runModifierPipeline(...)
  → 计算结果写入 _computed（内存，不持久化）
```

**Zustand Store 结构**：

```typescript
interface RecipeState {
  recipes: Record<string, ProjectRecipe>  // recipeRef → 全量配方数据
  dirtyRecipeIds: Set<string>              // 修改后待持久化的配方 ID

  syncFromDB(projectId: string): Promise<void>  // 打开项目时全量加载
  updateRecipe(id: string, patch: Partial<ProjectRecipe>): void
  flushToDB(): Promise<void>               // 批量写回 IndexedDB
}
```

### 4.4 与现有 Store 的集成要点

| 操作 | 当前行为 | 改造后 |
|---|---|---|
| 打开画板 | 从 localStorage 全量加载 | 读 Canvas + 拉取 ProjectRecipe 到 recipeStore（内存字典） |
| 编辑节点位置 | 修改 canvasStore.nodes | 不变 |
| 编辑配方 | 修改 recipeStore.recipes | 内存修改 → 标记 dirtyRecipeIds → 通过 ProjectRecipe 表持久化 |
| 搜索配方 | 遍历全量数据 | 只查 `projectRecipes` 表 |
| 切换画板 | 不涉及 | 检查 dirty → flushToDB() → 加载目标画板 |
| 自动保存 | 无 | 失焦/定时（60s）/关闭前自动 flushToDB() |

***

## 5. 配方搜索

搜索只发生在 **ProjectRecipe** 表上。

### 5.1 搜索服务

```typescript
// src/services/searchService.ts

interface SearchParams {
  q?: string                      // 全文关键词
  system?: string
  machine?: string
  inputId?: string                // 按输入物质过滤
  outputId?: string               // 按输出物质过滤
  tag?: string[]
  sortBy?: 'updatedAt' | 'recipeId' | 'machineName'
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

interface SearchResult {
  total: number
  items: ProjectRecipe[]
  page: number
  pageSize: number
}

class SearchService {
  async search(
    projectId: string,
    params: SearchParams
  ): Promise<SearchResult> {
    let collection = db.projectRecipes
      .where('projectId').equals(projectId)

    if (params.system) {
      collection = collection.and(r => r.system === params.system)
    }
    if (params.machine) {
      collection = collection.and(r => r.machineName.includes(params.machine!))
    }
    if (params.tag && params.tag.length > 0) {
      collection = collection.and(r =>
        params.tag!.every(t => (r as any).tags?.includes(t))
      )
    }

    if (params.q) {
      const keyword = params.q.toLowerCase()
      collection = collection.and(r =>
        r.recipeId.toLowerCase().includes(keyword) ||
        r.machineName.toLowerCase().includes(keyword) ||
        r.system.toLowerCase().includes(keyword) ||
        r.inputs.some(i => i.id.toLowerCase().includes(keyword)) ||
        r.outputs.some(o => o.id.toLowerCase().includes(keyword))
      )
    }

    if (params.inputId) {
      collection = collection.and(r =>
        r.inputs.some(i => i.id.includes(params.inputId!))
      )
    }
    if (params.outputId) {
      collection = collection.and(r =>
        r.outputs.some(o => o.id.includes(params.outputId!))
      )
    }

    const all = await collection.toArray()

    if (params.sortBy) {
      all.sort((a, b) => {
        const field = params.sortBy!
        const va = (a as any)[field] as string
        const vb = (b as any)[field] as string
        return params.sortOrder === 'asc'
          ? va.localeCompare(vb)
          : vb.localeCompare(va)
      })
    }

    const page = params.page || 1
    const pageSize = params.pageSize || 50
    const start = (page - 1) * pageSize

    return {
      total: all.length,
      items: all.slice(start, start + pageSize),
      page,
      pageSize
    }
  }
}
```

### 5.2 搜索 UI

搜索面板只展示 ProjectRecipe 中的条目。每条结果右侧的 **[插入到画板]** 按钮触发插入流程（见第 7 章）。

```
┌───────────────────────────────────────┐
│  配方搜索                             │
│                                        │
│  [  电解  ]  [系统▼gregtech] [标签▼]    │
│                                        │
│  结果 12 条 / 第 1 页                   │
│  ┌───────────────────────────────┐     │
│  │ 电解水          gregtech 电解机│     │
│  │ 输入: fluid:water             │     │
│  │ 输出: fluid:hydrogen          │     │
│  │ 标签: 基础, 电解    [插入到画板]│     │
│  ├───────────────────────────────┤     │
│  │ 电解铝         gregtech 电解机│     │
│  │ 输入: fluid:alumina           │     │
│  │ 输出: fluid:aluminum          │     │
│  │ 标签: 电解           [插入到画板]│    │
│  └───────────────────────────────┘     │
│  < 1  2  >                             │
└───────────────────────────────────────┘
```

***

## 6. 配方导入

### 6.1 关键变化

```
v2.0（旧）：导入 → 写入 recipes 表 → 绑定 canvasId
v2.1（旧）：导入 → 写入 libraryRecipes 表 → 不绑定任何画板
v2.2（新）：导入 → 写入 projectRecipes 表 → 不绑定画板，配方 ID 哈希去重
```

导入的数据进入 **项目级 ProjectRecipe 池**，供该项目下所有画板节点通过 `recipeRef` 引用。

### 6.2 导入管线

```
用户选择文件
    ↓
格式检测: 扩展名 + 文件头签名
    ↓
┌─ 格式分发 ──────────────────┐
│ JSON_v2 → jsonParser()       │
│ JSON_v1 → migrateV1ToV2()    │
│ CSV     → csvParser()        │
│ JSON 数组 → genericParser()  │
└──────────┬───────────────────┘
           ↓
      逐条校验
           ↓
    ┌── 通过 ──→ 写入 projectRecipes（项目级，不绑定 canvas）
    │
    校验失败
    │
    └── 记录错误 → 继续下一条
           ↓
      返回导入报告
```

### 6.3 CSV 格式规范

```csv
recipe_id,system,machine_name,duration_seconds,inputs,outputs,tags
电解水,gregtech,电解机,10,"fluid:water:1000","fluid:hydrogen:2000;fluid:oxygen:1000",基础
粉碎铁矿石,gregtech,粉碎机,5,"item:iron_ore:3","item:crushed_iron:2;item:stone_dust:1",粉碎
```

- `inputs` / `outputs` 格式：`category:id:amount`，多条用 `;` 分隔。
- `tags` 格式：逗号分隔字符串。

### 6.4 校验规则

| 规则 | 错误级别 |
|---|---|
| `recipe_id` 非空 | error |
| `inputs` 非空数组 | error |
| `amount` 为正数 | error |
| `category:id` 格式合法 | error |
| `duration_seconds` 在 (0, 86400] 范围内 | error |
| 项目内 `(projectId, recipeId)` 已存在 | warning（跳过，不覆盖） |

### 6.5 导入服务

```typescript
// src/services/importService.ts

class ImportService {
  async importToProject(
    file: File,
    projectId: string
  ): Promise<ImportResult> {
    const text = await file.text()
    const format = this.detectFormat(file.name, text)

    let parsed: RawRecipe[]
    try {
      parsed = this.parse(text, format)
    } catch (e) {
      return {
        importId: generateId(),
        format,
        total: 0,
        success: 0,
        errors: [{ row: 0, message: `解析失败: ${e.message}` }],
        recipes: []
      }
    }

    // 项目内去重
    const existingIds = new Set(
      (await db.projectRecipes
        .where('projectId').equals(projectId)
        .toArray())
        .map(r => r.recipeId)
    )

    const result: ImportResult = {
      importId: generateId(),
      format,
      total: parsed.length,
      success: 0,
      errors: [],
      recipes: []
    }

    const toInsert: ProjectRecipe[] = []

    for (const [i, raw] of parsed.entries()) {
      const validation = this.validate(raw)
      if (!validation.valid) {
        result.errors.push({ row: i + 1, message: validation.message })
        result.recipes.push({ recipeId: raw.recipeId, status: 'error' })
        continue
      }

      if (existingIds.has(raw.recipeId)) {
        result.recipes.push({ recipeId: raw.recipeId, status: 'skipped' })
        continue
      }

      toInsert.push({
        id: generateId(),
        projectId,
        recipeId: raw.recipeId,
        machineName: raw.machine_name,
        system: raw.system,
        archetypeId: '',
        durationSeconds: raw.duration_seconds,
        inputs: raw.inputs,
        outputs: raw.outputs,
        sourceLibraryId: null,
        metadata: {},
        source: 'import',
        importRecordId: result.importId,
        createdAt: toISO(),
        updatedAt: toISO()
      })

      result.recipes.push({ recipeId: raw.recipeId, status: 'created' })
    }

    // 批量写入配方池
    if (toInsert.length > 0) {
      await db.projectRecipes.bulkAdd(toInsert)
    }
    result.success = toInsert.length

    await db.importRecords.add({
      id: result.importId,
      projectId,
      sourceFormat: format,
      fileName: file.name,
      fileHash: await this.sha256(text),
      recipeCount: parsed.length,
      successCount: result.success,
      errorCount: result.errors.length,
      errors: result.errors,
      importedAt: toISO()
    })

    return result
  }
}
```

### 6.6 导入后用户需要做什么

导入完成 → 数据进入 ProjectRecipe 池 → **不会自动出现在任何画板上**。用户需要：

```
1. 打开搜索面板
2. 搜索导入的配方（按 system / tags / 关键词）
3. 点击 [插入到画板]
   └→ 检查 ProjectRecipe 是否已有 → 无则写入 → 在 Canvas.nodes 中创建轻量节点
```

***

## 7. 从配方池到画板：插入与同步

### 7.1 插入流程（引用模式）

```
用户在搜索面板找到配方，点击 [插入到画板]
    │
    ▼
┌─ 第 1 步：检查 ProjectRecipe ─────────────┐
│  projectRecipes.get(recipeId)              │
│  若配方池中无此配方 → 将搜索条目写入        │
│  ProjectRecipe 表                          │
│  若已有 → 直接引用                         │
└────────────────────┬────────────────────────┘
                     │
┌─ 第 2 步：创建轻量画布节点 ────────────────┐
│  RecipeNode {                              │
│    id: "node-new"                          │
│    type: "recipeNode"                      │
│    position: 用户鼠标位置                   │
│    data: {                                 │
│      recipeRef: "pr-001"  ← 配方 ID 指针   │
│      mode: "auto"                          │
│      manualMachines: null                  │
│      activeModifiers: []                   │
│      modifierStates: {}                    │
│      hardwareSpecs: {}                     │
│      // 不存 inputs/outputs/duration       │
│    }                                       │
│  }                                         │
│  → canvas.nodes.push(newNode)              │
│  → IndexedDB.canvases.update()             │
└────────────────────┬────────────────────────┘
                     │
                     ▼
        插入完成。节点不携带全量配方数据，
        运行时通过 recipeStore.recipes[node.data.recipeRef] 获取
```

### 7.2 代码实现

```typescript
// src/services/canvasService.ts

class CanvasService {
  async insertRecipeToCanvas(
    recipeId: string,          // ProjectRecipe.id
    projectId: string,
    canvasId: string,
    position: { x: number; y: number }
  ): Promise<string> {
    // 第 1 步：确保配方池中存在
    let recipe = await db.projectRecipes.get(recipeId)
    if (!recipe) {
      throw new Error('配方池中不存在该条目，请先导入')
    }

    const nodeId = generateId()
    const now = toISO()

    // 第 2 步：创建轻量节点（只存 recipeRef）
    const newNode: unknown = {
      id: nodeId,
      type: 'recipeNode',
      position,
      data: {
        recipeRef: recipeId,
        mode: 'auto',
        manualMachines: null,
        activeModifiers: [],
        modifierStates: {},
        hardwareSpecs: {}
      }
    }

    await db.transaction('rw', db.canvases, async () => {
      const canvas = await db.canvases.get(canvasId)
      if (!canvas) throw new Error('画板不存在')

      canvas.nodes.push(newNode as any)
      canvas.updatedAt = now
      await db.canvases.put(canvas)
    })

    return nodeId
  }

  // 从配方库同步（用户点击 [从配方库同步] 时触发）
  //
  // 因为节点只存 recipeRef 指针，同步只需更新 ProjectRecipe 表的一行。
  // 画板节点不需要任何改动——指针没变，数据自动跟随后效。
  async syncFromLibrary(recipeId: string, sourceId: string): Promise<void> {
    const library = await db.projectRecipes.get(sourceId)
    if (!library) return

    const local = await db.projectRecipes.get(recipeId)
    if (!local) return

    // 仅同步基础字段，保留用户自定义的修饰器（存在 node.data 中，不受影响）
    await db.projectRecipes.update(recipeId, {
      recipeId: library.recipeId,
      machineName: library.machineName,
      system: library.system,
      archetypeId: library.archetypeId,
      durationSeconds: library.durationSeconds,
      inputs: JSON.parse(JSON.stringify(library.inputs)),
      outputs: JSON.parse(JSON.stringify(library.outputs)),
      sourceLibraryId: sourceId,
      updatedAt: toISO()
    })

    // Canvas.nodes 完全不动——recipeRef 不变，数据自动跟随后效
    // node.data.activeModifiers / modifierStates / hardwareSpecs —— 属于节点覆写，不受影响
  }
}
```

### 7.3 与旧方案对比

| 维度 | 旧方案（v2.1 CanvasSnapshot） | 新方案（v2.2 引用模式） |
|---|---|---|
| 插入时创建 | 独立的 snapshot 行 + 画布节点 | 只创建画布节点（recipeRef 指针） |
| 配方全量数据存哪 | CanvasSnapshot 表（每画板每节点一份） | ProjectRecipe 表（项目唯一一份） |
| 50 个节点引用同一配方 | 50 份数据副本 | 50 个指针指向同一行 |
| 修改配方 inputs | 需遍历更新 50 个 snapshot | 更新 ProjectRecipe 一行，自动生效 |
| 从配方库同步 | 更新 snapshot 行 | 更新 ProjectRecipe 行，Canvas 不动 |

### 7.4 运行时数据流

```
渲染 RecipeNode
    │
    从 node.data.recipeRef 拿到指针
    │
    从 Zustand recipeStore.recipes[recipeRef] 读取配方全量数据  ← O(1) 内存
    │
    合并 node.data 中的用户覆写（modifiers / mode 等）
    │
    → 传给修饰器管线执行 runModifierPipeline()
    → 计算结果写在 _computed 字段（内存，不持久化）
```

画板打开时加载流程：

```
loadCanvas(canvasId)
    ├── 读 Canvas（nodes/edges，轻量，不含配方全量数据）
    ├── 拉取 projectRecipes WHERE projectId 到 Zustand recipeStore
    └── 渲染时：node.data.recipeRef → recipeStore.recipes[ref]
```

### 7.5 冲突解决策略

当用户点击 [从配方库同步] 时，目标不是画板节点，而是 **ProjectRecipe 表的一行**。

**核心规则：仅同步基础数据，绝对保留用户自定义。**

| 字段分类 | 同步至 ProjectRecipe | 理由 |
|---|---|---|
| **基础输入/输出** `inputs` / `outputs` | ✓ 覆盖 | 配方库是物质流的唯一真理源 |
| **基础耗时** `durationSeconds` | ✓ 覆盖 | 机器基准耗时由配方定义 |
| **元数据** `recipeId` / `machineName` / `system` / `archetypeId` | ✓ 覆盖 | 标识信息跟随配方库 |
| **修饰器** `activeModifiers` / `modifierStates` | ✗（存在 node.data 中，不存 ProjectRecipe） | 用户挂载的修饰器是节点级覆写 |
| **运行模式** `mode` / `manualMachines` | ✗（存在 node.data 中） | 用户选择是节点级覆写 |
| **硬件规格** `hardwareSpecs` | ✗（存在 node.data 中） | 用户配置是节点级覆写 |

同步完成后：ProjectRecipe 表对应行的 `updatedAt` 更新，`sourceLibraryId` 更新为引用源。
**Canvas.nodes 完全不动**——所有节点的 `recipeRef` 指针没变，运行时自动读取到更新后的配方数据。

***

## 8. 子画板

### 8.1 数据模型

子画板与主画板共用同一张 `Canvas` 表，通过 `parentId` 字段（邻接表模型）建立层级关系。

```
Canvas (父：主产线)
  id: "canvas-root"
  parentId: null
  ├── nodes: [RecipeNode, SubCanvasNode, ...]
  │     │
  │     └── RecipeNode.data.recipeRef → ProjectRecipe
  │
  └── Canvas (子：电力供应)
        id: "canvas-sub-001"
        parentId: "canvas-root"
        ├── nodes: [...子画板自己的节点]
        └── ProjectRecipe 池为项目级共享
```

### 8.2 前端组件

**SubCanvasNode**（React Flow 自定义节点类型）：

- 在父画板中以缩略卡片展示。
- 双击展开进入子画板。
- 子画板的边界端口自动暴露为 SubCanvasNode 的端口，用于父画板的物料连线。

**导航面包屑**：

```
[Project: 我的工厂] > [Canvas: 主产线] > [Sub: 电力供应]
```

### 8.3 操作接口

```typescript
class CanvasService {
  async createSubCanvas(params: {
    projectId: string
    parentId: string
    name: string
    position: { x: number; y: number }
  }): Promise<string> {
    const canvasId = generateId()
    const now = toISO()

    // 子画板与主画板结构相同，仅 parentId 不同
    await db.canvases.add({
      id: canvasId,
      projectId: params.projectId,
      parentId: params.parentId,
      name: params.name,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: now,
      updatedAt: now
    })

    return canvasId
  }

  async deleteCanvas(canvasId: string): Promise<void> {
    const canvas = await db.canvases.get(canvasId)
    if (!canvas) return

    // 递归查找并删除所有子画板
    const children = await db.canvases
      .where('parentId').equals(canvasId)
      .toArray()

    await db.transaction('rw', db.canvases, async () => {
      for (const child of children) {
        await this.deleteCanvas(child.id)
      }
      await db.canvases.delete(canvasId)
    })
  }

  // 获取子画板列表
  async getChildren(parentId: string): Promise<Canvas[]> {
    return db.canvases
      .where('parentId').equals(parentId)
      .toArray()
  }
}
```

***

## 9. 数据迁移

### 9.1 迁移路径

```
localStorage (JSON v2)
    │
    ▼
IndexedDB (Project + Canvas + ProjectRecipe)
```

### 9.2 迁移步骤

```typescript
// src/core/migration/localStorageToIDB.ts

async function migrateFromLocalStorage(): Promise<MigrationReport> {
  const report: MigrationReport = { success: false, recipeCount: 0, errors: [] }

  try {
    const raw = localStorage.getItem('omniflow.canvas.v1')
    if (!raw) { report.errors.push('无画板数据'); return report }

    const payload = JSON.parse(raw)
    const now = toISO()

    // 创建 Project
    const projectId = generateId()
    await db.projects.add({
      id: projectId,
      name: '我的项目',
      description: '',
      tags: [],
      settings: { tps: 20 },
      resourceRegistry: {},
      createdAt: now, updatedAt: now
    })

    // 创建根画板
    const canvasId = generateId()
    const origNodes = payload.ui?.nodes || payload.nodes || []
    const edges = payload.ui?.edges || payload.edges || []
    const recipesRaw = payload.domain?.recipes || {}

    await db.canvases.add({
      id: canvasId, projectId, parentId: null,
      name: '主画板',
      nodes: origNodes, edges,
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: now, updatedAt: now
    })

    // 旧数据中的配方 → 提取全量数据写入 ProjectRecipe，节点中改为 recipeRef 指针
    const projectRecipes: ProjectRecipe[] = []
    const seenRecipeIds = new Map<string, string>() // recipe_id → ProjectRecipe.id

    for (const [nodeId, data] of Object.entries(recipesRaw)) {
      const d = data as any
      const recipeId = d.recipe_id || ''

      // 去重：同一配方 ID 只写一行 ProjectRecipe
      let recipeRef: string
      if (seenRecipeIds.has(recipeId)) {
        recipeRef = seenRecipeIds.get(recipeId)!
      } else {
        recipeRef = generateId()
        seenRecipeIds.set(recipeId, recipeRef)

        projectRecipes.push({
          id: recipeRef, projectId,
          recipeId,
          machineName: d.machine_name || '',
          system: d.system || '',
          archetypeId: d.archetype_id || '',
          durationSeconds: d.duration_seconds ?? 1.0,
          inputs: d.inputs || [],
          outputs: d.outputs || [],
          sourceLibraryId: null,
          metadata: d.metadata || {},
          source: 'import',
          createdAt: now, updatedAt: now
        })
      }
    }

    // 更新 origNodes 中每个 RecipeNode 的 data：剔除全量数据，改为 recipeRef 指针 + 用户覆写
    const migratedNodes = origNodes.map((node: any) => {
      if (node.type !== 'recipeNode') return node
      const oldData = recipesRaw[node.id]
      if (!oldData) return node

      const d = oldData as any
      const recipeRef = seenRecipeIds.get(d.recipe_id || '')

      return {
        ...node,
        data: {
          recipeRef,
          mode: d.mode || 'auto',
          manualMachines: d.manual_machines ?? null,
          activeModifiers: d.active_modifiers || [],
          modifierStates: d.modifier_states || {},
          hardwareSpecs: d.hardware_specs || {}
          // inputs / outputs / durationSeconds / machineName 等已提取到 ProjectRecipe
        }
      }
    })

    // 写回迁移后的轻量 nodes
    await db.canvases.update(canvasId, { nodes: migratedNodes })

    report.recipeCount = projectRecipes.length
    if (projectRecipes.length > 0) {
      await db.projectRecipes.bulkAdd(projectRecipes)
    }

    // 标记迁移完成
    localStorage.setItem('omniflow.migration_v3', JSON.stringify({
      completedAt: now, projectId, canvasId
    }))

    report.projectId = projectId
    report.canvasId = canvasId
    report.success = true
    return report

  } catch (e: any) {
    report.errors.push(e.message || '迁移过程出错')
    return report
  }
}
```

### 9.3 迁移触发

| 场景 | 行为 |
|---|---|
| 首次打开新版 | 自动检测 `omniflow.canvas.v1` → 弹出迁移提示 |
| 用户确认迁移 | 执行 `migrateFromLocalStorage()` → 生成 Project + Canvas + ProjectRecipe，节点数据剔除为 recipeRef |
| 用户暂不迁移 | 仍以 localStorage 模式工作，下次打开再次提示 |
| 已迁移过的 | 检测 `omniflow.migration_v3` → 跳过 |

### 9.4 回退机制

- 迁移**不会删除** localStorage 数据。
- 用户可通过"设置 → 从 localStorage 恢复"手动回退。
- 旧版数据在迁移完成后保留 30 天，之后在 UI 中提示清理。

***

## 10. 性能优化

### 10.1 Dexie 写入优化

| 手段 | 说明 |
|---|---|
| `bulkAdd()` / `bulkPut()` | 批量操作单次事务 |
| 事务显式声明 | `db.transaction('rw', ...)` 明确 scope |
| 防抖保存 | 编辑操作不立即写 IndexedDB，通过 5s 防抖或 `beforeunload` 触发 |
| 增量写入 | `canvases.update(id, { nodes })` 而非全量覆盖 |

### 10.2 画板加载优化

| 手段 | 说明 | 效果 |
|---|---|---|
| 节点轻量化 | `nodes` 中只存 `recipeRef` 指针 + 覆写 | 300 节点的 Canvas ~40KB（原 ~500KB） |
| 配方池一次性加载 | 打开项目时拉取 projectRecipes 到内存字典 | 画板操作完全不访问 DB |
| 分页渲染 | 搜索面板结果分页 50 条 | 避免 DOM 节点过多 |

### 10.3 搜索优化

| 场景 | 方案 | 预期耗时 |
|---|---|---|
| system + tag 组合过滤 | 索引预过滤 + filter | < 20ms |
| 物质 ID 搜索 | filter + some() | < 50ms（1 万条） |
| 纯关键词搜索 | 全 filter + includes() | < 80ms（1 万条） |

### 10.4 存储用量估算

| 类型 | 单条大小 | 典型量 | 总量 |
|---|---|---|---|
| Project | ~1KB | 10 个 | ~10KB |
| Canvas（300 轻量节点 + 400 edge） | ~40KB | 15 个 | ~600KB |
| ProjectRecipe | ~2KB | 5000 条 | ~10MB |
| Tag | ~0.1KB | 100 个 | ~10KB |
| ImportRecord | ~0.5KB | 50 条 | ~25KB |
| **总计** | | | **~10.6MB** |

IndexedDB 的浏览器配额通常 > 1GB，预期数据量完全在范围内。

配方池（10MB）是主要占用，但打开项目时一次加载到内存后，画板操作不再访问 DB。节点轻量化使 Canvas 体积从 ~100KB 压缩至 ~40KB。

***

## 11. 安全性与边界

### 11.1 IndexedDB 数据隔离

| 维度 | 说明 |
|---|---|
| 同源策略 | IndexedDB 按 origin 隔离，不同域名的页面无法互相访问 |
| 清除风险 | 用户可通过浏览器 DevTools 或清除站点数据手动删除 |
| 备份建议 | 提供"导出 Project"按钮，导出为 JSON 文件 |

### 11.2 IndexedDB 限制

| 限制 | 处理 |
|---|---|
| 浏览器清除存储 | UI 底部提示"数据存储在本地浏览器" |
| Safari 7 天淘汰 | Safari 可能清除 IndexedDB。调用 `navigator.storage.persist()` 请求持久存储 |
| 配额超限 | 捕获 `QuotaExceededError`，提示清理或导出 |

### 11.3 并发控制

IndexedDB 的事务模型天然支持读写隔离：

- `readonly` 事务可并发。
- `readwrite` 事务串行排队。

```typescript
// 多 tab 通信
window.addEventListener('storage', (e) => {
  if (e.key === 'omniflow:db_updated') {
    // 提示用户刷新
  }
})

await db.projects.update(id, data)
localStorage.setItem('omniflow:db_updated', Date.now().toString())
```

### 11.4 数据完整性

| 机制 | 说明 |
|---|---|
| Schema 版本化 | Dexie `version()` 支持 schema 升级 |
| 事务原子性 | 插入配方到画板时，ProjectRecipe 写入与 Canvas 节点更新在同一个事务中 |
| 指针一致性 | 节点只存 `recipeRef`，配方全量数据唯一存在于 ProjectRecipe 行。删除节点不影响配方数据 |

***

## 12. 与后端的关系

### 12.1 架构边界

| 层 | 职责 | 技术 |
|---|---|---|
| 前端存储 | Project / Canvas / ProjectRecipe CRUD | IndexedDB + Dexie.js |
| 前端计算 | 修饰器管线 + 拓扑编译 + Payload 构建 | 现有 TypeScript |
| 前端 UI | 画板编辑器 + 搜索 + 导入 + 子画板 | React + Zustand |
| 后端 | 仅接收 Payload，返回 LP 求解结果 | FastAPI + SciPy |

### 12.2 API 变更

| 变更 | 说明 |
|---|---|
| `/api/calculate` | 不变 |
| `/api/debug` | 不变 |
| **后端不引入任何存储 API** | 新增的服务层（ProjectRecipe / Import）全部在前端 |

***

## 13. 文件结构变更

### 13.1 前端新增文件

按垂直切片阶段标注归属，每个阶段交付时同步完成 Service + Store + UI。

```
src/
├── db/
│   ├── omniflowDb.ts           # P0: Dexie 数据库定义（5 张表，含子画板 parentId schema）
│   └── migrations.ts           # P0: 数据库版本迁移
├── services/
│   ├── projectService.ts       # P0: Project CRUD
│   ├── canvasService.ts        # P0: Canvas CRUD（layout 保存）；P4 扩展子画板 CRUD
│   ├── projectRecipeService.ts # P1: ProjectRecipe CRUD
│   ├── searchService.ts        # P1: 配方搜索（限定在 projectRecipes）
│   └── importService.ts        # P3: 多格式导入 → projectRecipes
├── stores/
│   ├── projectStore.ts         # P0: Project 状态管理
│   ├── canvasStore.ts          # P0: 修改: IndexedDB 同步 + isDirty；P4 扩展子画板状态
│   ├── recipeStore.ts          # P2: 配方池内存字典 + 节点覆写合并
│   └── searchStore.ts          # P1: 搜索状态；P3 扩展导入状态
├── components/
│   ├── ProjectList.tsx         # P0: 极简项目列表（创建/切换/删除）
│   ├── RecipeSearchPanel.tsx   # P1: 极简搜索面板；P5 精化
│   ├── SyncButton.tsx          # P2: [从配方库同步] 按钮
│   ├── RecipeImportDialog.tsx  # P3: 极简导入对话框；P5 精化
│   ├── SubCanvasNode.tsx       # P4: 子画板节点组件
│   ├── BreadcrumbNav.tsx       # P4: 面包屑导航
│   ├── ProjectSettings.tsx     # P5: 项目设置面板（正式 UI）
│   └── ...                     # P5: 其余正式 UI 替换极简版
├── core/
│   └── migration/
│       └── localStorageToIDB.ts # P6: 迁移脚本
└── types/
    ├── project.ts              # P0: Project / Canvas 类型（含 parentId）
    └── projectRecipe.ts        # P1: ProjectRecipe 类型
```

### 13.2 后端变更

**无变更**。后端保持纯计算服务，不引入任何数据存储相关代码。

***

## 14. 实施路径

### 14.1 阶段划分（垂直切片）

每个阶段交付 **Service + Store + 极简 UI** 的完整垂直切片，确保 DB → Store → 组件链路始终畅通。

| 阶段 | 周期 | Service 层 | Store 层 | 极简 UI |
|---|---|---|---|---|
| **P0: 基础设施** | 第 1-2 周 | `projectService` + `canvasService`；Dexie 5 张表 schema（含子画板 `parentId` 邻接表递归嵌套结构） | `projectStore` | 项目列表页（创建/切换/删除项目） |
| **P1: 配方池 + 搜索** | 第 3-4 周 | `projectRecipeService` + `searchService` | `searchStore` | 搜索面板（按 system/tag/关键词过滤 ProjectRecipe） |
| **P2: 引用模式 + 同步** | 第 5-6 周 | `canvasService.insertRecipeToCanvas`（recipeRef 指针 + 节点覆写）+ `syncFromLibrary`（冲突解决策略） | `recipeStore`（Pool 字典 + recipeRef 级联） | 插入按钮 + [从配方库同步] 按钮 |
| **P3: 导入** | 第 7-8 周 | `importService`（CSV/JSON 解析 + 校验 + 去重，写入 projectRecipes） | `searchStore` 扩展 | 导入对话框（文件选择 + 进度 + 错误报告） |
| **P4: 子画板** | 第 9-10 周 | `canvasService` 扩展（子画板 CRUD，schema 已在 P0 就绪） | `canvasStore` 扩展 | `SubCanvasNode` 组件 + 面包屑导航 |
| **P5: UI 精化** | 第 11 周 | 无新增 | 无新增 | 正式 UI 替换极简版（样式、交互、响应式） |
| **P6: 迁移 + 测试** | 第 12 周 | `migrationService` | 无新增 | 迁移提示弹窗 |

**垂直切片原则**：每个阶段结束时，对应功能的数据链路必须可验证。UI 可以简陋，但 `DB → Store → 组件` 必须通。

### 14.2 依赖关系

```
P0（Dexie + schema + projectStore + 极简项目列表）
  ├── P1（配方池 + searchStore + 极简搜索）
  │     └── P3（导入 + searchStore 扩展 + 导入对话框）
  └── P2（引用模式 + recipeStore Pool 字典 + 极简插入/同步）
        └── P4（子画板 + canvasStore 扩展 + SubCanvasNode）
              └── P5（UI 精化）
                    └── P6（迁移 + 测试）
```

P0 的 schema 设计包含子画板邻接表结构（`parentId`），P4 不再需要修改底层 schema。

### 14.3 风险矩阵

| 风险 | 概率 | 缓解 |
|---|---|---|
| Safari 清除 IndexedDB | 中 | `navigator.storage.persist()` + UI 提示 |
| 配方库万级搜索 > 100ms | 低 | 引入 MiniSearch 做内存倒排索引 |
| 用户多 tab 编辑同一画板 | 低 | localStorage 事件通信提示刷新 |

***

## 15. 前端新增依赖

```json
{
  "dependencies": {
    "dexie": "^4.4.0"
  },
  "devDependencies": {
    "fake-indexeddb": "^6.0.0"
  }
}
```

| 包 | 用途 |
|---|---|
| `dexie` | IndexedDB 封装。~25KB gzip |
| `fake-indexeddb` | 测试 mock，避免 CI 中缺少 `indexedDB` 全局对象 |

***

*OmniFlow 第二阶段技术方案 · v2.3（引用模式 + 邻接表 + 5 表 Schema 重构）*