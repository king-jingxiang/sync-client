# 跨平台文件同步客户端 — 需求规格与实施方案

> 文档版本：v1.0
> 日期：2026-05-10

---

## 一、项目概述

本项目旨在开发一款基于 rclone 的跨平台桌面客户端，支持 Windows 与 macOS 双系统。核心能力为通过多种云存储配置源实现本地与远端文件的双向同步，并提供清晰的文件差异对比视图，帮助用户在同步前审阅改动内容。

### 1.1 核心价值
- 基于成熟工具 rclone，天然支持 70+ 云存储协议
- 双向同步与冲突解决，满足增量与全量同步需求
- 可视化差异对比，降低误操作风险
- 轻量包体与低资源占用，工具型软件的极致体验

---

## 二、功能需求清单

### 2.1 配置管理

| ID | 功能项 | 优先级 | 说明 |
|----|--------|--------|------|
| F1 | 多配置源管理 | P0 | 支持创建、编辑、删除多个 rclone remote（S3、OneDrive、Google Drive、SFTP、WebDAV 等），每个 remote 独立保存配置参数 |
| F2 | 配置文件导入/导出 | P1 | 支持导入现有 `rclone.conf` 文件，或将当前配置导出为 `.conf` 备份 |
| F3 | 配置验证 | P0 | 新建/编辑 remote 时提供「连接测试」按钮，调用 rclone 验证凭据与连通性 |
| F4 | 远程路径浏览 | P1 | 在选择同步目标时，提供远端文件树浏览（list 接口），支持展开目录 |

### 2.2 同步任务管理

| ID | 功能项 | 优先级 | 说明 |
|----|--------|--------|------|
| F5 | 创建同步任务 | P0 | 选择本地目录 + remote 名称 + 远端路径，设定同步方向与规则 |
| F6 | 同步方向选择 | P0 | 支持三种模式：① 双向同步 (bisync) ② 仅上传 (本地→远端) ③ 仅下载 (远端→本地) |
| F7 | 任务列表管理 | P0 | 任务增删改查，支持启用/禁用任务、任务命名与分组 |
| F8 | 任务级过滤规则 | P1 | 每个任务独立配置包含/排除模式（glob/regex），如 `*.tmp`、`node_modules/` |
| F9 | 任务手动触发 | P0 | 点击「立即同步」按钮执行一次同步 |
| F10 | 任务自动调度 | P1 | 按时间间隔（每 N 分钟/小时）或定时（每日固定时间）自动执行 |
| F11 | 任务实时监控 | P1 | 底部状态栏展示当前正在运行的同步任务数量与总进度 |

### 2.3 差异对比与预览

| ID | 功能项 | 优先级 | 说明 |
|----|--------|--------|------|
| F12 | 同步前差异扫描 | P0 | 执行同步前先调用 `check` 或 bisync 的 dry-run，列出所有变更文件 |
| F13 | 变更分类展示 | P0 | 差异视图按类别分组：新增、修改、删除、冲突，支持按类型筛选 |
| F14 | 文件元信息对比 | P1 | 展示变更文件的大小、修改时间、哈希值（如有）对比 |
| F15 | 选择性同步 | P1 | 用户在差异视图中可勾选/取消单个文件，决定本次是否同步该文件 |
| F16 | 冲突解决预览 | P1 | 双向同步模式下，展示冲突文件列表，提供冲突解决策略选择（最新优先、保留本地、保留远端、手动选择） |

### 2.4 同步执行与日志

| ID | 功能项 | 优先级 | 说明 |
|----|--------|--------|------|
| F17 | 实时进度展示 | P0 | 同步过程中展示当前文件、传输速度、已完成百分比、预估剩余时间 |
| F18 | 传输统计 | P1 | 统计本次同步的文件总数、传输总量、耗时、失败数 |
| F19 | 同步日志 | P0 | 记录每次同步的详细日志（DEBUG/INFO/WARN/ERROR 级别），支持日志查看与导出 |
| F20 | 失败重试 | P1 | 单文件传输失败时自动重试（可配置重试次数），支持查看失败原因 |
| F21 | 后台静默同步 | P2 | 最小化到系统托盘后，任务在后台运行，完成后通过系统通知提醒 |

### 2.5 本地文件监控

| ID | 功能项 | 优先级 | 说明 |
|----|--------|--------|------|
| F22 | 文件系统监听 | P1 | 对同步任务绑定的本地目录进行实时文件变更监控（增删改） |
| F23 | 变更防抖触发 | P2 | 检测到本地变更后，延迟 N 秒自动触发同步，避免高频保存导致频繁同步 |
| F24 | 忽略规则实时生效 | P2 | 监听器遵循任务级过滤规则，忽略的文件变更不触发同步 |

### 2.6 系统级能力

| ID | 功能项 | 优先级 | 说明 |
|----|--------|--------|------|
| F25 | 系统托盘常驻 | P0 | 支持最小化到系统托盘，右键菜单提供快捷操作（打开主界面、一键同步、退出） |
| F26 | 开机自启 | P2 | 可配置为系统开机时自动启动客户端 |
| F27 | 自动更新 | P2 | 检测到新版本时提示更新，支持后台下载与一键安装（Windows: .msi, macOS: .dmg） |
| F28 | 全局设置 | P1 | 应用级配置：默认日志级别、并发传输数、网络超时时间、代理设置、主题（浅色/深色） |

---

## 三、非功能需求

| 属性 | 目标 |
|------|------|
| 跨平台 | 完整支持 Windows 10+ 与 macOS 12+ (Intel & Apple Silicon) |
| 安装包体积 | 单平台安装包 < 30MB（不含内嵌 rclone 二进制） |
| 内存占用 | 空闲状态 < 100MB，同步运行时 < 300MB |
| 启动时间 | 冷启动 < 2 秒 |
| 并发能力 | 支持同时运行 3+ 个同步任务，不阻塞 UI |
| 离线可用 | 应用本身可离线运行，仅同步操作依赖网络 |
| 数据安全 | 不缓存用户云存储凭据；rclone 配置加密由 rclone 自身负责 |

---

## 四、技术选型

### 4.1 整体技术栈

| 层级 | 技术选型 | 版本/说明 |
|------|----------|-----------|
| 桌面框架 | **Tauri v2** | 跨平台 Rust + WebView 方案，包体极小 |
| 前端 UI | **React 19 + TypeScript** | 组件化开发，类型安全 |
| UI 组件库 | **shadcn/ui + TailwindCSS v4** | 无运行时依赖，样式高度可定制 |
| 状态管理 | **Zustand** | 轻量，适合中小型应用 |
| 后端逻辑 | **Rust (Tauri Commands)** | 进程管理、文件系统、网络请求、SQLite 读写 |
| 同步引擎 | **rclone** (内嵌二进制) | v1.68+，提供 RC API 与 bisync 能力 |
| 本地文件监控 | **notify (Rust crate)** | Tauri v2 原生支持，跨平台文件系统事件 |
| 数据持久化 | **SQLite (via sqlx / tauri-plugin-sql)** | 本地数据库，零配置 |
| 配置管理 | **rclone.conf + SQLite** | rclone 配置独立管理，应用元数据存 SQLite |
| 打包分发 | **Tauri Bundler** | 输出 .msi (Windows) 与 .dmg (macOS) |

### 4.2 选型理由

#### Tauri v2
- 相比 Electron，包体减少 90% 以上，内存占用降低 50%+
- v2 原生支持系统托盘、多窗口、全局快捷键、文件系统权限管理
- Rust 后端适合管理 rclone 子进程、解析 RC API 响应、处理本地文件监控
- 内置自动更新插件 (`tauri-plugin-updater`)

#### rclone RC API (优于 CLI)
- 通过 HTTP JSON API 与 rclone 守护进程通信，接口规范稳定
- 天然异步，支持并发任务与实时进度流（rc API 的 `_async` 模式 + `job/status` 轮询）
- 所有操作有结构化响应，错误码明确，远胜 CLI 的文本解析

#### SQLite
- 同步任务、历史记录、应用设置等结构化数据天然适合关系型存储
- sqlx 提供编译期查询检查，Rust 侧开发体验好
- 单文件数据库，备份与迁移简单

---

## 五、技术实施方案

### 5.1 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                      Presentation Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  配置管理页  │  │  任务管理页  │  │  差异对比/日志视图   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                        React + Zustan                          │
├──────────────────────────────────────────────────────────────┤
│                       Tauri Bridge                            │
│              invoke() / listen() 双向通信                      │
├──────────────────────────────────────────────────────────────┤
│                       Core Layer (Rust)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  RcloneMgr  │  │  TaskEngine  │  │  FsWatcherService   │  │
│  │ (RC API客户端)│  │ (任务调度器)  │  │   (文件系统监听)     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ ConfigStore │  │  TaskStore   │  │   LogStore          │  │
│  │ (rclone.conf)│  │  (SQLite)   │  │   (SQLite)          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                     rclone daemon                             │
│            localhost:5572 (RC HTTP Server)                    │
├──────────────────────────────────────────────────────────────┤
│                  Cloud Storage Endpoints                      │
│         S3 / OneDrive / Google Drive / SFTP ...               │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 模块职责

#### RcloneMgr (Rust)
- 管理 rclone 守护进程的生命周期（启动、健康检查、重启、停止）
- 封装所有 RC API 调用：`config/create`, `operations/list`, `sync/sync`, `sync/bisync`, `operations/check`, `job/status`
- 处理 API 响应与错误码，转换为 Rust 强类型结构
- 管理 rclone 二进制文件的释放（首次运行时从嵌入资源解压到用户目录）

#### TaskEngine (Rust)
- 维护内存中的任务队列与状态机（Idle → Scanning → Syncing → Completed/Failed）
- 调度任务的执行：串行 or 并行（可配置并发数）
- 对外暴露 `start_task(task_id)`, `pause_task(task_id)`, `get_task_status(task_id)` 等接口
- 将任务执行结果写入 SQLite

#### FsWatcherService (Rust)
- 使用 `notify` crate 为每个启用了「自动同步」的任务注册文件系统监听器
- 本地变更事件经过「过滤规则」与「防抖计时器」后，通知 TaskEngine 触发增量同步

#### Frontend (React)
- 配置管理：Remote 的 CRUD 表单，路径选择器（本地/远端）
- 任务管理：任务卡片列表，支持启停开关、同步方向徽章、下次执行时间
- 差异视图：树形表格展示变更文件，支持按类型筛选、批量选择/排除
- 同步进度：实时进度条、传输速率曲线图（可选）、日志流式输出
- 全局设置：偏好配置表单

### 5.3 核心数据流

#### 创建同步任务并执行

```
1. 用户在 UI 填写：本地路径 / Remote / 远端路径 / 方向 / 过滤规则
2. Frontend → invoke("create_task", payload)
3. Rust Core 校验路径与 remote 有效性
4. 写入 SQLite (tasks 表)
5. 用户点击「立即同步」
6. Frontend → invoke("run_task", task_id)
7. TaskEngine:
   a. 状态变为 Scanning
   b. 调用 RcloneMgr.operations_check() 获取差异列表
   c. 差异列表 emit 到 Frontend，用户可审阅/调整
   d. 用户确认后，状态变为 Syncing
   e. 调用对应 sync 接口（sync/bisync/sync）
   f. 轮询 job/status 获取实时进度，emit 到 Frontend
   g. 完成后写入 sync_logs 表，状态变为 Completed/Failed
```

#### 本地文件变更自动触发

```
1. FsWatcherService 监听目录 → 收到 notify event
2. 用任务的 glob/regex 规则过滤
3. 触发防抖计时器（如 5 秒）
4. 计时器到期 → 通知 TaskEngine 执行该任务的增量同步
5. 若任务正在运行，跳过或排队（按策略）
```

### 5.4 数据库表结构（SQLite）

```sql
-- 同步任务表
CREATE TABLE tasks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    local_path    TEXT NOT NULL,
    remote_name   TEXT NOT NULL,
    remote_path   TEXT NOT NULL,
    direction     TEXT NOT NULL CHECK(direction IN ('upload','download','bisync')),
    filters       TEXT,               -- JSON: {include: [...], exclude: [...]}
    conflict_policy TEXT DEFAULT 'newer', -- newer | local | remote | manual
    auto_sync     BOOLEAN DEFAULT 0,
    sync_interval INTEGER,            -- 自动同步间隔（分钟），NULL 表示手动
    is_enabled    BOOLEAN DEFAULT 1,
    last_sync_at  DATETIME,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 同步历史记录表
CREATE TABLE sync_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id       INTEGER NOT NULL REFERENCES tasks(id),
    direction     TEXT NOT NULL,
    status        TEXT NOT NULL CHECK(status IN ('running','completed','failed','cancelled')),
    total_files   INTEGER DEFAULT 0,
    transferred_bytes INTEGER DEFAULT 0,
    added_count   INTEGER DEFAULT 0,
    modified_count INTEGER DEFAULT 0,
    deleted_count INTEGER DEFAULT 0,
    error_count   INTEGER DEFAULT 0,
    started_at    DATETIME NOT NULL,
    ended_at      DATETIME,
    log_path      TEXT                  -- 指向本次同步的详细日志文件
);

-- 差异扫描结果表（单次同步前的变更列表）
CREATE TABLE sync_changes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    log_id        INTEGER NOT NULL REFERENCES sync_logs(id),
    file_path     TEXT NOT NULL,
    change_type   TEXT NOT NULL CHECK(change_type IN ('added','modified','deleted','conflict')),
    side          TEXT CHECK(side IN ('local','remote')),  -- 哪一侧有变更
    local_size    INTEGER,
    remote_size   INTEGER,
    local_modtime INTEGER,
    remote_modtime INTEGER,
    is_selected   BOOLEAN DEFAULT 1,   -- 用户是否勾选同步该文件
    resolved_by   TEXT                 -- manual / auto，冲突解决方式
);

-- 应用设置表
CREATE TABLE app_settings (
    key           TEXT PRIMARY KEY,
    value         TEXT NOT NULL,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 5.5 rclone RC API 核心调用映射

| 业务操作 | RC API 端点 | 说明 |
|----------|-------------|------|
| 列出 remotes | `config/listremotes` | 获取所有已配置 remote |
| 创建 remote | `config/create` | 动态创建配置（部分协议支持） |
| 远端目录浏览 | `operations/list` | 列出指定 remote 路径下的文件与目录 |
| 单向同步 | `sync/sync` | 参数：`srcFs`, `dstFs`, `_async=true` |
| 双向同步 | `sync/bisync` | 参数：`srcFs`, `dstFs`, `resync`（首次需 true） |
| 差异对比 | `operations/check` | 参数：`srcFs`, `dstFs`，返回差异列表 |
| 查询任务进度 | `job/status` | 参数：`jobid`，返回进度、已传输字节等 |
| 停止任务 | `job/stop` | 参数：`jobid` |

### 5.6 文件目录结构

```
sync-client/
├── src/                          # 前端源码
│   ├── components/               # 通用组件
│   ├── pages/                    # 页面级组件
│   │   ├── ConfigPage.tsx
│   │   ├── TasksPage.tsx
│   │   ├── DiffPage.tsx
│   │   ├── LogsPage.tsx
│   │   └── SettingsPage.tsx
│   ├── stores/                   # Zustand 状态
│   ├── hooks/                    # 自定义 Hooks
│   ├── lib/                      # 工具函数
│   └── App.tsx
├── src-tauri/                    # Tauri Rust 后端
│   ├── src/
│   │   ├── main.rs               # 入口
│   │   ├── lib.rs
│   │   ├── commands/             # Tauri 命令处理器 (Frontend 调用入口)
│   │   ├── services/             # 业务服务
│   │   │   ├── rclone_mgr.rs
│   │   │   ├── task_engine.rs
│   │   │   └── fs_watcher.rs
│   │   ├── models/               # 数据结构定义
│   │   ├── db/                   # SQLite 数据库操作
│   │   └── utils/                # 辅助工具
│   ├── Cargo.toml
│   └── tauri.conf.json
├── resources/                    # 内嵌资源
│   ├── rclone-windows-amd64.exe
│   └── rclone-darwin-universal
├── migrations/                   # SQLite 迁移脚本
├── package.json
├── tailwind.config.ts
└── README.md
```

---

## 六、开发路线图

### Phase 1：基础骨架（第 1-2 周）
- [ ] 初始化 Tauri v2 + React + TailwindCSS 项目
- [ ] 集成 shadcn/ui，搭建主窗口布局与导航
- [ ] 实现 rclone 二进制文件的嵌入与首次运行释放逻辑
- [ ] 实现 RcloneMgr：启动 RC daemon，封装基础 API 调用
- [ ] 配置页：Remote 列表展示、创建表单、连接测试

### Phase 2：同步核心（第 3-4 周）
- [ ] 实现 SQLite 数据库与表结构
- [ ] 实现 TaskEngine：任务 CRUD、状态机
- [ ] 实现单向同步（上传/下载）与实时进度展示
- [ ] 差异扫描：调用 `operations/check`，结果存入 `sync_changes`
- [ ] 差异视图 UI：树形表格、变更分类筛选、文件选择/排除

### Phase 3：双向同步与冲突（第 5-6 周）
- [ ] 集成 `sync/bisync` 实现真正的双向同步
- [ ] 冲突检测与解决策略 UI
- [ ] bisync 状态文件（`.lst`）的路径管理与清理策略
- [ ] 首次 resync 流程的引导与确认

### Phase 4：自动化与优化（第 7-8 周）
- [ ] FsWatcherService：本地目录文件监控与防抖触发
- [ ] 任务自动调度（定时/间隔）
- [ ] 系统托盘常驻、开机自启
- [ ] 日志系统：分级日志、日志查看器、导出功能
- [ ] 全局设置页

### Phase 5：打磨与发布（第 9-10 周）
- [ ] 深色/浅色主题切换
- [ ] 性能优化：大数据量差异列表虚拟滚动
- [ ] 自动更新集成
- [ ] Windows / macOS 打包与签名
- [ ] 编写用户文档与快速开始指南

---

## 七、风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| rclone RC API 某些 remote 支持不完善 | 高 | 保持 CLI 作为 fallback，核心路径优先用 API，边缘场景降级 |
| bisync 冲突处理复杂，用户体验差 | 中 | 前期提供「最新优先」自动策略，降低用户认知负担；手动策略作为高级选项 |
| macOS 沙盒限制文件系统访问 | 高 | 遵循 macOS App Sandbox 规则，使用 `NSOpenPanel` 让用户显式授权目录 |
| 大目录差异扫描耗时久 | 中 | 差异扫描走异步 job，UI 展示加载状态；大数据量用虚拟滚动 |
| rclone 二进制体积大（~50MB/平台） | 低 | 安装包分平台打包，不追求单包多平台；首次运行按需释放对应平台二进制 |

---

## 八、附录

### 8.1 参考资源
- rclone RC API 文档：https://rclone.org/rc/
- rclone bisync 文档：https://rclone.org/bisync/
- Tauri v2 文档：https://v2.tauri.app/
- rclone 二进制下载：https://rclone.org/downloads/

### 8.2 术语表
- **Remote**：rclone 中对一个云存储配置的命名引用，如 `my-s3`、`work-onedrive`
- **bisync**：rclone 的双向同步命令，维护两边的状态文件以实现双向增量同步
- **RC (Remote Control)**：rclone 的 HTTP API 模式，允许外部程序通过 REST 接口控制 rclone
- **resync**：bisync 首次运行或状态文件丢失时的全量对齐标志
