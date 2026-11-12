import {
  KENYA_PATH,
  KENYA_POINT,
  LAND_PATH,
  MAP_VIEWBOX,
} from "../assets/worldMapData";

// Faint dashed arcs radiate from Kenya and fade out in open space. They express
// the long-term vision only: they deliberately end at no country, marker or
// label, so the map never implies listings exist anywhere but Kenya.
function arc(dx, dy, lift) {
  const { x, y } = KENYA_POINT;
  const midX = x + dx / 2;
  const midY = y + dy / 2 - lift;
  return `M${x} ${y} Q${midX} ${midY} ${x + dx} ${y + dy}`;
}

const ARCS = [
  { d: arc(-330, -120, 90), dir: "left" },
  { d: arc(-250, 70, 60), dir: "left" },
  { d: arc(300, -90, 80), dir: "right" },
  { d: arc(280, 110, 50), dir: "right" },
];

export default function WorldMap() {
  const { x, y } = KENYA_POINT;

  return (
    <svg
      className="ga-map-svg"
      viewBox={MAP_VIEWBOX}
      role="img"
      aria-labelledby="ga-map-title ga-map-desc"
      preserveAspectRatio="xMidYMid meet"
    >
      <title id="ga-map-title">World map with Kenya highlighted</title>
      <desc id="ga-map-desc">
        A simple world map. Kenya is highlighted in green as NyumbaDirect&apos;s
        first active market.
      </desc>

      <defs>
        <linearGradient id="ga-fade-right" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#174A70" stopOpacity="0.55" />
          <stop offset="1" stopColor="#174A70" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ga-fade-left" x1="1" x2="0" y1="0" y2="0">
          <stop offset="0" stopColor="#174A70" stopOpacity="0.55" />
          <stop offset="1" stopColor="#174A70" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect className="ga-map-ocean" x="0" y="0" width="1000" height="500" rx="28" />
      <path className="ga-map-land" d={LAND_PATH} />
      <path className="ga-map-kenya" d={KENYA_PATH} />

      {ARCS.map((item) => (
        <path
          key={item.d}
          className="ga-map-arc"
          d={item.d}
          stroke={`url(#ga-fade-${item.dir})`}
        />
      ))}

      <circle className="ga-map-pulse" cx={x} cy={y} r="10" />
      <circle className="ga-map-marker" cx={x} cy={y} r="7" />
      <text className="ga-map-label" x={x + 16} y={y - 14}>
        Kenya
      </text>
    </svg>
  );
}
