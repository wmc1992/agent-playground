# agent-playground

星岚（Stellar Playground）是一个零依赖的交互式粒子实验：移动光标吸引星尘，
拖动滑块调整粒子数量、流动速度与色相。页面使用原生 HTML / CSS / JavaScript
构建，由 GitHub Actions 发布到 GitHub Pages。

**在线访问：<https://mingchao.wang/agent-playground/>**

## 特性

- Canvas 2D 粒子星图，支持吸引、斥力、涡旋三种互动模式
- 参数面板可实时调整粒子数量、速度与颜色，并可暂停、重置
- 深色 / 浅色主题切换，跟随系统偏好并记住选择
- 响应式布局，键盘可操作的控件，支持 `prefers-reduced-motion`
- 纯静态、无构建步骤、无第三方依赖，页面离开视野时自动休眠

## 目录结构

```
docs/
  index.html          页面结构
  assets/styles.css   样式与主题
  assets/app.js       交互逻辑与粒子模拟
.github/workflows/
  pages.yml           GitHub Pages 部署工作流
```

## 本地预览

```bash
cd docs
python3 -m http.server 8000
# 打开 http://localhost:8000
```

## 部署

站点通过 GitHub Actions 从 `docs/` 目录发布到 GitHub Pages。向 `master`
推送涉及 `docs/` 的改动后会自动重新部署，也可以在 Actions 页面手动触发
「Deploy to GitHub Pages」工作流。

仓库使用账户的自定义域名，因此访问地址为
<https://mingchao.wang/agent-playground/>；`https://wmc1992.github.io/agent-playground/`
会跳转到同一地址。
