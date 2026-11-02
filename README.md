# 残影 · Afterimage

Silen1 看过的电影、剧集、动画与纪录片。Live at <https://silen1.com/afterimage/>.

纯静态网站：Three.js（`vendor/`）+ ES modules，无需构建，GitHub Pages 直接从 `main` 发布。

## 加一部作品

编辑 `data/works.js`，往 `WORKS` 里加一项：

| 字段 | 说明 |
| --- | --- |
| `id` | 英文短名，用作链接 `#/id` |
| `type` | `film` 电影 · `series` 剧集 · `animation` 动画 · `documentary` 纪录（一部只属于一类） |
| `title` / `title_en` | 中文名 / 英文名 |
| `year` | 年份 |
| `meta` | 一行信息，如导演和片长；剧集写 `N seasons` 会在卡片上画出 N 格 |
| `palette` | 三个颜色，代表这部作品（不用海报，避开版权） |
| `line` / `note` | 一句话 / 一段感想（`note` 里空一行就是新段落） |
| `link` | IMDb 或豆瓣链接 |
| `sample` | 示例条目才写 `true` |

标题里如果有新汉字，运行 `sh tools/subset-fonts.sh <完整字体目录>` 重新裁剪字体。

## 调试参数

- `?at=3` 直接停在第 4 部
- `?capture` 逐帧渲染（`window.__frame()`），用于导出预览视频
