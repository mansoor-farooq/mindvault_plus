"use client";

import React, { useState } from 'react';
import { useAdminTheme } from '@/context/AdminThemeContext';

// --- Sparkline Chart for KPI Cards ---
export function SparklineChart({ data, color }: { data: number[]; color?: string }) {
  const { palette } = useAdminTheme();
  const strokeColor = color || palette.primary;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const width = 120;
  const height = 40;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / (max - min || 1)) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

// --- Area Chart with Smooth Curves & Gradient Fill ---
export interface AreaChartSeries {
  name: string;
  data: number[];
  color?: string;
}

export function AreaChart({
  series,
  categories,
  height = 280,
}: {
  series: AreaChartSeries[];
  categories: string[];
  height?: number;
}) {
  const { palette } = useAdminTheme();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const allValues = series.flatMap((s) => s.data);
  const maxVal = Math.max(...allValues, 100);
  const minVal = 0;

  const width = 600;
  const chartHeight = height - 40;
  const stepX = width / (categories.length - 1);

  return (
    <div className="w-full space-y-4">
      {/* Legend Header */}
      <div className="flex items-center gap-4 text-xs font-semibold">
        {series.map((s, idx) => {
          const color = s.color || (idx === 0 ? palette.primary : '#00b8d9');
          return (
            <div key={s.name} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span>{s.name}</span>
            </div>
          );
        })}
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${chartHeight}`} className="w-full h-auto overflow-visible">
          <defs>
            {series.map((s, idx) => {
              const color = s.color || (idx === 0 ? palette.primary : '#00b8d9');
              return (
                <linearGradient key={`grad-${idx}`} id={`area-grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.0" />
                </linearGradient>
              );
            })}
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = chartHeight * ratio;
            return (
              <line
                key={ratio}
                x1="0"
                y1={y}
                x2={width}
                y2={y}
                stroke="currentColor"
                className="text-gray-200 dark:text-gray-800"
                strokeDasharray="4 4"
              />
            );
          })}

          {/* Render Series Areas & Lines */}
          {series.map((s, idx) => {
            const color = s.color || (idx === 0 ? palette.primary : '#00b8d9');
            const pointsArr = s.data.map((val, i) => {
              const x = i * stepX;
              const y = chartHeight - ((val - minVal) / (maxVal - minVal)) * (chartHeight - 20) - 10;
              return { x, y };
            });

            // Smooth cubic bezier path string
            const linePath = pointsArr.reduce((acc, point, i) => {
              if (i === 0) return `M ${point.x},${point.y}`;
              const prev = pointsArr[i - 1];
              const cx = (prev.x + point.x) / 2;
              return `${acc} C ${cx},${prev.y} ${cx},${point.y} ${point.x},${point.y}`;
            }, '');

            const areaPath = `${linePath} L ${width},${chartHeight} L 0,${chartHeight} Z`;

            return (
              <g key={s.name}>
                <path d={areaPath} fill={`url(#area-grad-${idx})`} />
                <path
                  d={linePath}
                  fill="none"
                  stroke={color}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data point dots */}
                {pointsArr.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r={hoverIndex === i ? 6 : 4}
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="transition-all duration-150 cursor-pointer"
                    onMouseEnter={() => setHoverIndex(i)}
                    onMouseLeave={() => setHoverIndex(null)}
                  />
                ))}
              </g>
            );
          })}
        </svg>

        {/* Categories X Labels */}
        <div className="flex justify-between mt-2 px-1 text-[11px] font-semibold text-gray-400">
          {categories.map((cat, i) => (
            <span key={cat} className={hoverIndex === i ? 'text-primary font-bold' : ''}>
              {cat}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Bar Chart Component ---
export function BarChart({
  series,
  categories,
  height = 240,
}: {
  series: { name: string; data: number[]; color?: string }[];
  categories: string[];
  height?: number;
}) {
  const { palette } = useAdminTheme();
  const maxVal = Math.max(...series.flatMap((s) => s.data), 10);

  return (
    <div className="w-full space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs font-semibold">
        {series.map((s, idx) => {
          const color = s.color || (idx === 0 ? palette.primary : '#22c55e');
          return (
            <div key={s.name} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span>{s.name}</span>
            </div>
          );
        })}
      </div>

      <div className="flex items-end justify-between gap-2 border-b border-gray-200 dark:border-gray-800 pb-2" style={{ height }}>
        {categories.map((cat, catIdx) => (
          <div key={cat} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
            <div className="w-full flex items-end justify-center gap-1 h-full">
              {series.map((s, sIdx) => {
                const val = s.data[catIdx];
                const heightPercent = (val / maxVal) * 100;
                const color = s.color || (sIdx === 0 ? palette.primary : '#22c55e');
                return (
                  <div
                    key={s.name}
                    className="w-full max-w-[16px] rounded-t-md transition-all duration-300 group-hover:opacity-80 relative"
                    style={{ height: `${heightPercent}%`, backgroundColor: color }}
                  >
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-gray-900 text-white text-[10px] font-bold pointer-events-none z-10">
                      {val}
                    </div>
                  </div>
                );
              })}
            </div>
            <span className="text-[10px] font-semibold text-gray-400 truncate max-w-full">{cat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Donut Chart Component ---
export function DonutChart({
  labels,
  series,
  colors,
}: {
  labels: string[];
  series: number[];
  colors?: string[];
}) {
  const { palette } = useAdminTheme();
  const defaultColors = colors || [palette.primary, '#00b8d9', '#ffab00', '#ff5630', '#22c55e'];
  const total = series.reduce((a, b) => a + b, 0);

  let accumulatedPercent = 0;

  const slices = series.map((val, idx) => {
    const percent = val / total;
    const startAngle = accumulatedPercent * 360;
    accumulatedPercent += percent;
    const endAngle = accumulatedPercent * 360;
    return {
      value: val,
      percent: Math.round(percent * 100),
      label: labels[idx],
      color: defaultColors[idx % defaultColors.length],
      startAngle,
      endAngle,
    };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* SVG Donut */}
      <div className="relative w-44 h-44 flex-shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {slices.map((slice, i) => {
            const strokeDasharray = `${slice.percent * 2.83} 283`;
            const strokeDashoffset = -slices.slice(0, i).reduce((acc, s) => acc + s.percent, 0) * 2.83;

            return (
              <circle
                key={i}
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={slice.color}
                strokeWidth="16"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-500 hover:opacity-85"
              />
            );
          })}
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-xl font-extrabold">{total.toLocaleString()}</span>
          <span className="text-[10px] text-gray-400 font-semibold uppercase">Total</span>
        </div>
      </div>

      {/* Legend details */}
      <div className="flex-1 space-y-2.5 w-full">
        {slices.map((slice) => (
          <div key={slice.label} className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: slice.color }} />
              <span>{slice.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-400">{slice.value}</span>
              <span className="font-bold w-10 text-right">{slice.percent}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Radial Bar Chart ---
export function RadialBarChart({
  percent,
  title,
  subtitle,
}: {
  percent: number;
  title: string;
  subtitle: string;
}) {
  const { palette } = useAdminTheme();
  const strokeDasharray = `${(percent / 100) * 251.2} 251.2`;

  return (
    <div className="flex flex-col items-center text-center space-y-3">
      <div className="relative w-36 h-36 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="10" className="text-gray-100 dark:text-gray-800" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={palette.primary}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            className="transition-all duration-1000"
          />
        </svg>
        <span className="absolute text-2xl font-black">{percent}%</span>
      </div>
      <div>
        <h4 className="text-sm font-bold">{title}</h4>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
    </div>
  );
}
