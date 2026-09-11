---
title: 用 Astro 搭这个站
date: 2026-09-10
tags: [技术, Astro, 前端]
summary: 记录一下本站的技术选型：为什么是 Astro，以及动画和交互怎么做的。
---

## 为什么选 Astro

需求很简单：**静态内容要快，交互要能加，动画要丝滑**。

Astro 的 islands 架构刚好合适：

- 页面默认零 JS（快）
- 需要交互的组件才"水合"（按需加载）
- Markdown 写作 + 组件自由混排

## 动画怎么做的

### 1. 滚动出现

用 `IntersectionObserver` 给元素加 `.in` 类，配合 CSS transition：

```js
const io = new IntersectionObserver((es) => {
  for (const e of es) if (e.isIntersecting) e.target.classList.add('in');
}, { threshold: 0.12 });
```

### 2. 渐变流动

标题用 `background-clip: text` + 位移动画，做出流动的渐变：

```css
.grad {
  background: linear-gradient(120deg, var(--accent), var(--accent-2), var(--accent));
  background-size: 200% 200%;
  -webkit-background-clip: text;
  color: transparent;
  animation: flow 6s ease infinite;
}
```

## 下一步

- [ ] 加上 View Transitions（页面切换动画）
- [ ] 评论区（Giscus）
- [ ] 图片灯箱
- [ ] 全文搜索

慢慢来。
