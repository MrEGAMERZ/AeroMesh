import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import Viewer3D from './components/Viewer3D.jsx';
import FlightMap from './components/FlightMap.jsx';
import MeasurementTools from './components/MeasurementTools.jsx';
import PipelineStatus from './components/PipelineStatus.jsx';
import SampleSelector from './components/SampleSelector.jsx';
import UploadModal from './components/UploadModal.jsx';
import { generateScenarioDataset } from './utils/datasets.js';
import './App.css';

export default function App() {
  const [activeModel, setActiveModel] = useState('vggt');
  const [activeSampleId, setActiveSampleId] = useState('urban-quadrant');
  const [flightData, setFlightData] = useState(null);
  const [activeWaypointIndex, setActiveWaypointIndex] = useState(0);

  // Measurement State
  const [measurementMode, setMeasurementMode] = useState(false);
  const [measuredPoints, setMeasuredPoints] = useState([]);

  // Upload Modal & Processing State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processStage, setProcessStage] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);

  // Load dataset when sample changes
  useEffect(() => {
    const data = generateScenarioDataset(activeSampleId);
    setFlightData(data);
    setMeasuredPoints([]);
    setActiveWaypointIndex(0);
  }, [activeSampleId]);

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

  const handleStartProcessing = ({ videoFile, telemetryFile, engine, fps, masking }) => {
    setActiveModel(engine);
    setIsProcessing(true);
    setProcessProgress(10);
    setProcessStage(`Ingesting ${videoFile} & filtering blur at ${fps} FPS...`);

    setTimeout(() => {
      setProcessProgress(35);
      setProcessStage(masking ? 'SAM 2 dynamic object masking active...' : 'Skipping dynamic masking...');
    }, 1200);

    setTimeout(() => {
      setProcessProgress(70);
      setProcessStage(`Feed-forward transformer inference (${engine.toUpperCase()})...`);
    }, 2500);

    setTimeout(() => {
      setProcessProgress(90);
      setProcessStage('Georeferencing & Poisson surface meshing...');
    }, 3800);

    setTimeout(() => {
      setProcessProgress(100);
      setProcessStage('Reconstruction Complete!');
      // Switch to fresh sample dataset
      setActiveSampleId(activeSampleId === 'urban-quadrant' ? 'rural-quarry' : 'urban-quadrant');
      setTimeout(() => {
        setIsProcessing(false);
      }, 800);
    }, 4800);
  };

  const handleExport = () => {
    // Generate downloadable OBJ
    if (!flightData) return;
    const lines = ["# SIH26158 Georeferenced Drone Reconstruction OBJ"];
    flightData.points.slice(0, 1000).forEach((p) => {
      lines.push(`v ${p[0].toFixed(4)} ${p[2].toFixed(4)} ${p[1].toFixed(4)}`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AeroMesh3D_${activeSampleId}_model.obj`;
    a.click();
    URL.revokeObjectURL(url);
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
        activeSampleId={activeSampleId}
        onSelectSample={setActiveSampleId}
        showSidebar={showSidebar}
        onToggleSidebar={() => setShowSidebar((s) => !s)}
      />

      {/* Main Workspace: 3D Viewport + GIS Side Panel */}
      <main className="main-workspace">
        <div className="viewport-section">
          <Viewer3D
            flightData={flightData}
            measurementMode={measurementMode}
            onAddMeasurementPoint={handleAddMeasurementPoint}
          />

          {/* Processing Overlay if job running */}
          {isProcessing && (
            <div className="processing-overlay glass-panel">
              <div className="spinner-orbit" />
              <div className="processing-info">
                <div className="processing-title">Processing Single-Pass Flight Pass</div>
                <div className="processing-stage font-mono">{processStage}</div>
                <div className="progress-bar-track">
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

            <PipelineStatus />
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
