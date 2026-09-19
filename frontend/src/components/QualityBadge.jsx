// Displays reconstruction quality indicators from the API quality_report
import React from 'react';

export default function QualityBadge({ report }) {
  if (!report) return null;
  const confidence = report.confidence ?? 'N/A';
  const color = confidence === 'high' ? '#22c55e' : confidence === 'medium' ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '8px 12px', background: '#0f0f1a', borderRadius: 6, fontSize: 11, fontFamily: 'monospace' }}>
      <span style={{ color: '#888' }}>Points: </span><span style={{ color: '#7ecfff' }}>{report.point_count?.toLocaleString() ?? '—'}</span>
      <span style={{ color: '#888' }}>Runtime: </span><span style={{ color: '#7ecfff' }}>{report.elapsed_seconds != null ? `${report.elapsed_seconds.toFixed(1)}s` : '—'}</span>
      <span style={{ color: '#888' }}>Frames used: </span><span style={{ color: '#7ecfff' }}>{report.frames_used ?? '—'}</span>
      {report.alignment_residual != null && (
        <><span style={{ color: '#888' }}>Alignment err: </span><span style={{ color: '#f59e0b' }}>{report.alignment_residual.toFixed(3)}m</span></>
      )}
      {!report.telemetry_available && (
        <span style={{ color: '#ef4444' }}>⚠ No telemetry — relative scale only</span>
      )}
    </div>
  );
}
