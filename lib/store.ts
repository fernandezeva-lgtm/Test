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
  await fs.mkdir(DATA_DIR, { recursive: true });
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

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET no está configurado");
  return crypto.createHash("sha256").update(`plaid-token:${secret}`).digest();
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
