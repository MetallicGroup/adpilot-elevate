const KEY = "adpilot:wizard-draft:v1";

export function loadDraft<T>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed.data as T;
  } catch {
    return null;
  }
}

export function saveDraft<T>(data: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {}
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(KEY); } catch {}
}

export function draftSavedAt(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw).at ?? null;
  } catch { return null; }
}