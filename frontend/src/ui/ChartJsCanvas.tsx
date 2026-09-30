import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

Chart.defaults.color = '#8493a6';
Chart.defaults.font.family = 'IBM Plex Mono';
Chart.defaults.font.size = 10;

export const ChartJsCanvas: React.FC<{ config: any; height?: number; testId?: string }> = ({
  config,
  height = 240,
  testId,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    chart.current = new Chart(ref.current, config);
    return () => {
      chart.current?.destroy();
      chart.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(config)]);

  return (
    <div style={{ height, position: 'relative' }}>
      <canvas ref={ref} data-testid={testId} />
    </div>
  );
};

export function gridScales(xTitle: string, yTitle: string, logX = false) {
  return {
    x: {
      type: logX ? ('logarithmic' as const) : ('linear' as const),
      title: { display: true, text: xTitle },
      grid: { color: '#16222f' },
    },
    y: {
      title: { display: true, text: yTitle },
      grid: { color: '#16222f' },
    },
  };
}
