import React from 'react';
import { Building2, Mountain, Route, Check, Sparkles } from 'lucide-react';

export default function SampleSelector({ activeSampleId, onSelectSample }) {
  const scenarios = [
    {
      id: 'urban-quadrant',
      title: 'Urban Infrastructure',
      tag: 'Oblique Pass',
      icon: Building2,
      points: '42.5k pts',
      alt: '45m AGL',
      desc: 'Dynamic vehicle masking & facade relief'
    },
    {
      id: 'rural-quarry',
      title: 'Open-Cast Quarry',
      tag: 'Nadir Grid',
      icon: Mountain,
      points: '56.0k pts',
      alt: '68m AGL',
      desc: 'Stepped excavation benches & volume tracking'
    },
    {
      id: 'bridge-span',
      title: 'Highway Viaduct',
      tag: 'Linear Pass',
      icon: Route,
      points: '39.8k pts',
      alt: '35m AGL',
      desc: 'Linear corridor with specular suppression'
    }
  ];

  return (
    <div className="scenario-selector-container">
      <div className="scenario-label-badge">
        <Sparkles size={12} className="accent-cyan-text" />
        <span>Benchmark Flights:</span>
      </div>
      <div className="scenario-pills">
        {scenarios.map((sc, index) => {
          const Icon = sc.icon;
          const isActive = sc.id === activeSampleId;
          return (
            <button
              key={sc.id}
              style={{ animationDelay: `${index * 80}ms` }}
              className={`scenario-pill ${isActive ? 'active' : ''}`}
              onClick={() => onSelectSample(sc.id)}
            >
              <div className="scenario-icon-box">
                <Icon size={16} className="scenario-icon" />
              </div>
              <div className="scenario-info">
                <div className="sc-header-row">
                  <span className="sc-title">{sc.title}</span>
                  <span className="sc-meta font-mono">{sc.alt}</span>
                </div>
                <span className="sc-sub">{sc.desc}</span>
              </div>
              {isActive && (
                <div className="active-indicator-badge">
                  <Check size={12} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
