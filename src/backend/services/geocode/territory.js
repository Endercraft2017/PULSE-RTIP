/** Server-side territory policy.
 * A configured GeoJSON FeatureCollection must include an allowed Polygon /
 * MultiPolygon and a denied Polygon / MultiPolygon named Morong (mode=deny).
 * No external reverse-geocoder is trusted to approve a location. Text never
 * overrides GPS. Missing boundaries fail closed until an administrator supplies
 * the designated territory and an authoritative Morong exclusion boundary.
 */
const fs = require('fs');
function error(message, statusCode = 422) { return Object.assign(new Error(message), { statusCode }); }
function ringContains(point, ring) {
  let inside = false;
  const [x, y] = point;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    const cross = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
    if (Math.abs(cross) < 1e-10 && x >= Math.min(xi, xj) && x <= Math.max(xi, xj) && y >= Math.min(yi, yj) && y <= Math.max(yi, yj)) return true;
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function contains(geometry, point) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(rings => ringContains(point, rings[0]) && !rings.slice(1).some(r => ringContains(point, r)));
}
function loadPolicy() {
  const path = process.env.TERRITORY_GEOJSON_PATH;
  if (!path) throw error('Location submissions are disabled until the designated territory and Morong exclusion boundaries are configured.', 503);
  let features;
  try {
    features = JSON.parse(fs.readFileSync(path, 'utf8')).features;
    if (!Array.isArray(features) || !features.length || !features.every(f =>
      ['allow', 'deny'].includes(f.properties?.mode) && ['Polygon', 'MultiPolygon'].includes(f.geometry?.type))) throw new Error('Invalid boundary features');
    for (const feature of features) {
      const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      if (!polygons.length || !polygons.every(p => p.length && p.every(r => r.length >= 4 && r.every(c => c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90) && JSON.stringify(r[0]) === JSON.stringify(r[r.length - 1])))) throw new Error('Invalid polygon');
    }
    if (!features.some(f => f.properties.mode === 'allow') || !features.some(f => f.properties.mode === 'deny' && /\bmorong\b/i.test(f.properties.name || ''))) throw new Error('Required boundaries missing');
  } catch (_) { throw error('Territory boundary configuration is invalid. Contact an administrator.', 503); }
  return features;
}
function assertLocation(data) {
  if (/\bmorong\b/i.test(String(data.location || ''))) throw error('Reports and locations originating from Morong are not accepted.');
  if (data.latitude == null || data.longitude == null || data.latitude === '' || data.longitude === '' || !Number.isFinite(Number(data.latitude)) || !Number.isFinite(Number(data.longitude))) throw error('A valid GPS coordinate pair is required.');
  const point = [Number(data.longitude), Number(data.latitude)];
  if (Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) throw error('Invalid GPS coordinates.');
  const features = loadPolicy();
  if (features.some(f => f.properties.mode === 'deny' && contains(f.geometry, point))) throw error('This location is excluded. Morong reports are not accepted.');
  if (!features.some(f => f.properties.mode === 'allow' && contains(f.geometry, point))) throw error('The location is outside the designated territory.');
}
module.exports = { assertLocation, contains };
