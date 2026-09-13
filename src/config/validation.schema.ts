import { z } from 'zod';

export const environmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'staging', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGINS: z.string().optional().default(''),

  // Database Configuration
  DB_HOST: z.string({ message: 'DB_HOST is required' }).min(1),
  DB_PORT: z.coerce.number().default(5432),
  DB_USERNAME: z.string({ message: 'DB_USERNAME is required' }).min(1),
  DB_PASSWORD: z.string({ message: 'DB_PASSWORD is required' }).min(1),
  DB_NAME: z.string({ message: 'DB_NAME is required' }).min(1),
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL').default('http://localhost:3000'),

  // JWT Configuration
  JWT_ACCESS_SECRET: z
    .string({ message: 'JWT_ACCESS_SECRET is required' })
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('30m'),
  JWT_REFRESH_SECRET: z
    .string({ message: 'JWT_REFRESH_SECRET is required' })
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Rate Limiting / Throttling
  THROTTLE_TTL: z.coerce.number().default(60),
  THROTTLE_LIMIT: z.coerce.number().default(100),

  // Mailer Configuration
  MAIL_PROVIDER: z
    .enum(['console', 'resend', 'aws-ses', 'sendgrid'])
    .default('console'),
  MAIL_API_KEY: z.string().optional().default(''),
  MAIL_FROM_ADDRESS: z
    .string()
    .email('Invalid MAIL_FROM_ADDRESS email format')
    .default('noreply@localhost'),

  // SMS Configuration
  SMS_PROVIDER: z.string().default('termii'),
  SMS_API_KEY: z.string({ message: 'SMS_API_KEY is required' }).min(1),
  SMS_SENDER_ID: z.string({ message: 'SMS_SENDER_ID is required' }).min(1),

  // Storage Configuration
  STORAGE_PROVIDER: z.string().default('s3'),
  STORAGE_BUCKET: z.string({ message: 'STORAGE_BUCKET is required' }).min(1),
  STORAGE_REGION: z.string({ message: 'STORAGE_REGION is required' }).min(1),
  STORAGE_ACCESS_KEY_ID: z
    .string({ message: 'STORAGE_ACCESS_KEY_ID is required' })
    .min(1),
  STORAGE_SECRET_ACCESS_KEY: z
    .string({ message: 'STORAGE_SECRET_ACCESS_KEY is required' })
    .min(1),
  MFA_ENCRYPTION_KEY: z
    .string()
    .length(64, {
      message: 'MFA_ENCRYPTION_KEY must be exactly a 64-character hex string',
    })
    .regex(/^[0-9a-fA-F]{64}$/, {
      message: 'MFA_ENCRYPTION_KEY must be a valid hex string',
    }),

  // The application name displayed inside the authenticator app (e.g., Google Authenticator, Microsoft Authenticator)
  MFA_ISSUER: z.string().default('iDICE ESO Portal'),

  NIN_HASH_KEY: z
    .string()
    .length(64, {
      message: 'NIN_HASH_KEY must be exactly a 64-character hex string',
    })
    .regex(/^[0-9a-fA-F]{64}$/, {
      message: 'NIN_HASH_KEY must be a valid hex string',
    }),
  NIN_ENCRYPTION_KEY: z
    .string()
    .length(64, {
      message: 'NIN_ENCRYPTION_KEY must be exactly a 64-character hex string',
    })
    .regex(/^[0-9a-fA-F]{64}$/, {
      message: 'NIN_ENCRYPTION_KEY must be a valid hex string',
    }),

  // Brute-force protection throttling controls
  LOCKOUT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOCKOUT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  LOCKOUT_DURATION_MINUTES: z.coerce.number().int().positive().default(30),
});

export type EnvironmentVariables = z.infer<typeof environmentSchema>;

export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const result = environmentSchema.safeParse(config);

  if (!result.success) {
    const formattedErrors = JSON.stringify(result.error.format(), null, 2);
    throw new Error(`❌ Environment Validation Error:\n${formattedErrors}`);
  }

  return result.data;
}
