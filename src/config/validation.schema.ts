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

  // JWT Configuration
  JWT_ACCESS_SECRET: z
    .string({ message: 'JWT_ACCESS_SECRET is required' })
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z
    .string({ message: 'JWT_REFRESH_SECRET is required' })
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Rate Limiting / Throttling
  THROTTLE_TTL: z.coerce.number().default(60),
  THROTTLE_LIMIT: z.coerce.number().default(100),

  // Mailer Configuration
  MAIL_PROVIDER: z.string().default('sendgrid'),
  MAIL_API_KEY: z.string({ message: 'MAIL_API_KEY is required' }).min(1),
  MAIL_FROM_ADDRESS: z
    .string({ message: 'MAIL_FROM_ADDRESS is required' })
    .email('Invalid MAIL_FROM_ADDRESS email format'),

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
