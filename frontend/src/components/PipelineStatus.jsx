import React from 'react';
import { 
  Clock, 
  Cpu, 
  EyeOff, 
  Layers, 
  Globe, 
  Sparkles,
  Check
} from 'lucide-react';

export default function PipelineStatus() {
  const stages = [
    {
      id: 'ingest',
      name: 'Ingestion & Blur Filter',
      desc: 'Laplacian variance filter (dropped blur)',
      icon: Clock,
      stats: '48 frames / 6 dropped',
      duration: '0.8s'
    },
    {
      id: 'masking',
      name: 'Dynamic Object Masking',
      desc: 'SAM 2 video segmentation for vehicles',
      icon: EyeOff,
      stats: '4 vehicles isolated',
      duration: '1.4s'
    },
    {
      id: 'transformer',
      name: 'Feed-Forward 3D Transformer',
      desc: 'Direct geometry regression (no SfM)',
      icon: Cpu,
      stats: '42.5k 3D points',
      duration: '2.6s'
    },
    {
      id: 'georef',
      name: 'GPS/IMU Scale Anchoring',
      desc: 'SVD rigid alignment to flight track',
      icon: Globe,
      stats: 'Scale 1.042 (WGS84)',
      duration: '0.3s'
    },
    {
      id: 'mesh',
      name: 'Screened Poisson Meshing',
      desc: 'Watertight surface & UV texture pass',
      icon: Layers,
      stats: '28.4k polygons',
      duration: '1.1s'
    }
  ];

  return (
    <div className="pipeline-card glass-panel">
      <div className="card-header">
        <div className="card-title-group">
          <div className="card-icon-pill">
            <Sparkles size={14} className="accent-cyan-text" />
          </div>
          <div>
            <span className="card-title">Reconstruction Pipeline</span>
            <span className="card-caption">Zero-Bundle-Adjustment Pass</span>
          </div>
        </div>
        <span className="total-time-badge font-mono">Total: 6.2s</span>
      </div>

      <div className="pipeline-steps">
        {stages.map((stage, idx) => {
          return (
            <div key={stage.id} className="pipeline-step-item" style={{ animationDelay: `${idx * 70}ms` }}>
              <div className="step-connector-column">
                <div className="step-icon-circle completed">
                  <Check size={11} strokeWidth={3} />
                </div>
                {idx < stages.length - 1 && <div className="step-connector-line completed" />}
              </div>

              <div className="step-content">
                <div className="step-top-row">
                  <span className="step-title">{stage.name}</span>
                  <span className="step-duration font-mono">{stage.duration}</span>
                </div>
                <div className="step-desc">{stage.desc}</div>
                <div className="step-stats font-mono">{stage.stats}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
