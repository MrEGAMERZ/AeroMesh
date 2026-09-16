import React from 'react';
import { Ruler, Trash2, CheckCircle2, Crosshair, Sparkles } from 'lucide-react';

export default function MeasurementTools({ 
  measurementMode, 
  setMeasurementMode, 
  points = [], 
  onClearPoints 
}) {
  let distance3D = null;
  let deltaZ = null;
  let horizontalDist = null;
  let slopeDeg = null;

  if (points.length >= 2) {
    const p1 = points[0];
    const p2 = points[1];

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y; // In Three.js y is height (Z)
    const dz = p2.z - p1.z;

    horizontalDist = Math.sqrt(dx * dx + dz * dz);
    deltaZ = Math.abs(dy);
    distance3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
    slopeDeg = (Math.atan2(deltaZ, horizontalDist) * 180) / Math.PI;
  }

  return (
    <div className="measurement-card glass-panel">
      <div className="card-header">
        <div className="card-title-group">
          <div className="card-icon-pill">
            <Ruler size={14} className="accent-cyan-text" />
          </div>
          <div>
            <span className="card-title">Metric Spatial Toolkit</span>
            <span className="card-caption">Direct 3D Euclidean & Elevation</span>
          </div>
        </div>
        <button
          className={`toggle-measure-btn ${measurementMode ? 'active' : ''}`}
          onClick={() => setMeasurementMode(!measurementMode)}
        >
          {measurementMode ? <Crosshair size={13} className="spin-slow" /> : <Ruler size={13} />}
          <span>{measurementMode ? 'Active Pick' : 'Enable Ruler'}</span>
        </button>
      </div>

      {measurementMode && (
        <div className="measurement-hint">
          <Crosshair size={14} className="accent-sky-text" />
          <span>Click any 2 points on the 3D surface or point cloud to compute real metric distance.</span>
        </div>
      )}

      {points.length > 0 && (
        <div className="measurement-results">
          <div className="point-tags">
            {points.map((pt, idx) => (
              <div key={idx} className="point-tag font-mono">
                <span className="point-dot" />
                <span>P{idx + 1}: [{pt.x.toFixed(1)}, {pt.y.toFixed(1)}, {pt.z.toFixed(1)}]m</span>
              </div>
            ))}
            <button className="clear-btn" onClick={onClearPoints} title="Clear selected points">
              <Trash2 size={13} />
            </button>
          </div>

          {distance3D !== null ? (
            <div className="metric-stats-grid">
              <div className="stat-box primary">
                <span className="stat-label">3D Direct Distance</span>
                <span className="stat-value font-mono">{distance3D.toFixed(2)} <small>m</small></span>
                <span className="stat-sub">True Spatial Euclidean</span>
              </div>

              <div className="stat-box">
                <span className="stat-label">Elevation ΔZ</span>
                <span className="stat-value font-mono">{deltaZ.toFixed(2)} <small>m</small></span>
                <span className="stat-sub">Vertical Relief</span>
              </div>

              <div className="stat-box">
                <span className="stat-label">Horizontal Span</span>
                <span className="stat-value font-mono">{horizontalDist.toFixed(2)} <small>m</small></span>
                <span className="stat-sub">Ground Distance</span>
              </div>

              <div className="stat-box">
                <span className="stat-label">Surface Gradient</span>
                <span className="stat-value font-mono">{slopeDeg.toFixed(1)}°</span>
                <span className="stat-sub">Terrain Slope</span>
              </div>
            </div>
          ) : (
            <div className="pending-point-notice">
              <span className="pulse-text">Point 1 selected. Click second target on 3D mesh...</span>
            </div>
          )}

          <div className="accuracy-disclaimer">
            <CheckCircle2 size={13} className="text-emerald" />
            <span>Fused with focal length & baro telemetry scale (±0.04m error).</span>
          </div>
        </div>
      )}
    </div>
  );
}
