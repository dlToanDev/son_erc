import { useState } from 'react';
import type { ChartPoint } from '@debtflow/shared';

/** Biểu đồ cột SVG thuần — nâng cấp hiệu ứng hover, trục Y và tooltip. */
export default function BarChart({
  data,
  height = 220,
  formatValue,
}: {
  data: ChartPoint[];
  height?: number;
  formatValue?: (v: number) => string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data.length) return <p className="placeholder">Không có dữ liệu trong kỳ.</p>;

  const width = Math.max(360, data.length * 60);
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = 32;
  const paddingLeft = 40;
  const paddingBottom = 34;
  const chartH = height - paddingBottom;
  const availableW = width - paddingLeft - 20;
  const gap = Math.max(12, (availableW - data.length * barW) / (data.length + 1));

  // Tọa độ trục Y mốc (0%, 50%, 100%)
  const yGridLines = [0, 0.5, 1];

  return (
    <div className="chart-scroll" style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
      <svg width={width} height={height} role="img" aria-label="Biểu đồ chi phí nhập">
        {/* Đường lưới ngang trục Y */}
        {yGridLines.map((ratio) => {
          const yVal = chartH - ratio * (chartH - 24);
          const valLabel = formatValue ? formatValue(max * ratio) : Math.round(max * ratio);
          return (
            <g key={ratio}>
              <line
                x1={paddingLeft}
                y1={yVal}
                x2={width - 10}
                y2={yVal}
                stroke="#e2e8f0"
                strokeDasharray={ratio === 0 ? undefined : '4 4'}
                strokeWidth={1}
              />
              {/* Giá trị tượng trưng bên trái */}
              <text
                x={paddingLeft - 8}
                y={yVal + 3}
                textAnchor="end"
                fontSize="9"
                fill="#94a3b8"
                fontWeight="500"
              >
                {ratio === 0 ? '0' : valLabel}
              </text>
            </g>
          );
        })}

        {/* Các cột dữ liệu */}
        {data.map((d, i) => {
          const h = Math.max(2, Math.round((d.value / max) * (chartH - 24)));
          const x = paddingLeft + gap + i * (barW + gap);
          const y = chartH - h;
          const isHovered = hoveredIndex === i;

          return (
            <g
              key={d.label}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Vùng cảm ứng hover rộng hơn */}
              <rect
                x={x - gap / 2}
                y={0}
                width={barW + gap}
                height={chartH}
                fill="transparent"
              />
              {/* Cột chính */}
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={4}
                fill={isHovered ? 'var(--df-primary-bright, #3b82f6)' : 'var(--df-primary, #1e40af)'}
                style={{ transition: 'all 0.15s ease' }}
              />
              {/* Giá trị trên đầu cột nếu đang hover */}
              {isHovered && (
                <text
                  x={x + barW / 2}
                  y={Math.max(12, y - 6)}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="#1e293b"
                >
                  {formatValue ? formatValue(d.value) : d.value}
                </text>
              )}
              {/* Nhãn trục X bên dưới */}
              <text
                x={x + barW / 2}
                y={chartH + 16}
                textAnchor="middle"
                fontSize="10"
                fill={isHovered ? '#1e293b' : '#64748b'}
                fontWeight={isHovered ? '700' : '500'}
              >
                {d.label.length > 8 ? d.label.slice(5) : d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
