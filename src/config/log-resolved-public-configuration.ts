import { Logger } from '@nestjs/common';
import { normalizeQuotedEnvValue } from './env-normalize';

const logger = new Logger('ConfigModule');

/** Keys safe to print in full (no credentials or session secrets). */
const PUBLIC_VALUE_KEYS: readonly string[] = [
  'NODE_ENV',
  'PORT',
  'FRONTEND_URL',
  'JWT_EXPIRES_IN',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CALLBACK_URL',
  'STORAGE_TYPE',
  'UPLOADS_DIR',
  'UPLOADS_BASE_URL',
  'AVATAR_PLACEHOLDER_URL',
  'AWS_S3_BUCKET_NAME',
  'AWS_S3_REGION',
  'AWS_S3_URL',
  'GEMINI_TEXT_MODEL',
  'GEMINI_IMAGE_MODEL',
  'GEMINI_TTS_MODEL',
  'GEMINI_TTS_VOICE',
  'PROMPTS_DIR',
  'CSE_APPROVAL_THRESHOLD',
  'EMAIL_PROVIDER',
  'MAIL_FROM_EMAIL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
];

/** Never log values; only whether the app saw a non-empty value. */
const SECRET_PRESENCE_KEYS: readonly string[] = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GOOGLE_CLIENT_SECRET',
  'GEMINI_API_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'SMTP_USER',
  'SMTP_PASSWORD',
];

export function logResolvedPublicConfiguration(
  config: Record<string, unknown>,
): void {
  logger.log('Non-sensitive configuration (resolved at startup)');
  for (const key of PUBLIC_VALUE_KEYS) {
    const v = config[key];
    if (v === undefined) {
      logger.log(`  ${key}=(unset)`);
      continue;
    }
    const display = normalizeQuotedEnvValue(String(v));
    if (display === '') {
      logger.log(`  ${key}=(unset)`);
      continue;
    }
    logger.log(`  ${key}=${display}`);
  }
  for (const key of SECRET_PRESENCE_KEYS) {
    const v = config[key];
    const present =
      normalizeQuotedEnvValue(
        v === undefined || v === null ? '' : String(v),
      ) !== '';
    logger.log(`  ${key}=${present ? '(set)' : '(unset)'}`);
  }
}
