# Pomodoro Tech — 极简桌面番茄钟

一个基于 Electron 的极简桌面番茄钟，运行于系统托盘，通过小浮窗交互。

## 特性

- 系统托盘常驻，点击托盘图标显示/隐藏浮窗
- 25 分钟专注 / 5 分钟休息，自动循环
- 环形进度条直观显示剩余时间
- 托盘图标颜色随状态变化（灰=空闲 / 红=专注 / 绿=休息）
- 计时完成时系统通知 + 提示音
- 关闭窗口自动隐藏到托盘，计时不中断
- 右键托盘菜单快速控制

## 截图

| 空闲态 | 专注态 | 休息态 |
|--------|--------|--------|
| 灰色图标 + 25:00 | 红色图标 + 倒计时 | 绿色图标 + 倒计时 |

## 使用方法

```bash
# 启动
npm start

# 运行测试
npm test
```

### 操作方式

- **浮窗按钮**: ▶ 开始 / ⏸ 暂停 / ↺ 重置 / ⏹ 停止
- **托盘点击**: 切换浮窗显示/隐藏
- **托盘右键菜单**: 开始专注、暂停、重置、退出

## 技术栈

- [Electron](https://www.electronjs.org/) — 桌面框架
- HTML + CSS + JavaScript (Vanilla) — 无框架依赖
- Web Audio API — 提示音播放
- Node.js `node:test` — 单元测试

## 项目结构

```
003-Pomodoro-Tech/
├── main.js                  # Electron 主进程（窗口、托盘、IPC）
├── package.json
├── src/
│   ├── timer.js             # 计时器核心（状态机）
│   ├── timer.test.js        # 单元测试（8 个用例）
│   ├── notification.js      # 系统通知 + 提示音
│   └── renderer/            # 浮窗 UI
│       ├── index.html
│       ├── style.css
│       └── renderer.js
├── assets/                  # 托盘图标和提示音
├── scripts/                 # 资源生成脚本
└── docs/                    # 设计文档和计划
```

## 许可

[MIT](LICENSE)
