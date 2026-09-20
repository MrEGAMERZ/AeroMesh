import React from 'react';
import {
  Compass,
  Cpu,
  UploadCloud,
  Download,
  Building2,
  Mountain,
  Route,
  Activity
} from 'lucide-react';

const ENGINES = [
  { id: 'vggt', label: 'VGGT-Ω' },
  { id: 'mapanything', label: 'MapAnything' },
  { id: 'dust3r', label: 'DUSt3R' },
];

const SCENARIOS = [
  { id: 'urban-quadrant', label: 'Urban', alt: '45m', icon: Building2 },
  { id: 'rural-quarry', label: 'Quarry', alt: '68m', icon: Mountain },
  { id: 'bridge-span', label: 'Viaduct', alt: '35m', icon: Route },
];

export default function Navbar({
  activeModel,
  onModelChange,
  onOpenUpload,
  onExport,
  isProcessing,
  activeSampleId,
  onSelectSample,
  showSidebar,
  onToggleSidebar
}) {
  return (
    <header className="topbar">
      {/* Brand & System Status */}
      <div className="topbar-left">
        <div className="topbar-brand">
          <Compass size={15} className="brand-icon-svg" />
          <span className="brand-text">AEROMESH <b>3D</b></span>
          <span className="brand-badge-mini">SIH26158</span>
        </div>
        <div className="status-dot-chip" title="Clustered GPU acceleration active">
          <span className="live-dot" />
          <span>H200</span>
        </div>
      </div>

      {/* Center: Flight Scenarios + Engine */}
      <div className="topbar-center">
        {/* Benchmark Flights */}
        {onSelectSample && (
          <div className="topbar-group">
            <span className="group-label">Flight:</span>
            <div className="seg-pills">
              {SCENARIOS.map((sc) => {
                const Icon = sc.icon;
                const isActive = activeSampleId === sc.id;
                return (
                  <button
                    key={sc.id}
                    type="button"
                    className={`seg-btn ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectSample(sc.id)}
                    title={`${sc.label} (${sc.alt})`}
                  >
                    <Icon size={12} />
                    <span>{sc.label}</span>
                    <span className="seg-sub">{sc.alt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="topbar-divider" />

        {/* Engine Switcher */}
        <div className="topbar-group">
          <span className="group-label">
            <Cpu size={12} /> Engine:
          </span>
          <div className="seg-pills">
            {ENGINES.map((eng) => {
              const isActive = activeModel === eng.id;
              return (
                <button
                  key={eng.id}
                  type="button"
                  className={`seg-btn ${isActive ? 'active' : ''}`}
                  onClick={() => onModelChange(eng.id)}
                  disabled={isProcessing}
                >
                  <span>{eng.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="topbar-right">
        <button
          type="button"
          onClick={onToggleSidebar}
          className={`topbar-btn ${showSidebar ? "primary-action" : ""}`}
          title="Toggle Flight Telemetry & Pipeline Stream Sidebar"
        >
          <Activity size={13} />
          <span>Telemetry</span>
        </button>

        <button
          id="btn-upload-flight"
          onClick={onOpenUpload}
          className="topbar-btn primary-action"
          disabled={isProcessing}
          title="Upload drone video & telemetry"
        >
          <UploadCloud size={13} />
          <span>New Flight</span>
        </button>

      </div>
    </header>
  );
}

