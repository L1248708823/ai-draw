# 画图工作台

一个偏编辑刊物风的中文对话式生图网站，第一版只做最小链路：

- 输入提示词
- 上传多张参考图
- 选择尺寸
- 调用 Right Codes 生图
- 展示结果
- 复制提示词
- 下载图片
- 浏览器本地历史

## 技术栈

- Next.js
- TypeScript
- 原生 CSS

## 本地启动

先由你在本机执行依赖安装：

```bash
pnpm install
```

复制环境变量文件：

```bash
cp .env.example .env.local
```

然后把 `.env.local` 里的 `RIGHT_CODES_API_KEY` 改成你自己的 key。

开发环境启动：

```bash
pnpm dev
```

构建检查：

```bash
pnpm build
```

## 环境变量

`RIGHT_CODES_API_KEY`

- 必填
- Right Codes 的 API Key

`RIGHT_CODES_BASE_URL`

- 可选
- 默认值：`https://www.right.codes/draw`

`RIGHT_CODES_IMAGE_MODEL`

- 可选
- 默认值：`gpt-image-2-vip`

## 站点头像

当前代码默认读取：

`public/favicon.png`

这个文件当前用于：

- 浏览器标签页图标

注意：

- 如果直接拿它做 favicon，小尺寸下识别会一般
- 更稳的做法是后面再单独做一个简化版 favicon

## 当前实现边界

已实现：

- 对话式单页工作台
- 多图参考上传
- 服务端转发 Right Codes 生图
- 下载代理路由
- 本地历史记录

暂未实现：

- 登录
- 云端历史
- 真正的聊天补全
- 多模型切换
- 异步任务队列

## 目录说明

`app/`

- 页面与 API 路由

`components/`

- 主界面组件

`lib/`

- Right Codes 调用逻辑与共享类型

`docs/plans/`

- 设计文档
