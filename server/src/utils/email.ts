import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from './logger';

const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.port === 465,
  auth: {
    user: config.email.user,
    pass: config.email.pass,
  },
});

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    await transporter.sendMail({
      from: config.email.from,
      to,
      subject,
      html,
    });
    logger.info(`Email sent to ${to}: ${subject}`);
  } catch (error) {
    logger.error('Failed to send email', { error, to, subject });
    throw error;
  }
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const verifyUrl = `${config.frontendUrl}/verify-email?token=${token}`;
  await sendEmail(
    to,
    'Verify your Zurynn account',
    `
      <h2>Welcome to Zurynn Book Keeper!</h2>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${verifyUrl}" style="background:#6366f1;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">
        Verify Email
      </a>
      <p>This link expires in 24 hours.</p>
      <p>If you didn't create an account, you can safely ignore this email.</p>
    `
  );
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
  await sendEmail(
    to,
    'Reset your Zurynn password',
    `
      <h2>Password Reset Request</h2>
      <p>Click the button below to reset your password:</p>
      <a href="${resetUrl}" style="background:#6366f1;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;">
        Reset Password
      </a>
      <p>This link expires in 1 hour.</p>
      <p>If you didn't request a password reset, please ignore this email.</p>
    `
  );
}
