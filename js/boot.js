// 残影 · 启动器：比 main.js 先跑。
// 1. 决定界面语言（记过的优先，否则看设备语言：zh 开头是中文，其它是英文）
// 2. 这个标签页已经看过开场，就直接进放映
// 3. 预热三维引擎和字体，显示「放映机预热 37%」，然后再载入 main.js
(function () {
  var root = document.documentElement;
  var lang = null;
  try { lang = localStorage.getItem('afterimage:lang'); } catch (e) { /* 隐私模式 */ }
  if (lang !== 'zh' && lang !== 'en') {
    var prefs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'zh-CN'];
    lang = /^zh\b/i.test(prefs[0] || '') ? 'zh' : 'en';
  }
  root.dataset.lang = lang;
  root.lang = lang === 'en' ? 'en' : 'zh-CN';

  var params = new URLSearchParams(location.search);
  var seen = false;
  try { seen = sessionStorage.getItem('afterimage:intro') === '1'; } catch (e) { /* 存不了就每次都播 */ }
  if (seen && !params.has('intro')) root.classList.add('skip-intro');

  var label = document.getElementById('loader-label');
  var num = document.getElementById('loader-n');
  var fill = document.getElementById('loader-fill');
  var loader = document.getElementById('loader');
  if (label) label.textContent = lang === 'en' ? 'Warming up the projector' : '放映机预热';

  // 大致的字节数，只用来算进度（服务器压缩传输时 content-length 不准）
  var ASSETS = [
    ['vendor/three.module.min.js', 692000],
    ['assets/fonts/noto-serif-sc-600.woff2', 35000],
    ['assets/fonts/noto-serif-sc-400.woff2', 35000],
    ['assets/fonts/jetbrains-mono-latin-400-normal.woff2', 21000],
    ['assets/fonts/jetbrains-mono-latin-500-normal.woff2', 22000],
    ['assets/fonts/space-grotesk-latin-300-normal.woff2', 13000],
    ['assets/fonts/space-grotesk-latin-500-normal.woff2', 13000],
    ['js/main.js', 50000]
  ];
  var total = 0, got = [], shown = 0, target = 0, done = false;
  ASSETS.forEach(function (a, i) { total += a[1]; got[i] = 0; });

  function paint() {
    shown += (target - shown) * 0.25;
    if (target - shown < 0.4) shown = target;
    var p = Math.floor(shown);
    if (num) num.textContent = p < 10 ? '0' + p : String(p);
    if (fill) fill.style.transform = 'scaleX(' + (shown / 100).toFixed(3) + ')';
    if (!done || shown < 100) requestAnimationFrame(paint);
  }
  function update() {
    var sum = 0;
    for (var i = 0; i < ASSETS.length; i++) sum += Math.min(got[i], ASSETS[i][1]);
    target = Math.max(target, Math.min(90, (sum / total) * 90));
  }
  function load(a, i) {
    return fetch(a[0]).then(function (r) {
      if (!r.ok) throw new Error(a[0] + ' ' + r.status);
      if (!r.body || !r.body.getReader) return r.arrayBuffer().then(function () { got[i] = a[1]; update(); });
      var reader = r.body.getReader();
      function pump() {
        return reader.read().then(function (res) {
          if (res.done) { got[i] = a[1]; update(); return; }
          got[i] += res.value.byteLength; update();
          return pump();
        });
      }
      return pump();
    }).catch(function () { got[i] = a[1]; update(); });   // 预热失败不要紧，main.js 会自己再要一次
  }
  requestAnimationFrame(paint);
  requestAnimationFrame(function () { if (loader && !done) loader.classList.add('is-on'); });

  // main.js 准备好以后会发 afterimage:ready
  document.addEventListener('afterimage:ready', function () {
    done = true; target = 100;
    setTimeout(function () { if (loader) loader.classList.add('is-done'); }, 180);
    setTimeout(function () { if (loader) loader.hidden = true; }, 1400);
  }, { once: true });

  Promise.all(ASSETS.map(load)).then(function () {
    // 下载完了，剩下的是搭场景：慢慢爬到 97
    var creep = setInterval(function () { if (done) return clearInterval(creep); target = Math.min(97, target + 1.2); }, 120);
    return import('./main.js');
  }).catch(function (err) {
    if (document.body.classList.contains('no-webgl')) return;   // 没有 WebGL：main.js 已经换成片单，不算出错
    if (label) label.textContent = lang === 'en' ? 'The projector jammed — please reload' : '放映机卡住了 · 刷新一下试试';
    if (loader) loader.classList.add('is-error');
    console.error(err);
  });
})();
