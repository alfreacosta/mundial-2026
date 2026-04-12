/**
 * Convierte un datetime "naive" del backend (almacenado en America/Asuncion)
 * a un string ISO con offset de zona, para que el navegador lo convierta
 * automáticamente a la hora local del usuario.
 *
 * Paraguay Standard Time: UTC-4 (abril–septiembre)
 * Paraguay Summer Time:   UTC-3 (octubre–marzo)
 */
export function toLocalIso(naiveDateStr: string): string {
  if (!naiveDateStr) return naiveDateStr;
  if (/[Z+]/.test(naiveDateStr) || /-\d{2}:\d{2}$/.test(naiveDateStr)) return naiveDateStr;
  const month = parseInt(naiveDateStr.substring(5, 7), 10);
  const offset = (month >= 4 && month <= 9) ? '-04:00' : '-03:00';
  return naiveDateStr + offset;
}
