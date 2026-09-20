import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import Viewer3D from './components/Viewer3D.jsx';
import FlightMap from './components/FlightMap.jsx';
import MeasurementTools from './components/MeasurementTools.jsx';
import PipelineStatus from './components/PipelineStatus.jsx';
import UploadModal from './components/UploadModal.jsx';
import VideoPane from './components/VideoPane.jsx';
import SyncController from './components/SyncController.jsx';
import QualityBadge from './components/QualityBadge.jsx';
import ExportToolkit from './components/ExportToolkit.jsx';
import { createJob, getJobStatus, getArtifactUrl } from './utils/api.js';
import './App.css';

export default function App() {
  const [activeModel, setActiveModel] = useState('demo');
  const [flightData, setFlightData] = useState(null);
  const [activeWaypointIndex, setActiveWaypointIndex] = useState(0);

  // Sync state
  const [currentVideoTime, setCurrentVideoTime] = useState(0);

  // Measurement State
  const [measurementMode, setMeasurementMode] = useState(false);
  const [measuredPoints, setMeasuredPoints] = useState([]);

  // Upload Modal & Processing State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processStage, setProcessStage] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobInfo, setJobInfo] = useState(null);

  const handleAddMeasurementPoint = (pt) => {
    if (measuredPoints.length >= 2) {
      setMeasuredPoints([pt]);
    } else {
      setMeasuredPoints((prev) => [...prev, pt]);
    }
  };

  const handleClearMeasurementPoints = () => {
    setMeasuredPoints([]);
  };

  const handleStartProcessing = async ({ videoFile, telemetryFile, engine, computeBackend, fps, masking }) => {
    setActiveModel(engine);
    setIsProcessing(true);
    setProcessProgress(0);
    setProcessStage('Uploading files to backend...');
    setShowSidebar(true);   // always show sidebar so user can see progress
    setFlightData(null);    // clear previous model
    setMeasuredPoints([]);  // clear previous measurements
    
    try {
      const result = await createJob(videoFile, telemetryFile, engine, computeBackend, fps, masking);
      setJobId(result.job_id);
    } catch (err) {
      setIsProcessing(false);
      setProcessStage('Upload failed — check the backend is running on port 8000');
      console.error("Job creation error:", err);
      alert("Upload failed: " + err.message + "\n\nMake sure the backend is running:\n  cd backend && uvicorn app:app --reload");
    }
  };

  // Polling for job status
  useEffect(() => {
    let interval;
    if (jobId && isProcessing) {
      interval = setInterval(async () => {
        try {
          const statusResult = await getJobStatus(jobId);
          setJobInfo(statusResult);
          
          if (statusResult.status === 'processing' || statusResult.status === 'queued') {
            setProcessProgress(statusResult.progress || 0);
            setProcessStage(statusResult.current_stage || `Status: ${statusResult.status}`);
          } else if (statusResult.status === 'completed') {
            setIsProcessing(false);
            
            // Reconstruct FlightData structure for the components
            const summary = statusResult.summary || {};
            
            // We need to fetch the camera_trajectory.json to populate flightData.camera_poses and flightData.trajectory
            try {
               const trajRes = await fetch(getArtifactUrl(jobId, "camera_trajectory.json"));
               let poses = [];
               if (trajRes.ok) {
                 const trajData = await trajRes.json();
                 poses = trajData.cameras || [];
               }
               
               // Load up the data
               setFlightData({
                  ply_url: getArtifactUrl(jobId, "reconstructed_pointcloud.ply"),
                  camera_poses: poses,
                  trajectory: [], // Ideally we'd map points here, but keeping minimal for now
                  quality_report: {
                    status: 'success',
                    point_count: summary.point_count,
                    elapsed_seconds: summary.elapsed_seconds,
                    telemetry_available: summary.flight_duration_s != null,
                    flight_duration: summary.flight_duration_s,
                    mean_altitude: summary.mean_altitude_m
                  }
               });
               
            } catch (fetchErr) {
               console.error("Failed to fetch camera trajectory:", fetchErr);
            }
          } else if (statusResult.status === 'failed') {
            setIsProcessing(false);
            alert("Job failed: " + statusResult.error);
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [jobId, isProcessing]);

  const handleExport = () => {
    if (!jobId) {
      alert("No active job to export");
      return;
    }
    window.open(getArtifactUrl(jobId, "reconstructed_pointcloud.ply"), "_blank");
  };

  return (
    <div className="app-layout">
      {/* Top Navigation */}
      <Navbar
        activeModel={activeModel}
        onModelChange={setActiveModel}
        onOpenUpload={() => setIsUploadOpen(true)}
        onExport={handleExport}
        isProcessing={isProcessing}
        showSidebar={showSidebar}
        onToggleSidebar={() => setShowSidebar((s) => !s)}
      />

      {/* Main Workspace: 3D Viewport + GIS Side Panel */}
      <main className="main-workspace">
        <div className="viewport-section" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
          
          {/* Two-Pane Layout */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div style={{ flex: 1, borderRight: '1px solid #222' }}>
              <VideoPane 
                videoUrl={null} // We aren't serving the actual video file right now, but we could!
                onTimeUpdate={setCurrentVideoTime} 
              />
            </div>
            <div style={{ flex: 1 }}>
              <SyncController cameraPoses={flightData?.camera_poses} currentVideoTime={currentVideoTime}>
                {(activePose) => (
                  <Viewer3D
                    flightData={flightData}
                    activePose={activePose}
                    measurementMode={measurementMode}
                    measuredPoints={measuredPoints}
                    onAddMeasurementPoint={handleAddMeasurementPoint}
                  />
                )}
              </SyncController>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #222' }}>
            <QualityBadge report={flightData?.quality_report} />
          </div>

          {/* Processing Overlay if job running */}
          {isProcessing && (
            <div className="processing-overlay glass-panel">
              <div className="spinner-orbit" />
              <div className="processing-info">
                <div className="processing-title">Processing Single-Pass Flight Pass</div>
                <div className="processing-stage font-mono">{processStage}</div>
                {jobInfo && (
                    <div className="processing-summary-grid font-mono" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px', fontSize: '0.85rem', color: '#a1a1aa'}}>
                      <div>Compute: <span style={{color: '#fff'}}>{jobInfo.compute_device_name || "Unknown"}</span></div>
                      <div>Engine: <span style={{color: '#fff'}}>{jobInfo.model?.toUpperCase()}</span></div>
                      <div>VRAM: <span style={{color: '#fff'}}>{jobInfo.vram_used_gb || 0} / {jobInfo.vram_total_gb || 0} GB</span></div>
                      <div>Status: <span style={{color: '#fff', textTransform: 'capitalize'}}>{jobInfo.status}</span></div>
                    </div>
                )}
                {jobInfo?.status === "queued" && (
                    <div style={{color: '#ffc107', fontSize: '0.85rem', marginTop: '12px'}}>
                        Queue Position: {jobInfo.queue_position}
                    </div>
                )}
                <div className="progress-bar-track" style={{marginTop: '12px'}}>
                  <div className="progress-bar-fill" style={{ width: `${processProgress}%` }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Telemetry & GIS Analysis Sidebar (collapsible) */}
        {showSidebar && (
          <aside className="sidebar-section">
            <FlightMap
              trajectory={flightData?.trajectory || []}
              activeIndex={activeWaypointIndex}
              onSelectWaypoint={setActiveWaypointIndex}
            />

            <MeasurementTools
              measurementMode={measurementMode}
              setMeasurementMode={setMeasurementMode}
              points={measuredPoints}
              onClearPoints={handleClearMeasurementPoints}
            />

            {jobInfo?.status === 'completed' && (
              <ExportToolkit jobId={jobInfo.id} />
            )}

            <PipelineStatus job={jobInfo} />
          </aside>
        )}
      </main>

      {/* Ingest Flight Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onStartProcessing={handleStartProcessing}
      />
    </div>
  );
}
