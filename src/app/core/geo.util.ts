import { Feature, FeatureCollection, LineString, Polygon } from 'geojson';

/** Geodesic area of a lon/lat ring in square metres (spherical excess). */
export function ringAreaSqMeters(ring: number[][]): number {
  const R = 6378137;
  let total = 0;
  const n = ring.length;
  if (n < 3) return 0;
  for (let i = 0; i < n; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[(i + 1) % n];
    total +=
      ((lon2 - lon1) * Math.PI) / 180 *
      (2 + Math.sin((lat1 * Math.PI) / 180) + Math.sin((lat2 * Math.PI) / 180));
  }
  return Math.abs((total * R * R) / 2);
}

export function areaHectares(ring: number[][]): number {
  return ringAreaSqMeters(ring) / 10000;
}

/** Area-weighted centroid of a lon/lat ring → [lon, lat]. */
export function polygonCentroid(ring: number[][]): [number, number] {
  let a = 0, cx = 0, cy = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % n];
    const cross = x0 * y1 - x1 * y0;
    a += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (a === 0) {
    // Degenerate — fall back to average.
    const avg = ring.reduce((p, c) => [p[0] + c[0], p[1] + c[1]], [0, 0]);
    return [avg[0] / n, avg[1] / n];
  }
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}

/** Build a lat/lon graticule grid as GeoJSON for the space-map look. */
export function buildGraticule(step = 10): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = [];
  for (let lon = -180; lon <= 180; lon += step) {
    const coords: number[][] = [];
    for (let lat = -80; lat <= 80; lat += 4) coords.push([lon, lat]);
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
  }
  for (let lat = -80; lat <= 80; lat += step) {
    const coords: number[][] = [];
    for (let lon = -180; lon <= 180; lon += 6) coords.push([lon, lat]);
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
  }
  return { type: 'FeatureCollection', features };
}

export function polygonFeature(ring: number[][]): Feature<Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}
