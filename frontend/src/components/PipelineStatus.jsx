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
import QualityBadge from './QualityBadge.jsx';

export default function PipelineStatus({ job }) {
  if (!job) return null;

  if (job.status === 'queued') {
    return (
      <div className="pipeline-card glass-panel" style={{ padding: 16 }}>
        <div style={{ color: '#7ecfff', fontWeight: 'bold' }}>
          Waiting in queue (position: {job.queue_position})
        </div>
      </div>
    );
  }

  const stages = [
    { id: 'ingest', name: 'Ingestion & Blur Filter', desc: 'Laplacian variance filter (dropped blur)', stats: '48 frames / 6 dropped', duration: '0.8s' },
    { id: 'masking', name: 'Dynamic Object Masking', desc: 'SAM 2 video segmentation for vehicles', stats: '4 vehicles isolated', duration: '1.4s' },
    { id: 'transformer', name: 'Feed-Forward 3D Transformer', desc: 'Direct geometry regression (no SfM)', stats: '42.5k 3D points', duration: '2.6s' },
    { id: 'georef', name: 'GPS/IMU Scale Anchoring', desc: 'SVD rigid alignment to flight track', stats: 'Scale 1.042 (WGS84)', duration: '0.3s' },
    { id: 'mesh', name: 'Screened Poisson Meshing', desc: 'Watertight surface & UV texture pass', stats: '28.4k polygons', duration: '1.1s' }
  ];

  if (job.status === 'processing') {
    return (
      <div className="pipeline-card glass-panel">
        <div className="card-header">
          <div className="card-title-group">
            <div className="card-icon-pill">
              <Sparkles size={14} className="accent-cyan-text" />
            </div>
            <div>
              <span className="card-title">Reconstruction Pipeline</span>
              <span className="card-caption">Processing...</span>
            </div>
          </div>
        </div>

        <div className="pipeline-steps">
          {stages.map((stage, idx) => (
            <div key={stage.id} className="pipeline-step-item" style={{ animationDelay: `${idx * 70}ms` }}>
              <div className="step-connector-column">
                <div className="step-icon-circle completed">
                  <Clock size={11} strokeWidth={3} />
                </div>
                {idx < stages.length - 1 && <div className="step-connector-line completed" />}
              </div>
              <div className="step-content">
                <div className="step-top-row">
                  <span className="step-title">{stage.name}</span>
                </div>
                <div className="step-desc">{stage.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // completed
  return (
    <div className="pipeline-card glass-panel">
      <div className="card-header">
        <div className="card-title-group">
          <div className="card-icon-pill">
            <Check size={14} className="accent-green-text" />
          </div>
          <div>
            <span className="card-title">Job Completed</span>
            <span className="card-caption">Ready for analysis</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <QualityBadge report={job.report} />
      </div>
    </div>
  );
}
