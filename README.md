# Remote Claude Code

在手机上远程使用 PC 上运行的 [Claude Code](https://claude.ai/code)，无需安装 App，无需云服务器，仅需一个浏览器。

<p align="center">
  <strong>PC 运行服务 → 手机浏览器打开 → 扫码或输入 URL → 终端直连</strong>
</p>

---

## 架构

```
┌─────────────────┐         WebSocket + HTTP          ┌──────────────┐
│   你的 PC        │ ◄══════════════════════════════► │   Android 手机 │
│                 │         同一局域网 / 热点           │  (Chrome)     │
│  node-pty ──────┤                                   ├──────────────┤
│   ↓              │     xterm.js 终端渲染              │              │
│  Claude Code    │     Socket.IO 实时通信             │  网页终端     │
│  (PowerShell)   │     QR 码自动生成                  │  无需安装     │
└─────────────────┘                                   └──────────────┘
```

- **node-pty**：在 PC 上创建伪终端（PTY），运行 PowerShell / bash
- **xterm.js**：在手机浏览器中渲染完整终端界面
- **Socket.IO**：终端输入输出的实时双向通信
- **Express**：提供静态页面和连接信息 API

## 特性

- **零服务器**：不依赖任何云服务，PC 即服务器
- **会话驻留**：关闭手机浏览器不会丢失对话，重连回到同一终端
- **多客户端共享**：多个设备可同时连接同一个终端会话
- **二维码扫码连接**：PC 端自动生成 QR 码，手机一扫即连
- **跨平台**：Windows / macOS / Linux 均可用
- **自动启动 Claude Code**：首次连接自动运行 `claude` 命令
- **浏览器兼容检测**：在微信等不支持的浏览器中给出明确提示

## 快速开始

### 前置条件

- **Node.js** ≥ 18（[下载](https://nodejs.org/)）
- **Claude Code** 已安装（`npm install -g @anthropic-ai/claude-code`）
- PC 和手机在**同一局域网**（连同一个 WiFi），或 PC 开启移动热点

### 1. 克隆项目

```bash
git clone https://github.com/ZaraSheven/remote-claude-code.git
cd remote-claude-code
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动服务

```bash
node server.js
```

输出示例：
```
══ Remote Claude Code ══

  Phone URL:  http://192.168.1.100:3456

  Claude Code auto-launches on first connection.
  Reconnecting resumes the same session.

══ Ctrl+C to stop ══
```

### 4. 手机连接

1. 确保手机连接同一 WiFi
2. 打开 **Chrome** 浏览器（不要用微信/QQ 内置浏览器）
3. 输入 PC 上显示的 `Phone URL`
4. 点击 **「连接终端」**

PC 端会自动打开浏览器，同时显示 QR 码——也可以用手机扫描 QR 码直接打开。

## 配置

通过环境变量自定义行为：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3456` | 服务端口 |
| `SHELL` | Windows: `powershell.exe`<br>Linux/Mac: `bash` | 终端 Shell |
| `AUTO_CMD` | `claude` | 首次连接自动执行的命令。设为空字符串禁用 |

### 示例

```bash
# 使用 8080 端口，不自动启动 Claude Code
PORT=8080 AUTO_CMD="" node server.js

# 使用 cmd.exe 作为 Shell（Windows）
SHELL=cmd.exe node server.js

# 使用 zsh（macOS）
SHELL=/bin/zsh node server.js
```

## 适用场景

| 场景 | 说明 |
|------|------|
| 离开工位 | 去开会、吃饭，手机随时查看 Claude Code 跑的长任务进度，随手给指令 |
| 躺平 Coding | 不想坐在电脑前，用手机/平板躺着继续和 Claude Code 对话、调试代码 |
| 快速问答 | 想到一个问题，拿起手机问 Claude Code，不需要走到电脑前 |
| 多设备协作 | PC 跑着模型/服务，手机和平板同时接入同一个终端观察输出 |
| 校园网 / 公司内网 | 不需要云服务，局域网内直接连，不消耗手机流量 |
| 演示 / 教学 | 投屏到平板，手写 + Claude Code 终端同屏，比切窗口方便 |
| 无公网 IP 的家庭用户 | 不需要内网穿透、DDNS 等复杂配置，局域网直接搞定 |

## 当前局限

这仍然是一个早期项目，有一些已知限制：

### 网络限制
- **仅限局域网**：PC 和手机必须在同一 WiFi 下（或通过热点直连）。不支持跨互联网远程访问
- 跨网段访问需要额外配置（VPN / SSH 隧道 / frp 内网穿透）
- 部分路由器默认开启 AP 隔离会导致连不上

### 功能限制
- **单会话模式**：所有连接的设备共享同一个终端，无法独立操作
- **无身份认证**：同一局域网内知道 IP 和端口即可访问，不适合公共网络
- **终端体验**：手机键盘不如实体键盘方便，复杂编辑操作受限
- **Windows 防火墙**：首次运行需要管理员权限添加防火墙规则
- 依赖 PC 持续开机，PC 休眠/关机即断连
- `node-pty` 在部分 Windows 环境可能需要 Visual C++ 运行库

### 兼容性
- **不支持微信/QQ 内置浏览器**（缺少 WebSocket 支持），需用 Chrome 或 Edge
- iOS Safari 未经充分测试（理论可用）
- 仅测试过 Claude Code，其他终端应用未验证

> 遇到问题？查看[故障排查](#故障排查)章节，或提交 [Issue](https://github.com/ZaraSheven/remote-claude-code/issues)。

## 为爱发电

这个项目源于「想在床上用手机写代码」的朴素愿望，完全由热情驱动。

**欢迎任何形式的贡献：**

- 提交 Bug 报告或功能建议 → [Issue](https://github.com/ZaraSheven/remote-claude-code/issues)
- 贡献代码 → Fork + PR（小而美的改动比大重构更受欢迎）
- 改进文档 → 错别字、补充说明、翻译，都很珍贵
- 分享给朋友 → ⭐ **Star** 是最好的动力

**一些可以贡献的方向：**

- [ ] 可选的身份认证（密码 / Token）
- [ ] 多标签独立会话
- [ ] iOS Safari 测试与适配
- [ ] 通过 frp / Tailscale 实现远程访问的文档
- [ ] Docker 一键部署
- [ ] PWA 支持（添加到手机主屏幕）
- [ ] 终端字体大小调节
- [ ] 文件上传/下载

每一颗 Star、每一个 Issue、每一行 PR，都是让这个项目更好的力量。

---

## 跨平台支持

| 平台 | Shell | 特殊参数 | node-pty 支持 |
|------|-------|----------|---------------|
| Windows | PowerShell | `-ExecutionPolicy Bypass` | ✅ |
| macOS | bash | 无 | ✅ |
| Linux | bash | 无 | ✅ |

三个平台代码统一，无需额外配置。`node-pty` 在所有平台均有预编译二进制。

## 故障排查

### 手机连不上

**1. 检查是否同一网络**

手机和 PC 必须连接同一个 WiFi。可以在手机上尝试用浏览器打开 PC 的 IP 地址来测试连通性。

**2. 检查防火墙**

Windows 防火墙默认拦截入站连接。以管理员身份运行：
```powershell
New-NetFirewallRule -DisplayName "Remote Claude Code" `
  -Direction Inbound -Protocol TCP -LocalPort 3456 -Action Allow
```

**3. 路由器 AP 隔离**

部分路由器（如小米路由器）默认开启 AP 隔离，禁止 WiFi 设备间通信。解决方式：
- 关闭路由器的「AP 隔离」/「客户端隔离」选项
- 或 PC 开启移动热点，手机连接 PC 热点

**4. 确认正确的 IP**

启动服务器时，终端只显示物理网卡的 IP（自动过滤 VMware、VirtualBox 等虚拟适配器）。使用显示的那个 IP。

### 微信扫码打不开

微信内置浏览器不支持 WebSocket。页面会显示红色警告。请点击右上角「在浏览器中打开」，使用 Chrome 或 Edge。

### `claude` 命令无法运行（PowerShell 执行策略）

服务器已内置 `-ExecutionPolicy Bypass` 参数绕过此限制。若仍有问题，手动运行：

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 端口已被占用

```
Error: Port 3456 is already in use.
```

找到并终止占用进程：
```bash
netstat -ano | findstr 3456
taskkill /PID <pid> /F
```

或使用其他端口：`PORT=3457 node server.js`

## 项目结构

```
remote-claude-code/
├── server.js          # 主服务：Express + Socket.IO + node-pty
├── package.json       # 依赖声明
├── start.bat          # Windows 一键启动脚本
├── fix-network.ps1    # Windows 网络修复脚本（管理员运行）
├── hotspot-server.bat # 热点模式启动脚本
├── .gitignore
├── README.md          # 中文文档
├── README_EN.md       # English docs
└── public/
    └── index.html     # 前端：xterm.js 终端 + QR 码 + 响应式布局
```

## 安全提醒

- 服务仅绑定局域网地址，但**同一局域网内的设备均可访问**
- 建议仅在信任的网络（家庭、校园网）中使用
- 使用完毕后 `Ctrl+C` 停止服务
- 不要在公共 WiFi 上使用
- 可以结合 VPN / SSH 隧道实现远程加密访问

## 赞赏支持

如果这个项目帮到了你，欢迎请作者喝杯咖啡。

<p align="center">
  <table>
    <tr>
      <td align="center"><b>微信赞赏</b></td>
      <td align="center"><b>支付宝</b></td>
    </tr>
    <tr>
      <td><img src="assets/wechat-pay.png" width="260" alt="微信赞赏码" /></td>
      <td><img src="assets/alipay.png" width="260" alt="支付宝收款码" /></td>
    </tr>
  </table>
</p>

> GitHub Sponsors 开启方式：前往 [github.com/sponsors/ZaraSheven](https://github.com/sponsors/ZaraSheven) 按指引完成设置，然后将 `.github/FUNDING.yml` 中的注释取消即可启用。

## License

[MIT](LICENSE) — 随意使用、修改、分发，保留版权声明即可。
