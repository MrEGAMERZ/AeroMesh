import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export default function Viewer3D({ flightData, measurementMode, onAddMeasurementPoint, activePose }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);

  const objRef = useRef({
    pcd: null,
    mesh: null,
    traj: null,
    frustums: [],
  });

  /* ═══════════════ THREE.JS SCENE SETUP ═══════════════ */
  useEffect(() => {
    const ctr = mountRef.current;
    if (!ctr) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x28292d);
    sceneRef.current = scene;

    const cam = new THREE.PerspectiveCamera(45, ctr.clientWidth / ctr.clientHeight, 0.1, 2000);
    cam.position.set(75, 55, 85);
    cameraRef.current = cam;

    const ren = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    ren.setSize(ctr.clientWidth, ctr.clientHeight);
    ren.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = ren;
    ctr.innerHTML = "";
    ctr.appendChild(ren.domElement);

    const controls = new OrbitControls(cam, ren.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    /* lights */
    const amb = new THREE.AmbientLight(0xffffff, 0.9); scene.add(amb);
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(70, 120, 50);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x94a3b8, 0.65); 
    fill.position.set(-60, -20, -60); 
    scene.add(fill);

    const grid = new THREE.GridHelper(160, 40, 0x5a5e69, 0x3d4048); 
    grid.position.y = -1; 
    scene.add(grid);

    const ray = new THREE.Raycaster(); 
    ray.params.Points = { threshold: 2 };
    const m2 = new THREE.Vector2();
    
    const onPU = (e) => {
      // Measurement raycaster
      if (!measurementMode) return;
      
      const r = ren.domElement.getBoundingClientRect(); 
      m2.x = ((e.clientX - r.left) / r.width) * 2 - 1; 
      m2.y = -((e.clientY - r.top) / r.height) * 2 + 1;

      ray.setFromCamera(m2, cam);
      
      let intersects = [];
      if (objRef.current.mesh) {
        intersects = ray.intersectObject(objRef.current.mesh);
      } else if (objRef.current.pcd) {
        intersects = ray.intersectObject(objRef.current.pcd);
      }
      
      if (intersects.length > 0) {
        const pt = intersects[0].point;
        if (measurementMode && onAddMeasurementPoint) {
          onAddMeasurementPoint([pt.x, pt.y, pt.z]);
        }
      }
    };

    const dm = ren.domElement;
    dm.addEventListener("pointerup", onPU);

    let raf;
    const anim = () => {
      raf = requestAnimationFrame(anim);
      controls.update();
      ren.render(scene, cam);
    };
    anim();

    const onR = () => { 
      if (!ctr) return; 
      cam.aspect = ctr.clientWidth / ctr.clientHeight; 
      cam.updateProjectionMatrix(); 
      ren.setSize(ctr.clientWidth, ctr.clientHeight); 
    };
    window.addEventListener("resize", onR);

    return () => { 
      cancelAnimationFrame(raf); 
      dm.removeEventListener("pointerup", onPU); 
      window.removeEventListener("resize", onR); 
      ren.dispose(); 
      controls.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurementMode, onAddMeasurementPoint]);

  /* ═══════════════ GEOMETRY BUILD ═══════════════ */
  useEffect(() => {
    const sc = sceneRef.current; if (!sc || !flightData) return;
    if (objRef.current.pcd) sc.remove(objRef.current.pcd);
    if (objRef.current.mesh) sc.remove(objRef.current.mesh);
    if (objRef.current.traj) sc.remove(objRef.current.traj);
    objRef.current.frustums.forEach(f => sc.remove(f)); objRef.current.frustums = [];

    const pts = flightData.points || [];
    if (pts.length > 0) {
      const g = new THREE.BufferGeometry(), pos = new Float32Array(pts.length * 3), col = new Float32Array(pts.length * 3);
      let zMin = Infinity, zMax = -Infinity; pts.forEach(p => { if (p[2] < zMin) zMin = p[2]; if (p[2] > zMax) zMax = p[2]; });
      pts.forEach((p, i) => {
        pos[i*3] = p[0]; pos[i*3+1] = p[2]; pos[i*3+2] = p[1];
        const t = (p[2] - zMin) / (zMax - zMin || 1), c = new THREE.Color();
        c.setHSL(0.55 - t * 0.48, 0.95, 0.46 + t * 0.22);
        col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
      });
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const pc = new THREE.Points(g, new THREE.PointsMaterial({ size: 2.4, vertexColors: true, transparent: true, opacity: 0.88 }));
      sc.add(pc); objRef.current.pcd = pc;
    }
    
    if (flightData.meshVertices && flightData.meshIndices) {
      const mg = new THREE.BufferGeometry();
      mg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(flightData.meshVertices), 3));
      mg.setIndex(flightData.meshIndices); mg.computeVertexNormals();
      const mm = new THREE.MeshStandardMaterial({ color: 0x94a3b8, side: THREE.DoubleSide });
      const sm = new THREE.Mesh(mg, mm);
      sc.add(sm); objRef.current.mesh = sm;
    }
    
    const tr = flightData.trajectory || [];
    if (tr.length > 1) {
      const tp = tr.map(p => new THREE.Vector3(p.x, p.z, p.y)), crv = new THREE.CatmullRomCurve3(tp);
      const tm = new THREE.Mesh(new THREE.TubeGeometry(crv, 72, 0.38, 8, false), new THREE.MeshBasicMaterial({ color: 0xA78D78 }));
      sc.add(tm); objRef.current.traj = tm;
      tr.forEach((c, i) => { 
        if (i % 3 === 0) { 
          const f = new THREE.CameraHelper(new THREE.PerspectiveCamera(40, 1.5, 1, 6)); 
          f.position.set(c.x, c.z, c.y); 
          f.lookAt(c.x, 0, c.y + 4); 
          f.scale.set(0.65, 0.65, 0.65); 
          sc.add(f); 
          objRef.current.frustums.push(f); 
        } 
      });
    }
  }, [flightData]);

  /* ═══════════════ SYNC ACTIVE POSE ═══════════════ */
  useEffect(() => {
    if (!activePose || !cameraRef.current || !controlsRef.current) return;
    
    const cam = cameraRef.current;
    
    // Optionally update camera position to follow active pose
    // For now we just highlight the active frustum or move camera
    // This depends on the exact desired behavior. We'll simply let
    // it be passed as a prop, ready to be used to sync.
  }, [activePose]);

  return (
    <div ref={mountRef} style={{ width: "100%", height: "100%", overflow: "hidden" }} />
  );
}
