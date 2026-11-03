// 放映机的声音：全部用 Web Audio 现场合成，不下载任何音频文件。
//   咔嗒声 —— 每秒 24 下，抓片爪拉一格胶片（再轻轻一声快门）
//   电机 —— 很低的嗡嗡声
//   片噪 —— 光学声轨的沙沙声，偶尔一声爆豆
//   风声 —— 穿进作品时，跟着粒子的速度涌起来
// 默认关着；打开之后记住，下次在第一次点击时自动接上（浏览器不许没点击就出声）。
const KEY = 'afterimage:sound';
const LEVEL = 0.4;

let ctx = null, master = null, whooshGain = null, whooshBand = null, clatter = null;
let on = false;
const listeners = new Set();

function noise(sec, ch = 1) {
  const b = ctx.createBuffer(ch, Math.round(ctx.sampleRate * sec), ctx.sampleRate);
  for (let c = 0; c < ch; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  return b;
}

// 4 秒、96 格的咔嗒声，每格的力度和时机都有一点点不同，听起来才像机器
function clatterBuffer() {
  const sr = ctx.sampleRate, len = Math.round(sr * 4);
  const b = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    const burst = (at, amp, ms, decay) => {
      const n = Math.round(sr * ms / 1000), k = sr * decay / 1000;
      for (let i = 0; i < n && at + i < len; i++) d[at + i] += (Math.random() * 2 - 1) * amp * Math.exp(-i / k);
    };
    for (let f = 0; f < 96; f++) {
      const t0 = Math.round((f / 24 + (Math.random() - .5) * .0016) * sr);
      const amp = .5 + Math.random() * .25;
      burst(t0, amp, 7, 1.3);                               // 抓片爪
      burst(t0 + Math.round(sr / 48), amp * .32, 5, .8);     // 快门叶片
    }
    // 片子上的灰尘：偶尔一声「噼」
    for (let k = 0; k < 7; k++) burst(Math.floor(Math.random() * (len - sr * .01)), .35 + Math.random() * .5, 2, .35);
  }
  return b;
}

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0;
  const soft = ctx.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 5200; soft.Q.value = .4;  // 像隔着放映室的玻璃
  master.connect(soft).connect(ctx.destination);

  // 咔嗒
  clatter = ctx.createBufferSource(); clatter.buffer = clatterBuffer(); clatter.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 650;
  const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 2100; body.Q.value = 1.1; body.gain.value = 5;
  const cg = ctx.createGain(); cg.gain.value = .42;
  clatter.connect(hp).connect(body).connect(cg).connect(master);

  // 电机：低频锯齿波，滤掉高频只剩嗡嗡声，再用 24Hz 轻轻调制
  const motor = ctx.createOscillator(); motor.type = 'sawtooth'; motor.frequency.value = 48;
  const mlp = ctx.createBiquadFilter(); mlp.type = 'lowpass'; mlp.frequency.value = 170;
  const mg = ctx.createGain(); mg.gain.value = .16;
  const flutter = ctx.createOscillator(); flutter.frequency.value = 24;
  const fg = ctx.createGain(); fg.gain.value = .05;
  flutter.connect(fg).connect(mg.gain);
  motor.connect(mlp).connect(mg).connect(master);

  // 片噪
  const hiss = ctx.createBufferSource(); hiss.buffer = noise(3, 2); hiss.loop = true;
  const hb = ctx.createBiquadFilter(); hb.type = 'bandpass'; hb.frequency.value = 3200; hb.Q.value = .5;
  const hg = ctx.createGain(); hg.gain.value = .05;
  hiss.connect(hb).connect(hg).connect(master);

  // 风声（平时是 0）
  const wind = ctx.createBufferSource(); wind.buffer = noise(3, 2); wind.loop = true;
  whooshBand = ctx.createBiquadFilter(); whooshBand.type = 'bandpass'; whooshBand.frequency.value = 400; whooshBand.Q.value = 1.4;
  whooshGain = ctx.createGain(); whooshGain.gain.value = 0;
  wind.connect(whooshBand).connect(whooshGain).connect(master);

  const t = ctx.currentTime;
  [clatter, motor, flutter, hiss, wind].forEach((n) => n.start(t));
  return true;
}

function emit() { listeners.forEach((fn) => fn(on)); }

export const sound = {
  get on() { return on; },
  // 用户点了开关：必须在点击里调用，浏览器才让出声
  set(next) {
    on = !!next;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* 隐私模式 */ }
    if (on) {
      if (!ctx && !build()) { on = false; emit(); return; }
      ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(LEVEL, ctx.currentTime, .45);
    } else if (ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, .15);
      const c = ctx; setTimeout(() => { if (!on) c.suspend(); }, 900);
    }
    emit();
  },
  toggle() { this.set(!on); },
  // 粒子冲过来的速度（0~1）→ 风声
  warp(v) {
    if (!on || !ctx) return;
    const now = ctx.currentTime;
    whooshGain.gain.setTargetAtTime(Math.min(1, v) * .9, now, .08);
    whooshBand.frequency.setTargetAtTime(380 + v * 2200, now, .1);
    clatter.playbackRate.setTargetAtTime(1 + v * .18, now, .2);
  },
  onChange(fn) { listeners.add(fn); },
  // 上次开着：等第一次点击 / 按键再接上
  remembered() { try { return localStorage.getItem(KEY) === 'on'; } catch (e) { return false; } }
};

document.addEventListener('visibilitychange', () => {
  if (!ctx || !on) return;
  if (document.hidden) ctx.suspend(); else ctx.resume();
});
