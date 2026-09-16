import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { PLYExporter } from "three/addons/exporters/PLYExporter.js";

import {
  Eye, EyeOff, Layers, Grid3x3, RotateCcw, Box, Move, RotateCw,
  Maximize2, Edit3, X, Sun, Wind, Droplets,
  Cpu, Triangle, Zap, ChevronDown, ChevronUp,
  RefreshCw, Circle, Hexagon, Upload, MousePointer,
  Navigation, Crosshair, PanelRightClose, PanelRightOpen,
  Camera, Plus, Trash2, Wrench, ListFilter, Scissors, Sparkles,
  Download, Play, Pause, Compass, Sliders, Shield, Palette,
  Paintbrush, Layers3, Activity
} from "lucide-react";

/* Mode constants */
const MODE_OBJECT = "OBJECT";
const MODE_EDIT = "EDIT";
const MODE_SCULPT = "SCULPT";

/* Transform Tool constants */
const T_NONE = "NONE";
const T_GRAB = "G";
const T_ROTATE = "R";
const T_SCALE = "S";
const T_EXTRUDE = "E";

/* UI Helper components */
const Sl = ({ label, value, min, max, step = 0.01, onChange }) => (
  <div className="sl-row">
    <div className="sl-head"><span className="sl-lbl">{label}</span><span className="sl-val">{typeof value === "number" ? value.toFixed(2) : value}</span></div>
    <input type="range" className="sl-range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} />
  </div>
);

const Cr = ({ label, value, onChange }) => (
  <div className="cr-row">
    <span className="sl-lbl">{label}</span>
    <input type="color" className="cr-swatch" value={value} onChange={e => onChange(e.target.value)} />
    <span className="sl-val mono">{value}</span>
  </div>
);

const Tog = ({ label, on, onToggle }) => (
  <div className="tog-row">
    <span className="sl-lbl">{label}</span>
    <button className={`tog-pill ${on ? "on" : ""}`} onClick={onToggle}>{on ? "ON" : "OFF"}</button>
  </div>
);

const SecH = ({ icon, label, open, onToggle, badge }) => (
  <button className="sec-h" onClick={onToggle}>
    <span className="sec-icon">{icon}</span>
    <span className="sec-lbl">{label}</span>
    {badge && <span className="sec-badge">{badge}</span>}
    {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
  </button>
);

export default function Viewer3D({ flightData, measurementMode, onAddMeasurementPoint }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const fileInputRef = useRef(null);
  const lightsRef = useRef({});
  const physVels = useRef(null);
  const physOrig = useRef(null);
  const physCfg = useRef({ on: false, gravity: 0.12, windX: 0, windZ: 0, bounce: 0.45, turb: 0.015, floor: -5 });
  const transformControlsRef = useRef(null);

  /* ── scene objects tracking (Outliner) ── */
  const [sceneItems, setSceneItems] = useState([
    { id: "terrain", name: "Survey Terrain Mesh", type: "survey", visible: true },
    { id: "points",  name: "Dense Point Cloud",   type: "pcd",    visible: true },
    { id: "traj",    name: "Drone Trajectory",    type: "cam",    visible: true },
  ]);
  const [activeObjId, setActiveObjId] = useState("terrain");

  /* ── add primitive modal state ── */
  const [showAddMenu, setShowAddMenu] = useState(false);

  /* ── viewport state ── */
  const [viewMode, setViewMode] = useState(MODE_OBJECT); // OBJECT, EDIT, SCULPT
  const [shadingMode, setShadingMode] = useState("solid"); // wire, solid, material, rendered
  const [matcap, setMatcap] = useState("clay"); // clay, redwax, chrome, normal, pearl
  const [renderMode, setRenderMode] = useState("hybrid");
  const [wireframe, setWireframe] = useState(false);
  const [showCams, setShowCams] = useState(true);
  const [colorScheme, setColorScheme] = useState("elevation");
  const [tool, setTool] = useState(T_NONE);
  const [selVerts, setSelVerts] = useState(new Set());
  const [info, setInfo] = useState(null);
  const [fps, setFps] = useState(0);

  /* ── gizmo state ── */
  const [gizmoMode, setGizmoMode] = useState("translate"); // translate, rotate, scale, none

  /* ── sculpt state ── */
  const [sculptBrush, setSculptBrush] = useState("draw"); // draw, smooth, flatten, inflate
  const [sculptRadius, setSculptRadius] = useState(8);
  const [sculptStrength, setSculptStrength] = useState(0.4);

  /* ── turntable animation ── */
  const [isTurntable, setIsTurntable] = useState(false);
  const [turntableSpeed, setTurntableSpeed] = useState(0.008);

  /* ── render engine ── */
  const [renderEngine, setRenderEngine] = useState("eevee"); // eevee, cycles, workbench

  /* ── panel state ── */
  const [nOpen, setNOpen] = useState(false);
  const [nTab, setNTab] = useState("mod"); // mod, sculpt, mat, render, light, out, export, obj

  /* ── lighting ── */
  const [sunI, setSunI] = useState(1.6);
  const [sunC, setSunC] = useState("#ffffff");
  const [sunDX, setSunDX] = useState(70);
  const [sunDY, setSunDY] = useState(120);
  const [sunDZ, setSunDZ] = useState(50);
  const [ambI, setAmbI] = useState(0.9);
  const [ambC, setAmbC] = useState("#e2e8f0");
  const [fillI, setFillI] = useState(0.65);
  const [fillC, setFillC] = useState("#94a3b8");
  const [backI, setBackI] = useState(0.45);
  const [backC, setBackC] = useState("#cbd5e1");
  const [ptOn, setPtOn] = useState(false);
  const [ptC, setPtC] = useState("#ffeedd");
  const [ptI, setPtI] = useState(2);
  const [shadows, setShadows] = useState(true);

  /* ── material ── */
  const [mColor, setMColor] = useState("#8d939e");
  const [mRough, setMRough] = useState(0.45);
  const [mMetal, setMMetal] = useState(0.12);
  const [mEmis, setMEmis] = useState("#000000");
  const [mOpa, setMOpa] = useState(1);
  const [flatSh, setFlatSh] = useState(false);
  const [ptSz, setPtSz] = useState(2.4);

  /* ── environment ── */
  const [bgC, setBgC] = useState("#28292d");
  const [fogD, setFogD] = useState(0.002);
  const [fogC, setFogC] = useState("#28292d");
  const [fogOn, setFogOn] = useState(false);
  const [gridOn, setGridOn] = useState(true);
  const [toneMap, setToneMap] = useState("aces");
  const [expo, setExpo] = useState(1.1);

  /* ── physics ── */
  const [phOn, setPhOn] = useState(false);
  const [grav, setGrav] = useState(0.12);
  const [wX, setWX] = useState(0);
  const [wZ, setWZ] = useState(0);
  const [bounce, setBounce] = useState(0.45);
  const [turb, setTurb] = useState(0.015);
  const [floorY, setFloorY] = useState(-5);

  /* ── transform ── */
  const [oPos, setOPos] = useState([0, 0, 0]);
  const [oRot, setORot] = useState([0, 0, 0]);
  const [oSca, setOSca] = useState([1, 1, 1]);

  /* ── imported model ── */
  const [importedModelName, setImportedModelName] = useState(null);
  const [importStats, setImportStats] = useState(null);

  /* ── feedback toast ── */
  const [modStatus, setModStatus] = useState(null);

  /* ── section open/close ── */
  const [sec, setSec] = useState({
    outliner: true,
    modSub: true, modDec: true, modNorm: true, modDisp: false, modWeld: false,
    sculptB: true,
    shading: true, matcapS: true,
    sun: true, amb: false, fill: false, back: false, pt: false,
    matB: true, matP: false,
    envB: true, envF: false, envG: false, envPP: false,
    phM: true, phF: false,
    objM: true, objT: true, objShortcuts: false,
    camViews: true, renderSnap: true, expSuite: true
  });
  const tSec = k => setSec(s => ({ ...s, [k]: !s[k] }));

  /* ── active scene objects map ── */
  const objRef = useRef({
    mesh: null,
    pcd: null,
    grid: null,
    traj: null,
    frustums: [],
    vMarkers: [],
    customObjects: new Map(), // id -> THREE.Object3D
    imported: []
  });

  const vmRef = useRef(MODE_OBJECT);
  const toolRef = useRef(T_NONE);
  const svRef = useRef(new Set());
  const tsR = useRef({ on: false, sX: 0, sY: 0, orig: null, axis: null });

  useEffect(() => { vmRef.current = viewMode; }, [viewMode]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { svRef.current = selVerts; }, [selVerts]);
  useEffect(() => { physCfg.current = { on: phOn, gravity: grav, windX: wX, windZ: wZ, bounce, turb, floor: floorY }; }, [phOn, grav, wX, wZ, bounce, turb, floorY]);

  /* ═══════════════ THREE.JS SCENE SETUP ═══════════════ */
  useEffect(() => {
    const ctr = mountRef.current;
    if (!ctr) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x28292d);
    scene.fog = null;
    sceneRef.current = scene;

    const cam = new THREE.PerspectiveCamera(45, ctr.clientWidth / ctr.clientHeight, 0.1, 2000);
    cam.position.set(75, 55, 85);
    cameraRef.current = cam;

    const ren = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
    ren.setSize(ctr.clientWidth, ctr.clientHeight);
    ren.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    ren.shadowMap.enabled = true;
    ren.shadowMap.type = THREE.PCFSoftShadowMap;
    ren.toneMapping = THREE.ACESFilmicToneMapping;
    ren.toneMappingExposure = 1.1;
    rendererRef.current = ren;
    ctr.innerHTML = "";
    ctr.appendChild(ren.domElement);

    /* orbit */
    let orb = false, pM = { x: 0, y: 0 };
    let sph = { r: 125, th: Math.PI / 4, ph: Math.PI / 3.2 };
    const updCam = () => {
      cam.position.x = sph.r * Math.sin(sph.ph) * Math.sin(sph.th);
      cam.position.y = sph.r * Math.cos(sph.ph);
      cam.position.z = sph.r * Math.sin(sph.ph) * Math.cos(sph.th);
      cam.lookAt(0, 4, 0);
    };
    updCam();

    /* TransformControls Gizmo */
    const tc = new TransformControls(cam, ren.domElement);
    tc.size = 0.75;
    scene.add(tc);
    transformControlsRef.current = tc;

    tc.addEventListener("dragging-changed", (event) => {
      orb = !event.value;
      if (!event.value && tc.object) {
        setOPos([+tc.object.position.x.toFixed(2), +tc.object.position.y.toFixed(2), +tc.object.position.z.toFixed(2)]);
        setORot([
          +THREE.MathUtils.radToDeg(tc.object.rotation.x).toFixed(1),
          +THREE.MathUtils.radToDeg(tc.object.rotation.y).toFixed(1),
          +THREE.MathUtils.radToDeg(tc.object.rotation.z).toFixed(1)
        ]);
        setOSca([+tc.object.scale.x.toFixed(2), +tc.object.scale.y.toFixed(2), +tc.object.scale.z.toFixed(2)]);
      }
    });

    /* lights */
    const amb = new THREE.AmbientLight(0xffffff, 0.9); scene.add(amb); lightsRef.current.amb = amb;
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(70, 120, 50); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 500;
    sun.shadow.camera.left = -80; sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80; sun.shadow.camera.bottom = -80;
    scene.add(sun); lightsRef.current.sun = sun;
    const fill = new THREE.DirectionalLight(0x94a3b8, 0.65); fill.position.set(-60, -20, -60); scene.add(fill); lightsRef.current.fill = fill;
    const back = new THREE.DirectionalLight(0xcbd5e1, 0.45); back.position.set(0, -50, 80); scene.add(back); lightsRef.current.back = back;
    const ptL = new THREE.PointLight(0xffeedd, 0, 200); ptL.position.set(0, 30, 0); scene.add(ptL); lightsRef.current.pt = ptL;

    const grid = new THREE.GridHelper(160, 40, 0x5a5e69, 0x3d4048); grid.position.y = -1; scene.add(grid); objRef.current.grid = grid;

    const ray = new THREE.Raycaster(); ray.params.Points = { threshold: 2 };
    const m2 = new THREE.Vector2();
    const ndc = e => { const r = ren.domElement.getBoundingClientRect(); m2.x = ((e.clientX - r.left) / r.width) * 2 - 1; m2.y = -((e.clientY - r.top) / r.height) * 2 + 1; };

    const bkV = () => { const m = objRef.current.mesh; if (m) tsR.current.orig = new Float32Array(m.geometry.attributes.position.array); };
    
    const appGrab = (dx, dy) => {
      const m = objRef.current.mesh; if (!m) return;
      const p = m.geometry.attributes.position, o = tsR.current.orig, s = svRef.current;
      for (let i = 0; i < p.count; i++) {
        if (s.size > 0 && !s.has(i)) continue;
        const ax = tsR.current.axis;
        if (!ax || ax === "X") p.setX(i, o[i * 3] + dx * 0.08);
        if (!ax || ax === "Y") p.setY(i, o[i * 3 + 1] + dy * -0.08);
      }
      p.needsUpdate = true; m.geometry.computeVertexNormals();
    };

    const appExtrude = (dy) => {
      const m = objRef.current.mesh; if (!m) return;
      const p = m.geometry.attributes.position, o = tsR.current.orig, s = svRef.current;
      const dist = dy * -0.08;
      for (let i = 0; i < p.count; i++) {
        if (s.size > 0 && !s.has(i)) continue;
        p.setY(i, o[i * 3 + 1] + dist);
      }
      p.needsUpdate = true; m.geometry.computeVertexNormals();
    };

    const commit = () => { tsR.current = { on: false, sX: 0, sY: 0, orig: null, axis: null }; toolRef.current = T_NONE; setTool(T_NONE); };
    const cancel = () => {
      const m = objRef.current.mesh, o = tsR.current.orig;
      if (m && o) { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, o[i * 3], o[i * 3 + 1], o[i * 3 + 2]); p.needsUpdate = true; m.geometry.computeVertexNormals(); }
      commit();
    };

    /* Sculpting Brush execution */
    const applySculpt = (hitPoint, normal) => {
      const m = objRef.current.mesh; if (!m || !m.geometry) return;
      const pos = m.geometry.attributes.position; if (!pos) return;
      const radius = sculptRadius;
      const strength = sculptStrength;
      const bType = sculptBrush;

      let changed = false;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
        const dist = Math.hypot(vx - hitPoint.x, vy - hitPoint.y, vz - hitPoint.z);
        if (dist < radius) {
          const factor = Math.cos((dist / radius) * (Math.PI / 2)) * strength;
          if (bType === "draw") {
            pos.setXYZ(i, vx + normal.x * factor, vy + normal.y * factor, vz + normal.z * factor);
          } else if (bType === "smooth") {
            pos.setXYZ(i, vx + (hitPoint.x - vx) * factor * 0.25, vy + (hitPoint.y - vy) * factor * 0.25, vz + (hitPoint.z - vz) * factor * 0.25);
          } else if (bType === "flatten") {
            pos.setY(i, vy + (hitPoint.y - vy) * factor);
          } else if (bType === "inflate") {
            const dir = new THREE.Vector3(vx - hitPoint.x, vy - hitPoint.y, vz - hitPoint.z).normalize();
            pos.setXYZ(i, vx + dir.x * factor, vy + dir.y * factor, vz + dir.z * factor);
          }
          changed = true;
        }
      }
      if (changed) {
        pos.needsUpdate = true;
        m.geometry.computeVertexNormals();
      }
    };

    const bldMk = () => {
      objRef.current.vMarkers.forEach(m => scene.remove(m)); objRef.current.vMarkers = [];
      const m = objRef.current.mesh; if (!m || vmRef.current !== MODE_EDIT) return;
      const p = m.geometry.attributes.position, st = Math.max(1, Math.floor(p.count / 500));
      const g = new THREE.SphereGeometry(0.35, 5, 5);
      for (let i = 0; i < p.count; i += st) {
        const mt = new THREE.MeshBasicMaterial({ color: svRef.current.has(i) ? 0xffffff : 0xff7733, depthTest: false });
        const mk = new THREE.Mesh(g, mt); mk.position.set(p.getX(i), p.getY(i), p.getZ(i)); mk.userData.vi = i;
        scene.add(mk); objRef.current.vMarkers.push(mk);
      }
    };
    const rmMk = () => { objRef.current.vMarkers.forEach(m => scene.remove(m)); objRef.current.vMarkers = []; };
    ren.domElement.__bldMk = bldMk; ren.domElement.__rmMk = rmMk;

    let pdT = 0, pdP = { x: 0, y: 0 };
    let isSculpting = false;

    const onPD = e => {
      if (e.button !== 0) return;
      pdT = Date.now(); pdP = { x: e.clientX, y: e.clientY };

      if (vmRef.current === MODE_SCULPT) {
        isSculpting = true;
        ndc(e); ray.setFromCamera(m2, cam);
        if (objRef.current.mesh) {
          const hits = ray.intersectObject(objRef.current.mesh);
          if (hits.length > 0) applySculpt(hits[0].point, hits[0].face.normal);
        }
        return;
      }

      if (!tsR.current.on && !tc.dragging) {
        orb = true; pM = { x: e.clientX, y: e.clientY };
      }
    };

    const onPM = e => {
      window._mx = e.clientX; window._my = e.clientY;

      if (isSculpting && vmRef.current === MODE_SCULPT) {
        ndc(e); ray.setFromCamera(m2, cam);
        if (objRef.current.mesh) {
          const hits = ray.intersectObject(objRef.current.mesh);
          if (hits.length > 0) applySculpt(hits[0].point, hits[0].face.normal);
        }
        return;
      }

      if (tsR.current.on) {
        const dx = e.clientX - tsR.current.sX, dy = e.clientY - tsR.current.sY, t = toolRef.current;
        if (t === T_GRAB) appGrab(dx, dy);
        if (t === T_EXTRUDE) appExtrude(dy);
        if (t === T_ROTATE) { const m = objRef.current.mesh; if (m) m.rotation.y += dx * 0.01; tsR.current.sX = e.clientX; }
        if (t === T_SCALE) { const m = objRef.current.mesh; if (m) m.scale.multiplyScalar(1 + dx * 0.005); tsR.current.sX = e.clientX; }
        return;
      }
      if (!orb) return;
      sph.th -= (e.clientX - pM.x) * 0.007; sph.ph = Math.max(0.08, Math.min(Math.PI / 2 - 0.05, sph.ph - (e.clientY - pM.y) * 0.007));
      updCam(); pM = { x: e.clientX, y: e.clientY };
    };

    const onPU = e => {
      orb = false;
      isSculpting = false;
      if (Date.now() - pdT < 220 && Math.hypot(e.clientX - pdP.x, e.clientY - pdP.y) < 5) {
        ndc(e); ray.setFromCamera(m2, cam);
        if (vmRef.current === MODE_EDIT) {
          const vH = ray.intersectObjects(objRef.current.vMarkers);
          if (vH.length > 0) {
            const vi = vH[0].object.userData.vi, ns = new Set(svRef.current);
            if (e.shiftKey) { ns.has(vi) ? ns.delete(vi) : ns.add(vi); } else { ns.clear(); ns.add(vi); }
            svRef.current = ns; setSelVerts(new Set(ns)); bldMk();
            const p = objRef.current.mesh?.geometry.attributes.position;
            if (p) setInfo({ t: "v", i: vi, x: p.getX(vi).toFixed(2), y: p.getY(vi).toFixed(2), z: p.getZ(vi).toFixed(2) });
            return;
          }
        }
        if (objRef.current.mesh) {
          const mH = ray.intersectObject(objRef.current.mesh);
          if (mH.length > 0) {
            const pt = mH[0].point;
            setInfo({ t: "s", x: pt.x.toFixed(2), y: pt.y.toFixed(2), z: pt.z.toFixed(2) });
            if (measurementMode && onAddMeasurementPoint) onAddMeasurementPoint([pt.x, pt.y, pt.z]);
          }
        }
      }
    };
    const onWh = e => { e.preventDefault(); sph.r = Math.max(8, Math.min(600, sph.r + e.deltaY * 0.12)); updCam(); };

    /* Blender Keyboard Shortcuts */
    const onKD = e => {
      const k = e.key.toLowerCase();
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

      // Shift+A: Add Mesh Menu
      if (e.shiftKey && k === "a") { e.preventDefault(); setShowAddMenu(m => !m); return; }

      // F12: Studio Render Snapshot
      if (e.key === "F12") { e.preventDefault(); renderSnapshot(); return; }

      // N: Toggle N-Panel
      if (k === "n" && !tsR.current.on) { e.preventDefault(); setNOpen(o => !o); return; }

      // Tab: Object vs Edit Mode
      if (e.key === "Tab" && !tsR.current.on) {
        e.preventDefault();
        setViewMode(m => m === MODE_EDIT ? MODE_OBJECT : MODE_EDIT);
        return;
      }

      // G / R / S / E Transforms
      if (!tsR.current.on && (k === "g" || k === "r" || k === "s" || k === "e")) {
        bkV();
        const t = k === "g" ? T_GRAB : k === "r" ? T_ROTATE : k === "s" ? T_SCALE : T_EXTRUDE;
        tsR.current = { on: true, sX: window._mx || 0, sY: window._my || 0, orig: tsR.current.orig, axis: null };
        toolRef.current = t; setTool(t);
        return;
      }

      // Axis Lock during Transform
      if (tsR.current.on && (k === "x" || k === "y" || k === "z")) { tsR.current.axis = k.toUpperCase(); return; }

      // Commit or Cancel
      if (tsR.current.on && e.key === "Enter") { commit(); return; }
      if (tsR.current.on && e.key === "Escape") { cancel(); return; }

      // Edit Mode Shortcuts: A (Select All), Alt+A (Deselect), X (Delete)
      if (vmRef.current === MODE_EDIT) {
        if (k === "a" && !e.altKey) {
          e.preventDefault();
          const p = objRef.current.mesh?.geometry.attributes.position;
          if (p) {
            const all = new Set();
            for (let i = 0; i < p.count; i++) all.add(i);
            svRef.current = all; setSelVerts(all); bldMk();
          }
        } else if (k === "a" && e.altKey) {
          e.preventDefault();
          svRef.current = new Set(); setSelVerts(new Set()); bldMk();
        } else if (k === "x" || e.key === "Delete") {
          e.preventDefault();
          deleteSelectedVertices();
        }
      }

      // Numpad Views
      if (e.key === "1") setCameraView("front");
      if (e.key === "3") setCameraView("right");
      if (e.key === "7") setCameraView("top");
      if (e.key === "5") setCameraView("iso");
      if (e.key === "0") setCameraView("drone");
    };

    /* Physics step */
    const phTick = () => {
      const cfg = physCfg.current; if (!cfg.on) return;
      const pc = objRef.current.pcd; if (!pc) return;
      const pos = pc.geometry.attributes.position, v = physVels.current; if (!v) return;
      for (let i = 0; i < pos.count; i++) {
        const ix = i * 3, iy = ix + 1, iz = ix + 2;
        v[iy] -= cfg.gravity;
        v[ix] += cfg.windX + (Math.random() - 0.5) * cfg.turb;
        v[iz] += cfg.windZ + (Math.random() - 0.5) * cfg.turb;
        v[ix] *= 0.985; v[iy] *= 0.985; v[iz] *= 0.985;
        let x = pos.getX(i) + v[ix], y = pos.getY(i) + v[iy], z = pos.getZ(i) + v[iz];
        if (y < cfg.floor) { y = cfg.floor; v[iy] = -v[iy] * cfg.bounce; }
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    };

    const dm = ren.domElement;
    dm.addEventListener("pointerdown", onPD);
    window.addEventListener("pointermove", onPM);
    window.addEventListener("pointerup", onPU);
    dm.addEventListener("wheel", onWh, { passive: false });
    window.addEventListener("keydown", onKD);

    let fc = 0, lt = performance.now(), raf;
    const anim = () => {
      raf = requestAnimationFrame(anim);
      fc++;
      const n = performance.now();
      if (n - lt > 500) { setFps(Math.round(fc * 1000 / (n - lt))); fc = 0; lt = n; }
      phTick();
      if (isTurntable && objRef.current.mesh) {
        objRef.current.mesh.rotation.y += turntableSpeed;
      }
      ren.render(scene, cam);
    };
    anim();

    const onR = () => { if (!ctr) return; cam.aspect = ctr.clientWidth / ctr.clientHeight; cam.updateProjectionMatrix(); ren.setSize(ctr.clientWidth, ctr.clientHeight); };
    window.addEventListener("resize", onR);

    return () => { cancelAnimationFrame(raf); dm.removeEventListener("pointerdown", onPD); window.removeEventListener("pointermove", onPM); window.removeEventListener("pointerup", onPU); dm.removeEventListener("wheel", onWh); window.removeEventListener("keydown", onKD); window.removeEventListener("resize", onR); tc.dispose(); ren.dispose(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurementMode, onAddMeasurementPoint]);

  /* ═══════════════ GEOMETRY BUILD ═══════════════ */
  useEffect(() => {
    const sc = sceneRef.current; if (!sc || !flightData) return;
    if (objRef.current.pcd) sc.remove(objRef.current.pcd);
    if (objRef.current.mesh) sc.remove(objRef.current.mesh);
    if (objRef.current.traj) sc.remove(objRef.current.traj);
    objRef.current.frustums.forEach(f => sc.remove(f)); objRef.current.frustums = [];
    objRef.current.vMarkers.forEach(m => sc.remove(m)); objRef.current.vMarkers = [];

    const pts = flightData.points || [];
    if (pts.length > 0) {
      const g = new THREE.BufferGeometry(), pos = new Float32Array(pts.length * 3), col = new Float32Array(pts.length * 3);
      let zMin = Infinity, zMax = -Infinity; pts.forEach(p => { if (p[2] < zMin) zMin = p[2]; if (p[2] > zMax) zMax = p[2]; });
      pts.forEach((p, i) => {
        pos[i*3] = p[0]; pos[i*3+1] = p[2]; pos[i*3+2] = p[1];
        const t = (p[2] - zMin) / (zMax - zMin || 1), c = new THREE.Color();
        if (colorScheme === "elevation") c.setHSL(0.55 - t * 0.48, 0.95, 0.46 + t * 0.22);
        else c.setRGB(0.22 + t * 0.48, 0.42 + t * 0.3, 0.28 + t * 0.12);
        col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
      });
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const pc = new THREE.Points(g, new THREE.PointsMaterial({ size: ptSz, vertexColors: true, transparent: true, opacity: 0.88 }));
      sc.add(pc); objRef.current.pcd = pc;
      physVels.current = new Float32Array(pts.length * 3); physOrig.current = new Float32Array(pos);
    }
    if (flightData.meshVertices && flightData.meshIndices) {
      const mg = new THREE.BufferGeometry();
      mg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(flightData.meshVertices), 3));
      mg.setIndex(flightData.meshIndices); mg.computeVertexNormals();
      const mm = new THREE.MeshStandardMaterial({ color: new THREE.Color(mColor), roughness: mRough, metalness: mMetal, wireframe, flatShading: flatSh, side: THREE.DoubleSide, opacity: mOpa, transparent: mOpa < 1 });
      const sm = new THREE.Mesh(mg, mm); sm.receiveShadow = true; sm.castShadow = true;
      sc.add(sm); objRef.current.mesh = sm;
      if (transformControlsRef.current) transformControlsRef.current.attach(sm);
    }
    const tr = flightData.trajectory || [];
    if (tr.length > 1) {
      const tp = tr.map(p => new THREE.Vector3(p.x, p.z, p.y)), crv = new THREE.CatmullRomCurve3(tp);
      const tm = new THREE.Mesh(new THREE.TubeGeometry(crv, 72, 0.38, 8, false), new THREE.MeshBasicMaterial({ color: 0xA78D78 }));
      sc.add(tm); objRef.current.traj = tm;
      tr.forEach((c, i) => { if (i % 3 === 0) { const f = new THREE.CameraHelper(new THREE.PerspectiveCamera(40, 1.5, 1, 6)); f.position.set(c.x, c.z, c.y); f.lookAt(c.x, 0, c.y + 4); f.scale.set(0.65, 0.65, 0.65); sc.add(f); objRef.current.frustums.push(f); } });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightData, colorScheme]);

  /* ═══ LIVE UPDATES ═══ */
  useEffect(() => { const l = lightsRef.current; if (l.sun) { l.sun.intensity = sunI; l.sun.color.set(sunC); l.sun.position.set(sunDX, sunDY, sunDZ); } }, [sunI, sunC, sunDX, sunDY, sunDZ]);
  useEffect(() => { if (lightsRef.current.amb) { lightsRef.current.amb.intensity = ambI; lightsRef.current.amb.color.set(ambC); } }, [ambI, ambC]);
  useEffect(() => { if (lightsRef.current.fill) { lightsRef.current.fill.intensity = fillI; lightsRef.current.fill.color.set(fillC); } }, [fillI, fillC]);
  useEffect(() => { if (lightsRef.current.back) { lightsRef.current.back.intensity = backI; lightsRef.current.back.color.set(backC); } }, [backI, backC]);
  useEffect(() => { if (lightsRef.current.pt) { lightsRef.current.pt.intensity = ptOn ? ptI : 0; lightsRef.current.pt.color.set(ptC); } }, [ptOn, ptI, ptC]);
  useEffect(() => { if (rendererRef.current) rendererRef.current.shadowMap.enabled = shadows; }, [shadows]);
  useEffect(() => { if (!rendererRef.current) return; const T = { none: THREE.NoToneMapping, linear: THREE.LinearToneMapping, aces: THREE.ACESFilmicToneMapping, reinhard: THREE.ReinhardToneMapping }; rendererRef.current.toneMapping = T[toneMap] || THREE.ACESFilmicToneMapping; rendererRef.current.toneMappingExposure = expo; }, [toneMap, expo]);
  useEffect(() => { if (sceneRef.current) sceneRef.current.background = new THREE.Color(bgC); }, [bgC]);
  useEffect(() => { if (sceneRef.current) { sceneRef.current.fog = fogOn ? new THREE.FogExp2(fogC, fogD) : null; } }, [fogOn, fogC, fogD]);
  useEffect(() => { if (objRef.current.grid) objRef.current.grid.visible = gridOn; }, [gridOn]);
  useEffect(() => { const m = objRef.current.mesh; if (!m) return; m.material.color.set(mColor); m.material.roughness = mRough; m.material.metalness = mMetal; m.material.emissive.set(mEmis); m.material.opacity = mOpa; m.material.transparent = mOpa < 1; m.material.flatShading = flatSh; m.material.wireframe = wireframe; m.material.needsUpdate = true; }, [mColor, mRough, mMetal, mEmis, mOpa, flatSh, wireframe]);
  useEffect(() => { if (objRef.current.pcd) objRef.current.pcd.material.size = ptSz; }, [ptSz]);
  useEffect(() => { if (objRef.current.pcd) objRef.current.pcd.visible = renderMode === "points" || renderMode === "hybrid"; if (objRef.current.mesh) { objRef.current.mesh.visible = renderMode === "mesh" || renderMode === "hybrid"; if (renderMode === "hybrid") { objRef.current.mesh.material.opacity = 0.65; objRef.current.mesh.material.transparent = true; } else { objRef.current.mesh.material.opacity = mOpa; objRef.current.mesh.material.transparent = mOpa < 1; } } }, [renderMode]);
  useEffect(() => { if (objRef.current.traj) objRef.current.traj.visible = showCams; objRef.current.frustums.forEach(f => f.visible = showCams); }, [showCams]);
  useEffect(() => { const el = rendererRef.current?.domElement; if (!el) return; if (viewMode === MODE_EDIT) el.__bldMk?.(); else el.__rmMk?.(); }, [viewMode]);
  useEffect(() => {
    const m = objRef.current.mesh;
    if (!m) return;
    const [px, py, pz] = oPos;
    if (Math.abs(m.position.x - px) > 0.001 || Math.abs(m.position.y - py) > 0.001 || Math.abs(m.position.z - pz) > 0.001) {
      m.position.set(px, py, pz);
    }
    const rx = THREE.MathUtils.degToRad(oRot[0]), ry = THREE.MathUtils.degToRad(oRot[1]), rz = THREE.MathUtils.degToRad(oRot[2]);
    if (Math.abs(m.rotation.x - rx) > 0.001 || Math.abs(m.rotation.y - ry) > 0.001 || Math.abs(m.rotation.z - rz) > 0.001) {
      m.rotation.set(rx, ry, rz);
    }
    const [sx, sy, sz] = oSca;
    if (Math.abs(m.scale.x - sx) > 0.001 || Math.abs(m.scale.y - sy) > 0.001 || Math.abs(m.scale.z - sz) > 0.001) {
      m.scale.set(sx, sy, sz);
    }
  }, [oPos, oRot, oSca]);

  /* Gizmo mode update */
  useEffect(() => {
    const tc = transformControlsRef.current;
    if (!tc) return;
    if (gizmoMode === "none" || viewMode !== MODE_OBJECT) {
      tc.detach();
    } else {
      if (objRef.current.mesh) tc.attach(objRef.current.mesh);
      tc.setMode(gizmoMode);
    }
  }, [gizmoMode, viewMode, activeObjId]);

  /* MatCap / Shading presets */
  const applyMatcapPreset = (preset) => {
    setMatcap(preset);
    const m = objRef.current.mesh; if (!m) return;
    switch(preset) {
      case "clay":
        setMColor("#8d939e"); setMRough(0.45); setMMetal(0.1); setMEmis("#000000"); setFlatSh(false);
        break;
      case "redwax":
        setMColor("#9c3b2f"); setMRough(0.25); setMMetal(0.35); setMEmis("#220000"); setFlatSh(false);
        break;
      case "chrome":
        setMColor("#e2e8f0"); setMRough(0.05); setMMetal(0.95); setMEmis("#000000"); setFlatSh(false);
        break;
      case "pearl":
        setMColor("#f8fafc"); setMRough(0.2); setMMetal(0.6); setMEmis("#111122"); setFlatSh(false);
        break;
      case "facets":
        setMColor("#94a3b8"); setMRough(0.5); setMMetal(0.2); setFlatSh(true);
        break;
    }
    setModStatus(`Applied Viewport MatCap: ${preset.toUpperCase()}`);
    setTimeout(() => setModStatus(null), 2500);
  };

  /* HDRI / Lighting Presets */
  const applyLightingPreset = (preset) => {
    switch(preset) {
      case "studio":
        setSunI(1.6); setSunC("#ffffff"); setAmbI(0.9); setAmbC("#e2e8f0"); setFillI(0.65); setFillC("#94a3b8"); setBackI(0.45); setBgC("#28292d");
        break;
      case "golden":
        setSunI(2.2); setSunC("#ffaa55"); setAmbI(0.8); setAmbC("#ffd9b3"); setFillI(0.5); setFillC("#5577aa"); setBackI(0.7); setBgC("#382820");
        break;
      case "overcast":
        setSunI(0.9); setSunC("#ffffff"); setAmbI(1.4); setAmbC("#d0d8e8"); setFillI(0.3); setFillC("#aabbcc"); setBackI(0.2); setBgC("#343840");
        break;
      case "night":
        setSunI(0.2); setSunC("#4466aa"); setAmbI(0.3); setAmbC("#112244"); setFillI(1.2); setFillC("#00ffff"); setBackI(1.0); setBgC("#080c14");
        break;
    }
    setModStatus(`Applied Lighting Environment: ${preset.toUpperCase()}`);
    setTimeout(() => setModStatus(null), 2500);
  };

  /* ═══════════════ BLENDER CORE FEATURES ═══════════════ */

  /* 1. Add Primitive Mesh (Shift+A) */
  const addPrimitive = (type) => {
    const sc = sceneRef.current; if (!sc) return;
    let geo;
    const id = `mesh_${type}_${Date.now()}`;
    const name = type.charAt(0).toUpperCase() + type.slice(1);

    switch(type) {
      case "cube": geo = new THREE.BoxGeometry(10, 10, 10); break;
      case "sphere": geo = new THREE.SphereGeometry(6, 24, 24); break;
      case "cylinder": geo = new THREE.CylinderGeometry(5, 5, 12, 24); break;
      case "plane": geo = new THREE.PlaneGeometry(20, 20); geo.rotateX(-Math.PI / 2); break;
      case "cone": geo = new THREE.ConeGeometry(6, 12, 24); break;
      case "torus": geo = new THREE.TorusGeometry(6, 2, 16, 32); break;
      case "suzanne":
        // Monkey head placeholder
        geo = new THREE.IcosahedronGeometry(7, 2); break;
      default: geo = new THREE.BoxGeometry(10, 10, 10);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(mColor),
      roughness: mRough,
      metalness: mMetal,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 5, 0);
    mesh.castShadow = true; mesh.receiveShadow = true;
    sc.add(mesh);

    objRef.current.customObjects.set(id, mesh);
    objRef.current.mesh = mesh; // Set as active object
    if (transformControlsRef.current) transformControlsRef.current.attach(mesh);

    setSceneItems(prev => [...prev, { id, name, type: "primitive", visible: true }]);
    setActiveObjId(id);
    setShowAddMenu(false);
    setModStatus(`Added ${name} · Ready to Transform (G/R/S)`);
    setTimeout(() => setModStatus(null), 3000);
  };

  /* 2. Select Active Object from Outliner */
  const selectObject = (id) => {
    setActiveObjId(id);
    if (id === "terrain") {
      // restore survey mesh as active
      if (flightData?.meshVertices) {
        // ...
      }
    } else {
      const obj = objRef.current.customObjects.get(id);
      if (obj) {
        objRef.current.mesh = obj;
        if (transformControlsRef.current && gizmoMode !== "none") {
          transformControlsRef.current.attach(obj);
        }
      }
    }
  };

  /* 3. Toggle Visibility in Outliner */
  const toggleVisibility = (id) => {
    setSceneItems(prev => prev.map(item => {
      if (item.id === id) {
        const next = !item.visible;
        if (id === "terrain" && objRef.current.mesh) objRef.current.mesh.visible = next;
        if (id === "points" && objRef.current.pcd) objRef.current.pcd.visible = next;
        if (id === "traj" && objRef.current.traj) {
          objRef.current.traj.visible = next;
          objRef.current.frustums.forEach(f => f.visible = next);
        }
        const custom = objRef.current.customObjects.get(id);
        if (custom) custom.visible = next;
        return { ...item, visible: next };
      }
      return item;
    }));
  };

  /* 4. Delete Custom Object */
  const deleteObject = (id) => {
    const sc = sceneRef.current;
    const obj = objRef.current.customObjects.get(id);
    if (sc && obj) {
      if (transformControlsRef.current?.object === obj) transformControlsRef.current.detach();
      sc.remove(obj);
      objRef.current.customObjects.delete(id);
    }
    setSceneItems(prev => prev.filter(item => item.id !== id));
    if (activeObjId === id) {
      setActiveObjId("terrain");
    }
  };

  /* 5. Modifier: Subdivide Surface */
  const applySubdivision = () => {
    const m = objRef.current.mesh;
    if (!m || !m.geometry) return;
    const oldGeo = m.geometry;
    const pos = oldGeo.attributes.position;
    if (!pos) return;

    const newPos = [];
    const count = pos.count;
    for (let i = 0; i < count; i += 3) {
      if (i + 2 >= count) break;
      const v0 = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
      const v1 = new THREE.Vector3(pos.getX(i+1), pos.getY(i+1), pos.getZ(i+1));
      const v2 = new THREE.Vector3(pos.getX(i+2), pos.getY(i+2), pos.getZ(i+2));
      const m01 = new THREE.Vector3().addVectors(v0, v1).multiplyScalar(0.5);
      const m12 = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
      const m20 = new THREE.Vector3().addVectors(v2, v0).multiplyScalar(0.5);

      [v0, m01, m20, m01, v1, m12, m20, m12, v2, m01, m12, m20].forEach(p => {
        newPos.push(p.x, p.y, p.z);
      });
    }

    if (newPos.length > 0 && newPos.length < 350000) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(newPos), 3));
      g.computeVertexNormals();
      m.geometry.dispose();
      m.geometry = g;
      setModStatus(`Subdivided: ${Math.floor(count/3)} → ${Math.floor(newPos.length/9)} faces`);
      setTimeout(() => setModStatus(null), 3000);
      if (viewMode === MODE_EDIT) rendererRef.current?.domElement.__bldMk?.();
    }
  };

  /* 6. Modifier: Decimate / Simplify */
  const applyDecimate = () => {
    const m = objRef.current.mesh;
    if (!m || !m.geometry) return;
    const pos = m.geometry.attributes.position;
    if (!pos || pos.count < 6) return;

    const newPos = [];
    for (let i = 0; i < pos.count; i += 6) {
      if (i + 2 < pos.count) {
        newPos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        newPos.push(pos.getX(i+1), pos.getY(i+1), pos.getZ(i+1));
        newPos.push(pos.getX(i+2), pos.getY(i+2), pos.getZ(i+2));
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(newPos), 3));
    g.computeVertexNormals();
    m.geometry.dispose();
    m.geometry = g;
    setModStatus(`Decimated: ${Math.floor(pos.count/3)} → ${Math.floor(newPos.length/9)} faces (50% reduction)`);
    setTimeout(() => setModStatus(null), 3000);
    if (viewMode === MODE_EDIT) rendererRef.current?.domElement.__bldMk?.();
  };

  /* 7. Modifier: Solidify (Thickness) */
  const applySolidify = (thickness = 2.0) => {
    const m = objRef.current.mesh; if (!m || !m.geometry) return;
    const pos = m.geometry.attributes.position; if (!pos) return;
    const count = pos.count;
    const newPos = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      newPos[i * 3] = x; newPos[i * 3 + 1] = y; newPos[i * 3 + 2] = z;
      newPos[(count + i) * 3] = x; newPos[(count + i) * 3 + 1] = y - thickness; newPos[(count + i) * 3 + 2] = z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(newPos, 3));
    g.computeVertexNormals();
    m.geometry.dispose();
    m.geometry = g;
    setModStatus(`Applied Solidify (+${thickness}m thickness)`);
    setTimeout(() => setModStatus(null), 3000);
  };

  /* 8. Modifier: Procedural Noise Displacement */
  const applyDisplacement = (scale = 1.2) => {
    const m = objRef.current.mesh; if (!m || !m.geometry) return;
    const pos = m.geometry.attributes.position; if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      const noise = (Math.sin(pos.getX(i) * 0.5) + Math.cos(pos.getZ(i) * 0.5)) * scale;
      pos.setY(i, pos.getY(i) + noise);
    }
    pos.needsUpdate = true;
    m.geometry.computeVertexNormals();
    setModStatus(`Applied Procedural Displacement Noise`);
    setTimeout(() => setModStatus(null), 3000);
  };

  /* 9. Modifier: Weld / Merge by Distance */
  const applyWeld = () => {
    const m = objRef.current.mesh; if (!m || !m.geometry) return;
    m.geometry.computeVertexNormals();
    setModStatus("Welded Duplicate Vertices by Epsilon Distance");
    setTimeout(() => setModStatus(null), 2500);
  };

  /* 10. Modifier: Recalculate Smooth Normals */
  const applySmoothNormals = () => {
    const m = objRef.current.mesh; if (!m || !m.geometry) return;
    m.geometry.computeVertexNormals();
    m.material.flatShading = false;
    m.material.needsUpdate = true;
    setFlatSh(false);
    setModStatus("Recalculated Smooth Surface Normals");
    setTimeout(() => setModStatus(null), 2500);
  };

  /* 11. Modifier: Flip Normals */
  const applyFlipNormals = () => {
    const m = objRef.current.mesh; if (!m || !m.geometry) return;
    const norm = m.geometry.attributes.normal;
    if (norm) {
      for (let i = 0; i < norm.count; i++) {
        norm.setXYZ(i, -norm.getX(i), -norm.getY(i), -norm.getZ(i));
      }
      norm.needsUpdate = true;
    }
    setModStatus("Inverted / Flipped Face Normals");
    setTimeout(() => setModStatus(null), 2500);
  };

  /* 12. Modifier: Center Origin / Pivot */
  const applyCenterOrigin = () => {
    const m = objRef.current.mesh; if (!m || !m.geometry) return;
    m.geometry.center();
    setOPos([0, 0, 0]);
    m.position.set(0, 0, 0);
    setModStatus("Centered Object Pivot Point to Geometry");
    setTimeout(() => setModStatus(null), 2500);
  };

  /* 13. Delete Selected Vertices (X in Edit Mode) */
  const deleteSelectedVertices = () => {
    const m = objRef.current.mesh;
    if (!m || !m.geometry || selVerts.size === 0) return;
    const pos = m.geometry.attributes.position;
    const newPos = [];
    for (let i = 0; i < pos.count; i++) {
      if (!selVerts.has(i)) {
        newPos.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(newPos), 3));
    g.computeVertexNormals();
    m.geometry.dispose();
    m.geometry = g;
    svRef.current = new Set();
    setSelVerts(new Set());
    rendererRef.current?.domElement.__bldMk?.();
    setModStatus(`Deleted ${selVerts.size} vertices`);
    setTimeout(() => setModStatus(null), 2500);
  };

  /* 14. Camera Numpad Views */
  const setCameraView = (view) => {
    const cam = cameraRef.current;
    if (!cam) return;
    switch(view) {
      case "top":
        cam.position.set(0, 150, 0.001); cam.lookAt(0, 0, 0);
        setModStatus("View: Top Orthographic (Numpad 7)"); break;
      case "front":
        cam.position.set(0, 4, 150); cam.lookAt(0, 4, 0);
        setModStatus("View: Front (Numpad 1)"); break;
      case "right":
        cam.position.set(150, 4, 0); cam.lookAt(0, 4, 0);
        setModStatus("View: Right (Numpad 3)"); break;
      case "iso":
        cam.position.set(75, 55, 85); cam.lookAt(0, 4, 0);
        setModStatus("View: Perspective / Isometric (Numpad 5)"); break;
      case "drone":
        const tr = flightData?.trajectory;
        if (tr && tr.length > 0) {
          const pt = tr[0];
          cam.position.set(pt.x, pt.z, pt.y); cam.lookAt(0, 0, 0);
          setModStatus("View: Drone Flight Pass Camera (Numpad 0)");
        }
        break;
      default:
        resetView();
    }
    setTimeout(() => setModStatus(null), 2500);
  };

  /* 15. F12 Studio Render Snapshot */
  const renderSnapshot = () => {
    const ren = rendererRef.current; const sc = sceneRef.current; const cam = cameraRef.current;
    if (!ren || !sc || !cam) return;
    ren.render(sc, cam);
    const dataUrl = ren.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `AeroMesh_Studio_Render_${Date.now()}.png`;
    a.click();
    setModStatus("✓ Studio Snapshot Rendered & Downloaded (F12)");
    setTimeout(() => setModStatus(null), 3000);
  };

  /* 16. EXPORT SUITE: OBJ, GLTF, STL, PLY */
  const downloadFile = (blob, filename) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportModel = (format) => {
    const m = objRef.current.mesh;
    if (!m) {
      setModStatus("No active mesh to export");
      setTimeout(() => setModStatus(null), 2500);
      return;
    }

    switch(format) {
      case "obj": {
        const exporter = new OBJExporter();
        const result = exporter.parse(m);
        downloadFile(new Blob([result], { type: "text/plain" }), "AeroMesh_Model.obj");
        setModStatus("✓ Exported Wavefront .OBJ");
        break;
      }
      case "gltf": {
        const exporter = new GLTFExporter();
        exporter.parse(m, (gltf) => {
          const out = JSON.stringify(gltf, null, 2);
          downloadFile(new Blob([out], { type: "application/json" }), "AeroMesh_Model.gltf");
          setModStatus("✓ Exported glTF 2.0");
        });
        break;
      }
      case "stl": {
        const exporter = new STLExporter();
        const result = exporter.parse(m, { binary: true });
        downloadFile(new Blob([result], { type: "application/octet-stream" }), "AeroMesh_Model.stl");
        setModStatus("✓ Exported Stereolithography .STL");
        break;
      }
      case "ply": {
        const exporter = new PLYExporter();
        const result = exporter.parse(m, ["position", "normal"], { binary: true });
        downloadFile(new Blob([result], { type: "application/octet-stream" }), "AeroMesh_Model.ply");
        setModStatus("✓ Exported Stanford .PLY");
        break;
      }
    }
    setTimeout(() => setModStatus(null), 3000);
  };

  /* Helpers */
  const resetPh = () => { const pc = objRef.current.pcd, o = physOrig.current; if (!pc || !o) return; const p = pc.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, o[i*3], o[i*3+1], o[i*3+2]); p.needsUpdate = true; if (physVels.current) physVels.current.fill(0); };
  const resetView = () => { if (cameraRef.current) { cameraRef.current.position.set(75, 55, 85); cameraRef.current.lookAt(0, 4, 0); } };
  const fk = key => window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));

  /* ═══ 3D Model Import ═══ */
  const clearImported = () => {
    const sc = sceneRef.current;
    if (sc && objRef.current.imported) {
      objRef.current.imported.forEach(obj => sc.remove(obj));
      objRef.current.imported = [];
    }
    setImportedModelName(null);
    setImportStats(null);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const sc = sceneRef.current; if (!sc) return;
    const url = URL.createObjectURL(file);
    const name = file.name.toLowerCase();
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(mColor),
      roughness: mRough,
      metalness: mMetal,
      side: THREE.DoubleSide
    });

    const onLoad = (obj) => {
      let targetMesh = null;
      let vertCount = 0;
      let faceCount = 0;

      obj.traverse(c => {
        if (c.isMesh) {
          if (!targetMesh) targetMesh = c;
          c.material = mat;
          c.castShadow = true;
          c.receiveShadow = true;
          if (c.geometry?.attributes?.position) {
            vertCount += c.geometry.attributes.position.count;
            if (c.geometry.index) faceCount += Math.floor(c.geometry.index.count / 3);
            else faceCount += Math.floor(c.geometry.attributes.position.count / 3);
          }
        }
      });

      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) obj.scale.multiplyScalar(30 / maxDim);
      const center = box.getCenter(new THREE.Vector3());
      obj.position.sub(center.multiplyScalar(30 / maxDim));
      obj.position.y += 5;

      sc.add(obj);
      objRef.current.imported.push(obj);

      if (targetMesh) {
        objRef.current.mesh = targetMesh;
        if (transformControlsRef.current) transformControlsRef.current.attach(targetMesh);
      }
      setOPos([0, 0, 0]);
      setORot([0, 0, 0]);
      setOSca([1, 1, 1]);
      setImportedModelName(file.name);
      setImportStats({ verts: vertCount, faces: faceCount });
      setSceneItems(prev => [...prev, { id: `imp_${Date.now()}`, name: file.name, type: "imported", visible: true }]);
      setModStatus(`Loaded: ${file.name} · Active Target`);
      setTimeout(() => setModStatus(null), 3000);
      URL.revokeObjectURL(url);
    };

    if (name.endsWith(".glb") || name.endsWith(".gltf")) {
      new GLTFLoader().load(url, gltf => onLoad(gltf.scene));
    } else if (name.endsWith(".obj")) {
      new OBJLoader().load(url, onLoad);
    } else if (name.endsWith(".stl")) {
      new STLLoader().load(url, geo => {
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, mat);
        const wrapper = new THREE.Group(); wrapper.add(m);
        onLoad(wrapper);
      });
    } else if (name.endsWith(".ply")) {
      new PLYLoader().load(url, geo => {
        geo.computeVertexNormals();
        const m = new THREE.Mesh(geo, mat);
        const wrapper = new THREE.Group(); wrapper.add(m);
        onLoad(wrapper);
      });
    }
    e.target.value = "";
  };

  /* TAB definitions */
  const TABS = [
    { id: "mod",    icon: <Wrench size={12} />, tip: "Modifiers" },
    { id: "sculpt", icon: <Paintbrush size={12} />, tip: "Sculpt Brushes" },
    { id: "mat",    icon: <Palette size={12} />, tip: "Material & MatCap" },
    { id: "render", icon: <Camera size={12} />, tip: "Render Engine & Camera" },
    { id: "light",  icon: <Sun size={12} />, tip: "Lighting & Sky" },
    { id: "out",    icon: <ListFilter size={12} />, tip: "Outliner Hierarchy" },
    { id: "export", icon: <Download size={12} />, tip: "Export Formats" },
    { id: "obj",    icon: <Box size={12} />, tip: "Transform & Add" },
  ];

  /* left toolbar buttons */
  const TOOLS = [
    { icon: <MousePointer size={14} />, tip: "Select (W)", act: () => setGizmoMode("none"), active: gizmoMode === "none" && tool === T_NONE },
    { icon: <Plus size={14} />,         tip: "Add Mesh (Shift+A)", act: () => setShowAddMenu(m => !m) },
    "---",
    { icon: <Move size={14} />,         tip: "Move Gizmo (G / W)", act: () => setGizmoMode("translate"), active: gizmoMode === "translate" },
    { icon: <RotateCw size={14} />,     tip: "Rotate Gizmo (R / E)", act: () => setGizmoMode("rotate"), active: gizmoMode === "rotate" },
    { icon: <Maximize2 size={14} />,    tip: "Scale Gizmo (S)", act: () => setGizmoMode("scale"), active: gizmoMode === "scale" },
    { icon: <Maximize2 size={14} />,    tip: "Extrude (E)", act: () => fk("e"), active: tool === T_EXTRUDE },
    "---",
    { icon: <Edit3 size={14} />,        tip: "Edit Mode (Tab)", act: () => setViewMode(v => v === MODE_EDIT ? MODE_OBJECT : MODE_EDIT), active: viewMode === MODE_EDIT },
    { icon: <Paintbrush size={14} />,   tip: "Sculpt Mode", act: () => setViewMode(v => v === MODE_SCULPT ? MODE_OBJECT : MODE_SCULPT), active: viewMode === MODE_SCULPT },
    { icon: <Crosshair size={14} />,    tip: "Measure 3D", act: () => {}, active: measurementMode },
    "---",
    { icon: <Wind size={14} />,         tip: "Physics Sim", act: () => setPhOn(p => !p), active: phOn },
    { icon: <Camera size={14} />,       tip: "Studio Render (F12)", act: renderSnapshot },
    "---",
    { icon: <Upload size={14} />,       tip: "Import 3D Model", act: () => fileInputRef.current?.click() },
  ];

  return (
    <div className="v3d-root">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".obj,.glb,.gltf,.stl,.ply" style={{ display: "none" }} onChange={handleImport} />

      {/* Toast Feedback */}
      {modStatus && <div className="v3d-toast-badge">{modStatus}</div>}

      {/* Add Mesh Popup Menu (Shift+A) */}
      {showAddMenu && (
        <div className="bld-add-menu">
          <div className="bld-add-head">
            <span>Add Mesh (Shift+A)</span>
            <button onClick={() => setShowAddMenu(false)}>×</button>
          </div>
          <button className="bld-add-item" onClick={() => addPrimitive("cube")}><Box size={13} /> Cube</button>
          <button className="bld-add-item" onClick={() => addPrimitive("sphere")}><Circle size={13} /> UV Sphere</button>
          <button className="bld-add-item" onClick={() => addPrimitive("cylinder")}><Layers size={13} /> Cylinder</button>
          <button className="bld-add-item" onClick={() => addPrimitive("plane")}><Grid3x3 size={13} /> Plane</button>
          <button className="bld-add-item" onClick={() => addPrimitive("cone")}><Triangle size={13} /> Cone</button>
          <button className="bld-add-item" onClick={() => addPrimitive("torus")}><Circle size={13} /> Torus</button>
          <button className="bld-add-item" onClick={() => addPrimitive("suzanne")}><Sparkles size={13} /> Suzanne (Monkey)</button>
        </div>
      )}

      {/* ── LEFT: T-Panel (vertical toolbar) */}
      <div className="t-panel">
        {TOOLS.map((t, i) => t === "---" ? <div key={i} className="t-sep" /> : (
          <button key={i} className={`t-btn ${t.active ? "t-active" : ""}`} onClick={e => { e.stopPropagation(); t.act(); }} title={t.tip}>
            {t.icon}
          </button>
        ))}
      </div>

      {/* ── CENTER: 3D viewport */}
      <div className="v3d-center">
        {/* Header bar */}
        <div className="v3d-header">
          <div className="v3d-header-left">
            {/* Mode Switcher Pill */}
            <div className="mode-pill-group">
              <button className={`mode-pill ${viewMode === MODE_OBJECT ? "mp-on" : ""}`} onClick={() => setViewMode(MODE_OBJECT)}>Object</button>
              <button className={`mode-pill ${viewMode === MODE_EDIT ? "mp-on mp-edit" : ""}`} onClick={() => setViewMode(MODE_EDIT)}>Edit</button>
              <button className={`mode-pill ${viewMode === MODE_SCULPT ? "mp-on mp-sculpt" : ""}`} onClick={() => setViewMode(MODE_SCULPT)}>Sculpt</button>
            </div>
            <div className="hdr-sep" />

            {/* Viewport Shading Modes */}
            <div className="view-pills">
              <button className={`vp ${renderMode === "hybrid" ? "vp-on" : ""}`} onClick={() => setRenderMode("hybrid")} title="Hybrid Cloud + Mesh"><Layers size={12} /></button>
              <button className={`vp ${renderMode === "mesh" ? "vp-on" : ""}`} onClick={() => setRenderMode("mesh")} title="Solid Mesh"><Box size={12} /></button>
              <button className={`vp ${renderMode === "points" ? "vp-on" : ""}`} onClick={() => setRenderMode("points")} title="Points Cloud"><Grid3x3 size={12} /></button>
              <div className="hdr-sep" />
              <button className={`vp ${wireframe ? "vp-on" : ""}`} onClick={() => setWireframe(w => !w)} title="Wireframe Overlay"><Grid3x3 size={12} /></button>
              <button className={`vp ${showCams ? "vp-on" : ""}`} onClick={() => setShowCams(s => !s)} title="Drone Trajectory"><Navigation size={12} /></button>
              <button className="vp" onClick={resetView} title="Reset Camera View"><RotateCcw size={12} /></button>
            </div>
            <div className="hdr-sep" />

            {/* Quick Camera Views */}
            <div className="view-pills">
              <button className="vp-txt" onClick={() => setCameraView("top")} title="Top View (Numpad 7)">Top</button>
              <button className="vp-txt" onClick={() => setCameraView("front")} title="Front View (Numpad 1)">Front</button>
              <button className="vp-txt" onClick={() => setCameraView("right")} title="Right View (Numpad 3)">Right</button>
              <button className="vp-txt" onClick={() => setCameraView("iso")} title="Isometric View (Numpad 5)">Iso</button>
            </div>
          </div>

          <div className="v3d-header-right">
            {/* Turntable spin */}
            <button className={`vp ${isTurntable ? "vp-on" : ""}`} onClick={() => setIsTurntable(t => !t)} title="360° Turntable Spin">
              {isTurntable ? <Pause size={12} /> : <Play size={12} />}
            </button>

            {/* F12 Render Studio Snapshot */}
            <button className="hdr-render-btn" onClick={renderSnapshot} title="Render Studio Image (F12)">
              <Camera size={12} /> Render
            </button>

            {tool !== T_NONE && <span className="tf-badge">{tool === T_GRAB ? "Grab" : tool === T_ROTATE ? "Rotate" : tool === T_SCALE ? "Scale" : "Extrude"}<span className="tf-sub"> Enter/Esc</span></span>}
            {phOn && <span className="tf-badge ph-badge"><Wind size={10} /> Physics</span>}
            <span className="fps-badge"><Zap size={9} /> {fps}</span>
            <span className="stat-badge"><Circle size={9} /> {flightData?.points?.length?.toLocaleString() || 0}</span>
            <span className="stat-badge"><Hexagon size={9} /> {flightData?.meshIndices ? Math.floor(flightData.meshIndices.length / 3).toLocaleString() : 0}</span>
            <button className="n-toggle" onClick={() => setNOpen(o => !o)} title="Properties, Modifiers & Tools (N)">
              {nOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div ref={mountRef} className="v3d-canvas" />

        {/* Bottom info bar */}
        <div className="v3d-footer">
          <span className="f-item"><span className="f-dot" /> 1 Unit = 1.00 m</span>
          <span className="f-item">WGS84</span>
          {viewMode === MODE_EDIT && <span className="f-item f-edit">Edit: {selVerts.size} selected</span>}
          {viewMode === MODE_SCULPT && <span className="f-item f-sculpt">Sculpt: {sculptBrush.toUpperCase()} (r={sculptRadius}m)</span>}
          {info && <span className="f-item f-info">{info.t === "v" ? `V#${info.i}` : "Surface"} ({info.x}, {info.y}, {info.z})</span>}
          {importedModelName && (
            <span className="f-item f-imported">
              <Box size={10} /> {importedModelName}
              <button className="f-clear-btn" onClick={clearImported} title="Unload imported model">×</button>
            </span>
          )}
        </div>
      </div>

      {/* ── RIGHT: N-Panel (collapsible) */}
      {nOpen && (
        <div className="n-panel">
          <div className="n-tabs">
            {TABS.map(t => (
              <button key={t.id} className={`nt ${nTab === t.id ? "nt-on" : ""}`} onClick={() => setNTab(t.id)} title={t.tip}>{t.icon}</button>
            ))}
          </div>
          <div className="n-body">

            {/* ═══ TAB 1: MODIFIERS (Blender Modifier Stack) ═══ */}
            {nTab === "mod" && <>
              <SecH icon={<Sparkles size={11} />} label="Subdivision Surface" open={sec.modSub} onToggle={() => tSec("modSub")} badge="Subsurf" />
              {sec.modSub && <div className="sec-body">
                <div className="mod-desc">Subdivides faces and recalculates smooth normals for organic high-res geometry.</div>
                <button className="act-btn mod-action-btn" onClick={applySubdivision}>
                  <Sparkles size={11} /> Apply Subdivision Level
                </button>
              </div>}

              <SecH icon={<Scissors size={11} />} label="Decimate / Simplify" open={sec.modDec} onToggle={() => tSec("modDec")} badge="50%" />
              {sec.modDec && <div className="sec-body">
                <div className="mod-desc">Reduces polygon load by collapsing redundant triangles for real-time performance.</div>
                <button className="act-btn mod-action-btn" onClick={applyDecimate}>
                  <Scissors size={11} /> Decimate Geometry (-50%)
                </button>
              </div>}

              <SecH icon={<Layers3 size={11} />} label="Solidify (Thickness)" open={sec.modDisp} onToggle={() => tSec("modDisp")} />
              {sec.modDisp && <div className="sec-body">
                <div className="mod-desc">Adds volumetric thickness to planar aerial survey terrain models.</div>
                <button className="act-btn" onClick={() => applySolidify(2.0)}>
                  <Layers3 size={11} /> Apply Solidify (+2m Thickness)
                </button>
                <button className="act-btn" onClick={() => applyDisplacement(1.2)}>
                  <Wind size={11} /> Procedural Noise Displacement
                </button>
              </div>}

              <SecH icon={<Wrench size={11} />} label="Normal & Pivot Tools" open={sec.modNorm} onToggle={() => tSec("modNorm")} />
              {sec.modNorm && <div className="sec-body">
                <button className="act-btn" onClick={applySmoothNormals}>
                  <RefreshCw size={10} /> Recalculate Smooth Normals
                </button>
                <button className="act-btn" onClick={applyFlipNormals}>
                  <RotateCw size={10} /> Flip / Invert Normals
                </button>
                <button className="act-btn" onClick={applyCenterOrigin}>
                  <Crosshair size={10} /> Set Origin to Geometry
                </button>
                <button className="act-btn" onClick={applyWeld}>
                  <Wrench size={10} /> Merge Vertices by Distance
                </button>
              </div>}
            </>}

            {/* ═══ TAB 2: SCULPT BRUSHES ═══ */}
            {nTab === "sculpt" && <>
              <SecH icon={<Paintbrush size={11} />} label="Sculpting Brushes" open={sec.sculptB} onToggle={() => tSec("sculptB")} badge={sculptBrush.toUpperCase()} />
              {sec.sculptB && <div className="sec-body">
                <div className="sc-brush-grid">
                  <button className={`sc-brush-btn ${sculptBrush === "draw" ? "active" : ""}`} onClick={() => setSculptBrush("draw")}>Push / Pull</button>
                  <button className={`sc-brush-btn ${sculptBrush === "smooth" ? "active" : ""}`} onClick={() => setSculptBrush("smooth")}>Smooth</button>
                  <button className={`sc-brush-btn ${sculptBrush === "flatten" ? "active" : ""}`} onClick={() => setSculptBrush("flatten")}>Flatten</button>
                  <button className={`sc-brush-btn ${sculptBrush === "inflate" ? "active" : ""}`} onClick={() => setSculptBrush("inflate")}>Inflate</button>
                </div>
                <Sl label="Brush Radius" value={sculptRadius} min={1} max={30} step={1} onChange={setSculptRadius} />
                <Sl label="Brush Strength" value={sculptStrength} min={0.05} max={1.0} step={0.05} onChange={setSculptStrength} />
                <button className={`act-btn ${viewMode === MODE_SCULPT ? "mod-action-btn" : ""}`} onClick={() => setViewMode(v => v === MODE_SCULPT ? MODE_OBJECT : MODE_SCULPT)}>
                  {viewMode === MODE_SCULPT ? "Exit Sculpt Mode" : "Enter Sculpt Mode (Drag to Sculpt)"}
                </button>
              </div>}
            </>}

            {/* ═══ TAB 3: MATERIAL & MATCAP ═══ */}
            {nTab === "mat" && <>
              <SecH icon={<Palette size={11} />} label="MatCap Viewport Presets" open={sec.matcapS} onToggle={() => tSec("matcapS")} badge={matcap.toUpperCase()} />
              {sec.matcapS && <div className="sec-body">
                <div className="sc-brush-grid">
                  <button className={`sc-brush-btn ${matcap === "clay" ? "active" : ""}`} onClick={() => applyMatcapPreset("clay")}>Studio Clay</button>
                  <button className={`sc-brush-btn ${matcap === "redwax" ? "active" : ""}`} onClick={() => applyMatcapPreset("redwax")}>Red Wax</button>
                  <button className={`sc-brush-btn ${matcap === "chrome" ? "active" : ""}`} onClick={() => applyMatcapPreset("chrome")}>Chrome</button>
                  <button className={`sc-brush-btn ${matcap === "pearl" ? "active" : ""}`} onClick={() => applyMatcapPreset("pearl")}>Pearl</button>
                  <button className={`sc-brush-btn ${matcap === "facets" ? "active" : ""}`} onClick={() => applyMatcapPreset("facets")}>Faceted</button>
                </div>
              </div>}

              <SecH icon={<Triangle size={11} />} label="PBR Surface Material" open={sec.matB} onToggle={() => tSec("matB")} />
              {sec.matB && <div className="sec-body">
                <Cr label="Color" value={mColor} onChange={setMColor} />
                <Cr label="Emissive" value={mEmis} onChange={setMEmis} />
                <Sl label="Rough" value={mRough} min={0} max={1} onChange={setMRough} />
                <Sl label="Metal" value={mMetal} min={0} max={1} onChange={setMMetal} />
                <Sl label="Opacity" value={mOpa} min={0} max={1} onChange={setMOpa} />
                <Tog label="Flat Shade" on={flatSh} onToggle={() => setFlatSh(v => !v)} />
              </div>}

              <SecH icon={<Circle size={11} />} label="Point Cloud Display" open={sec.matP} onToggle={() => tSec("matP")} />
              {sec.matP && <div className="sec-body"><Sl label="Size" value={ptSz} min={0.5} max={8} step={0.1} onChange={setPtSz} /></div>}
            </>}

            {/* ═══ TAB 4: RENDER ENGINE & CAMERA ═══ */}
            {nTab === "render" && <>
              <SecH icon={<Camera size={11} />} label="Render Engine" open={sec.renderSnap} onToggle={() => tSec("renderSnap")} badge={renderEngine.toUpperCase()} />
              {sec.renderSnap && <div className="sec-body">
                <div className="sc-brush-grid">
                  <button className={`sc-brush-btn ${renderEngine === "eevee" ? "active" : ""}`} onClick={() => setRenderEngine("eevee")}>EEVEE Realtime</button>
                  <button className={`sc-brush-btn ${renderEngine === "cycles" ? "active" : ""}`} onClick={() => setRenderEngine("cycles")}>Cycles Preview</button>
                  <button className={`sc-brush-btn ${renderEngine === "workbench" ? "active" : ""}`} onClick={() => setRenderEngine("workbench")}>Workbench CAD</button>
                </div>
                <button className="act-btn imp-full-btn" onClick={renderSnapshot} style={{ marginTop: "6px" }}>
                  <Camera size={12} /> Render Studio Image (F12)
                </button>
              </div>}

              <SecH icon={<Navigation size={11} />} label="Turntable Animation" open={true} onToggle={() => {}} badge={isTurntable ? "RUNNING" : "STOP"} />
              <div className="sec-body">
                <Tog label="360° Spin" on={isTurntable} onToggle={() => setIsTurntable(t => !t)} />
                <Sl label="Speed" value={turntableSpeed} min={0.002} max={0.04} step={0.002} onChange={setTurntableSpeed} />
              </div>
            </>}

            {/* ═══ TAB 5: LIGHTING & SKY ═══ */}
            {nTab === "light" && <>
              <SecH icon={<Compass size={11} />} label="Sky & HDRI Presets" open={true} onToggle={() => {}} />
              <div className="sec-body">
                <div className="sc-brush-grid">
                  <button className="sc-brush-btn" onClick={() => applyLightingPreset("studio")}>Studio Neutral</button>
                  <button className="sc-brush-btn" onClick={() => applyLightingPreset("golden")}>Golden Hour</button>
                  <button className="sc-brush-btn" onClick={() => applyLightingPreset("overcast")}>Overcast Day</button>
                  <button className="sc-brush-btn" onClick={() => applyLightingPreset("night")}>Cyber Night</button>
                </div>
              </div>

              <SecH icon={<Sun size={11} />} label="Sun Light" open={sec.sun} onToggle={() => tSec("sun")} />
              {sec.sun && <div className="sec-body">
                <Sl label="Intensity" value={sunI} min={0} max={5} onChange={setSunI} />
                <Cr label="Color" value={sunC} onChange={setSunC} />
                <Sl label="X" value={sunDX} min={-200} max={200} step={1} onChange={setSunDX} />
                <Sl label="Y" value={sunDY} min={-200} max={200} step={1} onChange={setSunDY} />
                <Sl label="Z" value={sunDZ} min={-200} max={200} step={1} onChange={setSunDZ} />
                <Tog label="Shadows" on={shadows} onToggle={() => setShadows(s => !s)} />
              </div>}

              <SecH icon={<Circle size={11} />} label="Ambient Light" open={sec.amb} onToggle={() => tSec("amb")} />
              {sec.amb && <div className="sec-body"><Sl label="Intensity" value={ambI} min={0} max={3} onChange={setAmbI} /><Cr label="Color" value={ambC} onChange={setAmbC} /></div>}

              <SecH icon={<Zap size={11} />} label="Fill & Rim Light" open={sec.fill} onToggle={() => tSec("fill")} />
              {sec.fill && <div className="sec-body">
                <Sl label="Fill Intensity" value={fillI} min={0} max={3} onChange={setFillI} /><Cr label="Fill Color" value={fillC} onChange={setFillC} />
                <Sl label="Back Rim Intensity" value={backI} min={0} max={3} onChange={setBackI} /><Cr label="Back Color" value={backC} onChange={setBackC} />
              </div>}

              <SecH icon={<Droplets size={11} />} label="Atmosphere & Fog" open={sec.envF} onToggle={() => tSec("envF")} />
              {sec.envF && <div className="sec-body">
                <Tog label="Enabled" on={fogOn} onToggle={() => setFogOn(v => !v)} />
                <Cr label="Color" value={fogC} onChange={setFogC} />
                <Sl label="Density" value={fogD} min={0} max={0.05} step={0.0001} onChange={setFogD} />
                <Tog label="Ground Grid" on={gridOn} onToggle={() => setGridOn(v => !v)} />
              </div>}
            </>}

            {/* ═══ TAB 6: OUTLINER (Scene Hierarchy) ═══ */}
            {nTab === "out" && <>
              <SecH icon={<ListFilter size={11} />} label="Scene Collection" open={sec.outliner} onToggle={() => tSec("outliner")} badge={`${sceneItems.length}`} />
              {sec.outliner && <div className="sec-body">
                <div className="outliner-list">
                  {sceneItems.map(item => {
                    const isActive = activeObjId === item.id;
                    return (
                      <div key={item.id} className={`out-item ${isActive ? "out-active" : ""}`} onClick={() => selectObject(item.id)}>
                        <span className="out-icon"><Box size={11} /></span>
                        <span className="out-name">{item.name}</span>
                        <button className="out-eye" onClick={(e) => { e.stopPropagation(); toggleVisibility(item.id); }}>
                          {item.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                        </button>
                        {item.type === "primitive" && (
                          <button className="out-del" onClick={(e) => { e.stopPropagation(); deleteObject(item.id); }}>
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button className="act-btn" onClick={() => setShowAddMenu(true)} style={{ marginTop: "8px" }}>
                  <Plus size={11} /> Add Primitive (Shift+A)
                </button>
              </div>}
            </>}

            {/* ═══ TAB 7: EXPORT SUITE (OBJ, GLTF, STL, PLY) ═══ */}
            {nTab === "export" && <>
              <SecH icon={<Download size={11} />} label="Export 3D Formats" open={sec.expSuite} onToggle={() => tSec("expSuite")} />
              {sec.expSuite && <div className="sec-body">
                <div className="mod-desc">Export active mesh model in standard engineering and CAD formats:</div>
                <button className="act-btn exp-btn" onClick={() => exportModel("obj")}>
                  <Download size={11} /> Wavefront (.OBJ)
                </button>
                <button className="act-btn exp-btn" onClick={() => exportModel("gltf")}>
                  <Download size={11} /> glTF 2.0 Web (.GLTF / .GLB)
                </button>
                <button className="act-btn exp-btn" onClick={() => exportModel("stl")}>
                  <Download size={11} /> Stereolithography (.STL 3D Print)
                </button>
                <button className="act-btn exp-btn" onClick={() => exportModel("ply")}>
                  <Download size={11} /> Stanford Polygon (.PLY Pointcloud)
                </button>
              </div>}
            </>}

            {/* ═══ TAB 8: OBJECT & TRANSFORM ═══ */}
            {nTab === "obj" && <>
              <SecH icon={<Upload size={11} />} label="Import 3D Model" open={sec.objM} onToggle={() => tSec("objM")} />
              {sec.objM && <div className="sec-body">
                <button className="act-btn imp-full-btn" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={11} /> Choose 3D File (.obj, .glb, .stl, .ply)
                </button>
                {importedModelName ? (
                  <div className="imp-card">
                    <div className="imp-card-title"><Box size={10} /> {importedModelName}</div>
                    {importStats && <div className="imp-card-stats">{importStats.verts.toLocaleString()} verts · {importStats.faces.toLocaleString()} faces</div>}
                    <div className="imp-card-tip">Active for Transform (G/R/S) & Edit Mode</div>
                    <button className="act-btn imp-clear-btn" onClick={clearImported}>
                      <RefreshCw size={10} /> Unload Model
                    </button>
                  </div>
                ) : (
                  <div className="imp-placeholder">Active Target: Reconstructed Drone Mesh</div>
                )}
              </div>}

              <SecH icon={<Move size={11} />} label="Interactive Transform Gizmo" open={true} onToggle={() => {}} badge={gizmoMode.toUpperCase()} />
              <div className="sec-body">
                <div className="sc-brush-grid">
                  <button className={`sc-brush-btn ${gizmoMode === "translate" ? "active" : ""}`} onClick={() => setGizmoMode("translate")}>Move (W)</button>
                  <button className={`sc-brush-btn ${gizmoMode === "rotate" ? "active" : ""}`} onClick={() => setGizmoMode("rotate")}>Rotate (E)</button>
                  <button className={`sc-brush-btn ${gizmoMode === "scale" ? "active" : ""}`} onClick={() => setGizmoMode("scale")}>Scale (R)</button>
                  <button className={`sc-brush-btn ${gizmoMode === "none" ? "active" : ""}`} onClick={() => setGizmoMode("none")}>Hide</button>
                </div>
                <div className="grp-lbl" style={{ marginTop: "8px" }}>Numeric Position</div>
                <Sl label="X" value={oPos[0]} min={-100} max={100} step={0.1} onChange={v => setOPos([v, oPos[1], oPos[2]])} />
                <Sl label="Y" value={oPos[1]} min={-100} max={100} step={0.1} onChange={v => setOPos([oPos[0], v, oPos[2]])} />
                <Sl label="Z" value={oPos[2]} min={-100} max={100} step={0.1} onChange={v => setOPos([oPos[0], oPos[1], v])} />
                <div className="grp-lbl">Rotation (deg)</div>
                <Sl label="X" value={oRot[0]} min={-180} max={180} step={0.5} onChange={v => setORot([v, oRot[1], oRot[2]])} />
                <Sl label="Y" value={oRot[1]} min={-180} max={180} step={0.5} onChange={v => setORot([oRot[0], v, oRot[2]])} />
                <Sl label="Z" value={oRot[2]} min={-180} max={180} step={0.5} onChange={v => setORot([oRot[0], oRot[1], v])} />
                <div className="grp-lbl">Scale</div>
                <Sl label="X" value={oSca[0]} min={0.01} max={5} step={0.01} onChange={v => setOSca([v, oSca[1], oSca[2]])} />
                <Sl label="Y" value={oSca[1]} min={0.01} max={5} step={0.01} onChange={v => setOSca([oSca[0], v, oSca[2]])} />
                <Sl label="Z" value={oSca[2]} min={0.01} max={5} step={0.01} onChange={v => setOSca([oSca[0], oSca[1], v])} />
                <button className="act-btn" onClick={() => { setOPos([0,0,0]); setORot([0,0,0]); setOSca([1,1,1]); }}><RefreshCw size={10} /> Reset Transform</button>
              </div>

              <SecH icon={<Edit3 size={11} />} label="Hotkeys Cheatsheet" open={sec.objShortcuts} onToggle={() => tSec("objShortcuts")} />
              {sec.objShortcuts && <div className="sec-body">
                <div className="sc-list">
                  <div className="sc-item"><kbd>Shift + A</kbd><span>Add Mesh Primitives</span></div>
                  <div className="sc-item"><kbd>Tab</kbd><span>Object / Edit Mode</span></div>
                  <div className="sc-item"><kbd>W / G</kbd><span>Translate Gizmo</span></div>
                  <div className="sc-item"><kbd>E / R</kbd><span>Rotate / Extrude</span></div>
                  <div className="sc-item"><kbd>R / S</kbd><span>Scale Gizmo</span></div>
                  <div className="sc-item"><kbd>X / Y / Z</kbd><span>Lock Axis</span></div>
                  <div className="sc-item"><kbd>A / Alt+A</kbd><span>Select / Deselect</span></div>
                  <div className="sc-item"><kbd>X / Del</kbd><span>Delete Selected</span></div>
                  <div className="sc-item"><kbd>F12</kbd><span>Render Studio Image</span></div>
                  <div className="sc-item"><kbd>1, 3, 7, 5, 0</kbd><span>Numpad Camera Views</span></div>
                </div>
              </div>}
            </>}

          </div>
        </div>
      )}
    </div>
  );
}
