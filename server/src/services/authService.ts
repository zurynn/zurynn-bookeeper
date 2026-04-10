import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middlewares/errorHandler';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email';
import { logger } from '../utils/logger';
import {
  findUserByEmail,
  findUserById,
  createUser,
  verifyUserEmail,
  updateUserPassword,
  findUserByVerificationToken,
  createSession,
  findSession,
  deleteSession,
  updateSession,
  createPasswordReset,
  findPasswordResetByTokenHash,
  markPasswordResetUsed,
} from '../repositories/userRepository';
import { findUserCompany } from '../repositories/companyRepository';

const BCRYPT_ROUNDS = 12;

export async function registerUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  const existing = await findUserByEmail(data.email);
  if (existing) {
    throw new AppError(409, 'An account with this email already exists', 'EMAIL_EXISTS');
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const verificationToken = crypto.randomBytes(32).toString('hex');

  const userId = await createUser({
    email: data.email,
    passwordHash,
    firstName: data.firstName,
    lastName: data.lastName,
    verificationToken,
  });

  sendVerificationEmail(data.email, verificationToken).catch((err) => {
    logger.error('Failed to send verification email', { err, email: data.email });
  });

  return { userId };
}

export async function verifyEmail(token: string) {
  const user = await findUserByVerificationToken(token);
  if (!user) {
    throw new AppError(400, 'Invalid or expired verification token', 'INVALID_TOKEN');
  }
  await verifyUserEmail(user.id);
  return { success: true };
}

export async function loginUser(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (!user.emailVerified) {
    throw new AppError(403, 'Please verify your email address before logging in', 'EMAIL_NOT_VERIFIED');
  }

  const company = await findUserCompany(user.id);

  const sessionId = uuidv4();
  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    companyId: company?.id,
  });
  const refreshToken = signRefreshToken({
    userId: user.id,
    sessionId,
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await createSession({
    id: sessionId,
    userId: user.id,
    refreshToken,
    expiresAt,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified,
    },
    accessToken,
    refreshToken,
    company,
  };
}

export async function refreshTokens(refreshToken: string) {
  let payload: ReturnType<typeof verifyRefreshToken>;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const session = await findSession(payload.sessionId);
  if (!session || session.refreshToken !== refreshToken) {
    throw new AppError(401, 'Session not found or token mismatch', 'SESSION_INVALID');
  }

  if (new Date() > session.expiresAt) {
    await deleteSession(session.id);
    throw new AppError(401, 'Session expired', 'SESSION_EXPIRED');
  }

  const user = await findUserById(payload.userId);
  if (!user) {
    throw new AppError(401, 'User not found', 'USER_NOT_FOUND');
  }

  const userCompany = await findUserCompany(user.id);
  const newAccessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    companyId: userCompany?.id,
  });
  const newRefreshToken = signRefreshToken({
    userId: user.id,
    sessionId: session.id,
  });

  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + 7);

  await updateSession(session.id, newRefreshToken, newExpiresAt);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logoutUser(refreshToken: string) {
  try {
    const payload = verifyRefreshToken(refreshToken);
    await deleteSession(payload.sessionId);
  } catch {
    // Ignore invalid token errors during logout
  }
}

export async function forgotPassword(email: string) {
  const user = await findUserByEmail(email);
  if (!user) return { success: true };

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  await createPasswordReset({ userId: user.id, tokenHash, expiresAt });

  sendPasswordResetEmail(user.email, token).catch((err) => {
    logger.error('Failed to send password reset email', { err });
  });

  return { success: true };
}

export async function resetPassword(token: string, newPassword: string) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const reset = await findPasswordResetByTokenHash(tokenHash);
  
  if (!reset) {
    throw new AppError(400, 'Invalid or expired reset token', 'INVALID_TOKEN');
  }

  if (new Date() > reset.expiresAt) {
    throw new AppError(400, 'Reset token has expired', 'TOKEN_EXPIRED');
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await updateUserPassword(reset.userId, passwordHash);
  await markPasswordResetUsed(reset.id);

  return { success: true };
}
