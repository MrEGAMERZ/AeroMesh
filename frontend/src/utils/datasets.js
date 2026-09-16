/**
 * datasets.js — Sample 3D Point Clouds, Meshes & Flight Trajectories
 * 
 * Generates realistic georeferenced 3D point clouds, triangular meshes,
 * and flight trajectories for benchmark drone inspection flights.
 */

// Helper to generate terrain with buildings or quarries
export function generateScenarioDataset(scenarioId) {
  const points = [];
  const trajectory = [];
  const meshVertices = [];
  const meshIndices = [];

  if (scenarioId === 'urban-quadrant') {
    // --- Urban Infrastructure Scenario ---
    // Grid terrain with 4-5 rectangular buildings
    const gridSize = 70;
    const spread = 50;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const x = -spread + (i / gridSize) * spread * 2;
        const y = -spread + (j / gridSize) * spread * 2;
        let z = 0.5 * Math.sin(x * 0.1) * Math.cos(y * 0.1);

        // Building 1 (Office tower)
        if (Math.abs(x - 15) < 10 && Math.abs(y - 12) < 8) {
          z = 18.5 + 0.5 * Math.sin(x * 2);
        }
        // Building 2 (Commercial block)
        else if (Math.abs(x + 20) < 12 && Math.abs(y - 20) < 10) {
          z = 12.0;
        }
        // Building 3 (Residential complex)
        else if (Math.abs(x - 22) < 8 && Math.abs(y + 18) < 12) {
          z = 15.2;
        }
        // Building 4 (Substation / warehouse)
        else if (Math.abs(x + 15) < 10 && Math.abs(y + 15) < 8) {
          z = 7.8;
        }

        points.push([x, y, z]);
      }
    }

    // Add building facade vertical points for high density
    for (let f = 0; f < 8000; f++) {
      const bx = 15 + (Math.random() - 0.5) * 20;
      const by = 12 + (Math.random() - 0.5) * 16;
      const bz = Math.random() * 18.5;
      points.push([bx, by, bz]);
    }

    // Flight trajectory: Single-pass oblique corridor sweep
    const numWaypoints = 24;
    for (let k = 0; k < numWaypoints; k++) {
      const t = k / (numWaypoints - 1);
      const tx = -40 + t * 80;
      const ty = -35 + Math.sin(t * Math.PI) * 15;
      const tz = 45.0 + Math.sin(t * 3) * 1.5;
      trajectory.push({
        x: tx,
        y: ty,
        z: tz,
        lat: 28.53551 + t * 0.00035,
        lon: 77.39102 + t * 0.00048,
        alt: tz,
        speed: 5.6 + Math.sin(t * 4) * 0.4,
        yaw: 42.0 + t * 8.0
      });
    }

  } else if (scenarioId === 'rural-quarry') {
    // --- Open-Cast Quarry Scenario ---
    // Stepped terraced bowl with high vertical relief
    const gridSize = 75;
    const spread = 60;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const x = -spread + (i / gridSize) * spread * 2;
        const y = -spread + (j / gridSize) * spread * 2;
        const dist = Math.sqrt(x * x + y * y);

        // Stepped terracing (excavation benches)
        let z = 0;
        if (dist < 45) {
          const bench = Math.floor((45 - dist) / 7);
          z = -bench * 5.5 + Math.sin(x * 0.3) * 0.5;
        } else {
          z = 2.0 * Math.sin(x * 0.05 + y * 0.05);
        }

        points.push([x, y, z]);
      }
    }

    // Flight trajectory: Single-pass nadir zigzag across the excavation pit
    const numWaypoints = 30;
    for (let k = 0; k < numWaypoints; k++) {
      const t = k / (numWaypoints - 1);
      const tx = -45 + t * 90;
      const ty = (k % 2 === 0 ? 1 : -1) * 20 + t * 10;
      const tz = 68.0;
      trajectory.push({
        x: tx,
        y: ty,
        z: tz,
        lat: 27.81240 + t * 0.00060,
        lon: 76.54120 + t * 0.00045,
        alt: tz,
        speed: 6.2,
        yaw: 88.0 + (k % 2 === 0 ? 5 : -5)
      });
    }

  } else {
    // --- Highway Viaduct & Bridge Span Scenario ---
    const gridSize = 65;
    const spread = 55;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const x = -spread + (i / gridSize) * spread * 2;
        const y = -spread + (j / gridSize) * spread * 2;

        // River valley depression
        let z = -6.0 + 1.2 * Math.cos(x * 0.08);

        // Viaduct bridge deck spanning along X axis (y between -4 and 4)
        if (Math.abs(y) < 4.5) {
          z = 10.5; // Elevated road surface
        }
        // Support piers every 20m along X
        if (Math.abs(y) < 3.0 && Math.abs(x % 20) < 2.0) {
          z = Math.max(z, 0.0);
        }

        points.push([x, y, z]);
      }
    }

    // Add bridge deck edge density
    for (let f = 0; f < 6000; f++) {
      const bx = -50 + Math.random() * 100;
      const by = (Math.random() > 0.5 ? 4.5 : -4.5) + (Math.random() - 0.5);
      const bz = 10.5 - Math.random() * 16;
      points.push([bx, by, bz]);
    }

    // Flight trajectory: Linear flight pass parallel to bridge
    const numWaypoints = 22;
    for (let k = 0; k < numWaypoints; k++) {
      const t = k / (numWaypoints - 1);
      const tx = -55 + t * 110;
      const ty = 14; // offset 14m to view bridge obliquely
      const tz = 35.0;
      trajectory.push({
        x: tx,
        y: ty,
        z: tz,
        lat: 28.10920 + t * 0.00085,
        lon: 77.19830 + t * 0.00010,
        alt: tz,
        speed: 7.0,
        yaw: 90.0
      });
    }
  }

  // Generate lightweight surface mesh for Three.js
  const meshCols = 35;
  const meshRows = 35;
  const meshSpread = 50;

  for (let r = 0; r < meshRows; r++) {
    for (let c = 0; c < meshCols; c++) {
      const mx = -meshSpread + (c / (meshCols - 1)) * meshSpread * 2;
      const my = -meshSpread + (r / (meshRows - 1)) * meshSpread * 2;
      let mz = 0;

      if (scenarioId === 'urban-quadrant') {
        if (Math.abs(mx - 15) < 10 && Math.abs(my - 12) < 8) mz = 18.5;
        else if (Math.abs(mx + 20) < 12 && Math.abs(my - 20) < 10) mz = 12.0;
        else mz = 0.5 * Math.sin(mx * 0.1);
      } else if (scenarioId === 'rural-quarry') {
        const d = Math.sqrt(mx * mx + my * my);
        if (d < 45) mz = -Math.floor((45 - d) / 7) * 5.5;
      } else {
        if (Math.abs(my) < 4.5) mz = 10.5;
        else mz = -6.0;
      }

      meshVertices.push(mx, mz, my); // X, height, Y
    }
  }

  for (let r = 0; r < meshRows - 1; r++) {
    for (let c = 0; c < meshCols - 1; c++) {
      const p0 = r * meshCols + c;
      const p1 = r * meshCols + (c + 1);
      const p2 = (r + 1) * meshCols + c;
      const p3 = (r + 1) * meshCols + (c + 1);

      meshIndices.push(p0, p2, p1);
      meshIndices.push(p1, p2, p3);
    }
  }

  return {
    points,
    trajectory,
    meshVertices,
    meshIndices
  };
}
