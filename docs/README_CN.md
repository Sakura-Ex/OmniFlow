# OmniFlow

[English](../README.md) | 简体中文

[![CI](https://github.com/Sakura-Ex/OmniFlow/actions/workflows/ci.yml/badge.svg)](https://github.com/Sakura-Ex/OmniFlow/actions/workflows/ci.yml)

OmniFlow 是一个可视化产线规划工具，用于计算机器数量、资源需求与最终产率，并检查供应和排放约束。它面向规划工厂类游戏产线的玩家，支持格雷科技配方的并行、超频等规则。

## 能做什么

- **按目标产率规划机器。** 连接配方、原料和交付目标，查看运行量、建议安装数、利用率与资源流量。
- **只建模关心的工序。** 不必画出每个输入的上游机器，可以显式设置外部供应。供应受限时填写上限；不研究这段上游时，可设为供应充足。
- **检查瓶颈与副产物出口。** 设置供应、交付、排放和容量约束；目标无法满足时，查看限制与缺口诊断。
- **调整机器行为。** 编辑配方、单位、TPS 和已支持的修饰器，按需使用有线连接、共享资源总线及固定比例分流器。

例如，先为钢锭 10 个/min 的目标计算机器数量，再限制铁矿供应或关闭副产物出口，检查目标为什么无法满足。

## 快速开始

前端与计算后端均在本地运行。使用 **Node.js 24（含 npm）** 和 **Python 3.13**，与 CI 配置一致。安装依赖需要联网；下面的克隆命令需要 Git，也可以下载源码压缩包后解压。

```sh
git clone https://github.com/Sakura-Ex/OmniFlow.git
cd OmniFlow
```

### Windows

在仓库根目录打开 PowerShell，执行：

```powershell
.\start.bat
```

启动器会安装缺少的依赖、创建 Python 虚拟环境、启动两个服务，并打开 **http://127.0.0.1:5173**。保留启动窗口，在该窗口按 Enter 或 Ctrl+C 停止服务。故障排查与可选参数见[启动指南](starting.md)。

若需手动安装和启动，在第一个终端执行：

```powershell
npm ci
Copy-Item .env.example .env
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 7998
```

在仓库根目录另开一个终端：

```powershell
npm run dev -- --host 127.0.0.1
```

### macOS / Linux

在第一个终端执行：

```sh
npm ci
cp .env.example .env
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 7998
```

在仓库根目录另开一个终端：

```sh
npm run dev -- --host 127.0.0.1
```

这些手动命令适用于首次检出；已有配置时请保留原 `.env`。更换端口时，需要按 [.env.example](../.env.example) 同步调整 `VITE_BACKEND_URL` 和后端允许的浏览器来源。后端配置须设置为 Python 进程的环境变量，Vite 的 `.env` 不会配置 Python。

### 完成第一次计算

1. 打开 **http://127.0.0.1:5173**。初始画布是一条目标为**钢锭 10 个/min** 的产线，已配置铁矿、水、电力供应和副产物出口。
2. 点击**计算**，查看配方卡片上的机器数量，并展开计算结果查看资源汇总。初始示例打开时也会主动请求一次计算。
3. 把钢锭需求改为 **12 个/min**，再次计算。编辑后旧结果仍可见，并显示需要重新计算的提示。
4. 用**文件 → 保存**将文档保存在当前浏览器，或用**文件 → 导出**下载可转移的 JSON 副本。

若计算无法连接，检查后端的 **http://localhost:7998/api/health** 是否可访问，以及 `VITE_BACKEND_URL` 是否匹配。只运行前端无法求解产线。

## 建立和调整产线

添加配方节点，填写输入、输出与周期，再连接需要纳入模型的工序。计算机器需求前，先设置机器修饰器。

三类边界决定资源可以怎样进入或离开产线：

| 边界 | 含义 |
|---|---|
| 供应 | 允许物料或能量从模型外进入，可设置有限上限或供应充足。未连接的输入不会自动获得供应。 |
| 交付目标 | 要求至少交付某个数量、恰好交付某个数量，或在其他约束下最大化交付。 |
| 排放 | 允许多余产物或副产物离开，也可设置上限。没有出口的副产物可能阻止生产。 |

不想建立上游工序时，在配方卡片的“供应与边界设置”中配置对应输入。全局总线连接兼容端口，但**不会产生供应**。整条产线的约束、资源字典和单位环境在设置页调整。

计算后检查结果，修改相关数量或限制，再重新计算。文档编辑可撤销、重做。带有“应用”或“保存设置”按钮的设置，在提交前属于草稿；应用设置与保存文档是两件事。

**保存**将一份文档写入当前浏览器的本地存储，**打开**读取该保存；**导出**下载 JSON，**导入**校验并加载 JSON 文档。跨设备转移或备份产线应使用导出。浏览器存储不等于云同步，清除浏览器数据可能丢失本机保存。导出不会清除本机保存的“未保存”提示。

## 当前状态与限制

v2 计算链、节点编辑、设置页、中英文界面和文档导入导出已实现。菜单中标为“暂不可用”的项目仍是占位。当前验证范围及尚未完成的验收见[测试指南](testing.md)。

- **计算稳态产能，不模拟时间过程。** 连续线性模型平衡平均流量，不模拟库存随时间变化，不自动选择工况，也不进行整数安装优化。运行量 1.2 台与建议安装 2 台是不同的量。
- **流量平衡不保证可以启动。** 循环产线可能需要初始投料或预热。启动清单提示需要确认的条件，不证明动态启动可行。
- **诊断用于排查。** 缺口与满载约束不一定是唯一冲突，也不证明增加某台机器就能增产。限时求得的可行方案不一定最优。
- **需要本地服务。** 依赖安装完成后，只要本地前后端仍在运行，编辑与计算可以不联网使用。目前没有安装式离线应用／PWA、云同步或自动崩溃恢复。
- **默认面向本地使用。** 后端没有用户鉴权；公开部署或多人共享服务需要另外配置部署防护。

**下一阶段：**简洁、标准、详尽三种节点显示模式。目前已有设计与原型，正式软件尚未实现。其他面向大画布的交互规划见[交互设计手册](interaction-design-handbook.md)。

## 开发与贡献

前端使用 TypeScript、React 和 React Flow；后端使用 FastAPI 与 SciPy/HiGHS。前端编译产线模型，后端求解得到的线性规划问题。

完成前面的依赖安装后，执行前端检查：

```sh
npm run lint
npm test
npm run build
```

Windows 后端测试：

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest
```

macOS/Linux 将 `.\.venv\Scripts\python.exe` 换为 `.venv/bin/python`。CI 运行这些检查，浏览器验收单独记录。修改代码前请阅读[贡献指南](CONTRIBUTING.zh-CN.md)和[仓库约定](../AGENTS.md)。

## 进一步阅读

- [文档导航](README.md)：设计、实现状态与历史证据。
- [交互设计手册](interaction-design-handbook.md)：工作流程与交互规划。
- [v2 技术设计](technical-design-v2-proposal.md)与[求解器契约](solver-lp.md)：模型假设与计算架构。
- [测试指南](testing.md)与 [CI](ci.md)：检查方式、结果及验证边界。

## 许可证

[GNU GPL v3](../LICENSE)。
