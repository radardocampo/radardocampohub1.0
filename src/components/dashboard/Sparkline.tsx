import { useId } from "react";

/**
 * Sparkline em SVG puro: um traço de 88x24 não justifica carregar o Recharts,
 * e aqui a linha existe para dar forma à tendência, não para ser lida ponto a ponto.
 */
function movingAverage(values: number[], window: number) {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - half), Math.min(values.length, i + half + 1));
    return slice.reduce((sum, v) => sum + v, 0) / slice.length;
  });
}

export function Sparkline({
  values,
  color = "var(--color-primary)",
  width = 88,
  height = 24,
  className,
  title,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
  title?: string;
}) {
  const gradientId = useId();

  if (values.length < 2) return <div style={{ width, height }} className={className} />;

  // Média móvel: num traço de 24px de altura, a oscilação diária vira chuvisco e
  // esconde a tendência, que é a única coisa legível nesse tamanho.
  const series = values.length > 10 ? movingAverage(values, 3) : values;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const stepX = width / (series.length - 1);
  // 1px de respiro em cima e embaixo para a linha não encostar na borda.
  const toY = (v: number) => height - 1 - ((v - min) / span) * (height - 2);

  const points = series.map((v, i) => `${(i * stepX).toFixed(2)},${toY(v).toFixed(2)}`);
  const line = `M${points.join(" L")}`;
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
