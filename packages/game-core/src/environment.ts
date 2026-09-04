import { ENVIRONMENT_LOCATIONS, type EnvironmentLocation } from "../../shared/src/constants.ts";

export interface EnvironmentVector {
  location: EnvironmentLocation;
  coordinates: string;
  entropy: string;
  premium: boolean;
}

const COORD: Record<EnvironmentLocation, string> = {
  volcano: "subterranean-caldera",
  subterranean: "karst-19",
  aurora: "lat-78-night",
  harbor: "fog-berth-4",
  observatory: "ridge-12",
  "desert-night": "erg-27",
};

export function environmentFromSeed(entropyHex: string, preferred?: EnvironmentLocation, premium = false): EnvironmentVector {
  const location =
    premium && preferred
      ? preferred
      : ENVIRONMENT_LOCATIONS[parseInt(entropyHex.slice(0, 8), 16) % ENVIRONMENT_LOCATIONS.length]!;
  return {
    location,
    coordinates: COORD[location],
    entropy: entropyHex.slice(0, 16),
    premium,
  };
}
