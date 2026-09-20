import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";

export default function Viewer3D({ flightData, measurementMode, measuredPoints = [], onAddMeasurementPoint, activePose }) {
  const [walkMode, setWalkMode] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const walkModeRef = useRef(false);

  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);

  useEffect(() => {
    walkModeRef.current = walkMode;
    if (controlsRef.current && cameraRef.current) {
      if (walkMode) {
        cameraRef.current.position.y = 5.0; // human eye level
      }
    }
  }, [walkMode]);

  useEffect(() => {
    if (objRef.current.mesh && objRef.current.mesh.material) {
      objRef.current.mesh.material.wireframe = wireframe;
    }
  }, [wireframe]);

  const handleResetCamera = () => {
    if (cameraRef.current && controlsRef.current && objRef.current.mesh) {
      objRef.current.mesh.geometry.computeBoundingSphere();
      const center = objRef.current.mesh.geometry.boundingSphere.center;
      const radius = objRef.current.mesh.geometry.boundingSphere.radius;
      cameraRef.current.position.set(center.x, center.y + radius * 1.2, center.z + radius * 1.5);
      controlsRef.current.target.copy(center);
    }
  };

  const objRef = useRef({
    pcd: null,
    mesh: null,
    traj: null,
    frustums: [],
    measureLine: null,
    measurePoints: [],
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
          onAddMeasurementPoint({x: pt.x, y: pt.y, z: pt.z});
        }
      }
    };

    const dm = ren.domElement;
    dm.addEventListener("pointerup", onPU);

    // Keyboard state for Walk Mode
    const keys = { w: false, a: false, s: false, d: false, q: false, e: false };
    const onKD = (e) => {
      const k = e.key.toLowerCase();
      if (k in keys) keys[k] = true;
    };
    const onKU = (e) => {
      const k = e.key.toLowerCase();
      if (k in keys) keys[k] = false;
    };
    window.addEventListener("keydown", onKD);
    window.addEventListener("keyup", onKU);

    let raf;
    const anim = () => {
      raf = requestAnimationFrame(anim);
      
      if (walkModeRef.current) {
        // First-Person Walk navigation
        const speed = 0.8;
        const forward = new THREE.Vector3();
        cam.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(forward, cam.up).normalize();

        if (keys.w) cam.position.addScaledVector(forward, speed);
        if (keys.s) cam.position.addScaledVector(forward, -speed);
        if (keys.a) cam.position.addScaledVector(right, -speed);
        if (keys.d) cam.position.addScaledVector(right, speed);
        if (keys.q) cam.position.y -= speed * 0.5;
        if (keys.e) cam.position.y += speed * 0.5;

        // Keep orbit target ahead of camera so looking around stays intuitive
        controls.target.copy(cam.position).add(forward.multiplyScalar(5));
      } else {
        controls.update();
      }

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
      window.removeEventListener("keydown", onKD);
      window.removeEventListener("keyup", onKU);
      window.removeEventListener("resize", onR); 
      ren.dispose(); 
      controls.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measurementMode, onAddMeasurementPoint]);

  /* ═══════════════ GEOMETRY BUILD ═══════════════ */
  useEffect(() => {
    const sc = sceneRef.current; if (!sc || !flightData) return;
    
    // Cleanup old items
    if (objRef.current.pcd) { sc.remove(objRef.current.pcd); objRef.current.pcd.geometry.dispose(); }
    if (objRef.current.mesh) sc.remove(objRef.current.mesh);
    if (objRef.current.traj) sc.remove(objRef.current.traj);
    objRef.current.frustums.forEach(f => sc.remove(f)); objRef.current.frustums = [];

    // Load PLY if URL is provided
    if (flightData.ply_url) {
      const loader = new PLYLoader();
      loader.load(flightData.ply_url, (geometry) => {
        geometry.computeVertexNormals();
        
        // Render as a solid 3D model if faces are present (e.g. from our meshing pipeline)
        let object3d;
        if (geometry.index) {
            // It has faces! Render as a solid mesh.
            const material = new THREE.MeshStandardMaterial({
                vertexColors: !!geometry.attributes.color,
                color: geometry.attributes.color ? 0xffffff : 0xaaaaaa,
                roughness: 0.8,
                metalness: 0.1,
                side: THREE.DoubleSide
            });
            object3d = new THREE.Mesh(geometry, material);
            objRef.current.mesh = object3d;
        } else {
            // No faces, render as point cloud
            const material = new THREE.PointsMaterial({ 
                size: 1.5,
                vertexColors: !!geometry.attributes.color,
                color: geometry.attributes.color ? 0xffffff : 0xaaaaaa
            });
            object3d = new THREE.Points(geometry, material);
            objRef.current.pcd = object3d;
        }
        
        // Rotate so Y is up (often point clouds come with Z up)
        object3d.rotation.x = -Math.PI / 2;
        sc.add(object3d);

        // Auto-center camera on the point cloud
        geometry.computeBoundingSphere();
        const center = geometry.boundingSphere.center;
        const radius = geometry.boundingSphere.radius;
        if (cameraRef.current && controlsRef.current) {
           cameraRef.current.position.set(center.x, center.y + radius, center.z + radius * 1.5);
           controlsRef.current.target.copy(center);
        }
      });
    }

    // Trajectory Frustums
    const tr = flightData.camera_poses || [];
    if (tr.length > 0) {
      // Basic visualization of the camera poses
      tr.forEach((c, i) => { 
        if (i % 3 === 0) { 
          const f = new THREE.CameraHelper(new THREE.PerspectiveCamera(40, 1.5, 1, 6));
          // Apply position
          f.position.set(c.translation[0], c.translation[1], c.translation[2]);
          // Apply rotation - converting rotation matrix to quaternion
          const m4 = new THREE.Matrix4();
          m4.set(
              c.rotation[0][0], c.rotation[0][1], c.rotation[0][2], 0,
              c.rotation[1][0], c.rotation[1][1], c.rotation[1][2], 0,
              c.rotation[2][0], c.rotation[2][1], c.rotation[2][2], 0,
              0, 0, 0, 1
          );
          f.setRotationFromMatrix(m4);
          
          f.scale.set(0.65, 0.65, 0.65); 
          sc.add(f); 
          objRef.current.frustums.push(f); 
        } 
      });
    }
  }, [flightData]);

  
  /* ═══════════════ MEASUREMENT LINE SYNC ═══════════════ */
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    
    // Clear old measurement viz
    if (objRef.current.measureLine) sc.remove(objRef.current.measureLine);
    objRef.current.measurePoints.forEach(p => sc.remove(p));
    objRef.current.measurePoints = [];
    
    if (measuredPoints.length > 0) {
      // Draw points
      measuredPoints.forEach((pt, i) => {
        const dotGeo = new THREE.SphereGeometry(1.5, 16, 16);
        const dotMat = new THREE.MeshBasicMaterial({ color: i === 0 ? 0x00ff00 : 0xff0000 });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.set(pt.x, pt.y, pt.z);
        sc.add(dot);
        objRef.current.measurePoints.push(dot);
      });
      
      // Draw line
      if (measuredPoints.length === 2) {
        const p1 = measuredPoints[0];
        const p2 = measuredPoints[1];
        const points = [];
        points.push(new THREE.Vector3(p1.x, p1.y, p1.z));
        points.push(new THREE.Vector3(p2.x, p2.y, p2.z));
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 3 });
        const line = new THREE.Line(lineGeo, lineMat);
        sc.add(line);
        objRef.current.measureLine = line;
      }
    }
  }, [measuredPoints]);

  /* ═══════════════ SYNC ACTIVE POSE ═══════════════ */
  useEffect(() => {
    if (!activePose || !cameraRef.current || !controlsRef.current) return;
    // Just sync visualization here in the future
  }, [activePose]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      {/* Floating View Controls HUD */}
      <div style={{
        position: "absolute",
        top: "16px",
        left: "16px",
        zIndex: 10,
        display: "flex",
        gap: "8px",
        background: "rgba(15, 23, 42, 0.8)",
        backdropFilter: "blur(8px)",
        padding: "6px 10px",
        borderRadius: "8px",
        border: "1px solid rgba(255, 255, 255, 0.12)"
      }}>
        <button
          type="button"
          onClick={() => setWalkMode(false)}
          className={!walkMode ? "glow-btn" : "secondary-btn"}
          style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "6px", cursor: "pointer" }}
        >
          🚁 Orbit
        </button>
        <button
          type="button"
          onClick={() => setWalkMode(true)}
          className={walkMode ? "glow-btn" : "secondary-btn"}
          style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "6px", cursor: "pointer" }}
        >
          🚶 Walk (WASD)
        </button>
        <button
          type="button"
          onClick={() => setWireframe((w) => !w)}
          className={wireframe ? "glow-btn" : "secondary-btn"}
          style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "6px", cursor: "pointer" }}
          title="Toggle wireframe polygon topology like in Blender"
        >
          🌐 {wireframe ? "Solid Mesh" : "Wireframe"}
        </button>
        <button
          type="button"
          onClick={handleResetCamera}
          className="secondary-btn"
          style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "6px", cursor: "pointer" }}
          title="Reset camera focus to 3D center"
        >
          🎯 Center
        </button>
      </div>

      {walkMode && (
        <div style={{
          position: "absolute",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          background: "rgba(15, 23, 42, 0.9)",
          color: "#38bdf8",
          padding: "8px 18px",
          borderRadius: "20px",
          fontSize: "12px",
          border: "1px solid rgba(56, 189, 248, 0.4)",
          boxShadow: "0 0 15px rgba(56, 189, 248, 0.25)",
          pointerEvents: "none"
        }}>
          🕹️ <b>Walk Mode Active:</b> Use <b>W A S D</b> to walk, <b>Q/E</b> to ascend/descend, drag mouse to look around
        </div>
      )}
    </div>
  );
}
