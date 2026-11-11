// 剪纸数据：先折（fold），再在折好的纸上剪（keep = 只留下这些形状以内；cut = 剪掉这些形状）。
// 所有图形都用“折好之后”的坐标来画，纸的中心在 (0,0)。
const rad = (d) => (d * Math.PI) / 180;
const SQ = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const HL = [[-3, 0], [3, 0]], VL = [[0, -3], [0, 3]];
const ray = (deg) => [[0, 0], [Math.cos(rad(deg)), Math.sin(rad(deg))]];
const at = (deg, r = 1) => [r * Math.cos(rad(deg)), r * Math.sin(rad(deg))];

export const FOLDS = {
  half: { name: '对折', wedge: '左右对称', steps: [
    { title: '左右对折', text: '把纸的左半边折到右半边上，折边在左侧。', ops: [{ line: VL, move: [-1, 0] }] },
  ] },
  strip: { name: '连续对折', wedge: '连成一串', steps: [
    { title: '左右对折', text: '把长纸条左右对折。', ops: [{ line: VL, move: [-1, 0] }] },
    { title: '再对折', text: '再对折一次，叠成四层。', ops: [{ line: [[1, -3], [1, 3]], move: [2, 0] }] },
  ] },
  quarter: { name: '四折', wedge: '四面对称', steps: [
    { title: '左右对折', text: '把纸的左半边折到右半边上。', ops: [{ line: VL, move: [-1, 0] }] },
    { title: '上下对折', text: '再把下半边折到上半边上，纸的中心在左下角。', ops: [{ line: HL, move: [0, -1] }] },
  ] },
  eighth: { name: '八折', wedge: '八瓣对称', steps: [
    { title: '左右对折', text: '把纸的左半边折到右半边上。', ops: [{ line: VL, move: [-1, 0] }] },
    { title: '上下对折', text: '再把下半边折到上半边上，纸的中心在左下角。', ops: [{ line: HL, move: [0, -1] }] },
    { title: '沿对角线对折', text: '从中心那个角出发，沿对角线再对折，变成三角形。', ops: [{ line: ray(45), move: [0, 1] }] },
  ] },
  sixteen: { name: '十六折', wedge: '十六瓣对称', steps: [
    { title: '左右对折', text: '把纸的左半边折到右半边上。', ops: [{ line: VL, move: [-1, 0] }] },
    { title: '上下对折', text: '再把下半边折到上半边上，纸的中心在左下角。', ops: [{ line: HL, move: [0, -1] }] },
    { title: '沿对角线对折', text: '从中心那个角出发，沿对角线对折成三角形。', ops: [{ line: ray(45), move: [0, 1] }] },
    { title: '再对折一次', text: '还是从中心那个角出发，把三角形再对折，变成细长的尖角。', ops: [{ line: ray(22.5), move: at(40) }] },
  ] },
  five: { name: '五折', wedge: '五角对称', steps: [
    { title: '上下对折', text: '把下半边向上对折，折边在下面，折边的中点就是纸的中心。', ops: [{ line: HL, move: [0, -1] }] },
    { title: '左边折过来', text: '以折边中点为顶点，把左边的一角折过来。折边被分成五等份的角度（每份 36°），先折最左边一份。', ops: [{ line: ray(144), move: at(170) }] },
    { title: '继续向右卷', text: '同样以中点为顶点，再折一份。', ops: [{ line: ray(108), move: at(130) }] },
    { title: '再折一份', text: '继续折。', ops: [{ line: ray(72), move: at(90) }] },
    { title: '折成一个尖角', text: '最后一折，所有层叠成一个 36° 的尖角。', ops: [{ line: ray(36), move: at(50) }] },
  ] },
  six: { name: '六折', wedge: '六角对称', steps: [
    { title: '上下对折', text: '把下半边向上对折，折边在下面，折边的中点就是纸的中心。', ops: [{ line: HL, move: [0, -1] }] },
    { title: '左边折三分之一', text: '以折边中点为顶点，把左边 60° 的一角折过来。', ops: [{ line: ray(120), move: at(150) }] },
    { title: '再折三分之一', text: '再把上面的部分折到右边，三份完全重合，变成 60° 的尖角。', ops: [{ line: ray(60), move: at(90) }] },
    { title: '再对折', text: '把尖角再对折一次，变成 30° 的细尖角。', ops: [{ line: ray(30), move: at(45) }] },
  ] },
};
export const foldSteps = (kind) => FOLDS[kind].steps;

/* ---- 画图形的小工具 ---- */
const circle = (cx, cy, r, n = 36) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * 2 * Math.PI), cy + r * Math.sin((i / n) * 2 * Math.PI)]);
const ell = (r0, deg, ra, rb, n = 36) => {
  const [cx, cy] = at(deg, r0), c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI, x = ra * Math.cos(a), y = rb * Math.sin(a);
    return [cx + x * c - y * s, cy + x * s + y * c];
  });
};
const diamond = (r0, deg, ra, rb) => ell(r0, deg, ra, rb, 4);
const drop = (r0, deg, len, w, n = 30) => { // 水滴：尖头朝中心
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)), pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const x = r0 + (len / 2) * (1 - Math.cos(a)), y = w * Math.sin(a) * Math.sin(a / 2);
    pts.push([x * c - y * s, x * s + y * c]);
  }
  return pts;
};
const polar = (f, n = 180) => Array.from({ length: n }, (_, i) => { const t = (i / n) * 2 * Math.PI; return at((t * 180) / Math.PI, f(t)); });
const arcSlot = (r1, r2, a1, a2, n = 14) => {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(at(a1 + ((a2 - a1) * i) / n, r2));
  for (let i = n; i >= 0; i--) pts.push(at(a1 + ((a2 - a1) * i) / n, r1));
  return pts;
};
const band = (a, b, w) => { // 从 a 到 b、宽 w 的长条
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), nx = (-dy / L) * w / 2, ny = (dx / L) * w / 2;
  return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]];
};
const heartPts = (s, cy = 0, n = 80) => Array.from({ length: n }, (_, i) => {
  const t = (i / n) * 2 * Math.PI;
  return [(s * 16 * Math.sin(t) ** 3) / 17, cy + (s * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))) / 17];
});
const mirrorX = (pts, x0) => pts.map(([x, y]) => [2 * x0 - x, y]).reverse();

const dollHalf = [
  ...Array.from({ length: 9 }, (_, i) => { const a = rad(90 - i * 17); return [0.5 + 0.15 * Math.cos(a), 0.36 + 0.15 * Math.sin(a)]; }),
  [0.56, 0.2], [1.2, 0.2], [1.2, 0.07], [0.67, 0.07], [0.69, -0.18], [0.78, -0.7], [0.58, -0.7], [0.5, -0.24],
];
const doll = [...dollHalf, ...mirrorX(dollHalf, 0.5).slice(1, -1)];

const starA = [0.95, 0], starB = at(36, 0.363);
const starCut = (() => {
  const ux = starB[0] - starA[0], uy = starB[1] - starA[1], nx = -uy, ny = ux; // 法线朝外
  const s = nx * (0 - starA[0]) + ny * (0 - starA[1]) > 0 ? -1 : 1;
  const a = [starA[0] - 5 * ux, starA[1] - 5 * uy], b = [starB[0] + 5 * ux, starB[1] + 5 * uy];
  return [a, b, [b[0] + 5 * s * nx, b[1] + 5 * s * ny], [a[0] + 5 * s * nx, a[1] + 5 * s * ny]];
})();

export const CUT_LEVELS = ['入门', '初级', '中级'];
export const CUTS = [
  {
    id: 'cut-heart', name: '对称爱心', level: 0, minutes: 2, fold: 'half', paper: SQ, color: '#d9342b',
    intro: '对折一次，剪半个爱心，打开就是完整的。',
    drawText: '在折边一侧画半个爱心，中间再画半个小爱心。靠着折边画，打开后才连在一起。',
    keep: [heartPts(0.86, -0.02)], cut: [heartPts(0.36, 0.02)],
  },
  {
    id: 'cut-dolls', name: '拉手小人', level: 0, minutes: 3, fold: 'strip', paper: [[-2, -0.7], [2, -0.7], [2, 0.7], [-2, 0.7]], color: '#2f9e6b',
    intro: '长纸条叠四层，剪一个小人，拉开是手拉手的一排。',
    drawText: '画一个小人，两只手一定要伸到纸的左右两条边，手那里不能剪断。',
    keep: [doll], cut: [],
  },
  {
    id: 'cut-star', name: '一刀五角星', level: 1, minutes: 4, fold: 'five', paper: SQ, color: '#e2a41f',
    intro: '折成五折，只剪一刀，就是端正的五角星。',
    drawText: '从一条边靠外的位置，斜着向另一条边靠近尖角的位置画一条直线。只剪这一刀，留下带尖角的那一块。',
    keep: [], cut: [starCut],
  },
  {
    id: 'cut-window', name: '八瓣窗花', level: 1, minutes: 5, fold: 'eighth', paper: SQ, color: '#d9342b',
    intro: '过年贴在窗户上的团花，折三次再剪。',
    drawText: '外边剪成圆弧形的花瓣；两条折边上各剪半个菱形和半个圆，中间剪一个水滴；尖角剪掉一点。',
    keep: [polar((t) => 0.82 + 0.13 * Math.cos(8 * t))],
    cut: [circle(0, 0, 0.11), drop(0.2, 22.5, 0.42, 0.075), diamond(0.4, 0, 0.11, 0.05), diamond(0.4, 45, 0.11, 0.05), circle(0.7, 0, 0.07), circle(...at(45, 0.7), 0.07)],
  },
  {
    id: 'cut-snow', name: '六角雪花', level: 2, minutes: 6, fold: 'six', paper: SQ, color: '#4f8fd6',
    intro: '真正的雪花都是六个角。折成十二层再剪。',
    drawText: '沿着一条折边留出雪花的“主干”，主干上长出两根斜的小枝，其余部分全部剪掉。',
    keep: [
      circle(0, 0, 0.2, 24), band([0, 0], [0.9, 0], 0.09), diamond(0.9, 0, 0.09, 0.07),
      band([0.46, 0], [0.46 + 0.25 * Math.cos(rad(60)), 0.25 * Math.sin(rad(60))], 0.07),
      band([0.46, 0], [0.46 + 0.25 * Math.cos(rad(60)), -0.25 * Math.sin(rad(60))], 0.07),
      band([0.68, 0], [0.68 + 0.16 * Math.cos(rad(60)), 0.16 * Math.sin(rad(60))], 0.06),
      band([0.68, 0], [0.68 + 0.16 * Math.cos(rad(60)), -0.16 * Math.sin(rad(60))], 0.06),
    ],
    cut: [circle(0, 0, 0.06, 12), diamond(0.3, 0, 0.06, 0.022)],
  },
  {
    id: 'cut-rosette', name: '十六瓣团花', level: 2, minutes: 8, fold: 'sixteen', paper: SQ, color: '#d9342b',
    intro: '折四次，花纹更细密，适合练手稳。',
    drawText: '尖角很厚，剪的时候要捏紧。外边剪小圆弧，里面依次剪弧形的细缝、折边上的半个椭圆和中间的水滴。',
    keep: [polar((t) => 0.88 + 0.06 * Math.cos(16 * t), 240)],
    cut: [
      circle(0, 0, 0.09), arcSlot(0.19, 0.25, 4.5, 18), ell(0.42, 0, 0.1, 0.035), ell(0.42, 22.5, 0.1, 0.035),
      drop(0.5, 11.25, 0.2, 0.04), arcSlot(0.76, 0.8, 3.5, 19),
    ],
  },
];
