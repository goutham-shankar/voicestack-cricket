import { MongoClient, type Db } from "mongodb";

/**
 * One MongoDB connection per process, cached on `global` so Next's dev-mode
 * module reloading cannot open a new pool on every edit.
 *
 * The URI is read lazily rather than at import time: a build, a lint run or a
 * unit test can load modules that reach this file without ever opening a
 * connection, and those should not fail for want of a database.
 */
type MongoCache = {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
};

declare global {
  var _mongoCache: MongoCache | undefined;
}

const cache: MongoCache = global._mongoCache ?? { client: null, promise: null };
global._mongoCache = cache;

function uri(): string {
  const value = process.env.MONGODB_URI;
  if (!value) {
    throw new Error(
      "Missing MONGODB_URI. Set it to your MongoDB connection string."
    );
  }
  return value;
}

/** The database named in the URI, or `voicestack` when the URI omits one. */
function dbName(): string | undefined {
  return process.env.MONGODB_DB || undefined;
}

export async function getClient(): Promise<MongoClient> {
  if (cache.client) return cache.client;

  if (!cache.promise) {
    cache.promise = new MongoClient(uri(), {
      // The auction polls constantly from a handful of clients; a small pool is
      // plenty and keeps us well inside Atlas's shared-tier connection limit.
      maxPoolSize: 10,
      // Fail fast rather than hanging a request for 30s when Mongo is away.
      serverSelectionTimeoutMS: 8000,
    }).connect();
  }

  try {
    cache.client = await cache.promise;
  } catch (error) {
    // A failed attempt must not be cached, or every later request inherits it.
    cache.promise = null;
    throw error;
  }
  return cache.client;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(dbName());
}

/**
 * Closes the pooled connection. The server never needs this — the pool lives as
 * long as the process — but a one-shot script does, or Node keeps running with
 * an idle socket open and the command appears to hang.
 */
export async function closeDb(): Promise<void> {
  const client = cache.client;
  cache.client = null;
  cache.promise = null;
  if (client) await client.close();
}
