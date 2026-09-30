import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import uPlot from 'uplot';

interface Props {
  data: uPlot.AlignedData;
  opts: Omit<uPlot.Options, 'width' | 'height'>;
  /** Cambia esta clave para forzar recreación (p. ej. al añadir/quitar series). */
  redrawKey?: string;
  testId?: string;
}

export interface UPlotHandle {
  redraw: () => void;
}

export const UPlotChart = forwardRef<UPlotHandle, Props>(function UPlotChart(
  { data, opts, redrawKey = 'x', testId },
  ref
) {
  const host = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  useImperativeHandle(ref, () => ({ redraw: () => plot.current?.redraw(true, true) }), []);

  useEffect(() => {
    if (!host.current) return;
    const w = host.current.clientWidth || 320;
    const h = host.current.clientHeight || 200;
    const u = new uPlot({ ...opts, width: w, height: h }, dataRef.current, host.current);
    plot.current = u;
    const ro = new ResizeObserver(() => {
      if (host.current) u.setSize({ width: host.current.clientWidth, height: host.current.clientHeight });
    });
    ro.observe(host.current);
    return () => {
      ro.disconnect();
      u.destroy();
      plot.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redrawKey]);

  useEffect(() => {
    plot.current?.setData(data);
  }, [data]);

  return <div ref={host} data-testid={testId} style={{ width: '100%', height: '100%' }} />;
});

/** Plugin uPlot: dibuja una línea vertical punteada en un valor X (lee un getter en vivo). */
export function vLinePlugin(getX: () => number | null, color: string, label: string): uPlot.Plugin {
  return {
    hooks: {
      draw: (u: uPlot) => {
        const x = getX();
        if (x == null || !isFinite(x)) return;
        const cx = Math.round(u.valToPos(x, 'x', true));
        const { ctx } = u;
        const b: any = u.bbox;
        if (cx < b.left || cx > b.left + b.width) return;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(cx, b.top);
        ctx.lineTo(cx, b.top + b.height);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.font = '600 20px IBM Plex Mono';
        ctx.fillText(label, cx + 6, b.top + 22);
        ctx.restore();
      },
    },
  };
}

/** Colores de las series. */
export const CHART = {
  accent: '#35e0c4',
  amber: '#ffb454',
  violet: '#9b8cff',
  red: '#ff6b6b',
  green: '#74e587',
  grid: '#16222f',
  axis: '#8493a6',
};

/** Opciones base con tema oscuro. */
export function baseAxes(xLabel: string, yLabel: string): uPlot.Axis[] {
  const common = {
    stroke: CHART.axis,
    grid: { stroke: CHART.grid, width: 1 },
    ticks: { stroke: CHART.grid, width: 1 },
    font: '10px IBM Plex Mono',
    labelFont: '11px IBM Plex Mono',
    labelSize: 26,
    size: 44,
  };
  return [
    { ...common, label: xLabel } as uPlot.Axis,
    { ...common, label: yLabel, size: 56 } as uPlot.Axis,
  ];
}
