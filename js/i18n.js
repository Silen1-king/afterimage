// 中文 / English 界面文字。语言由 boot.js 按设备语言决定（zh 开头 → 中文，其它 → English），
// 顶栏的「中 / EN」可以切换，切换结果记在 localStorage。
// 作品本身的文字（标题、你写的话）在 data/works.js；英文界面里没有英文版的就显示中文原文。
const KEY = 'afterimage:lang';

export const STR = {
  zh: {
    title: '残影 · Afterimage — Silen1',
    kicker: 'Silen1 · 放映中',
    sub: '看过的故事，在视网膜上留下的光。<br><span class="mono">Films, series, animation &amp; documentaries that stayed after the lights came on.</span>',
    enter: '进入放映<span class="mono">ENTER</span>',
    home: '<span aria-hidden="true">←</span><span class="bar__home-t"> SILEN1</span>',
    homeAria: '回到 Silen1 的博客 silen1.com',
    markAria: '残影 Afterimage 首页',
    filtersAria: '分类',
    all: '全部', film: '电影', series: '剧集', animation: '动画', documentary: '纪录',
    hint: '滚动穿行 · 点击进入', hintTouch: '滑动穿行 · 轻点进入',
    railAria: '作品进度',
    palette: '残影色谱 · AFTERIMAGE PALETTE',
    back: '<span aria-hidden="true">←</span> 返回 <kbd>ESC</kbd>',
    next: '下一部 <span aria-hidden="true">→</span>',
    indexTitle: '片单 <span class="mono">INDEX</span>',
    indexAria: '打开片单',
    close: 'CLOSE ✕',
    langAria: '切换到英文 · Switch to English',
    soundOn: '关掉放映机的声音', soundOff: '打开放映机的声音',
    ticket: '票根 · TICKET STUB', frame: '定格 · FREEZE FRAME',
    badgeTicket: '附票根', badgeFrame: '附定格',
    tagTicket: '票根', tagFrame: '定格',
    seen: 'SEEN'
  },
  en: {
    title: 'Afterimage 残影 — Silen1',
    kicker: 'Silen1 · Now showing',
    sub: 'Stories that stayed after the lights came on.<br><span class="intro__sub-zh">看过的故事，在视网膜上留下的光。</span>',
    enter: 'Roll film<span class="mono">ENTER</span>',
    home: '<span aria-hidden="true">←</span><span class="bar__home-t"> SILEN1</span>',
    homeAria: 'Back to Silen1’s blog, silen1.com',
    markAria: 'Afterimage home',
    filtersAria: 'Categories',
    all: 'All', film: 'Film', series: 'Series', animation: 'Animation', documentary: 'Documentary',
    hint: 'Scroll to travel · Click to enter', hintTouch: 'Swipe to travel · Tap to enter',
    railAria: 'Progress',
    palette: 'AFTERIMAGE PALETTE',
    back: '<span aria-hidden="true">←</span> Back <kbd>ESC</kbd>',
    next: 'Next <span aria-hidden="true">→</span>',
    indexTitle: 'Index <span class="mono">ALL WORKS</span>',
    indexAria: 'Open the index',
    close: 'CLOSE ✕',
    langAria: '切换到中文 · Switch to Chinese',
    soundOn: 'Turn the projector sound off', soundOff: 'Turn the projector sound on',
    ticket: 'TICKET STUB', frame: 'FREEZE FRAME',
    badgeTicket: 'TICKET STUB', badgeFrame: 'FREEZE FRAME',
    tagTicket: 'TICKET', tagFrame: 'STILL',
    seen: 'SEEN'
  }
};

export let lang = document.documentElement.dataset.lang === 'en' ? 'en' : 'zh';
export const t = (k) => STR[lang][k] ?? STR.zh[k] ?? k;
export const isEn = () => lang === 'en';

// 作品字段：英文界面优先用 *_en，没有就退回中文
export const pick = (obj, field) => (lang === 'en' && obj && obj[`${field}_en`]) || (obj && obj[field]) || '';

// 把带 data-i18n / data-i18n-aria 的静态文字换成当前语言
export function applyStatic(root = document) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    let k = el.dataset.i18n;
    if (k === 'hint' && coarse) k = 'hintTouch';
    el.innerHTML = t(k);
  });
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  document.documentElement.dataset.lang = lang;
}

export function setLang(l) {
  lang = l === 'en' ? 'en' : 'zh';
  try { localStorage.setItem(KEY, lang); } catch (e) { /* 隐私模式存不了也没关系 */ }
  applyStatic();
}
