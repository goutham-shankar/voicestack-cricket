import { Timestamp, type Query, type Transaction } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase";
import { DuplicateKeyError } from "@/lib/db-errors";

/**
 * A thin, honest query layer over Firestore, in place of Mongoose.
 *
 * It keeps the shape the rest of the app already speaks — plain objects with a
 * string `_id` plus `createdAt`/`updatedAt` — and supports only the handful of
 * operators this codebase actually uses. Two deliberate choices:
 *
 *  - Sorting and grouping happen in memory. An auction's collections are small
 *    (hundreds of rows), and this keeps Firestore composite indexes out of the
 *    deployment story entirely.
 *  - Unique fields are enforced in a transaction here, because Firestore has no
 *    unique indexes.
 */

export type Condition<V> = V | { $in: V[] } | { $ne: V } | { $contains: V };

export type Filter<T> = {
  [K in keyof T]?: Condition<T[K] extends Array<infer E> ? E | T[K] : T[K]>;
};

export type SortSpec<T> = Partial<Record<keyof T | "createdAt" | "updatedAt", 1 | -1>>;

export type Timestamps = { createdAt: Date; updatedAt: Date };
export type Doc<T> = T & { _id: string } & Timestamps;

type FindOptions<T> = {
  sort?: SortSpec<T>;
  limit?: number;
};

/** Firestore Timestamps become Dates, so callers can keep doing `.getTime()`. */
function fromFirestore(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(fromFirestore);
  if (value && typeof value === "object" && value.constructor === Object) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = fromFirestore(item);
    }
    return out;
  }
  return value;
}

function isOperator(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value instanceof Date || value instanceof Timestamp) return false;
  return ["$in", "$ne", "$contains"].some((key) => key in value);
}

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  // Nulls sort last either way, matching how Mongo ordered missing values here.
  if (a == null) return 1;
  if (b == null) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") {
    return Number(a) - Number(b);
  }
  return String(a).localeCompare(String(b));
}

function sortDocs<T>(rows: Doc<T>[], sort: SortSpec<T>): Doc<T>[] {
  const keys = Object.entries(sort) as [string, 1 | -1][];
  if (!keys.length) return rows;

  return [...rows].sort((left, right) => {
    for (const [key, direction] of keys) {
      const result = compare(
        (left as Record<string, unknown>)[key],
        (right as Record<string, unknown>)[key]
      );
      if (result !== 0) return result * direction;
    }
    return 0;
  });
}

export type CollectionDef<T> = {
  name: string;
  /** Applied to every created document, so reads never see missing fields. */
  defaults: () => T;
  /** Fields Firestore must treat as unique, enforced transactionally. */
  unique?: (keyof T & string)[];
};

export function collection<T extends Record<string, unknown>>(def: CollectionDef<T>) {
  const { name, defaults, unique = [] } = def;

  const ref = () => getDb().collection(name);

  function build(filter?: Filter<T>): Query {
    let query: Query = ref();
    for (const [field, condition] of Object.entries(filter ?? {})) {
      if (condition === undefined) continue;

      if (!isOperator(condition)) {
        query = query.where(field, "==", condition ?? null);
        continue;
      }

      const op = condition as Record<string, unknown>;
      if ("$in" in op) query = query.where(field, "in", op.$in as unknown[]);
      if ("$ne" in op) query = query.where(field, "!=", op.$ne ?? null);
      if ("$contains" in op) {
        query = query.where(field, "array-contains", op.$contains);
      }
    }
    return query;
  }

  function hydrate(
    snapshot: { id: string; data: () => Record<string, unknown> | undefined }
  ): Doc<T> {
    const data = (fromFirestore(snapshot.data() ?? {}) ?? {}) as T & Timestamps;
    return { ...data, _id: snapshot.id };
  }

  /** Rejects the write when any unique field already belongs to another doc. */
  async function assertUnique(
    txn: Transaction,
    data: Partial<T>,
    exceptId?: string
  ) {
    for (const field of unique) {
      const value = data[field];
      if (value === undefined) continue;
      const clash = await txn.get(ref().where(field, "==", value).limit(2));
      if (clash.docs.some((doc) => doc.id !== exceptId)) {
        throw new DuplicateKeyError(field);
      }
    }
  }

  return {
    name,
    defaults,
    ref,
    doc: (id: string) => ref().doc(id),
    hydrate,

    async find(filter?: Filter<T>, options?: FindOptions<T>): Promise<Doc<T>[]> {
      const snapshot = await build(filter).get();
      let rows = snapshot.docs.map(hydrate);
      if (options?.sort) rows = sortDocs(rows, options.sort);
      if (options?.limit != null) rows = rows.slice(0, options.limit);
      return rows;
    },

    async findOne(
      filter: Filter<T>,
      options?: FindOptions<T>
    ): Promise<Doc<T> | null> {
      const rows = await this.find(filter, { ...options, limit: 1 });
      return rows[0] ?? null;
    },

    async findById(id: string | null | undefined): Promise<Doc<T> | null> {
      if (!id) return null;
      const snapshot = await ref().doc(id).get();
      return snapshot.exists ? hydrate(snapshot) : null;
    },

    async count(filter?: Filter<T>): Promise<number> {
      const snapshot = await build(filter).count().get();
      return snapshot.data().count;
    },

    async exists(filter: Filter<T>): Promise<boolean> {
      const snapshot = await build(filter).limit(1).get();
      return !snapshot.empty;
    },

    async create(data: Partial<T>): Promise<Doc<T>> {
      const now = Timestamp.now();
      const payload = {
        ...defaults(),
        ...data,
        createdAt: now,
        updatedAt: now,
      };
      const docRef = ref().doc();

      if (unique.length) {
        await getDb().runTransaction(async (txn) => {
          await assertUnique(txn, data);
          txn.create(docRef, payload);
        });
      } else {
        await docRef.create(payload);
      }

      return { ...(fromFirestore(payload) as T & Timestamps), _id: docRef.id };
    },

    /** One batched insert, used by the player importer. */
    async createMany(rows: Partial<T>[]): Promise<Doc<T>[]> {
      const now = Timestamp.now();
      const batch = getDb().batch();
      const created: Doc<T>[] = [];

      for (const row of rows) {
        const docRef = ref().doc();
        const payload = { ...defaults(), ...row, createdAt: now, updatedAt: now };
        batch.create(docRef, payload);
        created.push({
          ...(fromFirestore(payload) as T & Timestamps),
          _id: docRef.id,
        });
      }

      await batch.commit();
      return created;
    },

    async updateById(id: string, patch: Partial<T>): Promise<Doc<T> | null> {
      const docRef = ref().doc(id);
      const payload = { ...patch, updatedAt: Timestamp.now() };

      // Without unique fields there is nothing to serialise against, so skip
      // the transaction — it would cost an extra round trip on every write.
      if (!unique.length) {
        const snapshot = await docRef.get();
        if (!snapshot.exists) return null;
        await docRef.update(payload);
        return {
          ...hydrate(snapshot),
          ...(fromFirestore(payload) as Partial<T>),
        } as Doc<T>;
      }

      const updated = await getDb().runTransaction(async (txn) => {
        const snapshot = await txn.get(docRef);
        if (!snapshot.exists) return null;
        await assertUnique(txn, patch, id);
        txn.update(docRef, payload);
        return { ...hydrate(snapshot), ...(fromFirestore(payload) as Partial<T>) };
      });

      return updated as Doc<T> | null;
    },

    /** `patch` may carry FieldValue sentinels (arrayRemove, increment, …). */
    async updateMany(
      filter: Filter<T>,
      patch: Record<string, unknown>
    ): Promise<number> {
      const snapshot = await build(filter).get();
      if (snapshot.empty) return 0;

      const batch = getDb().batch();
      for (const doc of snapshot.docs) {
        batch.update(doc.ref, { ...patch, updatedAt: Timestamp.now() });
      }
      await batch.commit();
      return snapshot.size;
    },

    async deleteById(id: string): Promise<boolean> {
      const docRef = ref().doc(id);
      const snapshot = await docRef.get();
      if (!snapshot.exists) return false;
      await docRef.delete();
      return true;
    },

    async deleteMany(filter?: Filter<T>): Promise<number> {
      const snapshot = await build(filter).get();
      if (snapshot.empty) return 0;

      const batch = getDb().batch();
      for (const doc of snapshot.docs) batch.delete(doc.ref);
      await batch.commit();
      return snapshot.size;
    },
  };
}

/**
 * Reads the single document of a settings-style collection, creating it from
 * the collection's defaults the first time. Replaces Mongoose's
 * `findOneAndUpdate({ singleton }, …, { upsert: true })`.
 */
export async function getSingleton<T extends Record<string, unknown>>(
  col: ReturnType<typeof collection<T>>,
  id = "global"
): Promise<Doc<T>> {
  const existing = await col.findById(id);
  if (existing) return existing;

  const now = Timestamp.now();
  try {
    await col
      .ref()
      .doc(id)
      .create({ ...col.defaults(), createdAt: now, updatedAt: now });
  } catch {
    // Another request created it first; its version is the one that counts.
  }

  const seeded = await col.findById(id);
  if (!seeded) throw new Error(`Could not initialise ${col.name}/${id}`);
  return seeded;
}
