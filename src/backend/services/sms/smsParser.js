/**
 * =============================================================================
 * SMS Report Parser
 * =============================================================================
 *
 * Parses structured PULSE911 SMS messages into report objects.
 *
 * Format: PULSE911|{TYPE}|{SEV}|{LAT},{LNG}|{NAME}|{PHONE}|{MESSAGE}
 * Example: PULSE911|FL|3|14.5117,121.2395|Ray Lopez|09122078435|Flood in area
 * =============================================================================
 */

const TYPE_MAP = {
  FL: 'Flood',
  FR: 'Fire',
  TY: 'Typhoon',
  IN: 'Infrastructure Damage',
  EQ: 'Earthquake',
  LS: 'Landslide',
  OT: 'Others',
};

const SEVERITY_MAP = {
  '1': 'low',
  '2': 'medium',
  '3': 'high',
};

/**
 * Attempts to parse a PULSE911-formatted SMS message.
 *
 * @param {string} rawMessage - The raw SMS body
 * @returns {object|null} Parsed report data, or null if not a PULSE911 message
 */
function parse(rawMessage) {
  if (!rawMessage || !rawMessage.startsWith('PULSE911|')) return null;

  const parts = rawMessage.split('|');
  // Minimum: PULSE911 | type | severity | coords | name | phone | message
  if (parts.length < 7) return null;

  const [lat, lng] = (parts[3] || '').split(',').map(Number);

  return {
    type: TYPE_MAP[parts[1]] || 'Others',
    severity: SEVERITY_MAP[parts[2]] || 'medium',
    latitude: isFinite(lat) ? lat : null,
    longitude: isFinite(lng) ? lng : null,
    sender_name: parts[4] || 'Unknown',
    sender_phone: parts[5] || '',
    // Rejoin remaining parts in case the message itself contains pipes
    message: parts.slice(6).join('|') || '',
  };
}

/**
 * Returns true if the message looks like a PULSE911 report.
 */
function isPulse911(message) {
  return !!(message && message.startsWith('PULSE911|'));
}

module.exports = { parse, isPulse911 };
