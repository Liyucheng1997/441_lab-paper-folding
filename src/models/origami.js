// 折纸教程数据。坐标说明：
//   菱形纸（DIA）四个角：上 (0,1) 右 (1,0) 下 (0,-1) 左 (-1,0)
//   折叠操作：line 折线两点，move 是“要动的那一侧”上的任意一点；from/to 表示把一点折到另一点
//   dir: valley 谷折（向自己折）/ mountain 山折（向后折）；select 用纸面原始坐标 c 或当前位置 p 选层
import { Matrix4, Vector3 } from 'three';

const R2 = Math.SQRT2, H = Math.SQRT1_2;
const DIA = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const SQ = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const rect = (hw, hh) => [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
const rad = (d) => (d * Math.PI) / 180;
const refl = (pt, p, q) => {
  const dx = q[0] - p[0], dy = q[1] - p[1], L = dx * dx + dy * dy;
  const t = ((pt[0] - p[0]) * dx + (pt[1] - p[1]) * dy) / L;
  return [2 * (p[0] + dx * t) - pt[0], 2 * (p[1] + dy * t) - pt[1]];
};
const rot = (pt, c, deg) => {
  const a = rad(deg), x = pt[0] - c[0], y = pt[1] - c[1];
  return [c[0] + x * Math.cos(a) - y * Math.sin(a), c[1] + x * Math.sin(a) + y * Math.cos(a)];
};
const HL = [[-3, 0], [3, 0]], VL = [[0, -3], [0, 3]];

/* ---------- 入门 ---------- */

const dog = {
  id: 'dog', name: '小狗脸', level: 0, minutes: 2, paper: DIA, paperName: '正方形纸',
  up: '#f3e3cf', down: '#c98a4b',
  intro: '三步就能完成，最适合第一次折纸。',
  steps: [
    { title: '对折成三角形', text: '把纸摆成菱形，上面的角向下对折，和下面的角对齐，压平。', ops: [{ from: [0, 1], to: [0, -1] }] },
    { title: '折出两只耳朵', text: '把左右两个角斜着向下折，让耳朵稍微伸出脸的边缘。', ops: [
      { line: [[-0.3, 0], [-0.8, -0.2]], move: [-1, 0], win: [0, 0.55] },
      { line: [[0.3, 0], [0.8, -0.2]], move: [1, 0], win: [0.45, 1] },
    ] },
    { title: '折出下巴', text: '下面的尖角有两层：前面一层向上折，后面一层向后折。', ops: [
      { line: [[-1, -0.72], [1, -0.72]], move: [0, -1], select: (v) => v.c[1] > 0, win: [0, 0.55] },
      { line: [[-1, -0.72], [1, -0.72]], move: [0, -1], select: (v) => v.c[1] < 0, dir: 'mountain', win: [0.45, 1] },
    ] },
    { title: '完成', text: '用笔画上眼睛和鼻子，小狗就做好了。' },
  ],
};

const cat = {
  id: 'cat', name: '小猫脸', level: 0, minutes: 2, paper: DIA, paperName: '正方形纸',
  up: '#fbe6c8', down: '#f0a04b',
  intro: '折两只尖耳朵，翻过来就是小猫。',
  steps: [
    { title: '对折成三角形', text: '把纸摆成菱形，下面的角向上对折，和上面的角对齐。', ops: [{ from: [0, -1], to: [0, 1] }] },
    { title: '折出两只耳朵', text: '从底边中点出发，把左右两个角斜着向上折，角尖要高出三角形的边。', ops: [
      { line: [[0, 0], [-0.634, 0.366]], move: [-1, 0], win: [0, 0.55] },
      { line: [[0, 0], [0.634, 0.366]], move: [1, 0], win: [0.45, 1] },
    ] },
    { title: '折下头顶', text: '把中间的顶角向下折，头顶就平了。', ops: [
      { line: [[-1, 0.62], [1, 0.62]], move: [0, 1], select: (v) => Math.abs(v.c[0]) < 0.4 },
    ] },
    { title: '翻面', text: '把整个纸翻过来。', ops: [{ type: 'flip' }] },
    { title: '完成', text: '画上眼睛、鼻子和胡须，小猫就做好了。' },
  ],
};

const cupH = 2 / (2 + R2), cupC = R2 - 1;
const cup = {
  id: 'cup', name: '纸杯', level: 0, minutes: 3, paper: DIA, paperName: '正方形纸',
  up: '#e6f1fb', down: '#5aa7e8',
  intro: '真的可以装水的小纸杯。',
  steps: [
    { title: '对折成三角形', text: '把纸摆成菱形，下面的角向上对折。', ops: [{ from: [0, -1], to: [0, 1] }] },
    { title: '左角折到右边', text: '把左边的角折到右侧斜边上，折完后上边缘要保持水平。', ops: [{ from: [-1, 0], to: [cupC, cupH] }] },
    { title: '右角折到左边', text: '右边的角同样折到左侧，盖在刚才那一片上面。', ops: [{ from: [1, 0], to: [-cupC, cupH] }] },
    { title: '前面的角向下折', text: '顶上有两层角，把前面一层向下折，盖住下面的两片。', ops: [
      { line: [[-1, cupH], [1, cupH]], move: [0, 1], select: (v) => v.c[1] < 0 },
    ] },
    { title: '后面的角向后折', text: '把剩下的一层角向后折下去。', ops: [
      { line: [[-1, cupH], [1, cupH]], move: [0, 1], select: (v) => v.c[1] > 0, dir: 'mountain' },
    ] },
    { title: '完成', text: '从上面把杯口撑开，纸杯就做好了。' },
  ],
};

const heart = {
  id: 'heart', name: '爱心', level: 0, minutes: 4, paper: DIA, paperName: '正方形纸',
  up: '#fde4e6', down: '#e8505b',
  intro: '送人最合适的小爱心。',
  steps: [
    { title: '折出十字折痕', text: '把纸摆成菱形，上下对折再打开，左右对折再打开，留下两条折痕。', ops: [
      { line: HL, move: [0, 1], crease: true, win: [0, 0.5] },
      { line: VL, move: [1, 0], crease: true, win: [0.5, 1] },
    ] },
    { title: '上角折到中心', text: '把上面的角折到两条折痕的交点。', ops: [{ from: [0, 1], to: [0, 0] }] },
    { title: '下角折到上边', text: '把下面的角向上折，角尖碰到上边缘的中点。', ops: [{ from: [0, -1], to: [0, 0.5] }] },
    { title: '右边向上折', text: '以底边中点为起点，把右半边沿斜线向上折，让底边贴着中线。', ops: [
      { line: [[0, -0.25], [0.625, 0.375]], move: [1, 0] },
    ] },
    { title: '左边向上折', text: '左半边同样向上折，两片在中线对齐。', ops: [
      { line: [[0, -0.25], [-0.625, 0.375]], move: [-1, 0] },
    ] },
    { title: '把尖角向后折', text: '顶上两个尖和左右两个尖都向后折一点，让爱心变圆润。', ops: [
      { line: [[-1, 0.62], [1, 0.62]], move: [0, 1], dir: 'mountain', win: [0, 0.5] },
      { line: [[0.5, -1], [0.5, 1]], move: [1, 0], dir: 'mountain', win: [0.4, 1] },
      { line: [[-0.5, -1], [-0.5, 1]], move: [-1, 0], dir: 'mountain', win: [0.4, 1] },
    ] },
    { title: '完成', text: '一颗爱心做好了。可以在上面写一句话送给别人。' },
  ],
};

/* ---------- 初级 ---------- */

const PW = 0.75, PH = 1.06, WX = 0.2;
const plane = {
  id: 'plane', name: '纸飞机', level: 1, minutes: 4, paper: rect(PW, PH), paperName: '长方形纸（A4）',
  up: '#ffffff', down: '#dce9f7',
  intro: '经典尖头飞机，飞得又直又远。',
  steps: [
    { title: '折出中线', text: '长方形纸竖着放，左右对折再打开，留下一条中线。', ops: [{ line: VL, move: [1, 0], crease: true }] },
    { title: '两个上角折到中线', text: '把左上角、右上角分别折到中线，顶部变成尖角。', ops: [
      { from: [-PW, PH], to: [0, PH - PW], win: [0, 0.55] },
      { from: [PW, PH], to: [0, PH - PW], win: [0.45, 1] },
    ] },
    { title: '斜边再折到中线', text: '把左右两条斜边再向中线折一次，机头变得更尖。', ops: [
      { line: [[0, PH], [-PW, PH - PW / Math.tan(rad(22.5))]], move: [-PW, 0.3], win: [0, 0.55] },
      { line: [[0, PH], [PW, PH - PW / Math.tan(rad(22.5))]], move: [PW, 0.3], win: [0.45, 1] },
    ] },
    { title: '沿中线对折', text: '沿中线把左半边折到右半边上，刚才折的部分包在里面。', ops: [{ line: VL, move: [-1, 0] }] },
    { title: '折出前面的机翼', text: '把上面一层向左折下来，折线和中线平行，留出机身的宽度。', ops: [
      { line: [[WX, -3], [WX, 3]], move: [1, 0], select: (v) => v.c[0] < 0, tag: 'wingF' },
    ] },
    { title: '折出后面的机翼', text: '另一层向后折，和前面的机翼对齐。', ops: [
      { line: [[WX, -3], [WX, 3]], move: [1, 0], select: (v) => v.c[0] > 0, dir: 'mountain', tag: 'wingB' },
    ] },
    { title: '展开机翼', text: '把两片机翼抬起到水平，和机身垂直。', cam: [0.9, -0.35, 0.45], ops: [
      { line: [[WX, -3], [WX, 3]], move: [-1, 0], all: true, deg: 90, select: (v) => v.has('wingF'), hideLine: true },
      { line: [[WX, -3], [WX, 3]], move: [-1, 0], all: true, deg: 90, dir: 'mountain', select: (v) => v.has('wingB'), hideLine: true },
    ] },
    { title: '完成', text: '捏住机身下方，向前平稳地掷出去。' },
  ],
};

const fortune = {
  id: 'fortune', name: '东南西北', level: 1, minutes: 4, paper: SQ, paperName: '正方形纸',
  up: '#ffffff', down: '#8fd0a8',
  intro: '小时候都玩过的占卜游戏。',
  steps: [
    { title: '折出对角折痕', text: '沿两条对角线分别对折再打开，找到中心点。', ops: [
      { line: [[-1, -1], [1, 1]], move: [-1, 1], crease: true, win: [0, 0.5] },
      { line: [[-1, 1], [1, -1]], move: [1, 1], crease: true, win: [0.5, 1] },
    ] },
    { title: '四个角折到中心', text: '把四个角依次折到中心点，变成一个小一圈的正方形。', ops: [
      { from: [1, 1], to: [0, 0], win: [0, 0.4] }, { from: [-1, 1], to: [0, 0], win: [0.2, 0.6] },
      { from: [-1, -1], to: [0, 0], win: [0.4, 0.8] }, { from: [1, -1], to: [0, 0], win: [0.6, 1] },
    ] },
    { title: '翻面', text: '把纸翻过来。', ops: [{ type: 'flip' }] },
    { title: '四个角再折到中心', text: '再把四个角折到中心点，正方形又小了一圈。', ops: [
      { from: [1, 0], to: [0, 0], win: [0, 0.4] }, { from: [0, 1], to: [0, 0], win: [0.2, 0.6] },
      { from: [-1, 0], to: [0, 0], win: [0.4, 0.8] }, { from: [0, -1], to: [0, 0], win: [0.6, 1] },
    ] },
    { title: '横竖各对折一次', text: '上下对折再打开，左右对折再打开，让它变软。', ops: [
      { line: HL, move: [0, 1], crease: true, win: [0, 0.5] },
      { line: VL, move: [1, 0], crease: true, win: [0.5, 1] },
    ] },
    { title: '翻面', text: '再翻过来，这一面有四个方形口袋。', ops: [{ type: 'flip' }] },
    { title: '完成', text: '把两只手的拇指和食指伸进四个口袋，向中间捏拢，就可以一开一合地玩了。在里面的三角上写上字。' },
  ],
};

const KA = R2 - 1, KB = 2 - R2;
const whale = {
  id: 'whale', name: '鲸鱼', level: 1, minutes: 4, paper: DIA, paperName: '正方形纸',
  up: '#ffffff', down: '#4f8fd6',
  intro: '胖胖的小鲸鱼，尾巴翘起来。',
  steps: [
    { title: '折出中线', text: '把纸摆成菱形，上下对折再打开。', ops: [{ line: HL, move: [0, 1], crease: true }] },
    { title: '两条边折到中线', text: '以右角为顶点，把右上、右下两条边折到中线，像一只风筝。', ops: [
      { line: [[1, 0], [-KA, KB]], move: [0, 1], win: [0, 0.55] },
      { line: [[1, 0], [-KA, -KB]], move: [0, -1], win: [0.45, 1] },
    ] },
    { title: '折出鲸鱼的头', text: '把左边的尖角向右折，角尖碰到两片纸的边缘。', ops: [{ from: [-1, 0], to: [-KA, 0] }] },
    { title: '上下对折', text: '沿中线把上半部分折下来。', ops: [{ line: HL, move: [0, 1] }] },
    { title: '折起尾巴', text: '把右边的尖角斜着向上折，尾巴翘起来。', ops: [
      { line: [[0.55, 0], [0.31, -0.286]], move: [1, 0] },
    ] },
    { title: '完成', text: '画上眼睛，可以在尾巴尖剪一刀分成两瓣。' },
  ],
};

const swanQ = (() => { const t = 2 / (Math.cos(rad(11.25)) + Math.sin(rad(11.25))); return [-1 + t * Math.cos(rad(11.25)), t * Math.sin(rad(11.25))]; })();
const NX = -0.075, HX = 0.6, NECK = 100;
const swan = {
  id: 'swan', name: '天鹅', level: 1, minutes: 5, paper: DIA, paperName: '正方形纸',
  up: '#ffffff', down: '#eef3f9',
  intro: '细长的脖子，优雅的白天鹅。',
  steps: [
    { title: '折出中线', text: '把纸摆成菱形，上下对折再打开。', ops: [{ line: HL, move: [0, 1], crease: true }] },
    { title: '两条边折到中线', text: '以左角为顶点，把左上、左下两条边折到中线。', ops: [
      { line: [[-1, 0], [KA, KB]], move: [0, 1], win: [0, 0.55] },
      { line: [[-1, 0], [KA, -KB]], move: [0, -1], win: [0.45, 1] },
    ] },
    { title: '再折一次变细', text: '把刚折好的两条边再向中线折一次，左边变成细长的尖角。', ops: [
      { line: [[-1, 0], swanQ], move: [0, 1], win: [0, 0.55] },
      { line: [[-1, 0], [swanQ[0], -swanQ[1]]], move: [0, -1], win: [0.45, 1] },
    ] },
    { title: '折出脖子', text: '把细长的尖角向右折过去。', ops: [{ line: [[NX, -1], [NX, 1]], move: [-1, 0], tag: 'neck' }] },
    { title: '折出头', text: '把尖角的顶端再向左折回来一小段。', ops: [
      { line: [[HX, -1], [HX, 1]], move: [1, 0], select: (v) => v.has('neck'), tag: 'head' },
    ] },
    { title: '向后对折', text: '沿中线把上半部分向后折。', ops: [{ line: HL, move: [0, 1], dir: 'mountain' }] },
    { title: '拉起脖子', text: '捏住脖子向上拉起来，在根部压出新的折痕。', allowTear: true, ops: [
      { type: 'rotate', center: [NX, 0], deg: NECK, select: (v) => v.has('neck') },
    ] },
    { title: '拉出头', text: '把头向前拉出来，压平。', allowTear: true, ops: [
      { type: 'rotate', center: rot([HX, 0], [NX, 0], NECK), deg: -90, select: (v) => v.has('head') },
    ] },
    { title: '完成', text: '把身体底部稍微撑开，天鹅就能站住了。', allowTear: true },
  ],
};

/* ---------- 中级：纸船 ---------- */

// “撑开压平”：一个顶角朝上的等腰直角三角形口袋，从底部撑开，再朝垂直方向压成菱形。
// front(v) 判断某片纸属于口袋的前壁还是后壁。
function panelAnim(front, right) {
  const basis = (m, c) => new Matrix4().makeBasis(m, c, new Vector3().crossVectors(m, c).normalize());
  const B0i = basis(new Vector3(0, -1, 0), new Vector3(right ? H : -H, -H, 0)).invert();
  return (t) => {
    const phi = (Math.PI / 4) * Math.sin((t * Math.PI) / 2);
    const psi = Math.acos(Math.min(1, H / Math.cos(phi)));
    const m = new Vector3(0, -Math.cos(phi), (front ? 1 : -1) * Math.sin(phi));
    const c = new Vector3((right ? 1 : -1) * Math.sin(psi), -Math.cos(psi), 0);
    return new Matrix4().makeRotationY((-Math.PI / 2) * t).multiply(basis(m, c).multiply(B0i));
  };
}
function openFlat(pre, front) {
  const ln = (deg) => [[0, 0], [Math.cos(rad(deg)), Math.sin(rad(deg))]];
  return [
    { line: VL, move: [1, 0], deg: 0, hideLine: true },
    { type: 'tag', tag: pre + 'FR', select: (v) => front(v) && v.p[0] > 0 },
    { type: 'tag', tag: pre + 'FL', select: (v) => front(v) && v.p[0] < 0 },
    { type: 'tag', tag: pre + 'KR', select: (v) => !front(v) && v.p[0] > 0 },
    { type: 'tag', tag: pre + 'KL', select: (v) => !front(v) && v.p[0] < 0 },
    { type: 'rotate', center: [0, 0], deg: -45, select: (v) => v.has(pre + 'FR'), anim: panelAnim(true, true) },
    { line: ln(-67.5), all: true, select: (v) => v.has(pre + 'KR'), anim: panelAnim(false, true), hideLine: true },
    { line: ln(-112.5), all: true, dir: 'mountain', select: (v) => v.has(pre + 'FL'), anim: panelAnim(true, false), hideLine: true },
    { type: 'rotate', center: [0, 0], deg: 45, select: (v) => v.has(pre + 'KL'), anim: panelAnim(false, false) },
  ];
}
const BH = PW * H, BS = BH * H;
const isFlap = (v) => v.has('flapF') || v.has('flapK');
const boat = {
  id: 'boat', name: '纸船', level: 2, minutes: 8, paper: rect(PW, PH), paperName: '长方形纸（A4）',
  up: '#ffffff', down: '#e7eef7',
  intro: '能漂在水上的小船，要“撑开再压平”两次。',
  steps: [
    { title: '上下对折', text: '长方形纸竖着放，把上半部分向下对折。折边在上面。', ops: [{ line: HL, move: [0, 1] }] },
    { title: '两个上角折到中线', text: '把左上角、右上角向下折到中线，上面变成一个尖顶，下面留出一条边。', ops: [
      { from: [-PW, 0], to: [0, -PW], win: [0, 0.55] },
      { from: [PW, 0], to: [0, -PW], win: [0.45, 1] },
    ] },
    { title: '前面的边向上折', text: '把下面那条边的前面一层向上折，压住三角形。', ops: [
      { line: [[-2, -PW], [2, -PW]], move: [0, -2], select: (v) => v.c[1] > 0, tag: 'brimF' },
    ] },
    { title: '后面的边向后折', text: '后面一层同样向后折上去。现在像一顶帽子。', ops: [
      { line: [[-2, -PW], [2, -PW]], move: [0, -2], select: (v) => v.c[1] < 0, dir: 'mountain', tag: 'brimK' },
    ] },
    { title: '把伸出来的小角折进去', text: '帽檐两头伸出三角形的小角，分别向里折，藏到帽檐后面。', ops: [
      { line: [[0, 0], [-PW, -PW]], move: [-PW, -0.5], select: (v) => v.has('brimF'), dir: 'mountain', layer: (l) => l - 0.5 },
      { line: [[0, 0], [PW, -PW]], move: [PW, -0.5], select: (v) => v.has('brimF'), dir: 'mountain', layer: (l) => l - 0.5 },
      { line: [[0, 0], [-PW, -PW]], move: [-PW, -0.5], select: (v) => v.has('brimK'), layer: (l) => l + 0.5 },
      { line: [[0, 0], [PW, -PW]], move: [PW, -0.5], select: (v) => v.has('brimK'), layer: (l) => l + 0.5 },
    ] },
    { title: '撑开，压成菱形', text: '从帽子底部把前后两层撑开，让左右两个角碰到一起，然后朝另一个方向压平，变成菱形。', ops: openFlat('a', (v) => v.c[1] > -Math.abs(v.c[0])) },
    { title: '前面的下角向上折', text: '把菱形下面的角，前面一层向上折到顶角。', ops: [
      { line: [[-2, -BH], [2, -BH]], move: [0, -2], select: (v) => v.c[0] > 0, tag: 'flapF' },
    ] },
    { title: '后面的下角向后折', text: '后面一层同样向后折上去，变成一个三角形。', ops: [
      { line: [[-2, -BH], [2, -BH]], move: [0, -2], select: (v) => v.c[0] < 0, dir: 'mountain', tag: 'flapK' },
    ] },
    { title: '再撑开，压成菱形', text: '和刚才一样：从底部撑开，左右两个角碰到一起，压平成小菱形。', ops: openFlat('b', (v) => v.c[0] > 0) },
    { title: '向两边拉开', text: '捏住菱形顶上的左右两片，慢慢向两边拉开，中间的三角形立起来成为船帆，底部压平。', ops: [
      { line: [[-2, -BS], [2, -BS]], move: [0, -2], select: (v) => !isFlap(v) && (v.has('bFR') || v.has('bKR')) },
      { line: [[-2, -BS], [2, -BS]], move: [0, -2], select: (v) => !isFlap(v) && (v.has('bFL') || v.has('bKL')), dir: 'mountain' },
      { type: 'rotate', center: [-BS, -BS], deg: 90, select: (v) => v.has('flapF') && v.has('bFR'), layer: 'top' },
      { type: 'rotate', center: [-BS, -BS], deg: 90, select: (v) => v.has('flapF') && v.has('bFL'), layer: 'bottom' },
      { type: 'rotate', center: [BS, -BS], deg: -90, select: (v) => v.has('flapK') && v.has('bKR'), layer: 'top' },
      { type: 'rotate', center: [BS, -BS], deg: -90, select: (v) => v.has('flapK') && v.has('bKL'), layer: 'bottom' },
    ] },
    { title: '完成', text: '把船身从上面稍微撑开，小船就能立住，也能放到水里。' },
  ],
};

/* ---------- 高级：千纸鹤 ---------- */

const K = 1 - H;
const PR = [K, -K], PL = [-K, -K], BT = [0, -1];
const Lsq = (v) => v.c[0] < -Math.abs(v.c[1]);
const Rsq = (v) => v.c[0] > Math.abs(v.c[1]);
const Tc = (v) => v.c[1] > Math.abs(v.c[0]);
const Bc = (v) => v.c[1] < -Math.abs(v.c[0]);
const petal = (face, right2, left2) => [
  { line: [PR, BT], move: [0.5, -0.5], select: face, dir: 'mountain', hideLine: true },
  { line: [PR, BT], move: [0.5, -0.5], select: right2 },
  { line: [BT, PL], move: [-0.5, -0.5], select: face, dir: 'mountain', hideLine: true },
  { line: [BT, PL], move: [-0.5, -0.5], select: left2 },
  { line: [PL, PR], move: [0, -1], select: face },
];
const NA = rad(11.25);
const narrow = (face, right2, left2) => [
  { line: [BT, [Math.sin(NA) * 1.5, -1 + Math.cos(NA) * 1.5]], move: [0.5, -0.5], select: (v) => face(v) || right2(v), win: [0, 0.55] },
  { line: [BT, [-Math.sin(NA) * 1.5, -1 + Math.cos(NA) * 1.5]], move: [-0.5, -0.5], select: (v) => face(v) || left2(v), win: [0.45, 1] },
];
const NC = [0, -0.36], NQ = [Math.cos(rad(-20.3)), -0.36 + Math.sin(rad(-20.3))];
const neckTip = refl(BT, NC, NQ);
const neckDir = (() => { const b = refl([0.03, -0.7], NC, NQ); const a = Math.atan2(neckTip[1] - b[1], neckTip[0] - b[0]); return a; })();
const headP = [neckTip[0] - 0.2 * Math.cos(neckDir), neckTip[1] - 0.2 * Math.sin(neckDir)];
const headA = neckDir - rad(37.5);
const crane = {
  id: 'crane', name: '千纸鹤', level: 3, minutes: 15, paper: DIA, paperName: '正方形纸',
  up: '#fdeef0', down: '#e86a7a',
  intro: '折纸里最经典的作品。会用到压折、花瓣折和内翻折，一步一步来。',
  steps: [
    { title: '对折成三角形', text: '把纸摆成菱形，上面的角向下对折。', ops: [{ line: HL, move: [0, 1] }] },
    { title: '再对折', text: '把右边的角折到左边，变成一个小三角形。', ops: [{ line: VL, move: [1, 0] }] },
    { title: '压折：撑开压成正方形', text: '把上面一片立起来，从中间撑开口袋，对准中线压平，变成一个正方形。', ops: [
      { line: [[-0.5, -0.5], [0, 0]], move: [-0.6, -0.2], select: (v) => v.c[0] > 0 && v.c[1] < 0, dir: 'mountain', hideLine: true },
      { line: [[-0.5, -0.5], [0, 0]], move: [-0.6, -0.2], select: (v) => v.c[0] > 0 && v.c[1] > 0 },
      { line: [[0, -1], [0, 0]], move: [-1, 0], select: (v) => v.c[0] > 0 && v.c[1] < 0 },
    ] },
    { title: '翻面', text: '把纸翻过来。', ops: [{ type: 'flip' }] },
    { title: '另一面同样压折', text: '把这一面的三角形也立起来、撑开、压平。现在是一个四层的“双正方形”，开口朝下。', ops: [
      { line: [[0, 0], [0.5, -0.5]], move: [0.6, -0.2], select: (v) => v.c[0] < 0 && v.c[1] < 0, dir: 'mountain', hideLine: true },
      { line: [[0, 0], [0.5, -0.5]], move: [0.6, -0.2], select: (v) => v.c[0] < 0 && v.c[1] > 0 },
      { line: VL, move: [1, 0], select: (v) => v.c[0] < 0 && v.c[1] < 0 },
    ] },
    { title: '折出三条折痕', text: '把上面一片的左右两条下边折到中线再打开，再把顶上的三角形向下折一次再打开。', ops: [
      { line: [PR, BT], move: [0.5, -0.5], select: (v) => Lsq(v) || (Tc(v) && v.c[0] < 0), crease: true, win: [0, 0.34] },
      { line: [BT, PL], move: [-0.5, -0.5], select: (v) => Lsq(v) || (Bc(v) && v.c[0] < 0), crease: true, win: [0.33, 0.67] },
      { line: [PL, PR], move: [0, 0], crease: true, win: [0.66, 1] },
    ] },
    { title: '花瓣折', text: '捏住最上面一层的下角向上掀起，沿刚才的横折痕翻上去，两边顺着折痕向中间收拢，压平成细长的菱形。', ops: petal(Lsq, (v) => Tc(v) && v.c[0] < 0, (v) => Bc(v) && v.c[0] < 0) },
    { title: '翻面', text: '把纸翻过来。', ops: [{ type: 'flip' }] },
    { title: '另一面同样花瓣折', text: '重复刚才的花瓣折。完成后是一个细长菱形，下半部分分成两条“腿”。', ops: petal(Rsq, (v) => Bc(v) && v.c[0] > 0, (v) => Tc(v) && v.c[0] > 0) },
    { title: '把两条腿折细', text: '把前面一层左右两条下边折到中线。', ops: narrow(Rsq, (v) => Bc(v) && v.c[0] > 0, (v) => Tc(v) && v.c[0] > 0) },
    { title: '翻面', text: '把纸翻过来。', ops: [{ type: 'flip' }] },
    { title: '另一面同样折细', text: '这一面的两条下边也折到中线。两条腿变得又细又尖。', ops: narrow(Lsq, (v) => Tc(v) && v.c[0] < 0, (v) => Bc(v) && v.c[0] < 0) },
    { title: '内翻折：折出脖子', text: '把右边的腿稍微打开，沿折线从两层中间向上翻出去，再压平。', ops: [
      { type: 'reverse', line: [NC, NQ], move: [0.05, -0.9], select: (v) => v.p[0] > 1e-6, front: (v) => v.c[0] < 0, tag: 'neck' },
    ] },
    { title: '内翻折：折出尾巴', text: '左边的腿用同样的方法向上翻出去。', ops: [
      { type: 'reverse', line: [NC, [-NQ[0], NQ[1]]], move: [-0.05, -0.9], select: (v) => v.p[0] < -1e-6 && !v.has('neck'), front: (v) => v.c[0] < 0 },
    ] },
    { title: '内翻折：折出头', text: '把脖子的尖端向下做一次内翻折，就是鹤的头。', ops: [
      { type: 'reverse', line: [headP, [headP[0] + Math.cos(headA), headP[1] + Math.sin(headA)]], move: neckTip, select: (v) => v.has('neck'), front: (v) => v.c[0] < 0 },
    ] },
    { title: '展开翅膀', text: '把前后两片翅膀向下拉开到水平，同时轻轻把背部撑鼓。', cam: [0.55, 0.5, 0.7], allowTear: true, ops: [
      { line: [PL, PR], move: [0, 1], all: true, deg: 82, select: (v) => Lsq(v) && v.c[0] < -K, hideLine: true },
      { line: [PL, PR], move: [0, 1], all: true, deg: 82, dir: 'mountain', select: (v) => Rsq(v) && v.c[0] > K, hideLine: true },
    ] },
    { title: '完成', text: '千纸鹤完成了。多折几次，折痕会越来越整齐。', allowTear: true },
  ],
};

export const LEVELS = ['入门', '初级', '中级', '高级'];
export const ORIGAMI = [dog, cat, cup, heart, plane, fortune, whale, swan, boat, crane];
