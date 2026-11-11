// 3D 播放器：把引擎算出的“片”画出来，并按进度 t 插值每一步的折叠动画。
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { pose, ap, LAYER } from './fold.js';

const DEFAULT_DIR = [0.2, -0.34, 1];
const FOV = 32;

function bounds(frame) {
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const p of frame.pieces) for (const m of [p.m0, p.m1]) for (const pt of p.poly) { const q = ap(m, pt); b.expandByPoint(v.set(q[0], q[1], q[2])); }
  const c = b.getCenter(new THREE.Vector3());
  let r = 0;
  for (const p of frame.pieces) for (const m of [p.m0, p.m1]) for (const pt of p.poly) { const q = ap(m, pt); r = Math.max(r, Math.hypot(q[0] - c.x, q[1] - c.y, q[2] - c.z)); }
  return { c, r };
}

function dashes(line, z) {
  const { a, b, dir } = line;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n = [-d[1], d[0]];
  const pat = dir === 'mountain' ? [0.1, 0.035, 0.02, 0.035] : [0.06, 0.04];
  const w = 0.008, pos = [];
  let u = -0.05, i = 0;
  while (u < L + 0.05) {
    const len = pat[i % pat.length];
    if (i % 2 === 0) {
      const u2 = Math.min(u + len, L + 0.05);
      const P = (uu, s) => [a[0] + d[0] * uu + n[0] * w * s, a[1] + d[1] * uu + n[1] * w * s, z];
      pos.push(...P(u, -1), ...P(u2, -1), ...P(u2, 1), ...P(u, -1), ...P(u2, 1), ...P(u, 1));
    }
    u += len; i++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

export class Stage {
  constructor() {
    this.scene = new THREE.Scene();
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe2e8, 2.5));
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 60);
    const sun = new THREE.DirectionalLight(0xffffff, 0.95);
    sun.position.set(-0.5, 0.9, 1);
    sun.target.position.set(0, 0, -1);
    this.camera.add(sun, sun.target);
    this.scene.add(this.camera);
    const common = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
    this.matUp = new THREE.MeshLambertMaterial({ ...common, side: THREE.FrontSide });
    this.matDown = new THREE.MeshLambertMaterial({ ...common, side: THREE.BackSide });
    this.matEdge = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 });
    this.matCrease = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.13 });
    this.items = [];
    this.guides = [];
  }

  setPaper(paper, up, down, textures) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of paper) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    this.box = { x0, y0, w: x1 - x0, h: y1 - y0 };
    this.paperR = Math.hypot(x1 - x0, y1 - y0) / 2;
    this.textures = textures || null;
    for (const m of [this.matUp, this.matDown]) { m.alphaTest = textures ? 0.5 : 0; m.map = textures ? textures.plain : null; m.needsUpdate = true; }
    this.setColors(up, down);
  }

  setColors(up, down) {
    this.matUp.color.set(up);
    this.matDown.color.set(down);
  }

  setTex(name) {
    if (!this.textures || this.texName === name) return;
    this.texName = name;
    this.matUp.map = this.matDown.map = this.textures[name];
  }

  clear() {
    for (const it of this.items) { this.root.remove(it.group); it.group.traverse((o) => o.geometry && o.geometry.dispose()); }
    for (const g of this.guides) { this.root.remove(g.mesh); g.mesh.geometry.dispose(); g.mesh.material.dispose(); }
    this.items = []; this.guides = [];
  }

  setFrame(frame) {
    this.clear();
    this.frame = frame;
    const { x0, y0, w, h } = this.box;
    let top = 0;
    for (const piece of frame.pieces) {
      const n = piece.poly.length, pos = [], uv = [], idx = [];
      for (const [x, y] of piece.poly) { pos.push(x, y, 0); uv.push((x - x0) / w, (y - y0) / h); }
      for (let i = 1; i < n - 1; i++) idx.push(0, i, i + 1);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      g.addGroup(0, idx.length, 0);
      g.addGroup(0, idx.length, 1);
      const group = new THREE.Group();
      group.matrixAutoUpdate = false;
      group.add(new THREE.Mesh(g, [this.matUp, this.matDown]));
      if (!this.textures) {
        const eg = new THREE.BufferGeometry();
        eg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        group.add(new THREE.LineLoop(eg, this.matEdge));
        if (piece.creases.length) {
          const cp = [];
          for (const [a, b] of piece.creases) cp.push(a[0], a[1], 0, b[0], b[1], 0);
          const cg = new THREE.BufferGeometry();
          cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
          group.add(new THREE.LineSegments(cg, this.matCrease));
        }
      }
      this.root.add(group);
      this.items.push({ group, piece });
      top = Math.max(top, Math.abs(piece.off0));
    }
    if (!frame.rev) {
      for (const line of frame.lines || []) {
        const mat = new THREE.MeshBasicMaterial({ color: line.dir === 'mountain' ? 0x3a3a3c : 0x0071e3, transparent: true, depthTest: false, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(dashes(line, top + LAYER * 3), mat);
        mesh.renderOrder = 10;
        this.root.add(mesh);
        this.guides.push({ mesh, line });
      }
    }
    this.bounds = bounds(frame);
  }

  update(t) {
    const f = this.frame;
    if (!f) return;
    const tt = f.rev ? 1 - t : t;
    for (const it of this.items) pose(it.piece, tt, it.group.matrix);
    for (const g of this.guides) {
      const [w0, w1] = g.line.win;
      const o = 1 - Math.max(0, Math.min(1, (t - w0) / ((w1 - w0) * 0.3)));
      g.mesh.material.opacity = o;
      g.mesh.visible = o > 0.01;
    }
    if (this.textures) this.setTex(typeof f.tex === 'function' ? f.tex(t) : f.tex || 'plain');
  }

  fitDistance(r, aspect) {
    const v = (FOV * Math.PI) / 360;
    const hfov = Math.atan(Math.tan(v) * aspect);
    return (Math.max(r, this.paperR * 0.42) / Math.sin(Math.min(v, hfov))) * 1.08;
  }
}

export class Viewer {
  constructor(el, onChange) {
    this.el = el;
    this.onChange = onChange || (() => {});
    this.stage = new Stage();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(this.renderer.domElement);
    this.camera = this.stage.camera;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 30;
    this.k = 0; this.t = 0; this.playing = false; this.delay = 0; this.speed = 1; this.auto = false;
    this.fit = 0;
    this.goalDir = null;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    this.resize();
    this.last = performance.now();
    const loop = (now) => { this.raf = requestAnimationFrame(loop); this.tick(Math.min(0.05, (now - this.last) / 1000)); this.last = now; };
    this.raf = requestAnimationFrame(loop);
  }

  resize() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setLesson(lesson) {
    this.lesson = lesson;
    this.stage.setPaper(lesson.paper, lesson.up, lesson.down, lesson.textures);
    this.camera.position.set(...DEFAULT_DIR).normalize().multiplyScalar(this.stage.fitDistance(this.stage.paperR, this.camera.aspect));
    this.controls.target.set(0, 0, 0);
    this.hadCam = false;
    this.go(0, false, true);
  }

  resetView() {
    this.goalDir = new THREE.Vector3(...(this.lesson.frames[this.k].cam || DEFAULT_DIR)).normalize();
    this.fit = 1;
  }

  go(k, play = true, snap = false) {
    const frames = this.lesson.frames;
    this.k = Math.max(0, Math.min(frames.length - 1, k));
    const f = frames[this.k];
    this.stage.setFrame(f);
    this.t = 0;
    this.playing = play;
    this.delay = play ? 0.5 : 0;
    clearTimeout(this.autoTimer);
    if (f.cam) { this.goalDir = new THREE.Vector3(...f.cam).normalize(); this.hadCam = true; }
    else if (this.hadCam) { this.goalDir = new THREE.Vector3(...DEFAULT_DIR).normalize(); this.hadCam = false; }
    this.fit = 1;
    if (snap) { this.controls.target.copy(this.stage.bounds.c); this.applyDist(this.stage.fitDistance(this.stage.bounds.r, this.camera.aspect)); }
    this.stage.update(0);
    this.onChange();
  }

  applyDist(d) {
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.camera.position.copy(this.controls.target).addScaledVector(dir, d);
  }

  seek(t) { this.playing = false; this.t = t; this.stage.update(t); this.onChange(); }
  play() {
    if (this.t >= 1) this.t = 0;
    this.playing = true; this.delay = this.t === 0 ? 0.35 : 0;
    this.stage.update(this.t); this.onChange();
  }
  pause() { this.playing = false; clearTimeout(this.autoTimer); this.onChange(); }
  showEnd(k) { this.go(k, false); this.t = 1; this.stage.update(1); this.onChange(); }

  duration() {
    const f = this.lesson.frames[this.k];
    if (f.dur) return f.dur;
    const moving = f.pieces.some((p) => p.anims.length);
    if (!moving) return f.tex ? 1.1 : 0.5;
    const stagger = (f.lines || []).some((l) => l.win[0] > 0) || f.pieces.some((p) => p.anims.length > 1);
    return stagger ? 2.8 : 1.9;
  }

  tick(dt) {
    if (this.playing) {
      if (this.delay > 0) this.delay -= dt;
      else {
        this.t = Math.min(1, this.t + (dt * this.speed) / this.duration());
        this.stage.update(this.t);
        if (this.t >= 1) {
          this.playing = false;
          if (this.auto && this.k < this.lesson.frames.length - 1) this.autoTimer = setTimeout(() => this.go(this.k + 1, true), 650 / this.speed);
        }
        this.onChange();
      }
    }
    if (this.fit > 0) {
      this.fit -= dt * 0.8;
      const a = 1 - Math.exp(-dt * 6);
      this.controls.target.lerp(this.stage.bounds.c, a);
      const cur = this.camera.position.distanceTo(this.controls.target);
      const goal = this.stage.fitDistance(this.stage.bounds.r, this.camera.aspect);
      if (this.goalDir) {
        const dir = this.camera.position.clone().sub(this.controls.target).normalize().lerp(this.goalDir, a).normalize();
        this.camera.position.copy(this.controls.target).addScaledVector(dir, cur);
      }
      this.applyDist(cur + (goal - cur) * a);
      if (this.fit <= 0) this.goalDir = null;
    }
    this.controls.update();
    this.renderer.render(this.stage.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.autoTimer);
    this.ro.disconnect();
    this.controls.dispose();
    this.stage.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}

// 缩略图：用一个共享的离屏渲染器，把教程的最终成品画成图片
let thumb = null;
export function renderThumb(lesson, k = lesson.frames.length - 1, t = 1, camDir = null) {
  if (!thumb) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(480, 360);
    thumb = { renderer, stage: new Stage() };
    thumb.stage.camera.aspect = 480 / 360;
    thumb.stage.camera.updateProjectionMatrix();
  }
  const { renderer, stage } = thumb;
  stage.setPaper(lesson.paper, lesson.up, lesson.down, lesson.textures);
  stage.texName = null;
  stage.setFrame(lesson.frames[k]);
  stage.update(t);
  const cam = [...lesson.frames].reverse().find((f) => f.cam);
  const dir = new THREE.Vector3(...(camDir || (cam ? cam.cam : DEFAULT_DIR))).normalize();
  const d = stage.fitDistance(stage.bounds.r, 480 / 360) * 1.05;
  stage.camera.position.copy(stage.bounds.c).addScaledVector(dir, d);
  stage.camera.lookAt(stage.bounds.c);
  renderer.render(stage.scene, stage.camera);
  const url = renderer.domElement.toDataURL('image/png');
  stage.clear();
  return url;
}
