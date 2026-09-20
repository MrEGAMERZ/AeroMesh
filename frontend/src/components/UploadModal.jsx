import React, { useState, useEffect } from 'react';
import { getComputeBackends } from '../utils/api.js';
import { X, UploadCloud, FileVideo, FileSpreadsheet, Play, Sparkles, CheckCircle2 } from 'lucide-react';

export default function UploadModal({ isOpen, onClose, onStartProcessing }) {
  const [videoFile, setVideoFile] = useState(null);
  const [telemetryFile, setTelemetryFile] = useState(null);
  const [computeBackend, setComputeBackend] = useState('');
  const [backendsList, setBackendsList] = useState([]);
  const [engine, setEngine] = useState('genai_chunk');
  const [fps, setFps] = useState('4.0');
  const [masking, setMasking] = useState(true);

  useEffect(() => {
    if (isOpen) {
      getComputeBackends().then(data => {
        setBackendsList(data.compute_backends || []);
        const avail = data.compute_backends.find(b => b.status === "available");
        if (avail) {
            setComputeBackend(avail.id);
            setEngine(avail.engines[0]);
        }
      }).catch(err => console.error("Failed to load compute backends:", err));
    }
  }, [isOpen]);

  if (!isOpen) return null;


  const handleSubmit = (e) => {
    e.preventDefault();
    if (!videoFile) {
        alert("Please provide a Video file.");
        return;
    }
    onStartProcessing({
      videoFile,
      telemetryFile,
      engine,
      computeBackend,
      fps: parseFloat(fps),
      masking
    });
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-panel">
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <UploadCloud size={20} className="accent-cyan-text" />
            </div>
            <div>
              <h3 className="modal-title">Ingest Drone Flight Pass</h3>
              <p className="modal-subtitle">Feed-forward single-pass 3D model generation</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="upload-form">
          {/* Drag and Drop Video */}
          <div className={`upload-dropzone ${videoFile ? 'has-file' : ''}`}>
            <input 
              type="file" 
              accept="video/*" 
              id="video-upload-input" 
              className="hidden-file-input"
              onChange={(e) => setVideoFile(e.target.files[0])}
            />
            <label htmlFor="video-upload-input" className="dropzone-label">
              <div className="dropzone-icon-circle">
                <FileVideo size={24} className="dropzone-icon" />
              </div>
              {videoFile ? (
                <div className="selected-filename-box">
                  <CheckCircle2 size={16} className="file-check-icon" />
                  <span className="selected-filename">{videoFile.name}</span>
                </div>
              ) : (
                <>
                  <div className="dropzone-main-text">Drop Drone Flight Video (MP4 / MOV)</div>
                  <div className="dropzone-sub-text">Single-pass nadir or oblique corridor capture</div>
                </>
              )}
            </label>
          </div>

          {/* Drag and Drop Telemetry */}
          <div className={`upload-dropzone ${telemetryFile ? 'has-file' : ''}`}>
            <input 
              type="file" 
              accept=".csv,.json,.srt" 
              id="telem-upload-input" 
              className="hidden-file-input"
              onChange={(e) => setTelemetryFile(e.target.files[0])}
            />
            <label htmlFor="telem-upload-input" className="dropzone-label">
              <div className="dropzone-icon-circle">
                <FileSpreadsheet size={24} className="dropzone-icon" />
              </div>
              {telemetryFile ? (
                <div className="selected-filename-box">
                  <CheckCircle2 size={16} className="file-check-icon" />
                  <span className="selected-filename">{telemetryFile.name}</span>
                </div>
              ) : (
                <>
                  <div className="dropzone-main-text">Drop Telemetry Flight Log (CSV / JSON / DJI SRT)</div>
                  <div className="dropzone-sub-text">Fuses GPS coordinates, barometric altitude, and IMU attitudes</div>
                </>
              )}
            </label>
          </div>

          {/* Pipeline Configuration Parameters */}
          <div className="form-row">
            <div className="form-group">
              <label className="input-label">Compute Backend (WHERE)</label>
              <select 
                value={computeBackend} 
                onChange={(e) => {
                  setComputeBackend(e.target.value);
                  const b = backendsList.find(x => x.id === e.target.value);
                  if (b && !b.engines.includes(engine)) setEngine(b.engines[0]);
                }} 
                className="form-select"
              >
                {backendsList.map(b => (
                  <option key={b.id} value={b.id} disabled={b.status !== "available"}>
                    {b.name} [{b.device}] {b.status !== "available" ? "(Unavailable)" : ""}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label className="input-label">Reconstruction Engine (HOW)</label>
              <select value={engine} onChange={(e) => setEngine(e.target.value)} className="form-select">
                {(backendsList.find(b => b.id === computeBackend)?.engines || []).map(eng => {
                  const labels = {
                    genai_chunk: '🤖 Generative AI (Chunk-by-Chunk)',
                    sfm: '🔬 SfM (Classical Sparse)',
                    colmap: '📐 COLMAP (Dense CPU)',
                    vggsfm: '🤖 VGGSfM (AI · GPU)',
                    vggt: '🤖 VGGT (AI · GPU)',
                    mapanything: '🌍 MapAnything (AI · GPU)',
                    demo: '🧪 Demo (Synthetic Test)',
                  };
                  return (
                    <option key={eng} value={eng}>{labels[eng] || eng.toUpperCase()}</option>
                  );
                })}
              </select>
            </div>
          </div>
          
          <div className="form-checkbox-row">
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={masking} 
                onChange={(e) => setMasking(e.target.checked)}
                className="styled-checkbox"
              />
              <span className="checkbox-text">
                <strong>Enable SAM 2 Dynamic Object Masking</strong>
                <small>Removes moving vehicular traffic & pedestrians from terrain geometry</small>
              </span>
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="glow-btn">
              <Play size={14} fill="currentColor" />
              <span>Start 3D Reconstruction</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
