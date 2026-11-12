import { Component, lazy, Suspense } from "react";
import { Link } from "react-router-dom";

// The map is a separate chunk so it never blocks search or first paint.
const WorldMap = lazy(() => import("./WorldMap"));

function MapFallback({ failed = false }) {
  return (
    <div className="ga-map-fallback" role={failed ? "note" : "status"}>
      <span aria-hidden="true" className="ga-map-fallback-pin" />
      <p>{failed ? "Map unavailable right now." : "Loading map…"}</p>
      <p className="ga-map-fallback-sub">
        NyumbaDirect is live in Kenya. You can still search every available home.
      </p>
    </div>
  );
}

class MapBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <MapFallback failed /> : this.props.children;
  }
}

/**
 * Hero world map. `homesListed` is the real number of available listings from
 * the API (null while loading or if the API is unreachable). No other figures
 * are shown and no listings are implied outside Kenya.
 */
export default function HeroMap({ homesListed }) {
  const hasCount = typeof homesListed === "number";

  return (
    <figure className="ga-map-card">
      <div className="ga-map-frame">
        <MapBoundary>
          <Suspense fallback={<MapFallback />}>
            <WorldMap />
          </Suspense>
        </MapBoundary>
      </div>

      <figcaption className="ga-map-caption">
        <span className="ga-map-caption-pin" aria-hidden="true" />
        <div>
          <strong>Kenya is our first active market</strong>
          <p>
            {hasCount && homesListed > 0
              ? `${homesListed.toLocaleString()} ${homesListed === 1 ? "home is" : "homes are"} listed right now. `
              : ""}
            We are building toward a world where finding a home is simple, and
            we only list homes where we operate today.
          </p>
          <Link to="/properties" className="ga-map-caption-link">
            Browse homes in Kenya <span aria-hidden="true">→</span>
          </Link>
        </div>
      </figcaption>
    </figure>
  );
}
