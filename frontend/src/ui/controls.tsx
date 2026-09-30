import React, { useState } from 'react';
import { formatSI } from '../core/units';

export const Section: React.FC<{ title: string; children: React.ReactNode; right?: React.ReactNode }> = ({
  title,
  children,
  right,
}) => (
  <div className="card">
    <div className="section-title" style={{ justifyContent: 'space-between' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>{title}</span>
      {right}
    </div>
    {children}
  </div>
);

/** Tooltip con la fórmula usada (para la defensa ante el jurado). */
export const Formula: React.FC<{ eq: string; source?: string; note?: string }> = ({ eq, source, note }) => {
  const [open, setOpen] = useState(false);
  return (
    <span className="tt-wrap" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="info-btn" aria-label="fórmula" data-testid="formula-info">
        ƒ
      </button>
      {open && (
        <span className="tt-pop">
          <span className="eq">{eq}</span>
          {note && <span className="tiny muted" style={{ display: 'block', marginBottom: 3 }}>{note}</span>}
          {source && <span className="src">{source}</span>}
        </span>
      )}
    </span>
  );
};

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display?: string;
  testId: string;
}
export const Slider: React.FC<SliderProps> = ({ label, value, min, max, step, onChange, display, testId }) => (
  <div className="field">
    <div className="field-head">
      <span className="field-label">{label}</span>
      <span className="field-val">{display ?? value}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      data-testid={testId}
    />
  </div>
);

interface SelectProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  testId: string;
}
export const Select: React.FC<SelectProps> = ({ label, value, options, onChange, testId }) => (
  <div className="field">
    <div className="field-head">
      <span className="field-label">{label}</span>
    </div>
    <select value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
);

export const Toggle: React.FC<{ label: string; value: boolean; onChange: (v: boolean) => void; testId: string }> = ({
  label,
  value,
  onChange,
  testId,
}) => (
  <div className="field" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span className="field-label">{label}</span>
    <button
      onClick={() => onChange(!value)}
      data-testid={testId}
      className="btn sm"
      style={{
        background: value ? 'rgba(53,224,196,0.14)' : 'var(--elev)',
        color: value ? 'var(--accent)' : 'var(--muted)',
        borderColor: value ? 'rgba(53,224,196,0.3)' : 'var(--line)',
        minWidth: 66,
      }}
    >
      {value ? 'ON' : 'OFF'}
    </button>
  </div>
);

interface StatProps {
  label: string;
  value: string;
  cls?: 'accent' | 'amber' | '';
  eq?: string;
  source?: string;
  note?: string;
  testId?: string;
}
export const Stat: React.FC<StatProps> = ({ label, value, cls = '', eq, source, note, testId }) => (
  <div className="stat">
    <div className="k">
      {label}
      {eq && <Formula eq={eq} source={source} note={note} />}
    </div>
    <div className={`v ${cls}`} data-testid={testId}>
      {value}
    </div>
  </div>
);

/** Stat cuyo valor se formatea en SI. */
export const StatSI: React.FC<{
  label: string;
  value: number;
  unit: string;
  cls?: 'accent' | 'amber' | '';
  eq?: string;
  source?: string;
  note?: string;
  testId?: string;
}> = ({ label, value, unit, cls, eq, source, note, testId }) => (
  <Stat label={label} value={formatSI(value, unit)} cls={cls} eq={eq} source={source} note={note} testId={testId} />
);
