import './tokens.css';
import './style.css';
import { Viewer, renderThumb } from './engine/viewer.js';
import { ap } from './engine/fold.js';
import { foldedBox } from './cut/texture.js';
import { ORIGAMI, LEVELS, CUTS, CUT_LEVELS, FOLDS, origamiLesson, cutLesson, lighten } from './lessons.js';

const app = document.getElementById('app');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const I = {
  play: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1.5v11l9.5-5.5z" fill="currentColor"/></svg>',
  pause: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" fill="currentColor"/></svg>',
  replay: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.2 7a4.8 4.8 0 1 0 1.5-3.5"/><path d="M2 1.8v2.4h2.4"/></svg>',
  left: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 2.5 4 7l4.5 4.5"/></svg>',
  right: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 2.5 10 7l-4.5 4.5"/></svg>',
  view: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.8 13.5 5v6L8 14.2 2.5 11V5z"/><path d="M2.5 5 8 8l5.5-3M8 8v6.2"/></svg>',
  scissors: '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><path d="M8.2 7.6 20 17M8.2 16.4 20 7M12.5 12h.01"/></svg>',
  logo: '<svg width="26" height="26" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="var(--primary)"/><path d="M7 20 16 8l9 12-9 4z" fill="#fff"/><path d="M16 8v16" stroke="var(--primary)" stroke-width="1.5"/></svg>',
};

/* ---------- 数据与缓存 ---------- */
const done = new Set(JSON.parse(localStorage.getItem('origami-done') || '[]'));
const markDone = (id) => { if (!done.has(id)) { done.add(id); localStorage.setItem('origami-done', JSON.stringify([...done])); } };
const lessons = new Map();
const getLesson = (kind, id) => {
  if (!lessons.has(id)) {
    const src = (kind === 'cut' ? CUTS : ORIGAMI).find((m) => m.id === id);
    if (!src) return null;
    lessons.set(id, kind === 'cut' ? cutLesson(src) : origamiLesson(src));
  }
  return lessons.get(id);
};
const thumbs = new Map();

let viewer = null;
let cleanupFns = [];
function cleanup() {
  cleanupFns.forEach((f) => f());
  cleanupFns = [];
  if (viewer) { viewer.dispose(); viewer = null; }
}

/* ---------- 首页 ---------- */
const LEVEL_DESC = ['只用最基本的对折，三五步就能完成。', '步骤多一些，开始用到折痕和翻面。', '学习“撑开再压平”这样的立体动作。', '压折、花瓣折、内翻折，完成最经典的作品。'];
const CUT_DESC = ['对折再剪，认识什么是对称。', '多折几次，剪出五角星和团花。', '层数更多，花纹更细，需要耐心。'];

function nav(tab) {
  return `<header class="nav"><div class="nav-in">
    <a class="brand" href="#/">${I.logo}<span>折纸学堂</span></a>
    <div class="seg" role="tablist">
      <a href="#/" class="${tab === 'origami' ? 'on' : ''}">折纸</a>
      <a href="#/cut" class="${tab === 'cut' ? 'on' : ''}">剪纸</a>
    </div>
  </div></header>`;
}

function card(kind, m, steps) {
  return `<a class="card lesson-card" href="#/${kind === 'cut' ? 'c' : 'o'}/${m.id}">
    <div class="thumb"><img data-kind="${kind}" data-id="${m.id}" alt="${esc(m.name)}" ${thumbs.has(m.id) ? `src="${thumbs.get(m.id)}"` : ''} /></div>
    <div class="lc-body">
      <div class="lc-title">${esc(m.name)}${done.has(m.id) ? '<span class="status"><i></i>已学会</span>' : ''}</div>
      <div class="lc-intro">${esc(m.intro)}</div>
      <div class="lc-meta tabular">${steps} 步 · 约 ${m.minutes} 分钟</div>
    </div>
  </a>`;
}

function home(tab) {
  cleanup();
  const isCut = tab === 'cut';
  const list = isCut ? CUTS : ORIGAMI, levels = isCut ? CUT_LEVELS : LEVELS, desc = isCut ? CUT_DESC : LEVEL_DESC;
  const stepCount = (m) => (isCut ? FOLDS[m.fold].steps.length * 2 + 3 : m.steps.length);
  const learned = list.filter((m) => done.has(m.id)).length;
  app.innerHTML = `${nav(tab)}<main class="page"><div class="wrap">
    <section class="hero">
      <h1>${isCut ? '先折再剪，打开就是一朵花' : '跟着 3D 动画，一步一步学折纸'}</h1>
      <p>${isCut ? '每个图案都演示怎么折、在哪里剪、打开后是什么样。也可以自己画一刀试试。' : '每一步都有可以旋转的立体演示和文字说明，看清楚每条折线、每一层纸怎么动。从三步完成的小狗，到经典的千纸鹤。'}</p>
      <div class="hero-meta tabular">${list.length} 个教程 · 已学会 ${learned} 个</div>
    </section>
    ${isCut ? `<section class="level"><div class="level-head"><h2>自由创作</h2><span>选一种折法，自己画出要剪掉的地方。</span></div>
      <div class="grid"><a class="card lesson-card" href="#/free"><div class="thumb free-thumb">${I.scissors}</div>
      <div class="lc-body"><div class="lc-title">自由剪纸</div><div class="lc-intro">随手画几笔，立刻看到打开后的图案。</div><div class="lc-meta">5 种折法</div></div></a></div></section>` : ''}
    ${levels.map((lv, i) => `<section class="level"><div class="level-head"><h2>${lv}</h2><span>${desc[i]}</span></div>
      <div class="grid">${list.filter((m) => m.level === i).map((m) => card(tab, m, stepCount(m))).join('')}</div></section>`).join('')}
    <footer class="foot">拖动可以旋转模型，滚轮可以缩放。键盘 ← → 切换步骤，空格播放。</footer>
  </div></main>`;
  // 逐个生成缩略图，不阻塞页面
  const imgs = [...app.querySelectorAll('img[data-id]')].filter((im) => !im.getAttribute('src'));
  let stop = false;
  cleanupFns.push(() => { stop = true; });
  const nextThumb = () => {
    if (stop || !imgs.length) return;
    const im = imgs.shift();
    try {
      const url = renderThumb(getLesson(im.dataset.kind, im.dataset.id));
      thumbs.set(im.dataset.id, url);
      im.src = url;
    } catch (e) { console.error(e); }
    setTimeout(nextThumb, 0);
  };
  setTimeout(nextThumb, 30);
}

/* ---------- 教程页 ---------- */
const SWATCHES = ['#e86a7a', '#f0a04b', '#e2b93b', '#5fb878', '#5aa7e8', '#8b7fd6'];

function controlsHtml() {
  return `<div class="controls">
    <button class="btn" data-act="prev">${I.left}上一步</button>
    <button class="btn" data-act="play"></button>
    <button class="btn btn-primary" data-act="next">下一步${I.right}</button>
    <input class="scrub" type="range" min="0" max="1000" value="0" aria-label="这一步的进度" />
    <div class="seg seg-sm" data-speed>
      <button data-v="0.5">慢</button><button data-v="1" class="on">中</button><button data-v="2">快</button>
    </div>
    <label class="auto"><input type="checkbox" data-auto /> 连续播放</label>
    <button class="icon-btn" data-act="view" title="回到默认视角">${I.view}</button>
  </div>`;
}

function mountPlayer(lesson, opts = {}) {
  const $ = (s) => app.querySelector(s);
  const frames = () => viewer.lesson.frames;
  let shownK = -1;
  const sync = () => {
    const k = viewer.k, n = frames().length, f = frames()[k];
    if (k !== shownK) {
      shownK = k;
      $('.now-n').textContent = `第 ${k + 1} 步 / 共 ${n} 步`;
      $('.now h2').textContent = f.title;
      $('.now p').textContent = f.text;
      app.querySelectorAll('.steps li').forEach((li, i) => {
        li.classList.toggle('on', i === k);
        li.classList.toggle('past', i < k);
        if (i === k) li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      $('[data-act=prev]').disabled = k === 0;
      const nx = $('[data-act=next]');
      nx.innerHTML = k === n - 1 ? '完成' : `下一步${I.right}`;
      if (k === n - 1 && !opts.free) markDone(lesson.id);
    }
    const pb = $('[data-act=play]');
    const state = viewer.playing ? 'pause' : viewer.t >= 1 ? 'replay' : 'play';
    if (pb.dataset.state !== state) {
      pb.dataset.state = state;
      pb.innerHTML = state === 'pause' ? `${I.pause}暂停` : state === 'replay' ? `${I.replay}重播` : `${I.play}播放`;
    }
    const sc = $('.scrub');
    if (document.activeElement !== sc || viewer.playing) sc.value = Math.round(viewer.t * 1000);
  };
  viewer = new Viewer($('#stage'), sync);
  viewer.setLesson(lesson);
  const renderSteps = () => {
    const ol = $('.steps');
    if (!ol) return;
    ol.innerHTML = frames().map((f, i) => `<li data-k="${i}"><span class="num tabular">${i + 1}</span><span>${esc(f.title)}</span></li>`).join('');
    shownK = -1;
    sync();
  };
  renderSteps();

  const act = {
    prev: () => viewer.go(viewer.k - 1, true),
    next: () => { if (viewer.k === frames().length - 1) location.hash = opts.back; else viewer.go(viewer.k + 1, true); },
    play: () => (viewer.playing ? viewer.pause() : viewer.play()),
    view: () => viewer.resetView(),
  };
  const onClick = (e) => {
    const b = e.target.closest('[data-act]');
    if (b && act[b.dataset.act]) return act[b.dataset.act]();
    const li = e.target.closest('.steps li');
    if (li) return viewer.go(+li.dataset.k, true);
    const sp = e.target.closest('[data-speed] button');
    if (sp) { viewer.speed = +sp.dataset.v; sp.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === sp)); return; }
    const sw = e.target.closest('.swatch-btn');
    if (sw) {
      const c = sw.dataset.c;
      app.querySelectorAll('.swatch-btn').forEach((x) => x.classList.toggle('on', x === sw));
      if (lesson.kind === 'cut' || opts.free) viewer.stage.setColors(c, lighten(c, 0.18));
      else viewer.stage.setColors(c === lesson.down ? lesson.up : lighten(c, 0.84), c);
      opts.onColor && opts.onColor(c);
    }
  };
  app.addEventListener('click', onClick);
  $('.scrub').addEventListener('input', (e) => viewer.seek(e.target.value / 1000));
  $('[data-auto]').addEventListener('change', (e) => { viewer.auto = e.target.checked; });
  const onKey = (e) => {
    if (e.target.matches('input[type=text], textarea')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); if (viewer.k < frames().length - 1) viewer.go(viewer.k + 1, true); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); act.prev(); }
    else if (e.key === ' ') { e.preventDefault(); act.play(); }
  };
  window.addEventListener('keydown', onKey);
  cleanupFns.push(() => { app.removeEventListener('click', onClick); window.removeEventListener('keydown', onKey); });
  return { sync, renderSteps };
}

const swatchHtml = (cur, list) => `<div class="swatches" title="换一种纸的颜色">${[...new Set([cur, ...list])].slice(0, 7).map((c) => `<button class="swatch-btn ${c === cur ? 'on' : ''}" data-c="${c}" style="background:${c}" aria-label="纸的颜色"></button>`).join('')}</div>`;

const legend = (cut) => (cut
  ? `<div class="legend"><div><i class="lg lg-cut"></i>深色：要剪掉的部分</div><div class="muted">拖动旋转 · 滚轮缩放</div></div>`
  : `<div class="legend"><div><i class="lg lg-v"></i>蓝色虚线：向前折（谷折）</div><div><i class="lg lg-m"></i>灰色点划线：向后折（山折）</div><div class="muted">拖动旋转 · 滚轮缩放</div></div>`);

function lessonPage(kind, id) {
  cleanup();
  const lesson = getLesson(kind, id);
  if (!lesson) { location.hash = '#/'; return; }
  const m = lesson.meta, isCut = kind === 'cut';
  const back = isCut ? '#/cut' : '#/';
  app.innerHTML = `${nav(isCut ? 'cut' : 'origami')}<main class="page"><div class="wrap wide">
    <div class="lesson-top">
      <a class="btn" href="${back}">${I.left}返回</a>
      <h1>${esc(m.name)}</h1>
      <span class="tag">${(isCut ? CUT_LEVELS : LEVELS)[m.level]}</span>
      <span class="muted">${isCut ? `${m.paper[1][0] > 1.5 ? '长纸条' : '正方形纸'}、剪刀、铅笔 · ${FOLDS[m.fold].name}` : m.paperName} · 约 ${m.minutes} 分钟</span>
    </div>
    <div class="lesson-grid">
      <section class="card stage-card">
        <div class="stage-wrap"><div id="stage"></div>${swatchHtml(isCut ? lesson.up : lesson.down, isCut ? ['#d9342b', '#e2a41f', '#2f9e6b', '#4f8fd6', '#8b7fd6', '#1d1d1f'] : SWATCHES)}</div>
        <div class="now"><div class="now-n tabular"></div><h2></h2><p></p></div>
        ${controlsHtml()}
      </section>
      <aside class="card side-card">
        <div class="side-title">全部步骤</div>
        <ol class="steps"></ol>
        ${legend(isCut)}
      </aside>
    </div>
  </div></main>`;
  mountPlayer(lesson, { back });
}

/* ---------- 自由剪纸 ---------- */
function freePage() {
  cleanup();
  const kinds = ['half', 'quarter', 'eighth', 'six', 'five'];
  const SQ = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const st = { fold: 'eighth', strokes: [], color: '#d9342b' };
  app.innerHTML = `${nav('cut')}<main class="page"><div class="wrap wide">
    <div class="lesson-top">
      <a class="btn" href="#/cut">${I.left}返回</a>
      <h1>自由剪纸</h1>
      <span class="muted">选一种折法，在右边折好的纸上画圈，圈里的部分会被剪掉。</span>
    </div>
    <div class="lesson-grid">
      <section class="card stage-card">
        <div class="stage-wrap"><div id="stage"></div>${swatchHtml(st.color, ['#d9342b', '#e2a41f', '#2f9e6b', '#4f8fd6', '#8b7fd6', '#1d1d1f'])}</div>
        <div class="now"><div class="now-n tabular"></div><h2></h2><p></p></div>
        ${controlsHtml()}
      </section>
      <aside class="card side-card">
        <div class="side-title">折法</div>
        <div class="seg seg-sm seg-fill" data-fold>${kinds.map((k) => `<button data-v="${k}" class="${k === st.fold ? 'on' : ''}">${FOLDS[k].name}</button>`).join('')}</div>
        <div class="side-title">在折好的纸上画</div>
        <canvas class="draw" width="560" height="560"></canvas>
        <div class="draw-hint muted">按住鼠标画一个圈再松开。圆点是纸的中心；贴着边画的图形打开后会连成对称的花纹。</div>
        <div class="draw-btns">
          <button class="btn btn-sm" data-free="undo">撤销</button>
          <button class="btn btn-sm" data-free="clear">清空</button>
          <button class="btn btn-sm btn-primary" data-free="play">看展开动画</button>
        </div>
        <ol class="steps" hidden></ol>
      </aside>
    </div>
  </div></main>`;
  const cv = app.querySelector('.draw'), ctx = cv.getContext('2d');
  let lesson, tex = null, player = null, map = null, cur = null;

  const rebuild = (keepView) => {
    lesson = cutLesson({ id: 'free', name: '自由剪纸', fold: st.fold, paper: SQ, color: st.color, drawText: '' }, { cut: st.strokes }, true, tex);
    tex = lesson.textures;
    lesson.up = st.color; lesson.down = lighten(st.color, 0.18);
    if (!player) player = mountPlayer(lesson, { free: true, back: '#/cut', onColor: (c) => { st.color = c; draw(); } });
    else if (keepView) {
      viewer.lesson = lesson;
      viewer.stage.textures = tex; viewer.stage.texName = null;
      viewer.stage.setFrame(lesson.frames[viewer.k]);
      viewer.stage.update(viewer.t);
    } else { viewer.setLesson(lesson); player.renderSteps(); }
    if (!keepView) viewer.showEnd(lesson.frames.length - 1);
    const b = foldedBox(lesson.folded);
    const s = 480 / Math.max(b.x1 - b.x0, b.y1 - b.y0);
    map = { s, ox: 280 - ((b.x0 + b.x1) / 2) * s, oy: 280 + ((b.y0 + b.y1) / 2) * s };
    draw();
  };
  const toPx = ([x, y]) => [map.ox + x * map.s, map.oy - y * map.s];
  const draw = () => {
    ctx.clearRect(0, 0, 560, 560);
    ctx.fillStyle = st.color;
    for (const f of lesson.folded) {
      ctx.beginPath();
      f.poly.forEach((pt, i) => { const [x, y] = toPx(ap(f.m, pt)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.closePath(); ctx.fill();
    }
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    for (const s of st.strokes) { ctx.beginPath(); s.forEach((pt, i) => { const [x, y] = toPx(pt); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    if (cur && cur.length > 1) {
      ctx.strokeStyle = '#0071e3'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
      ctx.beginPath(); cur.forEach((pt, i) => { const [x, y] = toPx(pt); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke(); ctx.setLineDash([]);
    }
    const [cx, cy] = toPx([0, 0]);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#1d1d1f'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.fill();
  };
  const fromEvent = (e) => {
    const r = cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 560, y = ((e.clientY - r.top) / r.height) * 560;
    return [(x - map.ox) / map.s, (map.oy - y) / map.s];
  };
  cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); cur = [fromEvent(e)]; });
  cv.addEventListener('pointermove', (e) => {
    if (!cur) return;
    const p = fromEvent(e), l = cur[cur.length - 1];
    if (Math.hypot(p[0] - l[0], p[1] - l[1]) * map.s > 3) { cur.push(p); draw(); }
  });
  const end = () => {
    if (!cur) return;
    if (cur.length > 4) { st.strokes.push(cur); cur = null; rebuild(true); viewer.showEnd(lesson.frames.length - 1); } else { cur = null; draw(); }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  const onClick = (e) => {
    const f = e.target.closest('[data-fold] button');
    if (f) { st.fold = f.dataset.v; st.strokes = []; f.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === f)); rebuild(false); return; }
    const b = e.target.closest('[data-free]');
    if (!b) return;
    if (b.dataset.free === 'undo') { st.strokes.pop(); rebuild(true); viewer.showEnd(lesson.frames.length - 1); }
    if (b.dataset.free === 'clear') { st.strokes = []; rebuild(true); viewer.showEnd(lesson.frames.length - 1); }
    if (b.dataset.free === 'play') { viewer.auto = true; app.querySelector('[data-auto]').checked = true; viewer.go(0, true); }
  };
  app.addEventListener('click', onClick);
  cleanupFns.push(() => { app.removeEventListener('click', onClick); if (tex) for (const k in tex) tex[k].dispose(); });
  rebuild(false);
}

/* ---------- 路由 ---------- */
function route() {
  const h = location.hash.replace(/^#\/?/, '').split('/');
  if (h[0] === 'o' && h[1]) lessonPage('origami', h[1]);
  else if (h[0] === 'c' && h[1]) lessonPage('cut', h[1]);
  else if (h[0] === 'free') freePage();
  else home(h[0] === 'cut' ? 'cut' : 'origami');
  const page = app.querySelector('.page');
  if (page) page.scrollTop = 0;
}
window.addEventListener('hashchange', route);
route();

// 开发调试：把某个教程的每一步渲染成一张拼图
if (import.meta.env.DEV) {
  window.__sheet = async (kind, id, opts = {}) => {
    const L = getLesson(kind, id), n = L.frames.length, ts = opts.ts || [1], cols = opts.cols || 6;
    const tiles = [];
    for (let k = 0; k < n; k++) for (const t of ts) tiles.push([k, t]);
    const cv = document.createElement('canvas');
    cv.width = cols * 320; cv.height = Math.ceil(tiles.length / cols) * 240;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#f0f0f3'; ctx.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < tiles.length; i++) {
      const [k, t] = tiles[i];
      const im = new Image();
      im.src = renderThumb(L, k, t, opts.dir || (L.frames[k].cam ? L.frames[k].cam : [0.2, -0.34, 1]));
      await im.decode();
      const x = (i % cols) * 320, y = Math.floor(i / cols) * 240;
      ctx.drawImage(im, x, y, 320, 240);
      ctx.fillStyle = '#000'; ctx.font = '14px sans-serif'; ctx.fillText((k + 1) + (ts.length > 1 ? ' t=' + t : '') + ' ' + L.frames[k].title, x + 6, y + 16);
    }
    const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    await fetch('/__shot?name=' + (opts.name || id) + '.png', { method: 'POST', body: blob });
    return tiles.length;
  };
}
