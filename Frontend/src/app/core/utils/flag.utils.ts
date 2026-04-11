/**
 * Mapeo de códigos FIFA (3 letras) a códigos ISO 3166-1 alpha-2 (2 letras)
 * para usar con flagcdn.com
 */
const FIFA_TO_ISO: Record<string, string> = {
  GER: 'de', // Alemania
  SAU: 'sa', // Arabia Saudita
  ALG: 'dz', // Argelia
  ARG: 'ar', // Argentina
  AUS: 'au', // Australia
  AUT: 'at', // Austria
  BHR: 'bh', // Baréin
  BEL: 'be', // Bélgica
  BRA: 'br', // Brasil
  CPV: 'cv', // Cabo Verde
  CMR: 'cm', // Camerún
  CAN: 'ca', // Canadá
  CHI: 'cl', // Chile
  COL: 'co', // Colombia
  KOR: 'kr', // Corea del Sur
  CIV: 'ci', // Costa de Marfil
  CRC: 'cr', // Costa Rica
  CRO: 'hr', // Croacia
  CUW: 'cw', // Curaçao
  DEN: 'dk', // Dinamarca
  ECU: 'ec', // Ecuador
  EGY: 'eg', // Egipto
  SCO: 'gb-sct', // Escocia
  ESP: 'es', // España
  USA: 'us', // Estados Unidos
  FRA: 'fr', // Francia
  GHA: 'gh', // Ghana
  HAI: 'ht', // Haití
  HUN: 'hu', // Hungría
  ENG: 'gb-eng', // Inglaterra
  IRQ: 'iq', // Irak
  IRN: 'ir', // Irán
  ITA: 'it', // Italia
  JAM: 'jm', // Jamaica
  JPN: 'jp', // Japón
  JOR: 'jo', // Jordania
  MAR: 'ma', // Marruecos
  MEX: 'mx', // México
  NGA: 'ng', // Nigeria
  NOR: 'no', // Noruega
  NZL: 'nz', // Nueva Zelanda
  NED: 'nl', // Países Bajos
  PAN: 'pa', // Panamá
  PAR: 'py', // Paraguay
  PER: 'pe', // Perú
  POL: 'pl', // Polonia
  POR: 'pt', // Portugal
  QAT: 'qa', // Qatar
  SEN: 'sn', // Senegal
  SRB: 'rs', // Serbia
  RSA: 'za', // Sudáfrica
  SUI: 'ch', // Suiza
  TUN: 'tn', // Túnez
  URU: 'uy', // Uruguay
  UZB: 'uz', // Uzbekistán
  BIH: 'ba', // Bosnia y Herzegovina
  CZE: 'cz', // República Checa
  TUR: 'tr', // Turquía
  SWE: 'se', // Suecia
  COD: 'cd', // Congo DR
};

/**
 * Devuelve la URL de la bandera para un código FIFA dado.
 * Si no se encuentra el mapeo, devuelve una cadena vacía.
 */
export function getFlagUrl(codigoFifa: string, size: 'w40' | 'w80' | 'w160' = 'w40'): string {
  if (!codigoFifa) return '';
  const iso = FIFA_TO_ISO[codigoFifa.toUpperCase()];
  if (!iso) return '';
  return `https://flagcdn.com/${size}/${iso}.png`;
}
