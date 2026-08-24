const DEFAULT_UNITS = ['Thùng', 'Hộp', 'Bao', 'Kg', 'Cái', 'Lon', 'Chai', 'Hũ', 'Gói', 'Chiếc', 'Bộ'];
const STORAGE_KEY = 'debtflow_custom_units';

export function getUnits(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_UNITS;
}

export function saveUnits(units: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(units));
  } catch {}
}
