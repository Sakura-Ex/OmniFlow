# 参与贡献 OmniFlow

[English](../CONTRIBUTING.md) | 中文

感谢你对 OmniFlow 的关注！OmniFlow 致力于成为下一代泛用型（Game-Agnostic）工业排程求解器。无论你是想修复一个 Bug、增加一个硬核模组的修饰器逻辑，还是优化底层的单纯形矩阵算法，我们都极其欢迎你的加入。

在提交 Pull Request (PR) 之前，请务必阅读以下架构指南与开发规范。

## 🧠 核心架构哲学

OmniFlow 的底层设计遵循极度严格的物理与数学解耦。在动手编写代码之前，请确保你理解以下三大基石：

1. **Game-Agnostic（游戏无关性）**：
   系统不认识《我的世界》、《异星工厂》或《戴森球计划》。万物皆通过配置化的 `Global Resource Registry`（全局资源字典）映射。**严禁在核心渲染或计算管线中硬编码任何特定模组的资源 ID 或物理逻辑。**
2. **Nature vs. Context（本体与上下文的正交解耦）**：
   * `Registry` 只负责定义资源的“本体”（基础物理单位、UI 颜色）。
   * 机器与配方的 `Slot/Port` 负责定义资源的“用法”（计算模式、是否为只读催化剂、耐久期望）。
3. **Math-First（纯数学预编译）**：
   前端的 `Payload Compiler` 承载所有复杂的业务逻辑（超频、无损并行、耐久度换算），将其降维归一化为纯净的“每秒速率（Rate/s）”。后端的 SciPy 求解器是一个“瞎子”，它只负责全速求解矩阵 $Ax = b$。

---

## 🛠️ 目录结构指引 (修改哪里)

如果你想添加新内容，请严格遵守现有的领域驱动目录结构：

* **想添加新的全局资源类型？**
  👉 修改 `src/registry/defaults.ts`（例如新增 `factorio:watt`）。
* **想添加新的机器底盘逻辑？**
  👉 在 `src/data/archetypes/` 目录下创建新的底盘定义，并在 `index.ts` 中注册。
* **想添加某模组独有的超频/榨汁机制？**
  👉 在 `src/modifiers/` 目录下创建全新的修饰器逻辑，必须遵守 5-phase pipeline 规范，绝不能污染其他作用域。
* **想优化图扑分析或隐式全局路由？**
  👉 集中修改 `src/utils/topologicalNets.ts`。
* **想优化矩阵求解性能？**
  👉 你的战场在 `backend/main.py`。

---

## 💻 本地开发环境配置

本项目采用前后端分离的 Monorepo 架构。

### 前端环境 (Vite + React + Zustand)
1. 确保安装了 Node.js (推荐 v18+) 和包管理器 (推荐 `pnpm`)。
2. 进入根目录：
   ```bash
   pnpm install
   pnpm run dev
   ```

### 后端环境 (FastAPI + SciPy)
1. 确保安装了 Python 3.10+。
2. 进入 `backend` 目录，创建并激活虚拟环境：
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Windows 用户使用 venv\Scripts\activate
   ```
3. 安装依赖并启动服务：
   ```bash
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

---

## 📝 代码规范

* **TypeScript**：
  * 开启 Strict 模式。**禁止使用 `any`**，对于未知类型请使用 `unknown` 或定义具体的 Interface。
  * 涉及到状态流转的地方，优先使用 Zustand，避免 React Context 的重渲染灾难。
* **Python**：
  * 遵循 PEP 8 规范。
  * 必须使用类型提示（Type Hinting）配合 Pydantic 进行数据校验。
* **样式 (CSS)**：
  * 全局样式统一收束于 `index.css`。
  * 组件级样式推荐使用 Tailwind CSS 实用类，保持深色工业风（Dark Industrial）的视觉统一。

---

## 🌿 Git 工作流

1. **Fork 本仓库** 并 Clone 到本地。
2. **创建分支**：基于 `main` 分支创建一个特性分支。
   * 特性开发：`feat/add-create-mod-archetype`
   * 修复 Bug：`fix/matrix-solver-division-by-zero`
   * 文档更新：`docs/update-readme`
3. **提交规范**：
   提交信息必须清晰明了，格式如下：
   * `feat: 增加对概率性输出修饰器的支持`
   * `fix(modifier): 修复超频计算时未剔除无消耗催化剂的 bug`
   * `refactor(pipeline): 优化预编译管线的降维逻辑`
4. **提交 Pull Request**：
   * 在 PR 描述中清晰说明你解决了什么问题。
   * 如果是 UI 变更，请附带截图。
   * 如果修改了核心计算管线（`calculate.ts` 或 `main.py`），请说明你测试过的边界情况（Edge Cases）。

> *"The factory must grow, and the math must flow."* > 期待你的代码，让我们共同构建最强韧的工业统筹引擎！
