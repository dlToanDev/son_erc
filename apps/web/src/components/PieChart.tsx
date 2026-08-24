import { useState } from 'react';

export interface PieChartData {
  label: string;
  value: number;
  color?: string;
}

const DEFAULT_COLORS = [
  '#2563eb', // Xanh dương chủ đạo
  '#16a34a', // Xanh lá
  '#dc2626', // Đỏ
  '#f59e0b', // Cam/Vàng
  '#8b5cf6', // Tím
  '#06b6d4', // Cyan
  '#64748b', // Xám
];

export default function PieChart({
  data,
  size = 220,
  innerRadiusPercent = 0.55,
  formatValue,
}: {
  data: PieChartData[];
  size?: number;
  innerRadiusPercent?: number;
  formatValue?: (v: number) => string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const validData = data.filter((d) => d.value > 0);
  const total = validData.reduce((acc, d) => acc + d.value, 0);

  if (!validData.length || total === 0) {
    return <p className="placeholder">Không có dữ liệu biểu đồ.</p>;
  }

  const strokeWidth = (size / 2) * (1 - innerRadiusPercent);
  const radius = size / 2 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let accumulatedPercent = 0;

  return (
    <div className="pie-chart-container" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {validData.map((item, index) => {
            const percent = item.value / total;
            const strokeDasharray = `${percent * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedPercent * circumference;
            accumulatedPercent += percent;

            const sliceColor = item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
            const isHovered = hoveredIndex === index;

            return (
              <circle
                key={item.label}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={sliceColor}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                style={{
                  transition: 'all 0.2s ease-in-out',
                  cursor: 'pointer',
                  transformOrigin: 'center',
                  transform: 'rotate(-90deg)',
                  opacity: hoveredIndex !== null && !isHovered ? 0.6 : 1,
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <title>{`${item.label}: ${formatValue ? formatValue(item.value) : item.value} (${(percent * 100).toFixed(1)}%)`}</title>
              </circle>
            );
          })}
        </svg>

        {/* Center label inside donut */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: size,
            height: size,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            textAlign: 'center',
            padding: '1rem',
          }}
        >
          {hoveredIndex !== null ? (
            <>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                {validData[hoveredIndex].label}
              </span>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                {formatValue
                  ? formatValue(validData[hoveredIndex].value)
                  : validData[hoveredIndex].value}
              </span>
              <span style={{ fontSize: '0.75rem', color: DEFAULT_COLORS[hoveredIndex % DEFAULT_COLORS.length], fontWeight: 700 }}>
                {((validData[hoveredIndex].value / total) * 100).toFixed(1)}%
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>TỔNG CỘNG</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                {formatValue ? formatValue(total) : total}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <ul className="pie-legend" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: '160px' }}>
        {validData.map((item, index) => {
          const sliceColor = item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
          const isHovered = hoveredIndex === index;
          const percent = ((item.value / total) * 100).toFixed(1);

          return (
            <li
              key={item.label}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.85rem',
                padding: '0.35rem 0.6rem',
                borderRadius: '6px',
                background: isHovered ? '#f1f5f9' : 'transparent',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: sliceColor,
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: '#334155', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.label}
                </span>
              </div>
              <span style={{ fontWeight: 600, color: '#0f172a', marginLeft: '0.5rem' }}>{percent}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
