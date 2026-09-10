import { toInt } from '@/common/utils/parse-env';

export default () => ({
  app: {
    env: process.env.NODE_ENV || 'development',
    port: toInt(process.env.PORT, 3000),
    host: process.env.HOST || '0.0.0.0',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    corsOrigins: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean),
  },
  nin: {
    hashKey: process.env.NIN_HASH_KEY,
    encryptionKey: process.env.NIN_ENCRYPTION_KEY,
  },
  database: {
    host: process.env.DB_HOST,
    port: toInt(process.env.DB_PORT, 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  throttle: {
    ttl: toInt(process.env.THROTTLE_TTL, 60),
    limit: toInt(process.env.THROTTLE_LIMIT, 100),
  },
  mail: {
    provider: process.env.MAIL_PROVIDER || 'sendgrid',
    apiKey: process.env.MAIL_API_KEY,
    fromAddress: process.env.MAIL_FROM_ADDRESS,
  },
  sms: {
    provider: process.env.SMS_PROVIDER || 'termii',
    apiKey: process.env.SMS_API_KEY,
    senderId: process.env.SMS_SENDER_ID,
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER || 's3',
    bucket: process.env.STORAGE_BUCKET,
    region: process.env.STORAGE_REGION,
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
  },
  mfa: {
    encryptionKey: process.env.MFA_ENCRYPTION_KEY,
    issuer: process.env.MFA_ISSUER || 'iDICE ESO Portal',
  },
  security: {
    lockoutMaxAttempts: toInt(process.env.LOCKOUT_MAX_ATTEMPTS, 5),
    lockoutWindowMinutes: toInt(process.env.LOCKOUT_WINDOW_MINUTES, 15),
    lockoutDurationMinutes: toInt(process.env.LOCKOUT_DURATION_MINUTES, 30),
  },
});
