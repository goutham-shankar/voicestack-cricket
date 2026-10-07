import { ObjectId, type Collection as MongoCollection, type Filter as MongoFilter, type Document } from "mongodb";
import { getDb } from "@/lib/mongo";
import { DuplicateKeyError } from "@/lib/db-errors";

/**
 * A thin, honest query layer over MongoDB.
 *
 * It keeps the shape the rest of the app speaks — plain objects with a string
 * `_id` plus `createdAt`/`updatedAt` — and supports only the handful of
 * operators this codebase actually uses. Two deliberate choices:
 *
 *  - Sorting happens in memory. An auction's collections are small (hundreds of
 *    rows) and this keeps the ordering rules identical for every collection,
 *    including the null-handling and the locale-aware string compare.
 *  - `_id` is an ObjectId in the database but a string everywhere above this
 *    file, so nothing outside has to know which driver is underneath.
 */

export type Condition<V> =
  | V
  | { $in: V[] }
  | { $ne: V }
  | { $contains: V }
  | { $size: number }
  | { $exists: boolean };

export type Filter<T> = {
  [K in keyof T]?: Condition<T[K] extends Array<infer E> ? E | T[K] : T[K]>;
} & { _id?: Condition<string> };

export type SortSpec<T> = Partial<Record<keyof T | "createdAt" | "updatedAt", 1 | -1>>;

export type Timestamps = { createdAt: Date; updatedAt: Date };
export type Doc<T> = T & { _id: string } & Timestamps;

type FindOptions<T> = {
  sort?: SortSpec<T>;
  limit?: number;
};

/** Array and field operators a caller may pass straight through to Mongo. */
export type UpdateOps = {
  $push?: Record<string, unknown>;
  $pull?: Record<string, unknown>;
  $pop?: Record<string, 1 | -1>;
  $inc?: Record<string, number>;
};

const OPERATOR_KEYS = ["$in", "$ne", "$contains", "$size", "$exists"];
const UPDATE_OP_KEYS = ["$push", "$pull", "$pop", "$inc"];

/**
 * Singleton collections key their one row by a literal id such as "global", so
 * an id is only converted when it actually looks like an ObjectId.
 */
function toId(id: string): ObjectId | string {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === id
    ? new ObjectId(id)
    : id;
}

function isOperator(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value instanceof Date || value instanceof ObjectId) return false;
  return OPERATOR_KEYS.some((key) => key in value);
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

/**
 * Anything caching derived state needs to know when the database changes.
 * Every write below notifies, so a cache can never outlive its data — the
 * auction service's snapshot subscribes to this.
 */
const writeListeners = new Set<() => void>();

export function onDbWrite(listener: () => void): () => void {
  writeListeners.add(listener);
  return () => writeListeners.delete(listener);
}

export function notifyDbWrite() {
  for (const listener of writeListeners) listener();
}

/** Mongo reports a unique-index violation as E11000; name the field it hit. */
function asDuplicate(error: unknown, unique: string[]): never {
  const err = error as { code?: number; keyPattern?: Record<string, unknown> };
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {}).join("+") || unique[0] || "field";
    throw new DuplicateKeyError(field);
  }
  throw error;
}

export type CollectionDef<T> = {
  name: string;
  /** Applied to every created document, so reads never see missing fields. */
  defaults: () => T;
  /** Fields backed by a unique index. */
  unique?: (keyof T & string)[];
  /** Field groups backed by a compound unique index. */
  uniqueCompound?: (keyof T & string)[][];
};

/**
 * Creates a unique index once per process, and never lets that get in the way
 * of serving a request.
 *
 * Two things this has to survive. A database built by an earlier version of
 * this app already carries the same index under Mongo's default name
 * (`email_1` rather than `uniq_email`), and Mongo rejects a second index on
 * the same key with a different name — error 85, IndexOptionsConflict. The
 * index we wanted is already there, so that is success, not failure.
 *
 * Anything else is logged once and swallowed. An index is a setup concern;
 * a read has no business failing because one could not be created. The old
 * behaviour rethrew *and* cleared the cached attempt, so every subsequent
 * request paid another doomed round trip to Mongo and then 500ed — which on a
 * serverless host reads as the whole app being slow and broken.
 */
async function ensureIndex(
  handle: MongoCollection<Document>,
  collectionName: string,
  keys: Record<string, 1>,
  indexName: string
): Promise<void> {
  try {
    await handle.createIndex(keys, { unique: true, name: indexName });
  } catch (error) {
    const code = (error as { code?: number }).code;
    // 85 IndexOptionsConflict / 86 IndexKeySpecsConflict: an equivalent index
    // exists under another name. Nothing to do.
    if (code === 85 || code === 86) return;
    console.warn(
      `[db] could not create index ${indexName} on ${collectionName}:`,
      error instanceof Error ? error.message : error
    );
  }
}

export function collection<T extends Record<string, unknown>>(def: CollectionDef<T>) {
  const { name, defaults, unique = [], uniqueCompound = [] } = def;
  const hasIndexes = unique.length > 0 || uniqueCompound.length > 0;

  /**
   * Indexes are created once per process, on first use, and the promise is
   * cached so concurrent callers share the single attempt.
   */
  let indexesReady: Promise<void> | null = null;

  async function col(): Promise<MongoCollection<Document>> {
    const database = await getDb();
    const handle = database.collection(name);

    if (hasIndexes && !indexesReady) {
      indexesReady = Promise.all([
        ...unique.map((field) =>
          ensureIndex(handle, name, { [field]: 1 }, `uniq_${field}`)
        ),
        ...uniqueCompound.map((fields) =>
          ensureIndex(
            handle,
            name,
            Object.fromEntries(fields.map((field) => [field, 1])),
            `uniq_${fields.join("_")}`
          )
        ),
      ]).then(() => undefined);
    }
    if (indexesReady) await indexesReady;

    return handle;
  }

  function hydrate(row: Document): Doc<T> {
    const { _id, ...rest } = row;
    return { ...(rest as T & Timestamps), _id: String(_id) };
  }

  function build(filter?: Filter<T>): MongoFilter<Document> {
    const out: Record<string, unknown> = {};

    for (const [field, condition] of Object.entries(filter ?? {})) {
      if (condition === undefined) continue;
      const cast = (value: unknown) =>
        field === "_id" && typeof value === "string" ? toId(value) : value;

      if (!isOperator(condition)) {
        out[field] = cast(condition ?? null);
        continue;
      }

      const op = condition as Record<string, unknown>;
      if ("$in" in op) out[field] = { $in: (op.$in as unknown[]).map(cast) };
      if ("$ne" in op) out[field] = { $ne: cast(op.$ne ?? null) };
      // A scalar matched against an array field means "contains" in Mongo;
      // $all states that explicitly so the intent survives a later reading.
      if ("$contains" in op) out[field] = { $all: [op.$contains] };
      if ("$size" in op) out[field] = { $size: op.$size };
      if ("$exists" in op) out[field] = { $exists: op.$exists };
    }

    return out as MongoFilter<Document>;
  }

  /** Splits a caller's patch into its `$set` fields and its raw operators. */
  function buildUpdate(patch: Record<string, unknown>): Document {
    const set: Record<string, unknown> = {};
    const update: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(patch)) {
      if (UPDATE_OP_KEYS.includes(key)) update[key] = value;
      else set[key] = value;
    }

    set.updatedAt = new Date();
    update.$set = set;
    return update as Document;
  }

  return {
    name,
    defaults,

    async find(filter?: Filter<T>, options?: FindOptions<T>): Promise<Doc<T>[]> {
      const handle = await col();
      const rows = (await handle.find(build(filter)).toArray()).map(hydrate);
      const sorted = options?.sort ? sortDocs(rows, options.sort) : rows;
      return options?.limit != null ? sorted.slice(0, options.limit) : sorted;
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
      const handle = await col();
      const row = await handle.findOne({ _id: toId(id) } as MongoFilter<Document>);
      return row ? hydrate(row) : null;
    },

    async count(filter?: Filter<T>): Promise<number> {
      const handle = await col();
      return handle.countDocuments(build(filter));
    },

    async exists(filter: Filter<T>): Promise<boolean> {
      const handle = await col();
      return (await handle.findOne(build(filter), { projection: { _id: 1 } })) != null;
    },

    async create(data: Partial<T>): Promise<Doc<T>> {
      const handle = await col();
      const now = new Date();
      const payload = { ...defaults(), ...data, createdAt: now, updatedAt: now };

      try {
        const result = await handle.insertOne(payload as Document);
        notifyDbWrite();
        return { ...(payload as T & Timestamps), _id: String(result.insertedId) };
      } catch (error) {
        asDuplicate(error, unique);
      }
    },

    /** One batched insert, used by the player importer. */
    async createMany(rows: Partial<T>[]): Promise<Doc<T>[]> {
      if (!rows.length) return [];
      const handle = await col();
      const now = new Date();
      const payloads = rows.map((row) => ({
        ...defaults(),
        ...row,
        createdAt: now,
        updatedAt: now,
      }));

      try {
        const result = await handle.insertMany(payloads as Document[]);
        notifyDbWrite();
        return payloads.map((payload, index) => ({
          ...(payload as T & Timestamps),
          _id: String(result.insertedIds[index]),
        }));
      } catch (error) {
        asDuplicate(error, unique);
      }
    },

    async updateById(
      id: string,
      patch: Partial<T> & UpdateOps
    ): Promise<Doc<T> | null> {
      const handle = await col();
      try {
        const row = await handle.findOneAndUpdate(
          { _id: toId(id) } as MongoFilter<Document>,
          buildUpdate(patch as Record<string, unknown>),
          { returnDocument: "after" }
        );
        if (!row) return null;
        notifyDbWrite();
        return hydrate(row);
      } catch (error) {
        asDuplicate(error, unique);
      }
    },

    /**
     * The conditional claim the auction leans on: moves a document only while
     * it still matches `filter`, in one atomic operation. Returns the updated
     * document, or null when another request got there first.
     */
    async findOneAndUpdate(
      filter: Filter<T>,
      patch: Partial<T> & UpdateOps,
      options?: { returnDocument?: "before" | "after" }
    ): Promise<Doc<T> | null> {
      const handle = await col();
      try {
        const row = await handle.findOneAndUpdate(
          build(filter),
          buildUpdate(patch as Record<string, unknown>),
          { returnDocument: options?.returnDocument ?? "after" }
        );
        if (!row) return null;
        notifyDbWrite();
        return hydrate(row);
      } catch (error) {
        asDuplicate(error, unique);
      }
    },

    async updateMany(
      filter: Filter<T>,
      patch: Record<string, unknown>
    ): Promise<number> {
      const handle = await col();
      const result = await handle.updateMany(build(filter), buildUpdate(patch));
      if (result.modifiedCount) notifyDbWrite();
      return result.modifiedCount;
    },

    /**
     * Reads the row at `id`, creating it from the collection's defaults when it
     * is absent. A single upsert, so two requests racing on a cold database
     * cannot produce two rows. Nothing is written when the row already exists.
     */
    async ensureById(id: string): Promise<Doc<T> | null> {
      const handle = await col();
      const now = new Date();
      const row = await handle.findOneAndUpdate(
        { _id: toId(id) } as MongoFilter<Document>,
        { $setOnInsert: { ...defaults(), createdAt: now, updatedAt: now } },
        { upsert: true, returnDocument: "after" }
      );
      if (!row) return null;
      notifyDbWrite();
      return hydrate(row);
    },

    async deleteById(id: string): Promise<boolean> {
      const handle = await col();
      const result = await handle.deleteOne({ _id: toId(id) } as MongoFilter<Document>);
      if (result.deletedCount) notifyDbWrite();
      return result.deletedCount > 0;
    },

    async deleteMany(filter?: Filter<T>): Promise<number> {
      const handle = await col();
      const result = await handle.deleteMany(build(filter));
      if (result.deletedCount) notifyDbWrite();
      return result.deletedCount;
    },
  };
}

/**
 * Reads the single document of a settings-style collection, creating it from
 * the collection's defaults the first time. One upsert, so two requests racing
 * on a cold database cannot produce two rows.
 */
export async function getSingleton<T extends Record<string, unknown>>(
  col: ReturnType<typeof collection<T>>,
  id = "global"
): Promise<Doc<T>> {
  const seeded = await col.ensureById(id);
  if (!seeded) throw new Error(`Could not initialise ${col.name}/${id}`);
  return seeded;
}
