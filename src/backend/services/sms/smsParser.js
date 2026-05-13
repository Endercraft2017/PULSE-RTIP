/**
 * =============================================================================
 * SMS Report Parser
 * =============================================================================
 *
 * Parses two structured SMS formats into staged report objects:
 *
 *   PULSE911|{TYPE}|{SEV}|{LAT},{LNG}|{NAME}|{PHONE}|{MESSAGE}
 *     - Offline emergency SOS reports (red button)
 *     - Example: PULSE911|FL|3|14.5117,121.2395|Ray Lopez|09122078435|Flood in area
 *
 *   REPORT|{TITLE}|{LAT},{LNG}|{NAME}|{PHONE}|{MESSAGE}
 *     - Offline general (non-emergency) incident reports
 *     - Example: REPORT|Fallen tree on main road|14.5117,121.2395|Ray Lopez|09122078435|Blocks east lane
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

/* --------------------------------------------------------------------------
 * Format detection
 * -------------------------------------------------------------------------- */

function isPulse911(message) {
  return !!(message && message.startsWith('PULSE911|'));
}

function isReport(message) {
  return !!(message && message.startsWith('REPORT|'));
}

/* --------------------------------------------------------------------------
 * Individual parsers
 * -------------------------------------------------------------------------- */

function parsePulse911(rawMessage) {
  if (!isPulse911(rawMessage)) return null;

  const parts = rawMessage.split('|');
  // PULSE911 | type | severity | coords | name | phone | message
  if (parts.length < 7) return null;

  const [lat, lng] = (parts[3] || '').split(',').map(Number);

  return {
    source_type: 'sos',
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

function parseReport(rawMessage) {
  if (!isReport(rawMessage)) return null;

  const parts = rawMessage.split('|');
  // REPORT | title | coords | name | phone | message
  if (parts.length < 6) return null;

  const [lat, lng] = (parts[2] || '').split(',').map(Number);
  // General reports have no structured type/severity — default to 'Others' / 'medium'
  // so they still render in the existing sms_reports admin list.
  return {
    source_type: 'report',
    type: 'Others',
    severity: 'medium',
    title: parts[1] || '',
    latitude: isFinite(lat) ? lat : null,
    longitude: isFinite(lng) ? lng : null,
    sender_name: parts[3] || 'Unknown',
    sender_phone: parts[4] || '',
    message: parts.slice(5).join('|') || '',
  };
}

/* --------------------------------------------------------------------------
 * Unified entry point
 * -------------------------------------------------------------------------- */

function parse(rawMessage) {
  if (isPulse911(rawMessage)) return parsePulse911(rawMessage);
  if (isReport(rawMessage))   return parseReport(rawMessage);
  return null;
}

function isSupported(message) {
  return isPulse911(message) || isReport(message);
}

module.exports = {
  parse,
  parsePulse911,
  parseReport,
  isPulse911,
  isReport,
  isSupported,
};
