import { Pipe, PipeTransform } from '@angular/core';

/** Convierte un código FIFA de 3 letras (ARG, BRA, GER…) al código ISO 3166-1 alpha-2
 *  que necesita la librería flag-icons (ar, br, de…).
 *  Uso en template: <span class="fi" [class]="pais.codigo | fifaToFlag"></span>
 */
@Pipe({ name: 'fifaToFlag', standalone: true, pure: true })
export class FifaToFlagPipe implements PipeTransform {

  private static readonly MAP: Record<string, string> = {
    'AFG': 'af', 'ALB': 'al', 'ALG': 'dz', 'AND': 'ad', 'ANG': 'ao',
    'ANT': 'ag', 'ARG': 'ar', 'ARM': 'am', 'ARU': 'aw', 'ASA': 'as',
    'AUS': 'au', 'AUT': 'at', 'AZE': 'az', 'BAH': 'bs', 'BHR': 'bh',
    'BAN': 'bd', 'BRB': 'bb', 'BLR': 'by', 'BEL': 'be', 'BLZ': 'bz',
    'BEN': 'bj', 'BER': 'bm', 'BHU': 'bt', 'BOL': 'bo', 'BIH': 'ba',
    'BOT': 'bw', 'BRA': 'br', 'VIB': 'vg', 'BRU': 'bn', 'BUL': 'bg',
    'BFA': 'bf', 'BDI': 'bi', 'CPV': 'cv', 'CAM': 'kh', 'CMR': 'cm',
    'CAN': 'ca', 'CAY': 'ky', 'CTA': 'cf', 'CHA': 'td', 'CHI': 'cl',
    'CHN': 'cn', 'COL': 'co', 'COM': 'km', 'CGO': 'cg', 'COD': 'cd',
    'COK': 'ck', 'CRC': 'cr', 'CRO': 'hr', 'CUB': 'cu', 'CUW': 'cw',
    'CYP': 'cy', 'CZE': 'cz', 'DEN': 'dk', 'DJI': 'dj', 'DMA': 'dm',
    'DOM': 'do', 'ECU': 'ec', 'EGY': 'eg', 'SLV': 'sv', 'GEQ': 'gq',
    'ERI': 'er', 'EST': 'ee', 'ETH': 'et', 'FRO': 'fo', 'FIJ': 'fj',
    'FIN': 'fi', 'FRA': 'fr', 'GAB': 'ga', 'GAM': 'gm', 'GEO': 'ge',
    'GER': 'de', 'GHA': 'gh', 'GIB': 'gi', 'GRE': 'gr', 'GRN': 'gd',
    'GUM': 'gu', 'GUA': 'gt', 'GUI': 'gn', 'GNB': 'gw', 'GUY': 'gy',
    'HAI': 'ht', 'HON': 'hn', 'HKG': 'hk', 'HUN': 'hu', 'ISL': 'is',
    'IND': 'in', 'IDN': 'id', 'IRN': 'ir', 'IRQ': 'iq', 'IRL': 'ie',
    'ISR': 'il', 'ITA': 'it', 'CIV': 'ci', 'JAM': 'jm', 'JPN': 'jp',
    'JOR': 'jo', 'KAZ': 'kz', 'KEN': 'ke', 'PRK': 'kp', 'KOR': 'kr',
    'KOS': 'xk', 'KUW': 'kw', 'KGZ': 'kg', 'LAO': 'la', 'LVA': 'lv',
    'LBN': 'lb', 'LES': 'ls', 'LBR': 'lr', 'LBA': 'ly', 'LIE': 'li',
    'LTU': 'lt', 'LUX': 'lu', 'MAC': 'mo', 'MAD': 'mg', 'MWI': 'mw',
    'MAS': 'my', 'MDV': 'mv', 'MLI': 'ml', 'MLT': 'mt', 'MTQ': 'mq',
    'MTN': 'mr', 'MRI': 'mu', 'MEX': 'mx', 'MDA': 'md', 'MNG': 'mn',
    'MNE': 'me', 'MSR': 'ms', 'MAR': 'ma', 'MOZ': 'mz', 'MYA': 'mm',
    'NAM': 'na', 'NEP': 'np', 'NED': 'nl', 'NZL': 'nz', 'NCA': 'ni',
    'NIG': 'ne', 'NGA': 'ng', 'MKD': 'mk', 'NIR': 'gb', 'NOR': 'no',
    'OMA': 'om', 'PAK': 'pk', 'PLE': 'ps', 'PAN': 'pa', 'PNG': 'pg',
    'PAR': 'py', 'PER': 'pe', 'PHI': 'ph', 'POL': 'pl', 'POR': 'pt',
    'PUR': 'pr', 'QAT': 'qa', 'ROU': 'ro', 'RUS': 'ru', 'RWA': 'rw',
    'SKN': 'kn', 'LCA': 'lc', 'VIN': 'vc', 'SAM': 'ws', 'SMR': 'sm',
    'STP': 'st', 'SAU': 'sa', 'SCO': 'gb', 'SEN': 'sn', 'SRB': 'rs',
    'SEY': 'sc', 'SLE': 'sl', 'SGP': 'sg', 'SVK': 'sk', 'SVN': 'si',
    'SOL': 'sb', 'SOM': 'so', 'RSA': 'za', 'ESP': 'es', 'SRI': 'lk',
    'SUD': 'sd', 'SUR': 'sr', 'SWZ': 'sz', 'SWE': 'se', 'SUI': 'ch',
    'SYR': 'sy', 'TAH': 'pf', 'TPE': 'tw', 'TJK': 'tj', 'TAN': 'tz',
    'THA': 'th', 'TLS': 'tl', 'TOG': 'tg', 'TGA': 'to', 'TRI': 'tt',
    'TUN': 'tn', 'TUR': 'tr', 'TKM': 'tm', 'UGA': 'ug', 'UKR': 'ua',
    'UAE': 'ae', 'USA': 'us', 'URU': 'uy', 'UZB': 'uz', 'VAN': 'vu',
    'VEN': 've', 'VIE': 'vn', 'YEM': 'ye', 'ZAM': 'zm', 'ZIM': 'zw',
    'ENG': 'gb-eng', 'WAL': 'gb-wls',
  };

  transform(fifaCode: string | null | undefined): string {
    if (!fifaCode) return '';
    const upper = fifaCode.toUpperCase();
    return FifaToFlagPipe.MAP[upper] ?? upper.substring(0, 2).toLowerCase();
  }
}
