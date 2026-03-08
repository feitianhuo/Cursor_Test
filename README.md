# ChatGPT-like 对话问答系统

单用户本地使用的类 ChatGPT 对话系统，前后端分离，React + FastAPI + MySQL。

## 项目结构

```
├── backend/          # FastAPI 后端
├── frontend/         # React + Vite 前端
└── .cursor/plans/    # 项目规划
```

## 快速开始

### 1. 后端

```bash
cd backend
pip install -r requirements.txt
python run.py
```

后端默认运行在 `http://localhost:8000`。

数据库配置见 `backend/config.yaml`，默认：
- Host: 172.16.100.15
- Port: 13306
- User: root
- Password: 232323
- Database: vibecoding

可通过环境变量覆盖（参考 `.env.example`）。

### 2. 前端

```bash
cd frontend
npm install
npm run dev
```

前端默认运行在 `http://localhost:5173`，会代理 `/api` 请求到后端。

### 3. 验证

- 访问 http://localhost:5173 查看主界面
- 主界面会调用 `/api/health` 检查后端与数据库连接状态

## Phase 2 对话功能

配置 Qwen API Key 后即可使用对话：

1. 在 `backend/config.yaml` 的 `llm.qwen.api_key` 填入通义千问 API Key  
2. 或设置环境变量 `DASHSCOPE_API_KEY`  
3. 访问 http://localhost:5173 开始对话

支持流式回复、多轮对话、模型切换（Qwen / OpenAI）。

---

## Phase 1 交付

- [x] 前后端项目骨架
- [x] MySQL 配置文件接入（config.yaml + 环境变量）
- [x] SQLAlchemy 会话/消息表
- [x] 健康检查接口 `GET /health`
- [x] 基础布局（Header、侧边栏占位、主内容区）
- [x] Axios API 封装与错误处理

## Phase 2 交付

- [x] LLM 抽象层，默认 Qwen（通义千问）
- [x] 流式 API `POST /chat/stream`
- [x] 上下文管理（保留最近 10 轮）
- [x] 主对话页：消息列表、输入框、发送
- [x] 模型选择器、流式逐字渲染
