/**
 * Firestore has no unique indexes, so `collection()` enforces them itself and
 * raises this when one is violated. Routes map it to a 409 exactly as they did
 * MongoDB's E11000.
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
