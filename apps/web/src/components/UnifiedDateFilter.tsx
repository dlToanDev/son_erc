import { useState } from 'react';
import { Calendar } from 'lucide-react';

export type DatePreset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

interface UnifiedDateFilterProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

export const getPresetDates = (preset: DatePreset): { from: string; to: string } => {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth();

  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

  if (preset === 'today') {
    const todayStr = fmt(d);
    return { from: todayStr, to: todayStr };
  }

  if (preset === 'week') {
    const day = d.getDay();
    const diffToMon = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d);
    mon.setDate(diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { from: fmt(mon), to: fmt(sun) };
  }

  if (preset === 'month') {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    return { from: fmt(first), to: fmt(last) };
  }

  if (preset === 'quarter') {
    const q = Math.floor(month / 3);
    const first = new Date(year, q * 3, 1);
    const last = new Date(year, q * 3 + 3, 0);
    return { from: fmt(first), to: fmt(last) };
  }

  if (preset === 'year') {
    const first = new Date(year, 0, 1);
    const last = new Date(year, 11, 31);
    return { from: fmt(first), to: fmt(last) };
  }

  return { from: fmt(new Date(year, month, 1)), to: fmt(d) };
};

export default function UnifiedDateFilter({ from, to, onChange }: UnifiedDateFilterProps) {
  const [activePreset, setActivePreset] = useState<DatePreset>('month');

  const handlePresetChange = (preset: DatePreset) => {
    setActivePreset(preset);
    if (preset !== 'custom') {
      const dates = getPresetDates(preset);
      onChange(dates.from, dates.to);
    }
  };

  return (
    <div className="unified-date-filter" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      <div className="udf-preset" style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: '0.2rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
        <Calendar size={15} style={{ margin: '0 0.4rem', color: '#64748b' }} />
        <select
          value={activePreset}
          onChange={(e) => handlePresetChange(e.target.value as DatePreset)}
          style={{
            border: 'none',
            background: 'transparent',
            fontSize: '0.88rem',
            fontWeight: 600,
            color: '#1e293b',
            padding: '0.25rem 0.4rem',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="today">Hôm nay (1 ngày)</option>
          <option value="week">Tuần này</option>
          <option value="month">Tháng này</option>
          <option value="quarter">Quý này</option>
          <option value="year">Năm nay</option>
          <option value="custom">📅 Tùy chọn ngày</option>
        </select>
      </div>

      <div className="udf-range" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <input
          type="date"
          value={from}
          onChange={(e) => {
            setActivePreset('custom');
            onChange(e.target.value, to);
          }}
          style={{
            padding: '0.35rem 0.6rem',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontSize: '0.88rem',
            fontWeight: 600,
            color: '#0f172a',
            background: '#fff',
          }}
        />
        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>đến</span>
        <input
          type="date"
          value={to}
          onChange={(e) => {
            setActivePreset('custom');
            onChange(from, e.target.value);
          }}
          style={{
            padding: '0.35rem 0.6rem',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontSize: '0.88rem',
            fontWeight: 600,
            color: '#0f172a',
            background: '#fff',
          }}
        />
      </div>
    </div>
  );
}
