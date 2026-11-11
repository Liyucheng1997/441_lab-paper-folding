// 剪纸贴图：把“折好后剪掉的形状”按每一层纸的位置映射回整张纸，得到带镂空的贴图。
import * as THREE from 'three';
import { ap, centroid } from '../engine/fold.js';

const path = (ctx, pts) => { ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); };

export function foldedBox(faces) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const f of faces) for (const pt of f.poly) { const [x, y] = ap(f.m, pt); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, x1, y0, y1 };
}

// faces：折好之后的面；shape：{ keep:[多边形], cut:[多边形] }（折好后的坐标）
export function makeTextures(paper, faces, shape, old) {
  let px0 = Infinity, px1 = -Infinity, py0 = Infinity, py1 = -Infinity;
  for (const [x, y] of paper) { px0 = Math.min(px0, x); px1 = Math.max(px1, x); py0 = Math.min(py0, y); py1 = Math.max(py1, y); }
  const pw = px1 - px0, ph = py1 - py0;
  const W = pw >= ph ? 2048 : Math.round((2048 * pw) / ph), Hh = pw >= ph ? Math.round((2048 * ph) / pw) : 2048;
  const sx = W / pw, sy = Hh / ph;

  // 折叠空间里的“剪掉区域”蒙版
  const fb = foldedBox(faces);
  const pad = 0.06 * Math.max(fb.x1 - fb.x0, fb.y1 - fb.y0);
  const mx0 = fb.x0 - pad, my1 = fb.y1 + pad, mw = fb.x1 - fb.x0 + 2 * pad, mh = fb.y1 - fb.y0 + 2 * pad;
  const ms = 1400 / Math.max(mw, mh);
  const mask = document.createElement('canvas');
  mask.width = Math.ceil(mw * ms); mask.height = Math.ceil(mh * ms);
  const mc = mask.getContext('2d');
  mc.fillStyle = '#000';
  mc.setTransform(ms, 0, 0, -ms, -mx0 * ms, my1 * ms);
  if (shape.keep && shape.keep.length) {
    mc.fillRect(mx0, my1 - mh, mw, mh);
    mc.globalCompositeOperation = 'destination-out';
    for (const k of shape.keep) { mc.beginPath(); path(mc, k); mc.fill(); }
    mc.globalCompositeOperation = 'source-over';
  }
  for (const c of shape.cut || []) { mc.beginPath(); path(mc, c); mc.fill(); }

  const make = (mode) => {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = Hh;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, Hh);
    if (mode === 'plain') return cv;
    for (const f of faces) {
      const c = centroid(f.poly);
      const e = f.m.clone().invert().elements;
      ctx.save();
      ctx.setTransform(sx, 0, 0, -sy, -px0 * sx, py1 * sy);
      ctx.beginPath();
      path(ctx, f.poly.map(([x, y]) => { const dx = x - c[0], dy = y - c[1], L = Math.hypot(dx, dy) || 1; return [x + (dx / L) * (2 / sx), y + (dy / L) * (2 / sx)]; }));
      ctx.clip();
      ctx.transform(e[0], e[1], e[4], e[5], e[12], e[13]);
      ctx.translate(mx0, my1);
      ctx.scale(1 / ms, -1 / ms);
      if (mode === 'cut') ctx.globalCompositeOperation = 'destination-out';
      else { ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = 0.42; }
      ctx.drawImage(mask, 0, 0);
      ctx.restore();
    }
    return cv;
  };

  const out = {};
  for (const mode of ['plain', 'preview', 'cut']) {
    const cv = make(mode);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    out[mode] = t;
  }
  if (old) for (const k in old) old[k].dispose();
  return out;
}
