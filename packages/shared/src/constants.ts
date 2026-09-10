export const PLATFORM_NAME = "TrueTurn";
export const PLATFORM_TAGLINE = "The table does not blink.";

export const TOKEN_DAILY_GRANT = 500;
export const TOKEN_BALANCE_CAP = 1500;
export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const STARTING_TOKENS = 1000;
export const STARTING_DIAMONDS = 0;

export const HOLDEM_SMALL_BLIND = 5;
export const HOLDEM_BIG_BLIND = 10;
export const HOLDEM_STARTING_STACK = 500;

export const FARKLE_GOAL = 10_000;
export const FARKLE_OPENING_MINIMUM = 500;

export const SPADES_WIN = 500;
export const SPADES_BAG_PENALTY_AT = 10;
export const HEARTS_END_THRESHOLD = 100;
export const PITCH_WIN = 11;
export const PINOCHLE_MIN_BID = 250;

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const ENVIRONMENT_LOCATIONS = [
  "volcano",
  "subterranean",
  "aurora",
  "harbor",
  "observatory",
  "desert-night",
  "mountain",
  "ocean",
  "lunar",
  "deep-space",
  "rainforest",
  "tundra",
] as const;

export type EnvironmentLocation = (typeof ENVIRONMENT_LOCATIONS)[number];
