/**
 * Curated TMDB movie IDs for Cannes Palme d'Or winners and adjacent festival canon.
 */
export const CANNES_PALME_TMDB_IDS = new Set([
  496243, // Parasite (2019)
  915935, // Anatomy of a Fall (2023)
  497828, // Triangle of Sadness (2022)
  630240, // Titane (2021)
  430727, // Shoplifters (2018)
  399452, // The Square (2017)
  334524, // I, Daniel Blake (2016)
  7345, // Dheepan (2015)
  267864, // Winter Sleep (2014)
  109087, // Blue Is the Warmest Color (2013)
  80153, // Amour (2012)
  44238, // The Tree of Life (2011)
  37957, // Uncle Boonmee (2010)
  8266, // The White Ribbon (2009)
  13475, // Gomorrah (2008)
  14560, // 4 Months, 3 Weeks and 2 Days (2007)
  10189, // The Wind That Shakes the Barley (2006)
  14048, // L'Enfant (2005)
  4502, // Elephant (2003)
  423, // The Pianist (2002)
  1018, // Mulholland Drive (2001)
  16, // Dancer in the Dark (2000)
  11051, // Rosetta (1999)
  30061, // Taste of Cherry (1997)
  11165, // Secrets & Lies (1996)
  680, // Pulp Fiction (1994)
  10997, // Farewell My Concubine (1993)
  290, // Barton Fink (1991)
  767, // sex, lies, and videotape (1989)
  126, // Paris, Texas (1984)
  30063, // Nostalghia (1983)
  708, // The Conversation (1974)
  103, // Taxi Driver (1976)
  28, // Apocalypse Now (1979)
  510, // One Flew Over the Cuckoo's Nest (1975)
  843, // The 400 Blows (1959)
  842, // 8½ (1963)
  11216, // Cinema Paradiso (1988)
  152601, // The Great Beauty (2013)
  376867, // The Handmaiden (2016)
  374452, // Toni Erdmann (2016)
  331482, // The Lobster (2015)
  16869, // In the Mood for Love (2000)
  103663, // The Hunt (2012)
  110416, // Holy Motors (2012)
  290098, // Ida (2013)
  146239, // A Separation (2011)
  57119, // Certified Copy (2010)
  1124, // The Seventh Seal (1957)
  832, // Bicycle Thieves (1948)
  780, // Oldboy (2003)
  313369, // Carol (2015)
  264644, // Mustang (2015)
  264660, // Son of Saul (2015)
]);

/** TMDB production company IDs tied to art-house / boutique distribution. */
export const ART_HOUSE_COMPANY_IDS = [
  10932, // The Criterion Collection
  11586, // Janus Films
  43, // American Zoetrope
  6705, // Film4 Productions
  729, // MK2
  10868, // HanWay Films
  19749, // Curzon Artificial Eye
];

/** TMDB keyword IDs for indie / festival / art-house lanes. */
export const ART_HOUSE_KEYWORD_IDS = [9672, 12565, 162813, 155477];

/** Blockbuster / franchise keywords to deprioritize. */
export const MAINSTREAM_KEYWORD_IDS = [9715, 9717, 9882, 161176];

export const CRITERION_COMPANY_ID = 10932;

export function isFestivalCanon(tmdbId: number): boolean {
  return CANNES_PALME_TMDB_IDS.has(tmdbId);
}

export interface ArtHouseSignals {
  tmdbId: number;
  voteAverage?: number;
  voteCount?: number;
  popularity?: number;
  originalLanguage?: string | null;
}

export function artHouseTier(signals: ArtHouseSignals): 0 | 1 | 2 | 3 {
  const { tmdbId, voteAverage = 0, voteCount = 0, popularity = 0, originalLanguage } =
    signals;

  if (isFestivalCanon(tmdbId)) return 3;

  const foreign = originalLanguage && originalLanguage !== "en";
  const criticallyAcclaimed =
    voteAverage >= 7.3 && voteCount >= 40 && voteCount <= 2800;
  const boutiqueScale = voteCount <= 1800 && popularity <= 18;
  const cultDeepCut = voteAverage >= 7.0 && voteCount <= 900 && popularity <= 14;

  if (criticallyAcclaimed && boutiqueScale) return 3;
  if (foreign && voteAverage >= 6.9 && popularity <= 24 && voteCount <= 3200) {
    return 2;
  }
  if (cultDeepCut) return 2;
  if (voteAverage >= 7.0 && popularity <= 26 && voteCount <= 3500) return 1;

  return 0;
}

export function isArtHouseCandidate(signals: ArtHouseSignals): boolean {
  return artHouseTier(signals) >= 1;
}

export function isMainstreamBlock(signals: ArtHouseSignals): boolean {
  const { voteCount = 0, popularity = 0, voteAverage = 0, tmdbId } = signals;

  if (isFestivalCanon(tmdbId)) return false;

  if (voteCount >= 4500 || popularity >= 38) return true;
  if (popularity >= 30 && voteAverage < 7.6) return true;
  if (voteCount >= 2800 && popularity >= 22) return true;

  return false;
}

export function artHouseBoost(signals: ArtHouseSignals): number {
  const tier = artHouseTier(signals);
  let boost = tier * 4;

  if (isFestivalCanon(signals.tmdbId)) boost += 6;

  const { voteAverage = 0, voteCount = 0, popularity = 0, originalLanguage } =
    signals;

  if (voteAverage >= 7.5 && voteCount <= 1500) boost += 2.5;
  if (originalLanguage && originalLanguage !== "en" && voteAverage >= 7.0) {
    boost += 1.5;
  }
  if (popularity <= 10 && voteAverage >= 7.0) boost += 2;

  return boost;
}
