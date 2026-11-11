// 把教程数据变成播放器能直接播放的“课程”（一串帧）
import { build, staticPieces } from './engine/fold.js';
import { ORIGAMI, LEVELS } from './models/origami.js';
import { CUTS, CUT_LEVELS, FOLDS } from './cut/patterns.js';
import { makeTextures } from './cut/texture.js';

export { ORIGAMI, LEVELS, CUTS, CUT_LEVELS, FOLDS };

export function lighten(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * k));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function origamiLesson(m) {
  const b = build(m);
  let cam = null;
  for (const f of b.frames) { if (f.cam) cam = f.cam; else if (cam) f.cam = cam; } // 收尾的视角一直保持到最后
  return { id: m.id, kind: 'origami', name: m.name, paper: m.paper, up: m.up, down: m.down, frames: b.frames, meta: m };
}

// shape: { keep, cut }；free=true 时只保留“折好 → 展开”的帧
export function cutLesson(c, shape = c, free = false, oldTex) {
  const fold = FOLDS[c.fold];
  const b = build({ paper: c.paper, steps: fold.steps });
  const folded = b.states[b.states.length - 1];
  const textures = makeTextures(c.paper, folded, shape, oldTex);
  const still = (faces, extra) => ({ pieces: staticPieces(faces), lines: [], ...extra });
  const frames = [];
  if (!free) {
    b.frames.forEach((f) => frames.push({ ...f, tex: 'plain' }));
    frames.push(still(folded, { tex: 'preview', title: '画出图案', text: c.drawText + '（图里深色的部分是要剪掉的。）' }));
    frames.push(still(folded, { tex: (t) => (t < 0.5 ? 'preview' : 'cut'), title: '沿线剪下', text: '沿着画好的线，把深色的部分剪掉。纸叠得厚，剪刀要张大一点，慢慢剪。' }));
  } else {
    frames.push(still(folded, { tex: 'preview', title: '折好并画上图案', text: '深色的部分会被剪掉。' }));
    frames.push(still(folded, { tex: (t) => (t < 0.5 ? 'preview' : 'cut'), title: '剪下', text: '把深色的部分剪掉。' }));
  }
  for (let i = b.frames.length - 1; i >= 0; i--) {
    frames.push({ pieces: b.frames[i].pieces, lines: [], rev: true, tex: 'cut', title: i === 0 ? '完全打开' : '打开一层', text: i === 0 ? '把最后一层也打开，轻轻压平。' : '小心地把纸打开一层，别扯破细的地方。' });
  }
  frames.push(still(b.states[0], { tex: 'cut', title: '完成', text: free ? '这就是你剪出来的图案。' : '压平之后就可以贴起来了。' }));
  return { id: c.id, kind: 'cut', name: c.name, paper: c.paper, up: c.color, down: lighten(c.color, 0.18), frames, textures, folded, meta: c };
}
