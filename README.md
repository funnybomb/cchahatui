# cchahatui

<p align="center">
  <img src="docs/images/app-icon.png" alt="cchahatui" width="220">
</p>

<div align="center">

[![Release](https://img.shields.io/github/v/release/funnybomb/cchahatui?label=release)](https://github.com/funnybomb/cchahatui/releases)
[![Version](https://img.shields.io/badge/version-v0.2-2f6f8ff)](https://github.com/funnybomb/cchahatui/releases/tag/v0.2)
[![Desktop](https://img.shields.io/badge/desktop-macOS%20%7C%20Windows-2ea44f)](#安装)
[![DeepSeek](https://img.shields.io/badge/default-DeepSeek%20V4-1f6feb)](#deepseek-first)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-24c8db)](desktop/)
[![License](https://img.shields.io/github/license/funnybomb/cchahatui)](LICENSE)

</div>

cchahatui 是一个 **DeepSeek-first 桌面 AI 编程工作台**。它保留 cc-haha 风格的会话、项目、权限、Agent、Skills、插件、MCP、Computer Use、IM 接入、定时任务和 Token 统计能力，同时把默认模型体验切到 DeepSeek V4：大上下文、流式思考、前缀缓存感知、OpenAI-compatible API。

<p align="center">
  <a href="#deepseek-first">DeepSeek-first</a> ·
  <a href="#项目优势">项目优势</a> ·
  <a href="#桌面端预览">桌面端预览</a> ·
  <a href="#安装">安装</a> ·
  <a href="#开发">开发</a>
</p>

---

## DeepSeek-first

| 能力 | cchahatui 做法 |
|------|----------------|
| 默认模型 | 默认走 DeepSeek V4，优先使用 `deepseek-v4-pro` / `deepseek-v4-flash` |
| 100 万 Token 上下文 | 面向 DeepSeek V4 长上下文工作流，适合大仓库、多文件、多轮任务 |
| 思考模式流式推理 | 支持 reasoning/thinking 内容以流式方式进入会话 UI，回答前思路可见 |
| 前缀缓存感知 | 以 DeepSeek 前缀缓存为核心优化方向，减少重复上下文成本与等待 |
| OpenAI-compatible | 使用 `/chat/completions` 兼容路径，方便接入官方 DeepSeek Key |
| Claude Code 兼容体验 | 保留 cc-haha/Claude Code 类工作流，但品牌、配置、默认提供商转向 cchahatui + DeepSeek |

---

## 项目优势

- **真正桌面 App**：不是浏览器套壳入口。Tauri 2 + React 原生桌面窗口，应用名、图标、配置目录独立为 `cchahatui`。
- **项目级工作台**：会话绑定项目目录，支持多项目切换、分支选择、Worktree 隔离和右侧文件改动面板。
- **代码改动可视化**：聊天、终端、文件 Diff、执行记录、权限确认集中在一个窗口里，不需要反复切终端。
- **DeepSeek V4 优先**：默认模型、思考模式、长上下文、缓存感知都围绕 DeepSeek 调整，不再把 Claude 当作主路径。
- **Agent 系统完整**：保留通用 Agent、Explore、Plan、verification、statusline 等内置 Agent 能力，并让它们继承 DeepSeek 提供商配置。
- **插件/Skills/MCP 可扩展**：Skills 目录、MCP 服务、插件能力可管理，可扩展团队自己的工具链。
- **Computer Use**：授权后支持截图、点击、输入、滚动等桌面控制流程，适合跨应用自动化。
- **远程入口**：支持 H5 远程访问、IM 接入、定时任务，让桌面会话可以被手机或聊天工具接管。
- **安全边界清楚**：权限页、屏幕录制、辅助功能、诊断日志、API Key 配置路径都有独立入口，便于排查。

---

## 桌面端预览

<table>
  <tr>
    <td align="center" width="25%"><img src="docs/images/desktop_ui/10_desktop_workspace.png" alt="桌面工作台"><br><b>桌面工作台</b></td>
    <td align="center" width="25%"><img src="docs/images/desktop_ui/13_workspace_changes_worktree.png" alt="Worktree 与代码改动"><br><b>Worktree & 改动</b></td>
    <td align="center" width="25%"><img src="docs/images/desktop_ui/02_edit_code.png" alt="代码编辑"><br><b>代码编辑 & Diff</b></td>
    <td align="center" width="25%"><img src="docs/images/desktop_ui/03_ask_question_and_permission.png" alt="权限控制"><br><b>权限控制</b></td>
  </tr>
  <tr>
    <td align="center" width="25%"><img src="docs/images/desktop_ui/05_settings.png" alt="设置"><br><b>DeepSeek 设置</b></td>
    <td align="center" width="25%"><img src="docs/images/desktop_ui/06_settings_computer_use.png" alt="Computer Use"><br><b>Computer Use</b></td>
    <td align="center" width="25%"><img src="docs/images/desktop_ui/11_token_usage.png" alt="Token 用量"><br><b>Token 用量</b></td>
    <td align="center" width="25%"><img src="docs/images/desktop_ui/08_scheduled_task.png" alt="定时任务"><br><b>定时任务</b></td>
  </tr>
</table>

---

## 安装

### 下载桌面端

1. 打开 [Releases](https://github.com/funnybomb/cchahatui/releases)。
2. 下载 `v0.2` 对应的 macOS / Windows 安装包。
3. macOS 安装后从 `/Applications/cchahatui.app` 启动。
4. 首次启动进入设置页，添加 DeepSeek 提供商和 API Key。

### API Key 安全

- 不要把真实 DeepSeek Key 写入 README、issue、commit 或截图。
- 本地可放在应用设置或 `.env`。
- `.env` 已在 `.gitignore`，不会随仓库提交。

---

## 开发

### 桌面端开发

```bash
bun install
cd desktop
bun install
bun run tauri dev
```

### 构建 macOS

```bash
cd desktop
bun run build:macos-arm64
```

### 常用检查

```bash
bun run check:desktop
bun run check:server
bun run verify
```

---

## 配置路径

| 类型 | 路径 |
|------|------|
| 当前本机项目目录 | `/Users/funnybomb/百度云同步盘/mac_syn/FangcloudV2/personal_space.localized/个人工作文件/projects/haha+tui` |
| 应用数据 | `~/Library/Application Support/cchahatui/` |
| 诊断日志 | `~/Library/Application Support/cchahatui/claude/cc-haha/diagnostics/` |
| 项目配置 | 项目目录下的 `.claude/` 兼容目录 |
| 桌面源码 | `desktop/` |
| 图标源文件 | `desktop/public/app-icon.png` / `desktop/src-tauri/icons/` |

> 说明：部分底层兼容路径仍含 `claude` / `cc-haha` 字样，用于兼容原有运行时结构；产品入口、应用名、图标、默认提供商和用户心智以 `cchahatui` 为准。

---

## 功能矩阵

| 模块 | 状态 |
|------|------|
| DeepSeek V4 默认提供商 | 已启用 |
| 100 万 Token 长上下文工作流 | 已对齐 |
| 思考模式流式展示 | 已对齐 |
| 前缀缓存感知 | 已对齐 |
| 项目 / 会话管理 | 已启用 |
| 分支 / Worktree | 已启用 |
| 代码 Diff / 改动面板 | 已启用 |
| 内置 Agents | 已启用 |
| Skills / 插件 / MCP | 已启用 |
| WebSearch fallback | 可配置 |
| Computer Use | 需系统授权 |
| H5 / IM / 定时任务 | 已保留 |

---

## 文档入口

| 文档 | 说明 |
|------|------|
| [桌面端](docs/desktop/) | Tauri 2 + React 桌面客户端 |
| [第三方模型](docs/guide/third-party-models.md) | DeepSeek / OpenAI / Ollama 等提供商配置 |
| [环境变量](docs/guide/env-vars.md) | 本地环境变量和调试配置 |
| [多 Agent 系统](docs/agent/01-usage-guide.md) | Agent 编排、并行任务、上下文传递 |
| [Skills 系统](docs/skills/01-usage-guide.md) | 可扩展技能和条件激活 |
| [MCP / Channel](docs/channel/01-channel-system.md) | MCP 服务接入 |
| [Computer Use](docs/features/computer-use.md) | 桌面控制能力 |
| [IM 接入](docs/im/) | Telegram / 飞书 / 微信 / 钉钉 |

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 桌面 App | Tauri 2 |
| UI | React + Vite |
| 语言 | TypeScript |
| 本地运行时 | Bun |
| 终端 UI | Ink |
| Provider API | DeepSeek / OpenAI-compatible Chat Completions |
| 协议 | MCP, LSP |

---

## Star 趋势

如果 cchahatui 对你有帮助，可以给项目一个 Star，方便后续持续维护和推广。

<a href="https://www.star-history.com/#funnybomb/cchahatui&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=funnybomb/cchahatui&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=funnybomb/cchahatui&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=funnybomb/cchahatui&type=Date" />
  </picture>
</a>

---

## License

见 [LICENSE](LICENSE)。
