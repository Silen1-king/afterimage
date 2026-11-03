// 残影 · AFTERIMAGE — 看过的作品
// 这里只放 Silen1 真正看过的。改完运行 node tools/build-pages.mjs，生成每部作品的分享页和分享图。
// type（按作品形式分，一部作品只属于一类）：
//   film 电影 —— 真人电影
//   series 剧集 —— 真人剧集，美剧/英剧/韩剧/国产剧都算
//   animation 动画 —— 所有动画，不论长片还是番剧（千与千寻、攻壳、边缘行者都在这里）
//   documentary 纪录 —— 纪录片和纪录剧集（优先于以上三类）
// palette: 三个颜色，是这部作品留在脑子里的「色谱」（不用海报，避开版权）
// seen: 哪天看的（可选）
// still: 一张图（可选）。kind: 'ticket' 票根（自己拍的） | 'frame' 剧照（宽 1200 以内的低清图 + credit 注明出处）
//        caption 写在图下面；横图放在文字栏里，竖图放在右侧
//        只在点进作品之后出现，由粒子拼出来；没有就不显示
//        alt / caption 是中文；alt_en / caption_en 是英文界面用的（可选，没有就显示中文）
// line / note: 一句话 / 感想，留空就不显示
// line_en / note_en: 英文界面里显示的版本（可选；没有就显示中文原文）
export const WORKS = [
  {
    id: 'avatar-fire-and-ash', type: 'film',
    title: '阿凡达：火与烬', title_en: 'Avatar: Fire and Ash', year: 2025,
    meta: 'James Cameron · IMAX 3D',
    palette: ['#ff5a1f', '#2a8ea0', '#1a0c08'],
    seen: '2025-12-21',
    still: {
      kind: 'ticket', src: 'stills/avatar-fire-and-ash.webp', w: 860, h: 1289,
      alt: '《阿凡达：火与烬》IMAX 3D 电影票根：2025 年 12 月 21 日 15:55，1 号 IMAX 厅，7 排 13 座',
      caption: '2025.12.21 15:55 · IMAX 3D · 7排13座',
      alt_en: 'IMAX 3D ticket stub for Avatar: Fire and Ash — 21 Dec 2025, 15:55, IMAX Hall 1, row 7, seat 13',
      caption_en: '2025.12.21 15:55 · IMAX 3D · ROW 7 SEAT 13'
    },
    line: '',
    note: '',
    link: 'https://www.imdb.com/title/tt1757678/'
  },
  {
    id: 'edgerunners', type: 'animation',
    title: '赛博朋克：边缘行者', title_en: 'Cyberpunk: Edgerunners', year: 2022,
    meta: 'Studio Trigger · Season 1 · 10 episodes',
    palette: ['#f4e41e', '#3db7e0', '#04060c'],
    still: {
      kind: 'frame', src: 'stills/edgerunners.webp', w: 1200, h: 598,
      alt: '《赛博朋克：边缘行者》画面：大卫和露西背对镜头坐在月面上，望着地球',
      alt_en: 'Still from Cyberpunk: Edgerunners — David and Lucy sit on the moon with their backs to us, looking at Earth',
      credit: '© CD PROJEKT RED · Studio Trigger / Netflix'
    },
    line: '追逐、陪伴、遗憾',
    note: '',
    link: 'https://www.imdb.com/title/tt12590266/'
  }
];

export const TYPES = {
  film: { zh: '电影', en: 'FILM' },
  series: { zh: '剧集', en: 'SERIES' },
  animation: { zh: '动画', en: 'ANIMATION' },
  documentary: { zh: '纪录', en: 'DOCUMENTARY' }
};
