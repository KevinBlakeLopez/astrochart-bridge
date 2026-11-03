// A chart's place as a person or program wrote it, "Brooklyn, New York",
// "Hodgenville KY, USA" or "New York, NY (US)", split into the town to type
// into a site's town search and the state and country after it, which help
// choose among the site's matches. Only states and countries in the tables
// below are recognised, by their codes exactly as written or their names
// ignoring case and accents; anything else is left alone.

// Each country's ISO 3166-1 alpha-2 and alpha-3 codes and its name.
const COUNTRY_ROWS = `
AD AND Andorra|AE ARE United Arab Emirates|AF AFG Afghanistan|AG ATG Antigua and Barbuda|AI AIA Anguilla
AL ALB Albania|AM ARM Armenia|AO AGO Angola|AQ ATA Antarctica|AR ARG Argentina|AS ASM American Samoa
AT AUT Austria|AU AUS Australia|AW ABW Aruba|AX ALA Åland Islands|AZ AZE Azerbaijan
BA BIH Bosnia and Herzegovina|BB BRB Barbados|BD BGD Bangladesh|BE BEL Belgium|BF BFA Burkina Faso
BG BGR Bulgaria|BH BHR Bahrain|BI BDI Burundi|BJ BEN Benin|BL BLM Saint Barthélemy|BM BMU Bermuda
BN BRN Brunei|BO BOL Bolivia|BQ BES Caribbean Netherlands|BR BRA Brazil|BS BHS Bahamas|BT BTN Bhutan
BV BVT Bouvet Island|BW BWA Botswana|BY BLR Belarus|BZ BLZ Belize|CA CAN Canada|CC CCK Cocos Islands
CD COD Democratic Republic of the Congo|CF CAF Central African Republic|CG COG Republic of the Congo
CH CHE Switzerland|CI CIV Côte d'Ivoire|CK COK Cook Islands|CL CHL Chile|CM CMR Cameroon|CN CHN China
CO COL Colombia|CR CRI Costa Rica|CU CUB Cuba|CV CPV Cabo Verde|CW CUW Curaçao|CX CXR Christmas Island
CY CYP Cyprus|CZ CZE Czechia|DE DEU Germany|DJ DJI Djibouti|DK DNK Denmark|DM DMA Dominica
DO DOM Dominican Republic|DZ DZA Algeria|EC ECU Ecuador|EE EST Estonia|EG EGY Egypt|EH ESH Western Sahara
ER ERI Eritrea|ES ESP Spain|ET ETH Ethiopia|FI FIN Finland|FJ FJI Fiji|FK FLK Falkland Islands
FM FSM Micronesia|FO FRO Faroe Islands|FR FRA France|GA GAB Gabon|GB GBR United Kingdom|GD GRD Grenada
GE GEO Georgia|GF GUF French Guiana|GG GGY Guernsey|GH GHA Ghana|GI GIB Gibraltar|GL GRL Greenland
GM GMB Gambia|GN GIN Guinea|GP GLP Guadeloupe|GQ GNQ Equatorial Guinea|GR GRC Greece
GS SGS South Georgia and the South Sandwich Islands|GT GTM Guatemala|GU GUM Guam|GW GNB Guinea-Bissau
GY GUY Guyana|HK HKG Hong Kong|HM HMD Heard Island and McDonald Islands|HN HND Honduras|HR HRV Croatia
HT HTI Haiti|HU HUN Hungary|ID IDN Indonesia|IE IRL Ireland|IL ISR Israel|IM IMN Isle of Man|IN IND India
IO IOT British Indian Ocean Territory|IQ IRQ Iraq|IR IRN Iran|IS ISL Iceland|IT ITA Italy|JE JEY Jersey
JM JAM Jamaica|JO JOR Jordan|JP JPN Japan|KE KEN Kenya|KG KGZ Kyrgyzstan|KH KHM Cambodia|KI KIR Kiribati
KM COM Comoros|KN KNA Saint Kitts and Nevis|KP PRK North Korea|KR KOR South Korea|KW KWT Kuwait
KY CYM Cayman Islands|KZ KAZ Kazakhstan|LA LAO Laos|LB LBN Lebanon|LC LCA Saint Lucia|LI LIE Liechtenstein
LK LKA Sri Lanka|LR LBR Liberia|LS LSO Lesotho|LT LTU Lithuania|LU LUX Luxembourg|LV LVA Latvia|LY LBY Libya
MA MAR Morocco|MC MCO Monaco|MD MDA Moldova|ME MNE Montenegro|MF MAF Saint Martin|MG MDG Madagascar
MH MHL Marshall Islands|MK MKD North Macedonia|ML MLI Mali|MM MMR Myanmar|MN MNG Mongolia|MO MAC Macao
MP MNP Northern Mariana Islands|MQ MTQ Martinique|MR MRT Mauritania|MS MSR Montserrat|MT MLT Malta
MU MUS Mauritius|MV MDV Maldives|MW MWI Malawi|MX MEX Mexico|MY MYS Malaysia|MZ MOZ Mozambique
NA NAM Namibia|NC NCL New Caledonia|NE NER Niger|NF NFK Norfolk Island|NG NGA Nigeria|NI NIC Nicaragua
NL NLD Netherlands|NO NOR Norway|NP NPL Nepal|NR NRU Nauru|NU NIU Niue|NZ NZL New Zealand|OM OMN Oman
PA PAN Panama|PE PER Peru|PF PYF French Polynesia|PG PNG Papua New Guinea|PH PHL Philippines|PK PAK Pakistan
PL POL Poland|PM SPM Saint Pierre and Miquelon|PN PCN Pitcairn Islands|PR PRI Puerto Rico|PS PSE Palestine
PT PRT Portugal|PW PLW Palau|PY PRY Paraguay|QA QAT Qatar|RE REU Réunion|RO ROU Romania|RS SRB Serbia
RU RUS Russia|RW RWA Rwanda|SA SAU Saudi Arabia|SB SLB Solomon Islands|SC SYC Seychelles|SD SDN Sudan
SE SWE Sweden|SG SGP Singapore|SH SHN Saint Helena|SI SVN Slovenia|SJ SJM Svalbard and Jan Mayen
SK SVK Slovakia|SL SLE Sierra Leone|SM SMR San Marino|SN SEN Senegal|SO SOM Somalia|SR SUR Suriname
SS SSD South Sudan|ST STP São Tomé and Príncipe|SV SLV El Salvador|SX SXM Sint Maarten|SY SYR Syria
SZ SWZ Eswatini|TC TCA Turks and Caicos Islands|TD TCD Chad|TF ATF French Southern Territories|TG TGO Togo
TH THA Thailand|TJ TJK Tajikistan|TK TKL Tokelau|TL TLS Timor-Leste|TM TKM Turkmenistan|TN TUN Tunisia
TO TON Tonga|TR TUR Turkey|TT TTO Trinidad and Tobago|TV TUV Tuvalu|TW TWN Taiwan|TZ TZA Tanzania
UA UKR Ukraine|UG UGA Uganda|UM UMI United States Minor Outlying Islands|US USA United States|UY URY Uruguay
UZ UZB Uzbekistan|VA VAT Vatican City|VC VCT Saint Vincent and the Grenadines|VE VEN Venezuela
VG VGB British Virgin Islands|VI VIR United States Virgin Islands|VN VNM Vietnam|VU VUT Vanuatu
WF WLF Wallis and Futuna|WS WSM Samoa|YE YEM Yemen|YT MYT Mayotte|ZA ZAF South Africa|ZM ZMB Zambia
ZW ZWE Zimbabwe`;

// Other names and codes the countries go by, as charts and the two sites write
// them: astro.com's lists give the United Kingdom as UK.
const COUNTRY_ALIASES = {
  US: ["United States of America", "U.S.A.", "U.S."],
  GB: ["UK", "Great Britain", "Britain", "England", "Scotland", "Wales", "Northern Ireland"],
  CZ: ["Czech Republic"],
  CI: ["Ivory Coast"],
  CV: ["Cape Verde"],
  KR: ["Korea", "Republic of Korea"],
  MK: ["Macedonia"],
  MM: ["Burma"],
  NL: ["Holland", "The Netherlands"],
  RU: ["Russian Federation"],
  SZ: ["Swaziland"],
  TR: ["Türkiye"],
  VA: ["Holy See"],
  VN: ["Viet Nam"],
};

// The states, provinces and territories of the United States, Canada and
// Australia, by country, each its postal code and name.
const REGION_ROWS = {
  US: `AL Alabama|AK Alaska|AZ Arizona|AR Arkansas|CA California|CO Colorado|CT Connecticut|DE Delaware
DC District of Columbia|FL Florida|GA Georgia|HI Hawaii|ID Idaho|IL Illinois|IN Indiana|IA Iowa|KS Kansas
KY Kentucky|LA Louisiana|ME Maine|MD Maryland|MA Massachusetts|MI Michigan|MN Minnesota|MS Mississippi
MO Missouri|MT Montana|NE Nebraska|NV Nevada|NH New Hampshire|NJ New Jersey|NM New Mexico|NY New York
NC North Carolina|ND North Dakota|OH Ohio|OK Oklahoma|OR Oregon|PA Pennsylvania|RI Rhode Island
SC South Carolina|SD South Dakota|TN Tennessee|TX Texas|UT Utah|VT Vermont|VA Virginia|WA Washington
WV West Virginia|WI Wisconsin|WY Wyoming|PR Puerto Rico|GU Guam|VI U.S. Virgin Islands|AS American Samoa
MP Northern Mariana Islands`,
  CA: `AB Alberta|BC British Columbia|MB Manitoba|NB New Brunswick|NL Newfoundland and Labrador|NS Nova Scotia
NT Northwest Territories|NU Nunavut|ON Ontario|PE Prince Edward Island|QC Quebec|SK Saskatchewan|YT Yukon`,
  AU: `ACT Australian Capital Territory|NSW New South Wales|NT Northern Territory|QLD Queensland
SA South Australia|TAS Tasmania|VIC Victoria|WA Western Australia`,
};

const plain = (text) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const rows = (text) => text.split(/[|\n]/).map((row) => row.trim()).filter(Boolean);

// Each code, exactly as written, and each name, plain, to the keys it can
// stand for: a country's alpha-2 code, or a region's as "US-NY". A code can
// stand for more than one, as CA does for Canada and California.
const BY_CODE = new Map();
const BY_NAME = new Map();
const add = (map, text, key) => map.set(text, new Set([...(map.get(text) ?? []), key]));
for (const row of rows(COUNTRY_ROWS)) {
  const [alpha2, alpha3, ...name] = row.split(" ");
  add(BY_CODE, alpha2, alpha2);
  add(BY_CODE, alpha3, alpha2);
  add(BY_NAME, plain(name.join(" ")), alpha2);
}
for (const [alpha2, aliases] of Object.entries(COUNTRY_ALIASES)) {
  for (const alias of aliases) {
    if (/^[A-Z]{2,3}$/.test(alias)) add(BY_CODE, alias, alpha2);
    else add(BY_NAME, plain(alias), alpha2);
  }
}
for (const [country, text] of Object.entries(REGION_ROWS)) {
  for (const row of rows(text)) {
    const [code, ...name] = row.split(" ");
    add(BY_CODE, code, `${country}-${code}`);
    add(BY_NAME, plain(name.join(" ")), `${country}-${code}`);
  }
}

/**
 * The countries and regions a piece of a place can stand for, as keys:
 * "US" for a country, "US-NY" for a region. Empty when the tables don't know
 * it. A code counts only as written, in capitals, so "OR" is Oregon but "Or"
 * is nothing; a name counts whatever its case and accents.
 *
 * @param {string} piece
 * @returns {Set<string>}
 */
export function placeKeys(piece) {
  const text = piece.trim();
  return new Set([...(BY_CODE.get(text) ?? []), ...(BY_NAME.get(plain(text)) ?? [])]);
}

const known = (piece) => placeKeys(piece).size > 0;

/**
 * A place split into its town and the states and countries written after
 * it. The pieces after the first comma, or bracket, that the tables know
 * are qualifiers; the others are left out. Within the first piece, words at
 * its end that the tables know are qualifiers too, as KY in "Hodgenville KY",
 * the longest first, but its first word always stays the town's, so
 * "Washington, DC" and "New York, NY" keep their towns.
 *
 * @param {string} text  as printed: "Hodgenville KY, USA", "New York, NY (US)"
 * @returns {{ town: string, qualifiers: string[] }}
 */
export function placeParts(text) {
  const [first = "", ...rest] = text
    .replace(/[()]/g, ",")
    .split(",")
    .map((piece) => piece.trim())
    .filter(Boolean);
  const words = first.split(/\s+/);
  const trailing = [];
  while (words.length > 1) {
    const size = [3, 2, 1].find((count) => count < words.length && known(words.slice(-count).join(" ")));
    if (size === undefined) break;
    trailing.unshift(words.splice(-size).join(" "));
  }
  const after = rest.flatMap((piece) => {
    if (known(piece)) return [piece];
    const pieceWords = piece.split(/\s+/);
    return pieceWords.length > 1 && pieceWords.every(known) ? pieceWords : [];
  });
  return { town: words.join(" "), qualifiers: [...trailing, ...after] };
}

/**
 * Whether a site's match agrees with a place's qualifiers: each qualifier
 * stands for a country or region the match's own pieces do. A place with
 * none agrees with every match.
 *
 * @param {string[]} qualifiers  placeParts' qualifiers
 * @param {string[]} pieces  the match's text between its name and its coordinates, in pieces
 */
export function placeAgrees(qualifiers, pieces) {
  const keys = new Set(pieces.flatMap((piece) => [...placeKeys(piece)]));
  return qualifiers.every((qualifier) => [...placeKeys(qualifier)].some((key) => keys.has(key)));
}
