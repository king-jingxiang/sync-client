# SyncClient — 文件同步客户端

<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="SyncClient Logo" width="128" height="128">
</p>

<p align="center">
  <strong>基于 rclone 的跨平台文件同步桌面客户端</strong>
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#安装">安装</a> •
  <a href="#开发指南">开发指南</a> •
  <a href="#构建">构建</a> •
  <a href="#发布">发布</a>
</p>

---

## 项目简介

SyncClient 是一款轻量、跨平台的桌面应用，为 [rclone](https://rclone.org/) 提供直观易用的图形化界面。rclone 是业界知名的命令行文件同步工具，天然支持 70 余种云存储协议。通过 SyncClient，你可以在现代化的界面中管理云存储配置、创建同步任务、预览文件差异、监控传输进度，而无需记忆复杂的命令行参数。

## 功能特性

### 云存储配置管理
- 创建、编辑、删除多个 rclone remote（支持 S3、OneDrive、Google Drive、SFTP、WebDAV 等）
- 导入现有的 `rclone.conf` 配置文件，或导出配置进行备份
- 一键「连接测试」，快速验证远程存储的连通性
- 远程文件树浏览，直观查看云端目录结构

### 同步任务管理
- 创建同步任务：本地目录 + 远程名称 + 远程路径 + 同步方向
- 三种同步方向可选：双向同步 (bisync)、仅上传、仅下载
- 任务级包含/排除过滤规则，支持 glob/regex 模式匹配
- 任务启用/禁用开关，灵活控制执行范围
- 手动触发「立即同步」，按需执行

### 差异预览与选择性同步
- 同步前执行差异扫描 (dry-run)，列出所有变更文件
- 差异视图按类型分组：新增、修改、删除、冲突
- 文件元信息对比：大小、修改时间一览无遗
- 支持逐文件勾选/取消，精确控制本次同步范围

### 实时进度与日志
- 同步过程中实时展示当前文件、传输速度、完成百分比、预计剩余时间
- 详细的同步日志，支持 DEBUG / INFO / WARN / ERROR 多级筛选
- 历史同步记录存档，统计每次传输的文件数、字节数、耗时
- 日志导出功能，便于问题排查

### 系统集成
- 系统托盘常驻，最小化到托盘后台运行
- 托盘右键菜单：打开主界面、一键同步、退出
- 关闭窗口默认最小化到托盘，不中断后台任务

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| 桌面框架 | Tauri v2 (Rust + WebView) |
| 前端 | React 19 + TypeScript |
| UI 组件 | shadcn/ui + TailwindCSS v4 |
| 状态管理 | Zustand |
| 同步引擎 | rclone (RC API) |
| 文件监控 | notify (Rust crate) |
| 数据持久化 | SQLite (rusqlite) |
| 打包分发 | Tauri Bundler (MSI / NSIS / DMG) |

## 安装

### 下载预编译安装包

从 [Releases](https://github.com/YOUR_USERNAME/sync-client/releases) 页面下载适合你平台的最新版本。

| 平台 | 安装包 |
|------|--------|
| Windows (x64) | `.msi` 或 `.exe` (NSIS 安装程序) |
| macOS (Intel & Apple Silicon) | `.dmg` |

> **注意：** 应用运行依赖 [rclone](https://rclone.org/downloads/)，请确保系统中已安装 rclone，或将 rclone 可执行文件放置于应用同级目录下。

### 系统要求

- **Windows:** Windows 10 或更高版本 (x64)
- **macOS:** macOS 12 或更高版本 (Intel & Apple Silicon)
- **rclone:** v1.68 或更高版本（推荐）

## 开发指南

### 环境准备

- [Node.js](https://nodejs.org/) >= 22
- [Rust](https://rustup.rs/) >= 1.77
- [rclone](https://rclone.org/downloads/) 已安装且位于 PATH 中

### 项目初始化

```bash
# 克隆仓库
git clone https://github.com/YOUR_USERNAME/sync-client.git
cd sync-client

# 安装前端依赖
npm install

# 运行开发模式（同时启动 Vite 开发服务器和 Tauri 应用）
npm run tauri dev
```

### 目录结构

```
sync-client/
├── src/                    # 前端源码 (React + TypeScript)
│   ├── components/         # UI 组件
│   ├── pages/              # 页面级组件
│   ├── stores/             # Zustand 状态管理
│   ├── lib/                # 工具函数与 API 绑定
│   └── App.tsx             # 根组件
├── src-tauri/              # Tauri Rust 后端
│   ├── src/
│   │   ├── commands/       # Tauri 命令处理器
│   │   ├── services/       # 业务服务层
│   │   ├── models/         # 数据结构定义
│   │   ├── db/             # SQLite 数据库层
│   │   └── lib.rs          # 应用入口
│   ├── icons/              # 应用图标
│   └── Cargo.toml
├── migrations/             # 数据库迁移脚本
└── package.json
```

## 构建

### 仅构建前端

```bash
npm run build
```

### 构建完整桌面应用

```bash
npx tauri build
```

构建产物位于：

```
src-tauri/target/release/bundle/
├── msi/          # Windows MSI 安装包
├── nsis/         # Windows NSIS 安装包
└── dmg/          # macOS DMG (仅在 macOS 上构建)
```

### 通过 GitHub Actions 跨平台构建

本项目已集成 GitHub Actions 工作流，可自动为 Windows 和 macOS 构建并发布。详见 [`.github/workflows/release.yml`](.github/workflows/release.yml)。

## 发布

发布流程通过 GitHub Actions 自动完成。推送新标签即可触发：

```bash
git tag v0.1.0
git push origin v0.1.0
```

工作流将自动为所有支持的平台构建安装包，并将其附加到 GitHub Release 中。

## 开发路线图

- [x] 基础 remote 配置管理
- [x] 同步任务增删改查
- [x] 差异扫描与预览
- [x] 实时同步进度展示
- [x] 系统托盘集成
- [ ] 自动定时调度（间隔 / 定时）
- [ ] 本地文件系统监控与自动同步
- [ ] 冲突解决策略
- [ ] 自动更新
- [ ] 主题切换（浅色 / 深色）

## 许可证

MIT License — 详见 [LICENSE](LICENSE)。

## 致谢

- [rclone](https://rclone.org/) — 本应用背后的强大同步引擎
- [Tauri](https://v2.tauri.app/) — 现代化的跨平台桌面框架
- [shadcn/ui](https://ui.shadcn.com/) — 美观、可访问的 UI 组件库
