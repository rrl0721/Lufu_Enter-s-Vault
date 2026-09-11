# 部署指南 · lufusblog.top

静态站（Astro SSG），推荐托管 **Cloudflare Pages**（境外、免备案）。

## 一、推送到 GitHub

```sh
cd ~/项目/blog
git remote add origin git@github.com:rrl0721/<仓库名>.git   # 或 https://github.com/rrl0721/<仓库名>.git
git push -u origin main
```

## 二、Cloudflare Pages

1. Cloudflare Dashboard → **Workers & Pages** → Create → **Pages** → Connect to Git
2. 选择仓库，构建设置：

| 项 | 值 |
|---|---|
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| 环境变量 | `NODE_VERSION=22` |

3. Save and Deploy（首次构建约 1 分钟）

## 三、绑定域名

- Pages 项目 → **Custom domains** → 添加 `lufusblog.top`（建议再加 `www`）
- 域名 DNS 托管在 Cloudflare：自动添加记录
- DNS 在别处：把 NS 转到 Cloudflare，或加 CNAME 指向 `<项目>.pages.dev`

## 四、数据更新（B站 / Steam）

- 数据在**构建时**抓取（`src/lib/social.ts`），写入 `src/data/social-cache.json` + 头像到 `public/social/`，抓取失败自动用缓存兜底
- 刷新方式：CF Pages → Deployments → **Retry deployment**，或推一次提交
- 想要每天自动刷新：CF 里建 **Deploy Hook** + 外部 cron（如 GitHub Actions schedule）

## 五、本地开发

```sh
npm install
npm run dev                 # http://localhost:4321
npm run build               # 产物在 dist/（含 Pagefind 索引）
npm run preview             # 预览构建产物 http://localhost:4322
```

> 本地构建时 Steam 抓取需要代理：`https_proxy=http://127.0.0.1:7897 npm run build`
> Cloudflare 构建环境在境外，可直连，无需代理。

## 备注

- 站点地址已配置：`astro.config.mjs` → `site: 'https://lufusblog.top'`（RSS 绝对链接用）
- RSS：`/rss.xml`；搜索：Pagefind（构建时生成）
