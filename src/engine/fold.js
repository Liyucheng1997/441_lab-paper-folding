// 折叠引擎：把一张纸表示成若干个平面多边形（面），每个面带一个 3D 位姿矩阵和层号。
// 每一步由若干“操作”组成（沿线折叠、翻面、平面内转动、内翻折），
// 引擎负责按折线切分面、更新位姿、重新排层，并给出可供动画插值的“片”。
import { Matrix4, Vector3 } from 'three';

export const LAYER = 0.005; // 相邻两层纸之间的间距
const E = 1e-6;

export function rotLine(p, q, ang) {
  const d = new Vector3(q[0] - p[0], q[1] - p[1], 0).normalize();
  return new Matrix4().makeTranslation(p[0], p[1], 0)
    .multiply(new Matrix4().makeRotationAxis(d, ang))
    .multiply(new Matrix4().makeTranslation(-p[0], -p[1], 0));
}

export function rotZ(c, ang) {
  return new Matrix4().makeTranslation(c[0], c[1], 0)
    .multiply(new Matrix4().makeRotationZ(ang))
    .multiply(new Matrix4().makeTranslation(-c[0], -c[1], 0));
}

export function ap(m, pt) {
  const e = m.elements, x = pt[0], y = pt[1];
  return [e[0] * x + e[4] * y + e[12], e[1] * x + e[5] * y + e[13], e[2] * x + e[6] * y + e[14]];
}

export const isFlat = (m) => Math.abs(m.elements[10]) > 0.9999;
const sgn = (m) => (m.elements[10] >= 0 ? 1 : -1);

export function centroid(poly) {
  let x = 0, y = 0;
  for (const p of poly) { x += p[0]; y += p[1]; }
  return [x / poly.length, y / poly.length];
}

function area(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

function clip(poly, s, sg) {
  const out = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const sa = s[i] * sg, sb = s[(i + 1) % n] * sg;
    if (sa >= -E) out.push(a);
    if ((sa > E && sb < -E) || (sa < -E && sb > E)) {
      const t = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

function clipSegs(segs, sf, sg) {
  const out = [];
  for (const [a, b] of segs) {
    const sa = sf(a) * sg, sb = sf(b) * sg;
    if (sa < -E && sb < -E) continue;
    if (sa >= -E && sb >= -E) { out.push([a, b]); continue; }
    const t = sa / (sa - sb);
    const m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    out.push(sa >= -E ? [a, m] : [m, b]);
  }
  return out;
}

function view(w) {
  const c = centroid(w.poly);
  return { c, p: ap(w.m, c), layer: w.layer, tags: w.tags, has: (t) => w.tags.has(t) };
}

// 把各种写法的折线统一成 [p, q]，保证“要动的一侧”在 p→q 的左边
function lineOf(op) {
  let p, q, move = op.move;
  if (op.from) {
    const f = op.from, t = op.to;
    p = [(f[0] + t[0]) / 2, (f[1] + t[1]) / 2];
    q = [p[0] - (t[1] - f[1]), p[1] + (t[0] - f[0])];
    move = f;
  } else {
    [p, q] = op.line;
  }
  if (move) {
    const nx = -(q[1] - p[1]), ny = q[0] - p[0];
    if ((move[0] - p[0]) * nx + (move[1] - p[1]) * ny < 0) [p, q] = [q, p];
  }
  return [p, q];
}

const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

function overlap(A, B) {
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      const nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const len = Math.hypot(nx, ny);
      if (len < 1e-9) continue;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const v of A) { const d = (v[0] * nx + v[1] * ny) / len; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
      for (const v of B) { const d = (v[0] * nx + v[1] * ny) / len; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
      if (a1 <= b0 + 1e-5 || b1 <= a0 + 1e-5) return false;
    }
  }
  return true;
}

// 重新排层：保持互相重叠的面的上下次序，让每个面“落”到它下面的面上
export function compact(faces) {
  const fl = faces.filter((f) => isFlat(f.m));
  const polys = fl.map((f) => f.poly.map((p) => ap(f.m, p)));
  const order = fl.map((_, i) => i).sort((a, b) => fl[a].layer - fl[b].layer);
  const z = new Array(fl.length).fill(0);
  const done = [];
  for (const i of order) {
    let h = 0;
    for (const j of done) if (z[j] + 1 > h && overlap(polys[i], polys[j])) h = z[j] + 1;
    z[i] = h;
    done.push(i);
  }
  fl.forEach((f, i) => { f.layer = z[i]; });
}

export function runStep(faces, step) {
  let W = faces.map((f) => ({
    poly: f.poly, m0: f.m, m: f.m, layer0: f.layer, layer: f.layer, off0: f.off,
    tags: new Set(f.tags), creases: f.creases, anims: [], src: f,
  }));
  const lines = [];
  const ops = step.ops || [];
  const creaseOnly = ops.length > 0 && ops.every((o) => o.crease);
  const newCreases = new Map();
  let animErr = 0;

  for (const op of ops) {
    const type = op.type || 'fold';
    const win = op.win || [0, 1];
    const sel = (w) => !op.select || op.select(view(w));
    const flatLayers = W.filter((w) => isFlat(w.m)).map((w) => w.layer);
    const mx = Math.max(...flatLayers), mn = Math.min(...flatLayers);

    if (type === 'tag') {
      for (const w of W) if (sel(w)) w.tags.add(op.tag);
      continue;
    }

    let moved = [], R, fn, flips = true;

    if (type === 'flip') {
      const x = op.x || 0;
      R = rotLine([x, -1], [x, 1], Math.PI);
      fn = (t) => rotLine([x, -1], [x, 1], Math.PI * t);
      for (const w of W) { w.m = R.clone().multiply(w.m); w.anims.push({ win, fn }); w.layer = -w.layer; }
      continue;
    }

    if (type === 'rotate') {
      const ang = (op.deg * Math.PI) / 180;
      R = rotZ(op.center, ang);
      fn = (t) => rotZ(op.center, ang * t);
      moved = W.filter((w) => isFlat(w.m) && sel(w));
      flips = false;
    } else {
      // fold / reverse
      const [p, q] = lineOf(op);
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const d = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
      const n = [-d[1], d[0]];
      const next = [];
      let lo = Infinity, hi = -Infinity;
      for (const w of W) {
        if (!isFlat(w.m) || !sel(w)) { next.push(w); continue; }
        if (op.all) { moved.push(w); next.push(w); continue; }
        const cur = w.poly.map((pt) => ap(w.m, pt));
        const s = cur.map((c) => (c[0] - p[0]) * n[0] + (c[1] - p[1]) * n[1]);
        const smax = Math.max(...s), smin = Math.min(...s);
        if (smax <= E) { next.push(w); continue; }
        const X = [];
        for (let i = 0; i < cur.length; i++) {
          const j = (i + 1) % cur.length;
          if (Math.abs(s[i]) <= E) X.push([cur[i], w.poly[i]]);
          else if ((s[i] > E && s[j] < -E) || (s[i] < -E && s[j] > E)) {
            const t = s[i] / (s[i] - s[j]);
            X.push([
              [cur[i][0] + (cur[j][0] - cur[i][0]) * t, cur[i][1] + (cur[j][1] - cur[i][1]) * t],
              [w.poly[i][0] + (w.poly[j][0] - w.poly[i][0]) * t, w.poly[i][1] + (w.poly[j][1] - w.poly[i][1]) * t],
            ]);
          }
        }
        for (const [c] of X) {
          const u = (c[0] - p[0]) * d[0] + (c[1] - p[1]) * d[1];
          lo = Math.min(lo, u); hi = Math.max(hi, u);
        }
        if (smin >= -E) { moved.push(w); next.push(w); continue; }
        if (op.crease && X.length >= 2) {
          if (!newCreases.has(w.src)) newCreases.set(w.src, []);
          newCreases.get(w.src).push([X[0][1], X[X.length - 1][1]]);
        }
        const m = w.m;
        const sf = (pt) => { const c = ap(m, pt); return (c[0] - p[0]) * n[0] + (c[1] - p[1]) * n[1]; };
        const A = clip(w.poly, s, 1), B = clip(w.poly, s, -1);
        if (area(A) > 1e-9) {
          const wa = { ...w, poly: A, tags: new Set(w.tags), anims: [...w.anims], creases: clipSegs(w.creases, sf, 1) };
          moved.push(wa); next.push(wa);
        }
        if (area(B) > 1e-9) {
          next.push({ ...w, poly: B, tags: new Set(w.tags), anims: [...w.anims], creases: clipSegs(w.creases, sf, -1) });
        }
      }
      W = next;
      const deg = op.deg ?? 180;
      const ang = (op.dir === 'mountain' ? -1 : 1) * (deg * Math.PI) / 180;
      if (hi - lo > 1e-4 && !op.hideLine) {
        lines.push({
          a: [p[0] + d[0] * lo, p[1] + d[1] * lo], b: [p[0] + d[0] * hi, p[1] + d[1] * hi],
          dir: op.dir === 'mountain' ? 'mountain' : 'valley', win,
        });
      }
      if (op.crease) {
        const cfn = (t) => rotLine(p, q, ang * 0.92 * Math.sin(Math.PI * t));
        for (const w of moved) w.anims.push({ win, fn: cfn });
        continue;
      }
      R = rotLine(p, q, ang);
      fn = (t) => rotLine(p, q, ang * t);
      if (deg !== 180) flips = null; // 没折平：不改层
    }

    if (op.anim) {
      const e1 = op.anim(1).elements, e2 = R.elements;
      for (let i = 0; i < 16; i++) animErr = Math.max(animErr, Math.abs(e1[i] - e2[i]));
      fn = op.anim;
    }

    // 层
    if (flips !== null && moved.length) {
      const ls = moved.map((w) => w.layer);
      const mvMax = Math.max(...ls), mvMin = Math.min(...ls);
      let mode = op.layer;
      if (!mode) mode = type === 'reverse' ? 'reverse' : type === 'rotate' ? 'keep' : op.dir === 'mountain' ? 'bottom' : 'top';
      if (typeof mode === 'function') {
        for (const w of moved) w.layer = mode(w.layer, view(w));
      } else if (mode === 'top') {
        for (const w of moved) w.layer = flips ? mx + 1 + (mvMax - w.layer) : mx + 1 + (w.layer - mvMin);
      } else if (mode === 'bottom') {
        for (const w of moved) w.layer = flips ? mn - 1 - (w.layer - mvMin) : mn - 1 - (mvMax - w.layer);
      } else if (mode === 'reverse') {
        // 内翻折：尖角的前半、后半各自翻进前后两组之间的缝里
        const fr = moved.filter((w) => op.front(view(w))), bk = moved.filter((w) => !op.front(view(w)));
        const af = Math.min(...fr.map((w) => w.layer)), ab = Math.max(...bk.map((w) => w.layer));
        const mid = (af + ab) / 2, half = (af - ab) / 2;
        for (const w of fr) w.layer = mid + (0.8 * half) / (1 + (w.layer - af));
        for (const w of bk) w.layer = mid - (0.8 * half) / (1 + (ab - w.layer));
      }
    }
    for (const w of moved) {
      w.m = R.clone().multiply(w.m);
      w.anims.push({ win, fn });
      if (op.tag) w.tags.add(op.tag);
    }
  }

  let next;
  if (creaseOnly) {
    next = faces.map((f) => (newCreases.has(f) ? { ...f, creases: [...f.creases, ...newCreases.get(f)] } : f));
    for (const w of W) { w.m = w.m0; w.layer = w.layer0; }
  } else {
    next = W.map((w) => ({ poly: w.poly, m: w.m, layer: w.layer, off: w.off0, tags: w.tags, creases: w.creases }));
    compact(next);
    next.forEach((f, i) => {
      if (isFlat(f.m)) f.off = f.layer * LAYER * sgn(f.m);
      W[i].layer = f.layer;
      W[i].off1 = f.off;
    });
  }
  const pieces = W.map((w) => ({
    poly: w.poly, m0: w.m0, m1: w.m, off0: w.off0, off1: creaseOnly ? w.off0 : w.off1,
    anims: w.anims, creases: w.creases,
  }));
  return { pieces, lines, next, animErr };
}

export function staticPieces(faces) {
  return faces.map((f) => ({ poly: f.poly, m0: f.m, m1: f.m, off0: f.off, off1: f.off, anims: [], creases: f.creases }));
}

const _T = new Matrix4();
export function pose(piece, t, out) {
  out.copy(piece.m0);
  if (t >= 1) out.copy(piece.m1);
  else if (t > 0) {
    for (const a of piece.anims) {
      const lt = clamp01((t - a.win[0]) / (a.win[1] - a.win[0]));
      if (lt > 0) out.premultiply(a.fn(ease(lt)));
    }
  }
  const o = piece.off0 + (piece.off1 - piece.off0) * ease(clamp01(t));
  out.multiply(_T.makeTranslation(0, 0, o));
  return out;
}

export function initialFaces(paper) {
  return [{ poly: paper, m: new Matrix4(), layer: 0, off: 0, tags: new Set(), creases: [] }];
}

// 把一个教程的所有步骤预先算好
export function build(model) {
  let faces = initialFaces(model.paper);
  const states = [faces];
  const frames = [];
  for (const step of model.steps) {
    const r = runStep(faces, step);
    frames.push({ pieces: r.pieces, lines: r.lines, title: step.title, text: step.text, cam: step.cam, animErr: r.animErr, allowTear: step.allowTear });
    faces = r.next;
    states.push(faces);
  }
  return { frames, states };
}

// 自检：共用一条纸边的两个面，折完之后这条边必须还在同一个位置（纸没被撕开）
export function tears(faces) {
  const bad = [];
  const onSeg = (m, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = dx * dx + dy * dy;
    const t = ((m[0] - a[0]) * dx + (m[1] - a[1]) * dy) / L;
    if (t < 0.02 || t > 0.98) return false;
    return Math.hypot(a[0] + dx * t - m[0], a[1] + dy * t - m[1]) < 1e-6;
  };
  faces.forEach((f, i) => {
    f.poly.forEach((a, k) => {
      const b = f.poly[(k + 1) % f.poly.length];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-4) return;
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      faces.forEach((g, j) => {
        if (j <= i) return;
        for (let e = 0; e < g.poly.length; e++) {
          if (onSeg(mid, g.poly[e], g.poly[(e + 1) % g.poly.length])) {
            const P = ap(f.m, mid), Q = ap(g.m, mid);
            const dist = Math.hypot(P[0] - Q[0], P[1] - Q[1], P[2] - Q[2]);
            if (dist > 1e-4) bad.push({ i, j, mid, dist });
            break;
          }
        }
      });
    });
  });
  return bad;
}
