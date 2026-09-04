export const ERROR_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  UNAUTHORIZED: "UNAUTHORIZED",
  NOT_FOUND: "NOT_FOUND",
  OUT_OF_TURN: "OUT_OF_TURN",
  ILLEGAL_ACTION: "ILLEGAL_ACTION",
  STALE_VERSION: "STALE_VERSION",
  DUPLICATE_ACTION: "DUPLICATE_ACTION",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  MATCH_CLOSED: "MATCH_CLOSED",
  SEED_TAMPER: "SEED_TAMPER",
  RATE_LIMITED: "RATE_LIMITED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class PlatformError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;

  constructor(code: ErrorCode, message: string, retryable = false) {
    super(message);
    this.name = "PlatformError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function isPlatformError(error: unknown): error is PlatformError {
  return error instanceof PlatformError;
}
