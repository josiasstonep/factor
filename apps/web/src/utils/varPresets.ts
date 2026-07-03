const PREFIX = "factor_presets_";

export function getPresets(varKey: string): string[] {
  try {
    const raw = localStorage.getItem(PREFIX + varKey);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function savePreset(varKey: string, value: string): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  const existing = getPresets(varKey).filter((v) => v !== trimmed);
  localStorage.setItem(PREFIX + varKey, JSON.stringify([trimmed, ...existing].slice(0, 20)));
}

export function deletePreset(varKey: string, value: string): void {
  const updated = getPresets(varKey).filter((v) => v !== value);
  localStorage.setItem(PREFIX + varKey, JSON.stringify(updated));
}
