/** Normaliza un string quitando acentos/diacríticos y pasando a minúsculas */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
