// 残影 · AFTERIMAGE
// 一条缓慢扭转的光带穿过黑暗；每部作品是悬在带上的一块「玻璃胶片」。
// 滚动 = 摄影机沿光带推进；点击 = 镜头穿进胶片，粒子化作这部作品的颜色把你包住。
import * as THREE from '../vendor/three.module.min.js';
import { WORKS, TYPES } from '../data/works.js';

const $ = (s) => document.querySelector(s);
const body = document.body;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const pad2 = (n) => String(n).padStart(2, '0');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, t) => { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeInOut = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
// 录屏模式（?capture）：用固定步长的虚拟时间逐帧渲染，方便导出流畅的预览视频
const CAPTURE = new URLSearchParams(location.search).has('capture');
let vtime = 0;
const now = () => CAPTURE ? vtime * 1000 : performance.now();

/* ------------------------------------------------------------------ DOM: 目录 / 进度轨 */
const indexList = $('#index-list');
WORKS.forEach((w, i) => {
  const li = document.createElement('li');
  li.innerHTML = `<button type="button" data-id="${w.id}" style="--c:${w.palette[0]}">
    <span class="n mono">${pad2(i + 1)}</span>
    <span class="t">${w.title}<small>${w.title_en} · ${w.year}</small></span>
    <span class="k mono"><b class="fmt" data-k="${w.type}"></b>${TYPES[w.type].zh} · ${TYPES[w.type].en}</span>
    <span class="sw">${w.palette.map((c) => `<i style="background:${c}"></i>`).join('')}</span></button>`;
  indexList.appendChild(li);
});
$('#index-n').textContent = WORKS.length;
$('#intro-count').textContent = Object.keys(TYPES).map((k) => `${pad2(WORKS.filter((w) => w.type === k).length)} ${TYPES[k].en}`).join(' · ');

/* ------------------------------------------------------------------ WebGL 检测 */
const canvas = $('#stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (e) { renderer = null; }

if (!renderer) {
  body.classList.add('no-webgl', 'is-ready');
  $('#index').hidden = false;
  $('#close-index').hidden = true;
  indexList.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]'); if (b) { const w = WORKS.find((x) => x.id === b.dataset.id); if (w) window.open(w.link, '_blank', 'noopener'); }
  });
  throw new Error('WebGL unavailable — showing index fallback');
}

/* ------------------------------------------------------------------ 基础场景 */
const isPortrait = () => innerWidth / innerHeight < 0.85;
let DPR = Math.min(devicePixelRatio || 1, coarse ? 1.5 : 1.75);
renderer.setPixelRatio(DPR);
renderer.setClearColor(0x050507, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 120);

// 光带的中轴：一条向 -z 延伸、轻轻摆动的曲线
const N = WORKS.length;
const SPACING = 7.5;
const pathPts = [];
for (let i = -3; i <= N + 3; i++) {
  pathPts.push(new THREE.Vector3(Math.sin(i * 0.85) * 2.4, Math.cos(i * 0.63) * 1.1, -i * SPACING));
}
const curve = new THREE.CatmullRomCurve3(pathPts, false, 'catmullrom', 0.5);
const LEN = curve.getLength();
const uStart = (3 * SPACING) / LEN;         // 曲线上 i=0 的大致位置
const slotU = (j) => uStart + ((j + 0.6) * SPACING) / LEN;
const CAM_BACK = 4.6 / LEN;                 // 摄影机停在卡片前方多远

const shared = {
  uTime: { value: 0 },
  uWarp: { value: 0 },
  uBirth: { value: reduceMotion ? 1 : 0 },
  uMouse: { value: new THREE.Vector3(0, 0, -999) },
  uTint: { value: new THREE.Color('#ff7a1a') },
  uTintAmt: { value: 0 },
  uPx: { value: DPR }
};

/* ------------------------------------------------------------------ GLSL 公用 */
const NOISE = /* glsl */`
float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<5;i++){ v+=a*vnoise(p); p=m*p; a*=.5; } return v; }
vec3 nebula(vec2 p, float t, vec3 c1, vec3 c2, vec3 c3){
  vec2 q = vec2(fbm(p + vec2(0., t*.07)), fbm(p + vec2(5.2, 1.3) - t*.05));
  vec2 r = vec2(fbm(p + 3.5*q + vec2(1.7, 9.2) + t*.04), fbm(p + 3.5*q + vec2(8.3, 2.8)));
  float n = fbm(p + 3.*r);
  vec3 col = mix(c3, c2, smoothstep(.15, .75, n));
  col = mix(col, c1, smoothstep(.45, .95, length(q)*n*1.2));
  col += c1 * pow(smoothstep(.55, 1., r.x), 3.) * .9;
  return col;
}`;

/* ------------------------------------------------------------------ 粒子：双螺旋光带 + 浮尘 */
const COUNT = coarse ? 26000 : 64000;
const frames = curve.computeFrenetFrames(400, false);
const pos = new Float32Array(COUNT * 3);
const col = new Float32Array(COUNT * 3);
const rnd = new Float32Array(COUNT * 4);
const tmp = new THREE.Vector3(), nrm = new THREE.Vector3(), bin = new THREE.Vector3();
const cA = new THREE.Color(), cB = new THREE.Color();
for (let k = 0; k < COUNT; k++) {
  const kind = Math.random();
  const u = Math.random();
  const p = curve.getPointAt(u);
  const fi = Math.min(399, Math.floor(u * 400));
  nrm.copy(frames.normals[fi]); bin.copy(frames.binormals[fi]);
  let r, a;
  if (kind < 0.7) {                  // 两股扭转的光带（像一段被拧过的胶片）
    const strand = k % 2;
    const across = (Math.random() - 0.5);
    a = u * LEN * 0.42 + strand * Math.PI + across * 0.62;
    r = 2.9 + (Math.random() - 0.5) * 0.22 + Math.pow(Math.random(), 6) * 1.6 * Math.sign(across);
  } else if (kind < 0.84) {          // 贴着光带的「片孔」：等距的小亮点
    const strand = k % 2;
    const step = Math.min(1, Math.round(u * LEN * 2.2) / (LEN * 2.2));
    p.copy(curve.getPointAt(step));
    a = step * LEN * 0.42 + strand * Math.PI + (strand ? .42 : -.42);
    r = 3.25;
  } else {                           // 远处浮尘
    a = Math.random() * Math.PI * 2;
    r = 4.5 + Math.pow(Math.random(), 0.6) * 16;
  }
  tmp.copy(p).addScaledVector(nrm, Math.cos(a) * r).addScaledVector(bin, Math.sin(a) * r);
  tmp.addScaledVector(frames.tangents[fi], (Math.random() - 0.5) * (kind < .84 ? .12 : 3));
  pos.set([tmp.x, tmp.y, tmp.z], k * 3);
  // 颜色：取离它最近的那部作品的色谱
  const j = clamp(Math.round((u - uStart) * LEN / SPACING - 0.6), 0, N - 1);
  const pal = WORKS[j].palette;
  cA.set(pal[0]); cB.set(pal[1]);
  const m = Math.random();
  cA.lerp(cB, m * m);
  if (kind >= 0.84) cA.lerp(new THREE.Color('#9aa6c8'), 0.55);
  if (Math.random() < 0.05) cA.set('#ffffff');
  col.set([cA.r, cA.g, cA.b], k * 3);
  rnd.set([Math.random(), Math.random(), Math.random(), kind < .7 ? 0 : kind < .84 ? 1 : 2], k * 4);
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
pGeo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));
const pMat = new THREE.ShaderMaterial({
  uniforms: shared,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    uniform float uTime, uWarp, uBirth, uPx, uTintAmt; uniform vec3 uMouse, uTint;
    attribute vec4 aRnd; attribute vec3 color;
    varying vec3 vCol; varying float vA;
    void main(){
      vec3 p = position;
      float t = uTime * (.25 + aRnd.y * .35);
      // 缓慢的流动（几层正弦近似的旋度噪声）
      p += vec3(sin(t + p.z*.35 + aRnd.x*6.28), cos(t*.8 + p.x*.4 + aRnd.z*6.28), sin(t*.6 + p.y*.5)) * (aRnd.w > 1.5 ? .55 : .16);
      // 鼠标附近的粒子被轻轻推开
      vec3 d = p - uMouse; float dl = length(d);
      p += normalize(d + 1e-4) * pow(max(0., 1. - dl / 2.2), 2.) * 1.1;
      // 诞生：粒子从一个光点里炸开
      float b = clamp((uBirth * 1.6 - aRnd.x * .6), 0., 1.); b = 1. - pow(1. - b, 3.);
      p = mix(vec3(0., 0., 12.) + (aRnd.xyz - .5) * .6, p, b);
      vec4 mv = modelViewMatrix * vec4(p, 1.);
      // 穿越：所有粒子向镜头冲过来
      mv.z += uWarp * uWarp * (14. + aRnd.y * 26.);
      gl_Position = projectionMatrix * mv;
      float size = (aRnd.w > 1.5 ? 1.6 : aRnd.w > .5 ? 2.6 : 1.9) * (.55 + aRnd.z * .9);
      size *= 1. + uWarp * 2.5;
      gl_PointSize = size * uPx * (36. / -mv.z);
      float fog = smoothstep(46., 6., -mv.z);
      float twinkle = .65 + .35 * sin(uTime * (1. + aRnd.y * 3.) + aRnd.x * 40.);
      vA = fog * twinkle * b * smoothstep(.15, .9, -mv.z) * (aRnd.w > 1.5 ? .55 : 1.);
      vCol = mix(color, uTint, uTintAmt * .6);
    }`,
  fragmentShader: /* glsl */`
    varying vec3 vCol; varying float vA;
    void main(){
      vec2 c = gl_PointCoord - .5; float d = length(c);
      float a = smoothstep(.5, 0., d); a *= a;
      gl_FragColor = vec4(vCol * (1. + smoothstep(.18, 0., d)), a * vA);
    }`
});
const points = new THREE.Points(pGeo, pMat);
points.frustumCulled = false;
scene.add(points);

/* ------------------------------------------------------------------ 玻璃胶片（作品卡） */
// 四类作品各有一种「片子的形态」，看外形就知道是什么：
//   电影 = 2.39:1 宽银幕胶片，上下两排片孔
//   剧集 = 16:9 电视屏，圆角 + 扫描线 + 每季一格刻度
//   动画 = 4:3 赛璐珞，色块分层 + 墨线 + 顶部定位孔
//   纪录 = 3:2 取景框，四角框线 + REC 红点 + 十字准星
const FORMATS = {
  film:        { k: 0, w: 3.5,  h: 1.465, r: .012, top: .15, bot: .15 },
  series:      { k: 1, w: 3.2,  h: 1.8,   r: .075, top: .09, bot: .09 },
  animation:   { k: 2, w: 2.8,  h: 2.1,   r: .018, top: .15, bot: .08 },
  documentary: { k: 3, w: 3.05, h: 2.03,  r: .018, top: .12, bot: .11 }
};
const cardGeos = {};
for (const [t, f] of Object.entries(FORMATS)) cardGeos[t] = new THREE.PlaneGeometry(f.w, f.h, 1, 1);
const cardVS = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;
const cardFS = /* glsl */`
  uniform sampler2D uTex; uniform vec3 uC1, uC2, uC3; uniform float uTime, uHover, uFocus, uDissolve, uOpacity, uSeed, uKind, uAsp, uR;
  varying vec2 vUv;
  ${NOISE}
  float rbox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
  float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h); }
  void main(){
    vec2 uv = vUv; float asp = uAsp;
    vec2 p = (uv - .5) * vec2(asp, 1.);
    float sd = rbox(p, vec2(asp * .5, .5), uR);
    float mask = smoothstep(.003, -.003, sd);
    float holes = 0.;   // 打穿的孔（片孔 / 定位孔），能看见后面的粒子
    float rim = 0.;     // 孔边的一圈亮线
    // 悬停时的横向撕裂
    float row = floor(uv.y * 34.); float tick = floor(uTime * 14.);
    float glitch = step(.94, hash(vec2(row, tick + uSeed))) * uHover;
    vec2 g = uv + vec2((hash(vec2(row, tick)) - .5) * .06 * glitch, 0.);
    vec3 neb = nebula((g - .5) * vec2(asp, 1.) * 2.2 + uSeed * 7., uTime * (1. + uHover * 2.), uC1, uC2, uC3);
    neb += uC1 * exp(-abs(uv.y - .62) * 26.) * .35 * (.6 + .4 * sin(uTime * .7 + uSeed));

    if (uKind < .5) {
      // 电影：上下片基 + 片孔
      float band = step(.5 - .105, abs(p.y));
      vec2 hp = vec2((fract(p.x / .15 + .5) - .5) * .15, abs(p.y) - (.5 - .052));
      float h = rbox(hp, vec2(.04, .024), .008);
      holes = band * smoothstep(.002, -.002, h);
      rim = band * smoothstep(.008, 0., abs(h)) * .6;
      vec3 base = mix(vec3(.05, .035, .025), uC1 * .22, .35);
      neb = mix(neb, base, band);
      neb += vec3(1.) * smoothstep(.004, 0., abs(abs(p.y) - (.5 - .105))) * .25;
    } else if (uKind < 1.5) {
      // 剧集：电视屏
      neb *= .88 + .12 * sin(uv.y * 700.);
      neb += vec3(.06) * smoothstep(.06, 0., abs(p.x + p.y * .8 - .55)) ;
      neb *= smoothstep(1.1, .35, length(p * vec2(.9, 1.4)));
    } else if (uKind < 2.5) {
      // 动画：赛璐珞平涂 + 墨线 + 定位孔
      float l = dot(neb, vec3(.3, .59, .11));
      float lv = l * 5.;
      float q = (floor(lv) + .55) / 5.;
      vec3 flat_ = neb / max(l, .02) * q;
      flat_ = mix(flat_, uC1 * 1.1, step(4., lv) * .6);
      float ink = 1. - smoothstep(0., fwidth(lv) * 1.6, min(fract(lv), 1. - fract(lv)));
      neb = mix(flat_, vec3(.03, .025, .04), ink * .85);
      vec2 c = vec2(0., .5 - .065);
      float hc = length(p - c) - .03;
      float hl = rbox(p - vec2(-.3, c.y), vec2(.07, .018), .018);
      float hr = rbox(p - vec2(.3, c.y), vec2(.07, .018), .018);
      float h = min(hc, min(hl, hr));
      holes = smoothstep(.002, -.002, h);
      rim = smoothstep(.008, 0., abs(h)) * .6;
    } else {
      // 纪录：取景框
      float l = dot(neb, vec3(.3, .59, .11));
      neb = mix(neb, vec3(l) * vec3(1.05, 1., .95), .38);
      neb *= .96 + .04 * sin(uTime * 23.);
      vec2 ins = vec2(asp * .5 - .075, .5 - .075);
      vec2 a = abs(p);
      float br = min(seg(a, ins, ins - vec2(.13, 0.)), seg(a, ins, ins - vec2(0., .13)));
      float cross = min(seg(p, vec2(-.035, 0.), vec2(.035, 0.)), seg(p, vec2(0., -.035), vec2(0., .035)));
      neb = mix(neb, vec3(1.), smoothstep(.006, .002, br) * .85 + smoothstep(.004, .0015, cross) * .45);
      float rec = length(p - vec2(-asp * .5 + .13, .5 - .16)) - .02;
      neb = mix(neb, vec3(1., .16, .16), smoothstep(.003, -.003, rec) * step(.45, fract(uTime * .9)));
    }

    // 文字（悬停时 RGB 分离）
    float ab = .0007 + uHover * .0028 + glitch * .012;
    float tr = texture2D(uTex, g + vec2(ab, 0.)).a, tg = texture2D(uTex, g).a, tb = texture2D(uTex, g - vec2(ab, 0.)).a;
    vec3 col = neb * (.42 + .58 * uFocus);
    col = mix(col, vec3(1.), vec3(tr, tg, tb) * (.55 + .45 * uFocus));
    col *= .93 + .07 * sin(uv.y * 520. + uTime * 4.);
    col += (hash(uv * 900. + fract(uTime)) - .5) * (uKind > 2.5 ? .13 : .07);
    col *= smoothstep(1.35, .25, length(p * vec2(.8 / max(1., asp * .6), 1.2)));
    col += rim * mix(vec3(.9), uC1, .4) * (.4 + .6 * uFocus);
    // 玻璃边缘：一圈会变色的高光
    float edge = smoothstep(.022, 0., abs(sd));
    vec3 iri = .5 + .5 * cos(6.2831 * (atan(p.y, p.x) / 6.2831 + uTime * .08 + vec3(0., .33, .67)));
    col += edge * mix(vec3(.9), iri, .55) * (.35 + .65 * max(uFocus, uHover));
    // 溶解
    float dn = fbm(uv * 5. + uSeed);
    float dis = smoothstep(uDissolve - .05, uDissolve, dn + .001);
    float burn = smoothstep(.09, 0., abs(dn - uDissolve)) * step(.001, uDissolve);
    col += uC1 * burn * 2.5;
    float alpha = mask * dis * uOpacity * (.9 + .1 * uFocus) * (1. - holes);
    if (alpha < .003) discard;
    gl_FragColor = vec4(col, alpha);
  }`;

function cardTexture(w, i) {
  const f = FORMATS[w.type];
  const W = 1280, H = Math.round(W * f.h / f.w);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const X = f.k === 3 ? 110 : 70;            // 取景框的框线在角上，文字往里收
  const top = H * f.top + 40, bot = H * (1 - f.bot);
  g.fillStyle = '#fff';
  g.textBaseline = 'alphabetic';
  g.font = '500 30px "JetBrains Mono"';
  g.letterSpacing = '6px';
  const no = `NO.${pad2(i + 1)}`;
  if (f.k === 3) { g.fillText('REC', H * .13 + 30, H * .16 + 11); g.fillText(no, W - X - g.measureText(no).width, top); }
  else g.fillText(no, X, top);
  const ty = `${TYPES[w.type].en} · ${w.year}`;
  if (f.k === 3) g.fillText(ty, W - X - g.measureText(ty).width, top + 44);
  else g.fillText(ty, W - X - g.measureText(ty).width, top);
  if (f.k !== 3) g.fillRect(X, top + 22, 60, 2);
  // 中文标题：按宽度和高度自适应字号
  let fs = Math.min(150, H * .19);
  g.letterSpacing = '10px';
  do { g.font = `600 ${fs}px "Afterimage Serif"`; fs -= 6; } while (g.measureText(w.title).width > W - X * 2 - 40 && fs > 50);
  const base = H * (f.k === 0 ? .555 : .63);
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 30;
  g.fillText(w.title, X, base);
  g.shadowBlur = 0;
  g.font = `300 ${Math.round(fs * .3 + 10)}px "Space Grotesk"`;
  g.letterSpacing = '4px';
  g.fillText(w.title_en.toUpperCase(), X + 4, base + fs * .3 + 40);
  g.font = '400 24px "JetBrains Mono"';
  g.globalAlpha = .7;
  g.letterSpacing = '5px';
  g.fillText(w.meta.toUpperCase(), X + 4, bot - 26);
  // 剧集：每季一格
  const seasons = f.k === 1 && +(w.meta.match(/(\d+)\s*seasons?/i) || [])[1];
  if (seasons) {
    g.globalAlpha = .9;
    for (let s = 0; s < seasons; s++) g.fillRect(W - X - (seasons - s) * 34 + 8, bot - 46, 26, 22);
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

const cards = WORKS.map((w, i) => {
  const f = FORMATS[w.type];
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: null }, uTime: shared.uTime,
      uC1: { value: new THREE.Color(w.palette[0]) }, uC2: { value: new THREE.Color(w.palette[1]) }, uC3: { value: new THREE.Color(w.palette[2]) },
      uHover: { value: 0 }, uFocus: { value: 0 }, uDissolve: { value: 0 }, uOpacity: { value: 0 }, uSeed: { value: i * 1.37 + .3 },
      uKind: { value: f.k }, uAsp: { value: f.w / f.h }, uR: { value: f.r }
    },
    vertexShader: cardVS, fragmentShader: cardFS, transparent: true, depthWrite: false, side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(cardGeos[w.type], mat);
  mesh.userData = { i, w, slot: i, pass: 0, pos: new THREE.Vector3(), cur: new THREE.Vector3(), quat: new THREE.Quaternion(), show: 1, hover: 0, tilt: new THREE.Vector2(), scatter: new THREE.Vector3((Math.random() - .5) * 30, (Math.random() - .5) * 20, (Math.random() - .5) * 10) };
  mesh.renderOrder = 2;
  scene.add(mesh);
  return mesh;
});

/* ------------------------------------------------------------------ 进入作品后的全屏星云 */
const veilMat = new THREE.ShaderMaterial({
  uniforms: { uTime: shared.uTime, uA: { value: 0 }, uC1: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uC3: { value: new THREE.Color() }, uAsp: { value: 1 }, uPortrait: { value: 0 } },
  vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: /* glsl */`
    uniform float uTime, uA, uAsp, uPortrait; uniform vec3 uC1, uC2, uC3; varying vec2 vUv;
    ${NOISE}
    void main(){
      vec2 p = (vUv - .5) * vec2(uAsp, 1.);
      // 进入时像穿过一个光圈：从中心向外打开
      float open = smoothstep(uA * 1.6 - .25, uA * 1.6, length(p) * .9);
      vec3 col = nebula(p * 1.6, uTime * .8, uC1, uC2, uC3);
      col += uC1 * exp(-abs(p.y - .12) * 9.) * .18;
      // 文字一侧压暗，保证可读
      float side = mix(smoothstep(.95, -.15, vUv.x), smoothstep(.0, .9, vUv.y), uPortrait);
      col *= mix(1., .35, side);
      col *= smoothstep(1.4, .3, length(p));
      col += (hash(vUv * 1200. + fract(uTime)) - .5) * .05;
      float a = (1. - open) * uA;
      if (a < .002) discard;
      gl_FragColor = vec4(col, a);
    }`,
  transparent: true, depthTest: false, depthWrite: false
});
const veil = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), veilMat);
veil.frustumCulled = false;
veil.renderOrder = -1;
scene.add(veil);
// 星云在最底，粒子仍浮在它前面：人在作品「里面」
points.renderOrder = 1;

/* ------------------------------------------------------------------ 布局（筛选后重新排队） */
let filter = 'all';
let visible = WORKS.map((_, i) => i);
const camPos = [], lookAt = [];
const tV = new THREE.Vector3(), tQ = new THREE.Quaternion(), tM = new THREE.Matrix4(), UP = new THREE.Vector3(0, 1, 0);

function layout() {
  camPos.length = 0; lookAt.length = 0;
  const portrait = isPortrait();
  visible.forEach((ci, j) => {
    const u = slotU(j);
    const side = portrait ? 0 : (j % 2 ? -1 : 1);
    const c = curve.getPointAt(Math.min(1, u)).add(new THREE.Vector3(side * .55, side * .12, 0));
    const cam = curve.getPointAt(Math.max(0, u - CAM_BACK));
    const d = cards[ci].userData;
    d.slot = j; d.pos.copy(c);
    cards[ci].scale.setScalar(portrait ? Math.min(.92, (innerWidth / innerHeight) * 1.5) : 1);
    tM.lookAt(cam, c, UP); d.quat.setFromRotationMatrix(tM);
    camPos.push(cam);
    // 宽屏把卡片放在画面偏右，左侧留给文字
    lookAt.push(c.clone().add(new THREE.Vector3(portrait ? 0 : -1.05, portrait ? -.35 : 0, 0)));
  });
  cards.forEach((m, ci) => { m.userData.show = visible.includes(ci) ? 1 : 0; });
  buildRail();
}

/* ------------------------------------------------------------------ 输入：滚动 / 触摸 / 键盘 */
let s = -1.6, sT = -1.6, vel = 0, lastInput = 0, entered = false;
const maxS = () => visible.length - 1;
function nudge(delta) {
  if (!entered || mode !== 'browse') return;
  sT = clamp(sT + delta, 0, maxS());
  lastInput = now();
}
addEventListener('wheel', (e) => {
  if (!$('#index').hidden || mode === 'detail') return;
  e.preventDefault();
  const d = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
  nudge(clamp(d, -100, 100) * 0.0026);
}, { passive: false });
let touchY = null, touchX = null;
addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; touchX = e.touches[0].clientX; }, { passive: true });
addEventListener('touchmove', (e) => {
  if (touchY == null || mode !== 'browse') return;
  const y = e.touches[0].clientY, x = e.touches[0].clientX;
  const d = Math.abs(y - touchY) > Math.abs(x - touchX) ? touchY - y : touchX - x;
  nudge(d * 0.008); touchY = y; touchX = x;
}, { passive: true });
addEventListener('touchend', () => { touchY = null; });
addEventListener('keydown', (e) => {
  if (!$('#index').hidden) { if (e.key === 'Escape') closeIndex(); return; }
  if (!entered) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enter(); } return; }
  if (mode === 'detail') { if (e.key === 'Escape') exitDetail(); if (e.key === 'ArrowRight') nextDetail(1); if (e.key === 'ArrowLeft') nextDetail(-1); return; }
  if (['ArrowDown', 'ArrowRight', 'PageDown', 'j'].includes(e.key)) { e.preventDefault(); sT = clamp(Math.round(sT) + 1, 0, maxS()); lastInput = now(); }
  if (['ArrowUp', 'ArrowLeft', 'PageUp', 'k'].includes(e.key)) { e.preventDefault(); sT = clamp(Math.round(sT) - 1, 0, maxS()); lastInput = now(); }
  if (e.key === 'Enter' && mode === 'browse') dive(visible[Math.round(s)]);
});

/* ------------------------------------------------------------------ 鼠标 / 光标 / 拾取 */
const mouse = new THREE.Vector2(0, 0), mouseS = new THREE.Vector2(0, 0), mousePx = { x: innerWidth / 2, y: innerHeight / 2 }, cursorPx = { ...mousePx };
const ray = new THREE.Raycaster();
const cursor = $('#cursor');
let hovered = -1;
addEventListener('pointermove', (e) => {
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  mousePx.x = e.clientX; mousePx.y = e.clientY;
  cursor.classList.toggle('is-link', !!e.target.closest('button, a') && hovered < 0);
});
// 手机和平板没有悬停，点的那一下要自己判断点中了哪张卡
const tapRay = new THREE.Raycaster(), tapNdc = new THREE.Vector2();
function cardAt(x, y) {
  tapNdc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  tapRay.setFromCamera(tapNdc, camera);
  let best = 1e9, hit = -1;
  for (const m of cards) {
    const d = m.userData;
    if (!d.show || d.pass > .4) continue;
    const h = tapRay.intersectObject(m)[0];
    if (h && h.distance < best) { best = h.distance; hit = d.i; }
  }
  return hit;
}
canvas.addEventListener('click', (e) => {
  if (mode !== 'browse' || !entered) return;
  const ci = hovered >= 0 ? hovered : cardAt(e.clientX, e.clientY);
  if (ci < 0) return;
  const j = cards[ci].userData.slot;
  if (Math.abs(j - s) > 0.35) { sT = j; lastInput = now(); return; }  // 先飞过去
  dive(ci);
});

/* ------------------------------------------------------------------ 当前作品信息 */
let shownIdx = -1;
function setNow(ci) {
  if (ci === shownIdx) return;
  shownIdx = ci;
  const w = WORKS[ci];
  const j = visible.indexOf(ci);
  const swap = (el, txt) => { el.innerHTML = `<span class="swap">${txt}</span>`; };
  swap($('#now-no'), pad2(j + 1));
  $('#now-total').textContent = pad2(visible.length);
  swap($('#now-type'), `<b class="fmt" data-k="${w.type}"></b>${TYPES[w.type].zh} ${TYPES[w.type].en} · ${w.year}`);
  $('#now-type').style.color = w.palette[0];
  swap($('#now-title'), w.title);
  swap($('#now-en'), w.title_en);
  document.documentElement.style.setProperty('--accent', w.palette[0]);
  [...$('#rail').children].forEach((b, k) => b.classList.toggle('is-on', k === j));
}
function buildRail() {
  const rail = $('#rail'); rail.innerHTML = '';
  visible.forEach((ci, j) => {
    const b = document.createElement('button'); b.type = 'button';
    b.setAttribute('aria-label', `${pad2(j + 1)} ${WORKS[ci].title}`);
    b.innerHTML = `<span>${WORKS[ci].title}</span>`;
    b.onclick = () => { if (mode === 'browse') { sT = j; lastInput = now(); } };
    rail.appendChild(b);
  });
  shownIdx = -1;
}

/* ------------------------------------------------------------------ 筛选 */
document.querySelectorAll('.chip').forEach((chip) => chip.addEventListener('click', () => {
  if (mode !== 'browse') return;
  document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-on', c === chip));
  filter = chip.dataset.filter;
  const cur = visible[Math.round(clamp(s, 0, maxS()))];
  visible = WORKS.map((_, i) => i).filter((i) => filter === 'all' || WORKS[i].type === filter);
  layout();
  const keep = visible.indexOf(cur);
  sT = keep >= 0 ? keep : 0;
  // 一阵「重新洗牌」的风
  warpKick = 0.35;
}));
let warpKick = 0;

/* ------------------------------------------------------------------ 开场 → 进入 */
function enter() {
  if (entered) return;
  entered = true;
  body.classList.add('is-in');
  sT = 0; lastInput = now();
  if (reduceMotion) s = 0;
}
$('#enter').addEventListener('click', enter);

/* ------------------------------------------------------------------ 穿进作品 */
let mode = 'browse';   // browse | diving | detail | leaving
let diveT = 0, diveIdx = -1;
const diveFrom = new THREE.Vector3(), diveLookFrom = new THREE.Vector3();
const detail = $('#detail');

function fillDetail(ci) {
  const w = WORKS[ci];
  const j = visible.indexOf(ci);
  $('#d-no').textContent = `NO.${pad2(j + 1)}`;
  $('#d-type').innerHTML = `<b class="fmt" data-k="${w.type}"></b>${TYPES[w.type].zh} ${TYPES[w.type].en}`;
  $('#d-year').textContent = w.year;
  $('#d-title').textContent = w.title;
  $('#d-en').textContent = w.title_en;
  $('#d-meta').textContent = w.seen ? `${w.meta} · SEEN ${w.seen.replace(/-/g, '.')}` : w.meta;
  $('#d-line').textContent = w.line || '';
  $('#d-line').hidden = !w.line;
  $('#d-note').innerHTML = (w.note || '').split(/\n+/).filter(Boolean).map((p) => `<p>${p}</p>`).join('');
  $('#d-note').hidden = !w.note;
  setKeep(w);
  $('#d-palette').innerHTML = w.palette.map((c) => `<li><i style="background:${c}"></i><span>${c.toUpperCase()}</span></li>`).join('');
  const link = $('#d-link'); link.href = w.link; link.hidden = !w.link;
  $('#d-sample').classList.toggle('is-shown', !!w.sample);
  veilMat.uniforms.uC1.value.set(w.palette[0]);
  veilMat.uniforms.uC2.value.set(w.palette[1]);
  veilMat.uniforms.uC3.value.set(w.palette[2]);
  shared.uTint.value.set(w.palette[0]);
  document.title = `${w.title} · 残影 Afterimage`;
}

/* ------------------------------------------------------------------ 票根 / 定格：点进作品后，由粒子拼出来 */
const keep = $('#d-keep'), keepImg = $('#d-keep-img'), keepFrame = $('#d-keep-frame'), dust = $('#d-keep-dust');
const KEEP_LABEL = { ticket: '票根 · TICKET STUB', frame: '定格 · FREEZE FRAME' };
let keepRun = 0;
function setKeep(w) {
  keepRun++;
  const st = w.still;
  // 竖图（票根）放右侧一栏；横图（剧照）放在文字栏里，跟着内容走
  const wide = !!st && st.w / st.h > 1.2;
  $('.detail__inner').classList.toggle('has-keep', !!st && !wide);
  keep.classList.toggle('is-wide', wide);
  keep.hidden = !st;
  keep.classList.remove('is-shown');
  if (!st) { keepImg.removeAttribute('src'); return; }
  keep.dataset.kind = st.kind;
  keep.dataset.type = w.type;
  keep.style.setProperty('--ar', `${st.w} / ${st.h}`);
  keepImg.src = st.src;
  keepImg.alt = st.alt || '';
  $('#d-keep-kind').textContent = KEEP_LABEL[st.kind] || KEEP_LABEL.frame;
  $('#d-keep-cap').textContent = st.caption || '';
  $('#d-keep-credit').textContent = st.credit || '';
}
async function playKeep() {
  if (keep.hidden) return;
  const run = ++keepRun;
  try { await keepImg.decode(); } catch (e) { /* 图没加载出来就直接显示 */ }
  if (run !== keepRun) return;
  if (reduceMotion || !keepImg.naturalWidth) { keep.classList.add('is-shown'); return; }
  // 取样：把图缩成一小张，每个像素变成一颗粒子
  const fw = keepImg.offsetWidth, fh = keepImg.offsetHeight;
  const ox = keepFrame.offsetLeft + keepImg.offsetLeft, oy = keepFrame.offsetTop + keepImg.offsetTop;
  const cols = coarse ? 64 : (fw > fh * 1.2 ? 128 : 96), rows = Math.round(cols * fh / fw);
  const sc = document.createElement('canvas'); sc.width = cols; sc.height = rows;
  const sg = sc.getContext('2d', { willReadFrequently: true });
  sg.drawImage(keepImg, 0, 0, cols, rows);
  const px = sg.getImageData(0, 0, cols, rows).data;
  const pad = 0.45;                                   // 粒子从画框外面飞进来
  const cw = fw * (1 + pad * 2), ch = fh * (1 + pad * 2);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  dust.width = Math.round(cw * dpr); dust.height = Math.round(ch * dpr);
  Object.assign(dust.style, { left: `${ox - fw * pad}px`, top: `${oy - fh * pad}px`, width: `${cw}px`, height: `${ch}px` });
  const g = dust.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cell = fw / cols;
  const parts = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const k = (y * cols + x) * 4;
    const a = Math.random() * Math.PI * 2, r = (0.35 + Math.random()) * Math.max(fw, fh);
    parts.push({
      tx: fw * pad + x * cell, ty: fh * pad + y * cell,
      sx: cw / 2 + Math.cos(a) * r, sy: ch / 2 + Math.sin(a) * r,
      d: Math.random() * 0.45 + (y / rows) * 0.25,
      c: `rgb(${px[k]},${px[k + 1]},${px[k + 2]})`
    });
  }
  keep.classList.add('is-assembling');
  const T = 1.5, t0 = performance.now();
  const step = (now) => {
    if (run !== keepRun) { keep.classList.remove('is-assembling'); return; }
    const t = (now - t0) / 1000;
    g.clearRect(0, 0, cw, ch);
    for (const p of parts) {
      const e = easeOut(clamp((t - p.d) / (T - 0.6), 0, 1));
      const sz = cell * (0.35 + 0.65 * e) * (1.8 - 0.8 * e);
      g.globalAlpha = Math.min(1, e * 1.6);
      g.fillStyle = p.c;
      g.fillRect(lerp(p.sx, p.tx, e), lerp(p.sy, p.ty, e), sz, sz);
    }
    if (t > T - 0.45) keep.classList.add('is-shown');
    if (t < T + 0.6) requestAnimationFrame(step);
    else { keep.classList.remove('is-assembling'); g.clearRect(0, 0, cw, ch); }
  };
  requestAnimationFrame(step);
}
// 悬停：像把票根拿在手里，轻轻倾斜
keepFrame.addEventListener('pointermove', (e) => {
  if (reduceMotion || coarse) return;
  const r = keepFrame.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
  keep.style.setProperty('--rx', `${(-y * 9).toFixed(2)}deg`);
  keep.style.setProperty('--ry', `${(x * 11).toFixed(2)}deg`);
  keep.style.setProperty('--gx', `${((x + .5) * 100).toFixed(1)}%`);
  keep.style.setProperty('--gy', `${((y + .5) * 100).toFixed(1)}%`);
});
keepFrame.addEventListener('pointerleave', () => { ['--rx', '--ry'].forEach((v) => keep.style.setProperty(v, '0deg')); });

function dive(ci) {
  if (mode !== 'browse' || ci == null || ci < 0) return;
  diveIdx = ci;
  sT = s = cards[ci].userData.slot;
  fillDetail(ci);
  diveFrom.copy(camera.position);
  diveLookFrom.copy(curLook);
  mode = 'diving'; diveT = 0;
  body.classList.add('is-detail');
  cursor.classList.remove('is-card');
  if (location.hash !== `#/${WORKS[ci].id}`) history.pushState(null, '', `#/${WORKS[ci].id}`);
}
function exitDetail() {
  if (mode !== 'detail') return;
  mode = 'leaving';
  body.classList.remove('is-detail-in');
  setTimeout(() => body.classList.remove('is-detail'), 500);
  document.title = '残影 · Afterimage — Silen1';
  if (location.hash) history.pushState(null, '', location.pathname + location.search);
}
function nextDetail(dir) {
  if (mode !== 'detail') return;
  const j = (cards[diveIdx].userData.slot + dir + visible.length) % visible.length;
  body.classList.remove('is-detail-in');
  warpKick = 0.6;
  setTimeout(() => {
    cards[diveIdx].material.uniforms.uDissolve.value = 0;
    diveIdx = visible[j]; s = sT = j;
    setNow(diveIdx);
    fillDetail(diveIdx);
    detail.scrollTop = 0;
    history.replaceState(null, '', `#/${WORKS[diveIdx].id}`);
    body.classList.add('is-detail-in');
    playKeep();
  }, 520);
}
$('#d-back').addEventListener('click', exitDetail);
$('#d-next').addEventListener('click', () => nextDetail(1));
addEventListener('popstate', () => {
  const id = location.hash.replace('#/', '');
  const ci = WORKS.findIndex((w) => w.id === id);
  if (ci >= 0 && mode === 'browse') { if (!entered) enter(); dive(ci); }
  else if (!id && mode === 'detail') exitDetail();
});

/* ------------------------------------------------------------------ 目录 */
function openIndex() { $('#index').hidden = false; $('#close-index').focus(); }
function closeIndex() { $('#index').hidden = true; $('#open-index').focus(); }
$('#open-index').addEventListener('click', openIndex);
$('#close-index').addEventListener('click', closeIndex);
indexList.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-id]'); if (!b) return;
  const ci = WORKS.findIndex((w) => w.id === b.dataset.id);
  $('#index').hidden = true;
  if (!entered) enter();
  if (!visible.includes(ci)) { document.querySelector('.chip[data-filter=all]').click(); }
  if (mode === 'detail') { exitDetail(); }
  sT = s = cards[ci].userData.slot;
  setTimeout(() => dive(ci), 60);
});

/* ------------------------------------------------------------------ 主循环 */
const curLook = new THREE.Vector3();
const clock = new THREE.Clock();
let fpsAcc = 0, fpsN = 0, adapted = false;

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = isPortrait() ? 62 : 45;
  camera.updateProjectionMatrix();
  veilMat.uniforms.uAsp.value = camera.aspect;
  veilMat.uniforms.uPortrait.value = isPortrait() ? 1 : 0;
  layout();
}
addEventListener('resize', resize);

function camAt(sv, outPos, outLook) {
  const n = camPos.length;
  if (sv <= 0) {
    // 开场：摄影机在第一张卡更远的后方
    // 开场时站在光带外侧斜看它扭进远方，进入时滑进光带里面
    const u = slotU(0) - CAM_BACK + sv * 0.03;
    const away = smooth(0, -1.6, sv);
    outPos.copy(curve.getPointAt(clamp(u, 0, 1))).add(tV.set(4.8, 2.6, 5).multiplyScalar(away));
    outLook.copy(lookAt[0]).lerp(curve.getPointAt(clamp(u + .14, 0, 1)), away);
    return;
  }
  const i0 = Math.min(n - 1, Math.floor(sv)), i1 = Math.min(n - 1, i0 + 1), f = sv - i0;
  const u0 = slotU(i0) - CAM_BACK, u1 = slotU(i1) - CAM_BACK;
  outPos.copy(curve.getPointAt(clamp(lerp(u0, u1, f), 0, 1)));
  outLook.copy(lookAt[i0]).lerp(lookAt[i1], smooth(.2, .8, f));
}

const basePos = new THREE.Vector3(), baseLook = new THREE.Vector3(), plane = new THREE.Plane(), hit = new THREE.Vector3();

function tick() {
  const dt = CAPTURE ? 1 / 30 : Math.min(clock.getDelta(), 1 / 20);
  vtime += dt;
  const t = shared.uTime.value += dt * (reduceMotion ? .25 : 1);

  // 自适应画质：前 2 秒平均帧率太低就降分辨率
  if (!adapted) { fpsAcc += dt; fpsN++; if (fpsAcc > 2) { adapted = true; if (fpsN / fpsAcc < 40 && DPR > 1) { DPR = 1; renderer.setPixelRatio(1); shared.uPx.value = 1; resize(); } } }

  // 诞生
  if (shared.uBirth.value < 1) shared.uBirth.value = Math.min(1, shared.uBirth.value + dt / 2.6);

  // 滚动的惯性 + 停下后吸附到最近的一部
  if (mode === 'browse' && entered && now() - lastInput > 160) sT = lerp(sT, Math.round(sT), 1 - Math.pow(.001, dt));
  const prev = s;
  const k = entered && s < 0 ? 2 : 5;
  s = reduceMotion ? sT : lerp(s, sT, 1 - Math.exp(-k * dt));
  vel = lerp(vel, (s - prev) / Math.max(dt, 1e-3), .2);

  // 摄影机
  camAt(s, basePos, baseLook);
  mouseS.lerp(mouse, 1 - Math.exp(-4 * dt));
  const par = reduceMotion || coarse ? 0 : 1;
  basePos.x += mouseS.x * .35 * par; basePos.y += mouseS.y * .2 * par;

  if (mode === 'diving' || mode === 'leaving' || mode === 'detail') {
    if (mode === 'diving') diveT = Math.min(1, diveT + dt / (reduceMotion ? .5 : 1.45));
    if (mode === 'leaving') diveT = Math.max(0, diveT - dt / (reduceMotion ? .4 : 1.1));
    const e = easeInOut(diveT);
    const d = cards[diveIdx].userData;
    const target = d.pos.clone().add(new THREE.Vector3(0, 0, 1).applyQuaternion(cards[diveIdx].quaternion).multiplyScalar(-.6));
    camera.position.copy(basePos).lerp(target, reduceMotion ? 0 : e);
    curLook.copy(baseLook).lerp(d.pos, smooth(0, .5, diveT)).lerp(target.clone().add(target.clone().sub(basePos)), smooth(.5, 1, diveT));
    camera.fov = (isPortrait() ? 62 : 45) + (reduceMotion ? 0 : Math.sin(e * Math.PI) * 38);
    camera.updateProjectionMatrix();
    shared.uWarp.value = reduceMotion ? 0 : Math.sin(Math.min(1, diveT * 1.15) * Math.PI) * .9;
    cards[diveIdx].material.uniforms.uDissolve.value = mode === 'leaving' ? smooth(.04, .42, diveT) : smooth(.3, .82, diveT);
    veilMat.uniforms.uA.value = smooth(.42, 1, diveT);
    shared.uTintAmt.value = smooth(.4, 1, diveT);
    if (mode === 'diving' && diveT >= 1) { mode = 'detail'; body.classList.add('is-detail-in'); detail.focus({ preventScroll: true }); playKeep(); }
    if (mode === 'leaving' && diveT <= 0) { mode = 'browse'; cards[diveIdx].material.uniforms.uDissolve.value = 0; camera.fov = isPortrait() ? 62 : 45; camera.updateProjectionMatrix(); }
  } else {
    camera.position.copy(basePos);
    curLook.copy(baseLook);
    shared.uWarp.value = Math.min(.5, Math.abs(vel) * .08) * (reduceMotion ? 0 : 1);
  }
  if (warpKick > 0) { shared.uWarp.value = Math.max(shared.uWarp.value, Math.sin(warpKick / .6 * Math.PI) * .4); warpKick = Math.max(0, warpKick - dt * .8); }
  camera.lookAt(curLook);
  if (!reduceMotion) camera.rotateZ(clamp(-vel * .02, -.06, .06) + Math.sin(t * .2) * .006);

  // 卡片：飞向自己的位置、聚焦、悬停倾斜
  ray.setFromCamera(mouse, camera);
  let hit0 = -1, best = 1e9;
  if (mode === 'browse' && entered && !coarse) {
    for (const m of cards) { if (!m.userData.show || m.userData.pass > .4) continue; const h = ray.intersectObject(m)[0]; if (h && h.distance < best) { best = h.distance; hit0 = m.userData.i; } }
  }
  if (hit0 !== hovered) { hovered = hit0; cursor.classList.toggle('is-card', hovered >= 0); }
  for (const m of cards) {
    const d = m.userData, u = m.material.uniforms;
    const goal = d.show ? d.pos : tV.copy(d.pos).add(d.scatter);
    d.cur.lerp(goal, 1 - Math.exp(-(d.show ? 3.2 : 1.6) * dt));
    m.position.copy(d.cur);
    m.quaternion.slerp(d.quat, 1 - Math.exp(-4 * dt));
    d.hover = lerp(d.hover, hovered === d.i ? 1 : 0, 1 - Math.exp(-8 * dt));
    // 镜头经过后，卡片像门一样向一侧让开，不会从中间穿过
    const pass = d.show && mode === 'browse' ? clamp(s - d.slot, 0, 1.5) : 0;
    d.pass = pass;
    if (pass > 0) {
      const sd = isPortrait() ? 1 : (d.slot % 2 ? -1 : 1);
      m.position.x += sd * easeOut(Math.min(1, pass)) * 3.2;
      m.position.y += pass * .5;
      m.rotateY(sd * easeOut(Math.min(1, pass)) * 1.1);
    }
    if (d.show && !reduceMotion) {
      d.tilt.lerp(hovered === d.i ? mouseS : new THREE.Vector2(), 1 - Math.exp(-5 * dt));
      m.rotateY(d.tilt.x * .18); m.rotateX(-d.tilt.y * .14);
      m.position.y += Math.sin(t * .6 + d.i) * .04;
    }
    const focus = d.show ? clamp(1 - Math.abs(s - d.slot), 0, 1) : 0;
    u.uFocus.value = lerp(u.uFocus.value, focus, 1 - Math.exp(-6 * dt));
    u.uHover.value = d.hover;
    const op = (d.show && entered ? 1 : (entered ? 0 : smooth(.6, 1, shared.uBirth.value) * .85)) * (1 - smooth(.3, .85, d.pass));
    u.uOpacity.value = lerp(u.uOpacity.value, (mode !== 'browse' && d.i !== diveIdx) ? op * (1 - veilMat.uniforms.uA.value) : op, 1 - Math.exp(-4 * dt));
  }

  // 鼠标在 3D 里的位置（推开粒子）
  plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(tV).negate(), curLook);
  if (!coarse && ray.ray.intersectPlane(plane, hit)) shared.uMouse.value.lerp(hit, .25);

  // 当前作品
  if (entered && mode === 'browse') setNow(visible[Math.round(clamp(s, 0, maxS()))]);
  if (mode === 'browse') { shared.uTintAmt.value *= .96; }

  // 光标
  cursorPx.x = lerp(cursorPx.x, mousePx.x, .22); cursorPx.y = lerp(cursorPx.y, mousePx.y, .22);
  cursor.firstElementChild.style.transform = `translate(${mousePx.x}px, ${mousePx.y}px)`;
  cursor.lastElementChild.style.transform = `translate(${cursorPx.x}px, ${cursorPx.y}px)`;

  renderer.render(scene, camera);
}

/* ------------------------------------------------------------------ 启动 */
async function boot() {
  try {
    await Promise.race([
      Promise.all(['600 40px "Afterimage Serif"', '300 20px "Space Grotesk"', '500 20px "JetBrains Mono"', '400 20px "JetBrains Mono"'].map((f) => document.fonts.load(f, '残影ABC'))),
      new Promise((r) => setTimeout(r, 2500))
    ]);
  } catch (e) { /* 字体失败也照样开场 */ }
  cards.forEach((m, i) => { m.material.uniforms.uTex.value = cardTexture(WORKS[i], i); m.position.copy(m.userData.pos); });
  resize();
  cards.forEach((m) => { m.userData.cur.copy(m.userData.pos); m.position.copy(m.userData.pos); m.quaternion.copy(m.userData.quat); });
  body.classList.remove('is-loading');
  requestAnimationFrame(() => body.classList.add('is-ready'));
  if (CAPTURE) window.__frame = (n = 1) => { for (let i = 0; i < n; i++) tick(); };
  else renderer.setAnimationLoop(tick);
  // 直接打开某部作品的链接：#/blade-runner-2049
  const id = location.hash.replace('#/', '');
  const ci = WORKS.findIndex((w) => w.id === id);
  if (ci >= 0) { enter(); s = sT = cards[ci].userData.slot; shared.uBirth.value = 1; setTimeout(() => dive(ci), 300); }
  // 测试/截图用：?at=3 直接停在第 4 部
  const at = new URLSearchParams(location.search).get('at');
  if (at != null) { enter(); shared.uBirth.value = 1; s = sT = clamp(+at, 0, maxS()); }
}
document.addEventListener('visibilitychange', () => { if (CAPTURE) return; renderer.setAnimationLoop(document.hidden ? null : tick); clock.getDelta(); });
boot();
