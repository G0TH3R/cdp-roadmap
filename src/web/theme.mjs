// Persist only this display preference, never lookup records or authentication data.
const key = preview => preview ? 'cdp-schedule.preview.theme.v1' : 'cdp-schedule.theme.v1';
export function readTheme(view, preview = false) {
  try { return view.localStorage.getItem(key(preview)) === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}
export function saveTheme(view, theme, preview = false) {
  if (theme !== 'dark' && theme !== 'light') return;
  try { view.localStorage.setItem(key(preview), theme); }
  catch { /* Restricted storage must not prevent switching for this visit. */ }
}
