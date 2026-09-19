import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";

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
        
        // If geometry has color, PLYLoader sets it automatically
        let material = new THREE.PointsMaterial({ size: 1.5 });
        if (geometry.attributes.color) {
            material.vertexColors = true;
        } else {
            material.color = new THREE.Color(0xaaaaaa);
        }
        
        const pc = new THREE.Points(geometry, material);
        
        // Rotate so Y is up (often point clouds come with Z up)
        pc.rotation.x = -Math.PI / 2;
        
        sc.add(pc);
        objRef.current.pcd = pc;

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

  /* ═══════════════ SYNC ACTIVE POSE ═══════════════ */
  useEffect(() => {
    if (!activePose || !cameraRef.current || !controlsRef.current) return;
    // Just sync visualization here in the future
  }, [activePose]);

  return (
    <div ref={mountRef} style={{ width: "100%", height: "100%", overflow: "hidden" }} />
  );
}
