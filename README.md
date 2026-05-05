# OmniFlow

**OmniFlow** 是一个专为硬核自动化游戏（如《我的世界》格雷科技、异星工厂等）设计的可视化产线矩阵求解器。

传统的产线计算器往往缺乏直观的拓扑连线，而纯节点编辑器又难以处理复杂的多入多出与环形死结（如水-氢气-燃烧循环）。OmniFlow 将**现代化的节点交互 UI**与**底层的运筹学矩阵求解**完美融合，提供所见即所得的硬核解算体验。

---

## ✨ 核心特性

* **全解耦节点编辑器：** 基于 React Flow 构建，支持平滑缩放、端点吸附与严格的端口级物料校验。
* **多态数据渲染：** 针对不同游戏模组（GregTech, Vanilla, EnderIO 等）动态切换机器 UI 控制面板（如电压、超频开关）。
* **无状态解算架构：** 后端采用 FastAPI 构建无状态计算引擎，不依赖任何本地静态配方库，彻底释放自定义产线潜力。
* **速率配平引擎：** 引入时间维度（Tick），将离散的合成配方自动转化为精确的“次/秒”基础产率，并利用矩阵运算推导机器数量最优解。

---

## 🛠️ 技术栈

### 前端 (Frontend)

* React 18 + TypeScript
* React Flow (节点图表渲染)
* Vite (极速构建工具)
* Tailwind CSS (工业风暗色主题绘制)

### 后端 (Backend)

* Python 3.10+
* FastAPI (高性能 RESTful API 框架)
* Pydantic (严格的数据契约校验)
* SciPy / NumPy (线性代数与单纯形法矩阵求解)

---

## 🚀 本地开发指南

项目采用前后端分离架构，请确保本地已安装 Node.js 与 Python 环境。

### 1. 启动前端服务

前端运行在本地 5173 端口。

```bash
cd frontend
npm install
npm run dev
```

### 2. 启动后端解算服务

后端运行在本地 8000 端口，并自动开启 Swagger API 文档。

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows 用户使用 venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

> **联调说明：** 前端默认将计算请求发送至 `http://localhost:8000/api/calculate`。请确保后端 FastAPI 的 `CORSMiddleware` 已允许前端的跨域请求。

---

## 🌍 生产环境部署方案

推荐采用**前后端分离部署**策略，以兼顾前端的 CDN 加速与后端的独立算力。

### 前端部署 (GitHub Pages / Vercel)

前端为纯静态应用，可直接通过 CI/CD 自动构建。
部署前请将环境变量 `VITE_API_BASE_URL` 指向你的真实后端公网地址。
使用命令 `npm run build` 生成的 `dist` 目录可直接托管至任何静态服务。

### 后端部署 (Ubuntu 服务器 + Docker + Nginx)

对于后端引擎，推荐在 Ubuntu 环境下使用 Docker 容器化部署，并通过 Nginx 反向代理暴露服务。

**1. 准备 `docker-compose.yml`**
在 backend 目录下构建应用镜像并运行容器：

```yaml
version: '3.8'
services:
  api:
    build: .
    container_name: omniflow-api
    restart: always
    ports:
      - "8000:8000"
    environment:
      - ALLOWED_ORIGINS=https://your-frontend-domain.com
```

**2. 配置 Nginx 反向代理**
在 `/etc/nginx/sites-available/` 下配置代理节点，将外网请求转发至本地容器：

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 🤝 参与贡献

我们非常欢迎社区提交 Issue 或 Pull Request！
在开始编写代码之前，请务必阅读我们的 [CONTRIBUTING.md](./CONTRIBUTING.md) 以了解详细的数据契约规范和多态渲染约束。

---

## 📄 开源协议

MIT License
