import { z } from "zod";
import { GAME_IDS } from "./games.ts";
import { ENVIRONMENT_LOCATIONS } from "./constants.ts";

export const hex32Schema = z
  .string()
  .regex(/^[0-9a-f]{64}$/i, "Expected 32-byte hex seed");

export const guestSessionSchema = z.object({
  playerId: z.string().min(8).max(80),
  displayName: z.string().min(1).max(24),
  clientSeed: z.string().min(1).max(128),
});

export const createMatchSchema = z.object({
  gameId: z.enum(GAME_IDS),
  playerId: z.string().min(8).max(80),
  displayName: z.string().min(1).max(24),
  clientSeed: z.string().min(1).max(128),
  seatCount: z.number().int().min(1).max(6).optional(),
  environmentLocation: z.enum(ENVIRONMENT_LOCATIONS).optional(),
  idempotencyKey: z.string().min(8).max(80),
});

export const matchActionSchema = z.object({
  matchId: z.string().min(8),
  playerId: z.string().min(8).max(80),
  type: z.string().min(1).max(40),
  payload: z.union([z.string(), z.number(), z.array(z.number()), z.array(z.string()), z.object({ amount: z.number() })]).optional(),
  clientActionNonce: z.number().int().nonnegative(),
  matchVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().min(8).max(80),
});

export const verifyRequestSchema = z.object({
  serverSeedHex: hex32Schema,
  clientSeedHex: hex32Schema,
  nonce: z.number().int().nonnegative(),
  commitmentHex: z.string().regex(/^[0-9a-f]{64}$/i),
  kind: z.enum(["die", "dice", "shuffle"]),
  dieCount: z.number().int().min(1).max(6).optional(),
  deckSize: z.number().int().min(2).max(54).optional(),
});

export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type MatchActionInput = z.infer<typeof matchActionSchema>;
export type VerifyRequestInput = z.infer<typeof verifyRequestSchema>;
