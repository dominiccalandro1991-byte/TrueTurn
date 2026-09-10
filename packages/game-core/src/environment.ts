import { ENVIRONMENT_LOCATIONS, type EnvironmentLocation } from "../../shared/src/constants.ts";

export interface EnvironmentVector {
  location: EnvironmentLocation;
  coordinates: string;
  entropy: string;
  premium: boolean;
  round: number;
}

const COORD: Record<EnvironmentLocation, string> = {
  volcano: "subterranean-caldera",
  subterranean: "karst-19",
  aurora: "lat-78-night",
  harbor: "fog-berth-4",
  observatory: "ridge-12",
  "desert-night": "erg-27",
  mountain: "summit-41",
  ocean: "swell-8",
  lunar: "mare-tranquillitatis",
  "deep-space": "lagrange-2",
  rainforest: "canopy-3",
  tundra: "taiga-line",
};

export function environmentFromSeed(
  entropyHex: string,
  preferred?: EnvironmentLocation,
  premium = false,
  round = 0,
): EnvironmentVector {
  const salt = parseInt((entropyHex.slice(0, 8) + (round + 1).toString(16).padStart(4, "0")).slice(0, 8), 16) >>> 0;
  const location =
    premium && preferred && round === 0
      ? preferred
      : ENVIRONMENT_LOCATIONS[salt % ENVIRONMENT_LOCATIONS.length]!;
  return {
    location,
    coordinates: COORD[location],
    entropy: entropyHex.slice(0, 16),
    premium,
    round,
  };
}
