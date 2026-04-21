/**
 * =============================================================================
 * Hazard Safety Tips
 * =============================================================================
 * Maps a hazard title/type keyword to a short list of safety tips suitable
 * for inclusion in the emergency SMS broadcast and the frontend detail modal.
 * Mirrors the same tip set used by HazardsPage.getSafetyTips() on the
 * client so citizens see consistent guidance whether via SMS or in-app.
 * =============================================================================
 */

const TIPS = {
  flood: [
    'Move to higher ground immediately if water rises.',
    'Avoid walking or driving through flood waters.',
    'Disconnect electrical appliances if safe to do so.',
    'Listen to MDRRMO Morong announcements.',
  ],
  fire: [
    'Evacuate the area immediately if instructed.',
    'Stay low to avoid smoke inhalation.',
    'Do not use elevators during a fire emergency.',
    'Call BFP Morong or 911.',
  ],
  landslide: [
    'Move away from steep slopes immediately.',
    'Watch for cracks in the ground or tilting trees.',
    'Listen for rumbling sounds.',
    'Have an evacuation plan ready.',
  ],
  typhoon: [
    'Stay indoors and away from windows.',
    'Prepare emergency supplies (water, food, flashlight).',
    'Charge mobile devices and have backup power ready.',
    'Follow PAGASA advisories and MDRRMO instructions.',
  ],
  storm: [
    'Stay indoors and away from windows.',
    'Prepare emergency supplies.',
    'Follow PAGASA advisories.',
  ],
  earthquake: [
    'Drop, Cover, and Hold On during shaking.',
    'Stay away from windows and heavy furniture.',
    'After shaking, check for injuries and damage.',
    'Be prepared for aftershocks.',
  ],
  tsunami: [
    'Move to high ground or inland immediately.',
    'Do not wait for an official warning if you feel strong shaking near the coast.',
    'Stay away from the coast until authorities declare it safe.',
  ],
  volcanic: [
    'Evacuate if in the danger zone.',
    'Wear a dust mask or cover mouth with damp cloth.',
    'Stay indoors with windows closed if ashfall is likely.',
    'Protect eyes with goggles if outside.',
  ],
  default: [
    'Follow official MDRRMO instructions and advisories.',
    'Keep emergency contacts handy.',
    'Stay informed through trusted local sources.',
    'Have an emergency kit ready.',
  ],
};

/**
 * Returns safety tips based on a hazard's title or type keyword.
 * @param {string} hazardTitle - The hazard's title (or type keyword)
 * @returns {string[]} Array of tip strings
 */
function getTipsFor(hazardTitle) {
  const t = (hazardTitle || '').toLowerCase();
  if (t.includes('flood'))        return TIPS.flood;
  if (t.includes('fire'))         return TIPS.fire;
  if (t.includes('landslide'))    return TIPS.landslide;
  if (t.includes('typhoon') || t.includes('bagyo')) return TIPS.typhoon;
  if (t.includes('storm'))        return TIPS.storm;
  if (t.includes('earthquake') || t.includes('lindol')) return TIPS.earthquake;
  if (t.includes('tsunami'))      return TIPS.tsunami;
  if (t.includes('volcan') || t.includes('ash'))    return TIPS.volcanic;
  return TIPS.default;
}

module.exports = { getTipsFor };
