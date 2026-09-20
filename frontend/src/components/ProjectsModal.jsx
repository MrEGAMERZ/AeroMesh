import React, { useEffect, useState } from 'react';
import { Folder, Clock, Layers, ShieldCheck, Download, ExternalLink, X, RefreshCw } from 'lucide-react';
import { getArtifactUrl } from '../utils/api.js';

export default function ProjectsModal({ isOpen, onClose, onLoadProject, activeJobId }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(10, 15, 29, 0.82)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="glass-panel" style={{
        width: '90%',
        maxWidth: '780px',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8'
            }}>
              <Folder size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc', fontWeight: 600 }}>Project Library & Recent Surveys</h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Load past 3D models, download assets, or review NTRO audit reports</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={fetchProjects}
              className="secondary-btn"
              style={{ padding: '6px 12px', fontSize: '12px' }}
              title="Refresh project list"
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
              <span style={{ marginLeft: '6px' }}>Refresh</span>
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content List */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {projects.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
              <Folder size={36} style={{ opacity: 0.4, marginBottom: '10px' }} />
              <p style={{ margin: 0, fontSize: '14px' }}>No past projects found yet.</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Upload a drone or phone video to generate your first 3D model.</p>
            </div>
          )}

          {projects.map((proj) => {
            const isActive = activeJobId === proj.id;
            const dateStr = proj.created_at ? new Date(proj.created_at * 1000).toLocaleString() : 'Recent';
            const points = proj.point_count || proj.vertex_count || 0;
            const audit = proj.quality_audit;

            return (
              <div
                key={proj.id}
                style={{
                  background: isActive ? 'rgba(56, 189, 248, 0.08)' : 'rgba(30, 41, 59, 0.45)',
                  border: isActive ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '14px' }}>{proj.title}</span>
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: '#38bdf8',
                      fontFamily: 'monospace'
                    }}>
                      ID: {proj.id}
                    </span>
                    {isActive && (
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: 'rgba(34, 197, 94, 0.2)',
                        color: '#4ade80',
                        fontWeight: 600
                      }}>
                        ACTIVE IN VIEWPORT
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#94a3b8' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> {dateStr}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Layers size={12} /> {points.toLocaleString()} vertices
                    </span>
                    {audit && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#38bdf8' }}>
                        <ShieldCheck size={12} /> {audit.overall_confidence_pct}% Confidence ({audit.ntro_compliance_tier})
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      onLoadProject(proj.id);
                      onClose();
                    }}
                    className={isActive ? 'secondary-btn' : 'glow-btn'}
                    style={{ padding: '8px 16px', fontSize: '12px' }}
                  >
                    <ExternalLink size={13} style={{ marginRight: '6px' }} />
                    {isActive ? 'Reload' : 'Open in 3D'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
