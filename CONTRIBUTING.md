# 参与贡献 ComputeFlow

首先，非常感谢你对 ComputeFlow 感兴趣！ComputeFlow 致力于为硬核游戏整合包（如 GregTech、GTNH 等）提供最优雅、最高效的复杂产线矩阵求解体验。

我们非常欢迎社区的贡献，无论是修复 Bug、增加新模组的配方支持、优化前端交互，还是提升后端的求解算法性能。这份指南将帮助你快速了解项目的协作流程与开发规范。

---

## 目录

1. [报告 Bug 与建议](#报告-bug-与建议)
2. [本地开发环境配置](#本地开发环境配置)
3. [核心架构与开发规范](#核心架构与开发规范)
4. [提交代码规范 (Commit Message)](#提交代码规范)
5. [Pull Request 流程](#pull-request-流程)

---

## 报告 Bug 与建议

如果你发现了计算错误、UI 渲染异常，或者有绝妙的新功能想法，请通过 GitHub Issues 提交。

**提交 Bug 时，请尽量提供以下信息：**

* 触发 Bug 的具体环境（浏览器版本、所使用的游戏配方）。
* 复现步骤（最好能附带导出的 `nodes` & `edges` JSON 文件）。
* 期望的计算结果 vs 实际的计算结果。

---

## 本地开发环境配置

本项目采用前后端分离架构，你需要分别启动两个服务。

### 1. 前端 (Frontend)

前端使用 React + TypeScript + React Flow + Vite 构建。

```bash
cd frontend
# 安装依赖 (推荐使用 npm 或 pnpm)
npm install
# 启动本地开发服务器 (默认端口: 5173)
npm run dev
```

### 2. 后端 (Backend)

后端核心求解器使用 Python + FastAPI + Pydantic 构建。

```bash
cd backend
# 建议创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
# 安装依赖
pip install -r requirements.txt
# 启动 FastAPI 服务 (默认端口: 8000)
uvicorn main:app --reload
```

后端启动后，可访问 `http://localhost:8000/docs` 查看并测试 API 契约文档。

---

## 核心架构与开发规范

为了保持代码库的优雅和高性能，请在开发时遵循以下架构原则：

### 🎨 前端规范 (UI & Nodes)

* **多态渲染 (Polymorphic UI):** 我们支持多模组的配方。如果你要添加新机器类型的 UI，请基于 `data.system` 字段（如 `gregtech`, `vanilla`, `enderio`）进行条件渲染，**不要**将特定模组的属性（如电压、超频）强加于所有节点。
* **分离状态与渲染:** 画布的节点状态受 React Flow 接管，不要直接修改 DOM。
* **样式:** 使用 Tailwind CSS 保持深色、极简的工业控制台风格。端口（Handles）请根据物品类型进行一致的颜色编码（Color Coding）。

### ⚙️ 后端规范 (Solver & Matrix)

* **无状态计算 (Stateless Backend):** 后端必须保持无状态！**严禁**在后端引入数据库或保存任何配方状态。后端的职责仅为：接收前端传来的含完整参数的拓扑图 -> 构建化学计量矩阵 -> 调用算法求解 -> 返回机器数量和功耗。
* **数据契约:** 任何对请求体或响应体的修改，必须在 Pydantic Model (`main.py`) 和前端的 TypeScript Interface (`types.ts`) 中同步更新。

---

## 提交代码规范

我们遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范，这有助于自动生成清晰的 Changelog。提交格式如下：

`<type>(<scope>): <subject>`

**常用的 type：**
* `feat`: 新增功能 (Feature)
* `fix`: 修复 Bug
* `docs`: 文档修改 (如 README, CONTRIBUTING)
* `style`: 代码格式化 (不影响代码运行的变动)
* `refactor`: 重构代码 (既没有新增功能，也没有修复 Bug)
* `perf`: 性能优化
* `test`: 增加测试用例
* `chore`: 构建过程或辅助工具的变动

**示例：**
* `feat(ui): 增加源节点的最大供应速率输入框`
* `fix(solver): 修复包含零耗时原版配方时的除零异常`
* `refactor(nodes): 将机器元数据抽离为 metadata 对象`

---

## Pull Request 流程

1. **Fork** 本仓库到你的 GitHub 账号下。
2. 从 `main` 分支拉取最新的代码。
3. 创建一个新的特性分支进行开发：`git checkout -b feature/your-awesome-feature` 或 `fix/issue-number`。
4. 在本地进行测试，确保前后端联调无误。
5. 提交你的更改 (遵循 Commit 规范)。
6. 推送分支到你的 Fork 仓库：`git push origin feature/your-awesome-feature`。
7. 在 GitHub 页面点击 **New Pull Request**。
8. 详细填写 PR 描述，说明你的改动动机、实现思路以及是否有不向下兼容的 API 变动。

我们将尽快 Review 你的代码，并与你探讨可能的优化方案。再次感谢你让 ComputeFlow 变得更好！