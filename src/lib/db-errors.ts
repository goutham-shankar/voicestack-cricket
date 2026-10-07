/**
 * A unique-index violation, normalised. `collection()` raises this in place of
 * MongoDB's raw E11000 so routes can map it to a 409 without reaching for a
 * driver error code.
 */
export class DuplicateKeyError extends Error {
  field: string;

  constructor(field: string) {
    super(`Duplicate value for unique field "${field}"`);
    this.name = "DuplicateKeyError";
    this.field = field;
  }
}

export function isDuplicateKeyError(err: unknown): boolean {
  return err instanceof DuplicateKeyError;
}
