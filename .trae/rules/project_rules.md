# OmniFlow 项目规则

## 项目简介

OmniFlow 是一个专为硬核自动化游戏（如《我的世界》格雷科技、异星工厂等）设计的可视化产线矩阵求解器。它将 React Flow 节点编辑器与 SciPy 线性规划矩阵求解相结合，提供所见即所得的产线解算体验。

## 技术栈

### 前端
- React 19 + TypeScript 6.0
- React Flow 11（节点图表渲染）
- Vite 8（构建工具）
- 纯 CSS（深色工业风主题，无 Tailwind）

### 后端
- Python 3.10+
- FastAPI
- Pydantic（数据契约校验）
- SciPy / NumPy（线性规划矩阵求解）

## 常用命令

### 前端

```bash
# 安装依赖
npm install

# 启动开发服务器（默认端口 5173）
npm run dev

# 构建生产版本
npm run build

# 代码检查
npm run lint

# 预览生产构建
npm run preview
```

### 后端

```bash
cd backend

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境（Windows）
venv\Scripts\activate

# 安装依赖
pip install fastapi uvicorn numpy scipy pydantic

# 启动后端服务（默认端口 8000）
uvicorn main:app --reload
```

后端启动后访问 `http://localhost:8000/docs` 查看 Swagger API 文档。

## 项目结构

```
OmniFlow/
├── src/                        # 前端源码
│   ├── App.tsx                 # 主应用组件，React Flow 画布
│   ├── main.tsx                # 入口文件
│   ├── index.css               # 全局样式
│   ├── flowConfig.ts           # React Flow 节点类型注册
│   ├── components/             # UI 组件
│   │   ├── RecipeNode.tsx      # 配方节点
│   │   ├── SourceNode.tsx      # 输入源节点
│   │   ├── TargetNode.tsx      # 目标节点
│   │   ├── RecipeEditorModal.tsx  # 配方编辑弹窗
│   │   ├── EndpointEditorModal.tsx # 端点编辑弹窗
│   │   ├── SystemHUD.tsx       # 系统状态 HUD
│   │   ├── MenuBar.tsx         # 菜单栏
│   │   └── SegmentedControl.tsx  # 分段控制器
│   ├── hooks/                  # 自定义 Hooks
│   │   ├── useCanvasState.ts   # 画布节点/边状态管理
│   │   ├── useCanvasOperations.ts # 画布操作（添加/删除节点等）
│   │   ├── useCalculation.ts   # 后端计算请求
│   │   ├── useClipboard.ts     # 剪贴板操作
│   │   ├── useFileIO.ts        # 文件导入导出
│   │   ├── useKeyboardShortcuts.ts # 键盘快捷键
│   │   ├── useNodeEditor.ts    # 节点编辑器
│   │   ├── useNodeOperations.ts # 节点数据操作
│   │   ├── useUndoRedo.ts      # 撤销/重做
│   │   └── useTheme.ts         # 主题切换
│   ├── domain/canvas/          # 画布领域逻辑
│   │   ├── initialState.ts     # 初始状态
│   │   └── validators.ts       # 数据校验/规范化
│   ├── data/archetypes/        # 预制配方模板
│   ├── types/                  # TypeScript 类型定义
│   │   ├── recipe.ts           # 配方类型
│   │   ├── api.ts              # API 请求/响应类型
│   │   └── types.ts            # 通用类型
│   ├── modifiers/              # 修饰器/计算
│   │   ├── calculate.ts        # 计算逻辑
│   │   └── registry.ts         # 注册表
│   └── utils/                  # 工具函数
│       └── topologicalNets.ts  # 拓扑网络分析
├── backend/                    # 后端源码
│   └── main.py                 # FastAPI 应用 + SciPy LP 求解器
├── public/                     # 静态资源
├── .github/agents/             # GitHub Copilot Agent 配置
├── vite.config.ts              # Vite 配置
├── tsconfig.json               # TypeScript 根配置
├── tsconfig.app.json           # 前端 TS 配置
├── tsconfig.node.json          # Node 端 TS 配置
├── eslint.config.js            # ESLint 扁平配置
└── package.json
```

## 架构原则

### 前端
- **多态渲染**：根据 `data.system` 字段（如 `gregtech`, `vanilla`, `enderio`）动态渲染不同模组的 UI。模组特定属性放在 `metadata` 对象中。
- **状态管理**：画布状态完全由 React Flow 接管，不直接操作 DOM。
- **深色工业风**：所有 UI 保持深色、极简的工业控制台风格。
- **节点类型**：`recipeNode`（配方节点）、`sourceNode`（输入源）、`targetNode`（目标节点）

### 后端
- **无状态计算**：后端不存储任何配方或状态，仅接收完整的 NodeData 进行计算并返回结果。
- **数据契约同步**：Pydantic Model（`main.py`）和 TypeScript Interface（`types/`）中的类型必须保持同步。
- **速率公式**：Rate (/s) = amount / (duration_ticks / 20)，duration_ticks 为 0 时需守卫处理。
- **化学计量矩阵**：列 = 配方，行 = 物品；产出为正，消耗为负；求解 Ax >= b 允许副产物溢出。

## 代码规范

### 通用
- 不添加不必要的注释，代码应自解释
- 遵循 Conventional Commits 提交规范：`<type>(<scope>): <subject>`
- 常用 type：`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

### TypeScript
- 严格使用 TypeScript，遵守 `tsconfig.json` 中的 `noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch` 等规则
- 类型定义统一在 `src/types/` 目录下管理
- 前端和后端接口类型必须同步更新

### React
- 自定义 Hook 统一放在 `src/hooks/` 目录，文件名以 `use` 开头
- 组件使用函数组件 + Hooks 模式
- CSS 文件与对应组件放在同一目录

### Python
- 使用 Pydantic 进行数据校验
- 类型注解使用 Python 3.10+ 语法（如 `list[float]` 而非 `List[float]`，`dict[str, Any]` 等）
- 后端必须保持无状态，不能引入数据库或持久化

## 开发注意事项

- 前端开发服务器运行在 `http://localhost:5173`
- 后端 API 运行在 `http://localhost:8000`，计算接口为 `POST /api/calculate`
- 后端 CORS 已配置允许 `localhost:5173` 的跨域请求
- `backend/` 目录下尚无 `requirements.txt`，依赖为 `fastapi`, `uvicorn`, `numpy`, `scipy`, `pydantic`
- 画布数据通过 `localStorage` 持久化，key 为 `omniflow.canvas.v1`
