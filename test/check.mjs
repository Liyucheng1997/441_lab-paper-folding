// 自检：跑完每个教程的所有步骤，检查纸有没有被“撕开”、自定义动画终点是否与折叠结果一致。
import { build, tears, isFlat } from '../src/engine/fold.js';
import { ORIGAMI } from '../src/models/origami.js';
import { CUTS, foldSteps } from '../src/cut/patterns.js';

let fail = 0;
const run = (name, model) => {
  let b;
  try { b = build(model); } catch (e) { console.log(`✗ ${name}: 运行出错`, e); fail++; return; }
  const notes = [];
  b.frames.forEach((f, i) => {
    const t = tears(b.states[i + 1]);
    if (t.length && !f.allowTear) { notes.push(`  第${i + 1}步「${f.title}」撕裂 ${t.length} 处，例如 ${JSON.stringify(t[0])}`); fail++; }
    if (f.animErr > 1e-6) { notes.push(`  第${i + 1}步动画终点误差 ${f.animErr}`); fail++; }
    const moved = f.pieces.filter((p) => p.anims.length).length;
    if (model.steps[i].ops && !moved) { notes.push(`  第${i + 1}步「${f.title}」没有任何面在动`); fail++; }
  });
  const last = b.states[b.states.length - 1];
  console.log(`${notes.length ? '✗' : '✓'} ${name}: ${b.frames.length} 步, 最终 ${last.length} 片, 最高 ${Math.max(...last.filter((f) => isFlat(f.m)).map((f) => f.layer)) + 1} 层`);
  notes.forEach((n) => console.log(n));
};
for (const m of ORIGAMI) run(m.name, m);
for (const c of CUTS) run('剪纸·' + c.name, { paper: c.paper, steps: foldSteps(c.fold) });
console.log(fail ? `\n${fail} 个问题` : '\n全部通过');
process.exit(fail ? 1 : 0);
