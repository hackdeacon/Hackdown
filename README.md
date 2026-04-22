# Hackdown

一个开箱即用的静态网页工具，用于把 Markdown 转成适合微信公众号编辑器粘贴的内容。

## 功能

- Markdown 实时渲染预览
- 支持 GFM（列表、表格、代码块）
- 代码高亮（JS / Bash / JSON / Python）
- 4 套公众号风格主题
- 一键复制 HTML / 富文本
- 导入 `.md` 文件
- 下载渲染后的 HTML
- 自动保存草稿（`localStorage`）

## 使用

1. 直接双击打开 `index.html`（或用任意静态服务器打开）。
2. 左侧输入 Markdown，右侧查看公众号样式预览。
3. 点击“复制富文本”后粘贴到微信公众号编辑器。

## 注意

- 首次打开依赖 CDN（`marked`、`dompurify`、`highlight.js`）。
- 部分浏览器对富文本剪贴板权限较严格，若失败可退化使用“复制 HTML”。
