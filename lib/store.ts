import "server-only";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import type { Connection } from "./types";

/**
 * Almacenamiento mínimo en un fichero JSON (.data/store.json).
 * Suficiente para desarrollo; en producción sustitúyelo por una base de datos.
 * Los access tokens de Plaid se guardan cifrados con AES-256-GCM.
 */
type StoreShape = { users: Record<string, { connections: Connection[] }> };

const DATA_DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "store.json");

let queue: Promise<unknown> = Promise.resolve();

async function read(): Promise<StoreShape> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as StoreShape;
  } catch {
    return { users: {} };
  }
}

async function write(data: StoreShape) {
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  await fs.rename(tmp, FILE);
}

/** Serializa las escrituras para evitar condiciones de carrera dentro del proceso. */
function mutate<T>(fn: (data: StoreShape) => T): Promise<T> {
  const run = queue.then(async () => {
    const data = await read();
    const result = fn(data);
    await write(data);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function listConnections(userId: string): Promise<Connection[]> {
  const data = await read();
  return data.users[userId]?.connections ?? [];
}

export function addConnection(userId: string, conn: Connection) {
  return mutate((data) => {
    const user = (data.users[userId] ??= { connections: [] });
    user.connections.push(conn);
    return conn;
  });
}

export function removeConnection(userId: string, connectionId: string) {
  return mutate((data) => {
    const user = data.users[userId];
    if (!user) return undefined;
    const found = user.connections.find((c) => c.id === connectionId);
    user.connections = user.connections.filter((c) => c.id !== connectionId);
    return found;
  });
}

/**
 * Clave dedicada para cifrar tokens (independiente de AUTH_SECRET, que solo firma sesiones).
 * TOKEN_ENCRYPTION_KEY: 32 bytes en base64 (`openssl rand -base64 32`).
 * En producción debería venir de un KMS / gestor de secretos.
 */
let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  const ikm = raw ? Buffer.from(raw, "base64") : null;
  if (!ikm || ikm.length < 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY debe ser una clave de 32 bytes en base64");
  }
  cachedKey = Buffer.from(crypto.hkdfSync("sha256", ikm, Buffer.alloc(0), "plaid-access-token:v1", 32));
  return cachedKey;
}

/**
 * Cifra con AES-256-GCM. `aad` (usuario + conexión) se autentica junto al texto:
 * un token cifrado copiado a otro usuario o conexión no se puede descifrar.
 */
export function encrypt(plain: string, aad: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return "v1." + [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string, aad: string): string {
  const [version, ...parts] = payload.split(".");
  if (version !== "v1" || parts.length !== 3) throw new Error("Formato de token cifrado no soportado");
  const [iv, tag, enc] = parts.map((p) => Buffer.from(p, "base64url"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export const tokenAad = (userId: string, connectionId: string) => `${userId}:${connectionId}`;
