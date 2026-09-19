import React from 'react';
import { Download, FileBox, FileJson, Share2 } from 'lucide-react';
import { getArtifactUrl } from '../utils/api.js';

export default function ExportToolkit({ jobId }) {
  if (!jobId) return null;

  const handleDownload = (filename) => {
    const url = getArtifactUrl(jobId, filename);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="export-card glass-panel" style={{ marginTop: '16px' }}>
      <div className="card-header">
        <div className="card-title-group">
          <div className="card-icon-pill">
            <Share2 size={14} className="accent-cyan-text" />
          </div>
          <div>
            <span className="card-title">Export & Share</span>
            <span className="card-caption">Download assets for Blender/CAD</span>
          </div>
        </div>
      </div>

      <div className="export-actions" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }}>
        <button 
          className="glow-btn" 
          style={{ width: '100%', justifyContent: 'flex-start', padding: '10px' }}
          onClick={() => handleDownload('reconstructed_pointcloud.ply')}
        >
          <FileBox size={16} />
          <span style={{ marginLeft: '8px' }}>Download 3D Model (.PLY)</span>
        </button>

        <button 
          className="secondary-btn" 
          style={{ width: '100%', justifyContent: 'flex-start', padding: '10px' }}
          onClick={() => handleDownload('camera_trajectory.json')}
        >
          <FileJson size={16} />
          <span style={{ marginLeft: '8px' }}>Download Camera Trajectory (.JSON)</span>
        </button>
      </div>
    </div>
  );
}
