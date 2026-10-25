/** Morong, Rizal policy. Ships a user-authorized published operational boundary.
 * GPS is authoritative; outer edges are included, hole/deny edges excluded.
 * An old Morong-deny configuration deliberately fails closed.
 */
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const DEFAULT_POLICY_PATH=path.resolve(__dirname,'../../data/morong-rizal.geojson');
function error(message, statusCode = 422) { return Object.assign(new Error(message), { statusCode }); }
function ringContains([x,y], ring) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const [xi,yi]=ring[i], [xj,yj]=ring[j];
    const cross=(x-xi)*(yj-yi)-(y-yi)*(xj-xi);
    if(Math.abs(cross)<1e-10 && x>=Math.min(xi,xj) && x<=Math.max(xi,xj) && y>=Math.min(yi,yj) && y<=Math.max(yi,yj)) return true;
    if((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
function contains(geometry, point) {
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  return polygons.some(rings=>ringContains(point,rings[0])&&!rings.slice(1).some(r=>ringContains(point,r)));
}
function loadPolicy() {
  try {
    const raw=fs.readFileSync(process.env.TERRITORY_GEOJSON_PATH || DEFAULT_POLICY_PATH,'utf8');
    const policy=JSON.parse(raw), p=policy.properties;
    if(policy.type!=='FeatureCollection' || p?.jurisdiction!=='PH-RIZ-MORONG' || !['source','version'].every(k=>typeof p[k]==='string'&&p[k].trim())) throw Error('Missing provenance');
    if(p.approval_kind==='published-operational') {
      if(p.certification!=='not-lgu-certified' || !p.operational_authorization?.by || !Number.isFinite(Date.parse(p.operational_authorization.date))) throw Error('Missing operational authorization');
      if(policy.features?.length!==1 || policy.features[0].properties?.adm3_pcode!=='PH0405809' || policy.features[0].properties?.adm2_name!=='Rizal') throw Error('Wrong municipality');
      const digest=crypto.createHash('sha256').update(JSON.stringify(policy.features[0].geometry)).digest('hex');
      if(digest!==p.geometry_sha256) throw Error('Published geometry digest mismatch');
    } else if(!['approved_by','approved_at'].every(k=>typeof p[k]==='string'&&p[k].trim()) || !Number.isFinite(Date.parse(p.approved_at))) throw Error('Missing approval provenance');
    const features=policy.features;
    if(!Array.isArray(features)||!features.length) throw Error('No features');
    for(const f of features) {
      if(!['allow','deny'].includes(f.properties?.mode)||!['Polygon','MultiPolygon'].includes(f.geometry?.type)) throw Error('Invalid feature');
      if(f.properties.mode==='allow' && !/\bmorong\b/i.test(f.properties.name||'')) throw Error('Only Morong allow features accepted');
      if(f.properties.mode==='deny' && /\bmorong\b/i.test(f.properties.name||'')) throw Error('Obsolete exclusion policy');
      const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;
      if(!Array.isArray(polygons)||!polygons.length||!polygons.every(poly=>Array.isArray(poly)&&poly.length&&poly.every(r=>Array.isArray(r)&&r.length>=4&&r.every(c=>Array.isArray(c)&&c.length>=2&&Number.isFinite(c[0])&&Number.isFinite(c[1])&&Math.abs(c[0])<=180&&Math.abs(c[1])<=90)&&JSON.stringify(r[0])===JSON.stringify(r.at(-1))&&Math.abs(r.slice(1).reduce((a,c,i)=>a+r[i][0]*c[1]-c[0]*r[i][1],0))>1e-12))) throw Error('Invalid rings');
    }
    if(!features.some(f=>f.properties.mode==='allow')) throw Error('No Morong boundary');
    return {...policy, sha256:crypto.createHash('sha256').update(raw).digest('hex')};
  } catch (_) { throw error('Morong territory boundary configuration is invalid or lacks source/authorization provenance. Contact an administrator.',503); }
}
function assertLocation(data) {
  for(const key of ['latitude','longitude']) if(!['number','string'].includes(typeof data[key]) || String(data[key]).trim()==='' || !Number.isFinite(Number(data[key]))) throw error('A valid GPS coordinate pair is required.');
  const point=[Number(data.longitude),Number(data.latitude)];
  if(Math.abs(point[0])>180||Math.abs(point[1])>90) throw error('Invalid GPS coordinates.');
  const {features}=loadPolicy();
  if(features.some(f=>f.properties.mode==='deny'&&contains(f.geometry,point))||!features.some(f=>f.properties.mode==='allow'&&contains(f.geometry,point))) throw error('Only locations inside the Morong, Rizal territory are accepted.');
}
module.exports={assertLocation,contains,loadPolicy,DEFAULT_POLICY_PATH};
