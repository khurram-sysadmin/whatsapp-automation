const fallbackZones = [
  'UTC',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Sao_Paulo',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Riyadh',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Europe/Berlin',
  'Europe/London',
  'Europe/Paris',
  'Pacific/Auckland',
];

const intlWithTimeZones = Intl as typeof Intl & {
  supportedValuesOf?: (key: string) => string[];
};

export const TIME_ZONES = Array.from(new Set([
  'UTC',
  ...(intlWithTimeZones.supportedValuesOf?.('timeZone') ?? fallbackZones),
])).sort((a, b) => a.localeCompare(b));

export function timeZoneLabel(zone: string): string {
  if (zone === 'UTC') return 'UTC (UTC+00:00)';
  try {
    const offset = new Intl.DateTimeFormat('en', {
      timeZone: zone,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date()).find((part) => part.type === 'timeZoneName')?.value ?? '';
    return `${zone} (${offset.replace('GMT', 'UTC')})`;
  } catch {
    return zone;
  }
}

