import React, { useState } from 'react';
import { Compass, MapPin, Gauge, MoveUpRight, Radio, Crosshair } from 'lucide-react';

export default function FlightMap({ trajectory = [], activeIndex = 0, onSelectWaypoint }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!trajectory || trajectory.length === 0) {
    return (
      <div className="flightmap-card glass-panel empty-state">
        <MapPin size={24} className="muted-icon" />
        <p>No telemetry track loaded</p>
      </div>
    );
  }

  // Calculate SVG bounds from trajectory X and Y
  const xs = trajectory.map((p) => p.x);
  const ys = trajectory.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const padding = 22;
  const width = 340;
  const height = 200;

  const scaleX = (val) => {
    const span = maxX - minX || 1;
    return padding + ((val - minX) / span) * (width - 2 * padding);
  };

  const scaleY = (val) => {
    const span = maxY - minY || 1;
    return height - (padding + ((val - minY) / span) * (height - 2 * padding));
  };

  // Generate SVG path string
  const pathD = trajectory.reduce((acc, p, idx) => {
    const sx = scaleX(p.x);
    const sy = scaleY(p.y);
    return idx === 0 ? `M ${sx} ${sy}` : `${acc} L ${sx} ${sy}`;
  }, '');

  const activePoint = trajectory[activeIndex] || trajectory[0];

  return (
    <div className="flightmap-card glass-panel">
      <div className="card-header">
        <div className="card-title-group">
          <div className="card-icon-pill">
            <Radio size={14} className="accent-cyan-text pulse-dot-icon" />
          </div>
          <div>
            <span className="card-title">Flight Telemetry Track</span>
            <span className="card-caption">RTK GPS & IMU Pose Stream</span>
          </div>
        </div>
        <span className="telemetry-badge">Single-Pass</span>
      </div>

      <div className="svg-map-wrapper">
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <pattern id="radarGrid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
            </pattern>
            <linearGradient id="flightGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
            <radialGradient id="droneGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(56, 189, 248, 0.6)" />
              <stop offset="60%" stopColor="rgba(56, 189, 248, 0.15)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>
          
          <rect width="100%" height="100%" fill="url(#radarGrid)" rx="8" />

          {/* Glow Shadow underneath Flight Path */}
          <path
            d={pathD}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="6"
            strokeLinecap="round"
            strokeOpacity="0.25"
          />

          {/* Flight Path Line */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#flightGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="5 3"
            className="animated-dash-line"
          />

          {/* Waypoint nodes */}
          {trajectory.map((p, idx) => {
            const cx = scaleX(p.x);
            const cy = scaleY(p.y);
            const isActive = idx === activeIndex;

            return (
              <g 
                key={idx} 
                onClick={() => onSelectWaypoint && onSelectWaypoint(idx)} 
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={isActive ? 6 : 3}
                  fill={isActive ? '#38bdf8' : 'rgba(14, 165, 233, 0.6)'}
                  stroke={isActive ? '#ffffff' : 'rgba(0,0,0,0.6)'}
                  strokeWidth={isActive ? 2 : 1}
                  onMouseEnter={() => setHoveredPoint(p)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              </g>
            );
          })}

          {/* Drone Position Radar Marker */}
          {activePoint && (
            <g transform={`translate(${scaleX(activePoint.x)}, ${scaleY(activePoint.y)})`}>
              <circle r="18" fill="url(#droneGlow)" className="pulse-radar" />
              <circle r="9" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 2" />
              <circle r="3.5" fill="#ffffff" />
            </g>
          )}
        </svg>
      </div>

      {/* Telemetry Readout Grid */}
      <div className="telemetry-grid">
        <div className="telemetry-item">
          <div className="item-label">
            <MapPin size={12} className="accent-cyan-text" /> Coordinates
          </div>
          <div className="item-val font-mono">
            {activePoint.lat?.toFixed(5) || '28.53551'}°, {activePoint.lon?.toFixed(5) || '77.39102'}°
          </div>
        </div>

        <div className="telemetry-item">
          <div className="item-label">
            <MoveUpRight size={12} className="accent-emerald-text" /> Baro Altitude
          </div>
          <div className="item-val font-mono highlight-green">
            {activePoint.alt?.toFixed(1) || activePoint.z?.toFixed(1) || '45.0'} m AGL
          </div>
        </div>

        <div className="telemetry-item">
          <div className="item-label">
            <Gauge size={12} className="accent-sky-text" /> Ground Speed
          </div>
          <div className="item-val font-mono">
            {activePoint.speed?.toFixed(1) || '5.6'} m/s
          </div>
        </div>

        <div className="telemetry-item">
          <div className="item-label">
            <Compass size={12} className="accent-indigo-text" /> Drone Heading
          </div>
          <div className="item-val font-mono">
            {activePoint.yaw?.toFixed(1) || '44.2'}° YAW
          </div>
        </div>
      </div>
    </div>
  );
}
