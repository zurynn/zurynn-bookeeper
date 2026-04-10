import { eq, and, isNull } from 'drizzle-orm';
import { getDb } from '../db/connection';
import { users, sessions, passwordResets } from '../db/schema';

export async function findUserByEmail(email: string) {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);
  return user || null;
}

export async function findUserById(id: number) {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .limit(1);
  return user || null;
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  verificationToken: string;
}) {
  const db = getDb();
  const [result] = await db.insert(users).values(data) as any;
  return result.insertId;
}

export async function verifyUserEmail(userId: number) {
  const db = getDb();
  await db
    .update(users)
    .set({ emailVerified: true, verificationToken: null })
    .where(eq(users.id, userId));
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = getDb();
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, userId));
}

export async function findUserByVerificationToken(token: string) {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.verificationToken, token))
    .limit(1);
  return user || null;
}

export async function createSession(data: {
  id: string;
  userId: number;
  refreshToken: string;
  expiresAt: Date;
}) {
  const db = getDb();
  await db.insert(sessions).values(data);
}

export async function findSession(id: string) {
  const db = getDb();
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, id))
    .limit(1);
  return session || null;
}

export async function deleteSession(id: string) {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.id, id));
}

export async function updateSession(id: string, refreshToken: string, expiresAt: Date) {
  const db = getDb();
  await db
    .update(sessions)
    .set({ refreshToken, expiresAt })
    .where(eq(sessions.id, id));
}

export async function createPasswordReset(data: {
  userId: number;
  tokenHash: string;
  expiresAt: Date;
}) {
  const db = getDb();
  const [result] = await db.insert(passwordResets).values(data) as any;
  return result.insertId;
}

export async function findPasswordResetByTokenHash(tokenHash: string) {
  const db = getDb();
  const [reset] = await db
    .select()
    .from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, tokenHash), isNull(passwordResets.usedAt)))
    .limit(1);
  return reset || null;
}

export async function markPasswordResetUsed(id: number) {
  const db = getDb();
  await db
    .update(passwordResets)
    .set({ usedAt: new Date() })
    .where(eq(passwordResets.id, id));
}
