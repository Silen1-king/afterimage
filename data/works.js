// 残影 · AFTERIMAGE — 看过的作品
// 原型阶段：以下全部是「示例」，等 Silen1 换成自己真正看过的，并写上自己的话。
// type（按作品形式分，一部作品只属于一类）：
//   film 电影 —— 真人电影
//   series 剧集 —— 真人剧集，美剧/英剧/韩剧/国产剧都算
//   animation 动画 —— 所有动画，不论长片还是番剧（千与千寻、攻壳、边缘行者都在这里）
//   documentary 纪录 —— 纪录片和纪录剧集（优先于以上三类）
// palette: 三个颜色，是这部作品留在脑子里的「色谱」（不用海报，避开版权）
export const WORKS = [
  {
    id: 'blade-runner-2049', type: 'film', sample: true,
    title: '银翼杀手 2049', title_en: 'Blade Runner 2049', year: 2017,
    meta: 'Denis Villeneuve · 164 min',
    palette: ['#ff7a1a', '#1c6f7a', '#2a0f08'],
    line: '（示例）一句话写在这里。',
    note: '（示例）这里是你看完之后想说的话。可以很长，也可以只有一行。',
    link: 'https://www.imdb.com/title/tt1856101/'
  },
  {
    id: 'spirited-away', type: 'animation', sample: true,
    title: '千与千寻', title_en: 'Spirited Away', year: 2001,
    meta: '宫崎骏 · 125 min',
    palette: ['#e8433a', '#2fb3a5', '#1b1340'],
    line: '（示例）一句话写在这里。',
    note: '（示例）这里是你看完之后想说的话。',
    link: 'https://www.imdb.com/title/tt0245429/'
  },
  {
    id: 'breaking-bad', type: 'series', sample: true,
    title: '绝命毒师', title_en: 'Breaking Bad', year: 2008,
    meta: '5 seasons · 62 episodes',
    palette: ['#f2c230', '#2f7d46', '#3a2a12'],
    line: '（示例）一句话写在这里。',
    note: '（示例）这里是你看完之后想说的话。',
    link: 'https://www.imdb.com/title/tt0903747/'
  },
  {
    id: 'interstellar', type: 'film', sample: true,
    title: '星际穿越', title_en: 'Interstellar', year: 2014,
    meta: 'Christopher Nolan · 169 min',
    palette: ['#f3d9a4', '#4a6d8c', '#0b0d14'],
    line: '（示例）一句话写在这里。',
    note: '（示例）这里是你看完之后想说的话。',
    link: 'https://www.imdb.com/title/tt0816692/'
  },
  {
    id: 'edgerunners', type: 'animation', sample: true,
    title: '赛博朋克：边缘行者', title_en: 'Cyberpunk: Edgerunners', year: 2022,
    meta: '1 season · 10 episodes',
    palette: ['#fcee0a', '#ff2e88', '#0a1630'],
    line: '（示例）一句话写在这里。',
    note: '（示例）这里是你看完之后想说的话。',
    link: 'https://www.imdb.com/title/tt12590266/'
  },
  {
    id: 'black-mirror', type: 'series', sample: true,
    title: '黑镜', title_en: 'Black Mirror', year: 2011,
    meta: '7 seasons · anthology',
    palette: ['#9fd3ff', '#3e4a5c', '#05070b'],
    line: '（示例）一句话写在这里。',
    note: '（示例）这里是你看完之后想说的话。',
    link: 'https://www.imdb.com/title/tt2085059/'
  },
  {
    id: 'ghost-in-the-shell', type: 'animation', sample: true,
    title: '攻壳机动队', title_en: 'Ghost in the Shell', year: 1995,
    meta: '押井守 · 83 min',
    palette: ['#5dffb0', '#2a5e6b', '#06120f'],
    line: '（示例）一句话写在这里。',
    note: '（示例）这里是你看完之后想说的话。',
    link: 'https://www.imdb.com/title/tt0113568/'
  },
  {
    id: 'stranger-things', type: 'series', sample: true,
    title: '怪奇物语', title_en: 'Stranger Things', year: 2016,
    meta: '5 seasons',
    palette: ['#ff2a2a', '#3b2b7a', '#0a0508'],
    line: '（示例）一句话写在这里。',
    note: '（示例）这里是你看完之后想说的话。',
    link: 'https://www.imdb.com/title/tt4574334/'
  },
  {
    id: 'in-the-mood-for-love', type: 'film', sample: true,
    title: '花样年华', title_en: 'In the Mood for Love', year: 2000,
    meta: '王家卫 · 98 min',
    palette: ['#c8102e', '#d9a441', '#1a0a0c'],
    line: '（示例）一句话写在这里。',
    note: '（示例）这里是你看完之后想说的话。',
    link: 'https://www.imdb.com/title/tt0118694/'
  },
  {
    id: 'planet-earth', type: 'documentary', sample: true,
    title: '地球脉动', title_en: 'Planet Earth', year: 2006,
    meta: 'BBC · 11 episodes',
    palette: ['#7fd8a6', '#2a6f97', '#06140f'],
    line: '（示例）一句话写在这里。',
    note: '（示例）这里是你看完之后想说的话。',
    link: 'https://www.imdb.com/title/tt0795176/'
  }
];

export const TYPES = {
  film: { zh: '电影', en: 'FILM' },
  series: { zh: '剧集', en: 'SERIES' },
  animation: { zh: '动画', en: 'ANIMATION' },
  documentary: { zh: '纪录', en: 'DOCUMENTARY' }
};
