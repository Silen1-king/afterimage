# 残影 · Afterimage

Silen1 看过的电影、剧集、动画与纪录片。Live at <https://silen1.com/afterimage/>.

纯静态网站：Three.js（`vendor/`）+ ES modules，无需构建，GitHub Pages 直接从 `main` 发布。

## 加一部作品

1. 编辑 `data/works.js`，往 `WORKS` 里加一项（字段见下表）。
2. 有票根或剧照的话放进 `stills/`（剧照宽 1200 以内，写上 `credit`）。
3. 标题里如果有新汉字：`sh tools/subset-fonts.sh <完整字体目录>` 重新裁剪字体。
4. `node tools/build-pages.mjs` 生成这部作品的分享页 `w/<id>/` 和分享图 `og/<id>.jpg`（需要 Playwright）。

| 字段 | 说明 |
| --- | --- |
| `id` | 英文短名（小写字母、数字、横线），链接是 `/afterimage/w/<id>/` |
| `type` | `film` 电影 · `series` 剧集 · `animation` 动画 · `documentary` 纪录（一部只属于一类） |
| `title` / `title_en` | 中文名 / 英文名 |
| `year` | 年份 |
| `meta` | 一行信息，如导演和片长；剧集写 `N seasons` 会在卡片上画出 N 格 |
| `palette` | 三个颜色，代表这部作品（不用海报，避开版权） |
| `seen` | 哪天看的（可选），`2025-12-21` |
| `still` | 票根或剧照（可选）：`kind`（`ticket` / `frame`）、`src`、`w`、`h`、`alt`、`caption`、`credit`；英文界面用 `alt_en`、`caption_en` |
| `line` / `note` | 一句话 / 一段感想（`note` 里空一行就是新段落） |
| `line_en` / `note_en` | 英文界面里的版本（可选；没有就显示中文原文） |
| `link` | IMDb 或豆瓣链接 |

## 界面

- 语言：第一次按设备语言（中文设备是中文，其它是英文），顶栏「中 / EN」可切换并记住。文字在 `js/i18n.js`。
- 开场：同一个标签页只播一次，之后直接进放映。
- 放映机声音：顶栏右边的小音柱，默认关；全部用 Web Audio 现场合成（`js/sound.js`）。
- 加载进度：`js/boot.js` 先预热三维引擎和字体，再载入 `js/main.js`。

## 调试参数

- `?at=3` 直接停在第 4 部
- `?intro` 即使看过也重新播开场
- `?capture` 逐帧渲染（`window.__frame()`），用于导出预览视频
