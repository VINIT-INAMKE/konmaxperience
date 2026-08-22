import { plainToInstance } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

const inProduction = (o: EnvironmentVariables) => o.NODE_ENV === 'production';
const qstashEnabled = (o: EnvironmentVariables) => !!o.QSTASH_TOKEN;

/**
 * Environment contract enforced at boot (`ConfigModule.forRoot({ validate })`).
 * Keep `backend/.env.example` in sync with this class.
 */
export class EnvironmentVariables {
  @IsOptional() @IsString() NODE_ENV?: string;

  // Always required
  @IsString() @IsNotEmpty() DATABASE_URL: string;
  @IsString() @MinLength(32) JWT_SECRET: string;

  // Required in production
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() DIRECT_DATABASE_URL?: string;
  @ValidateIf(inProduction) @IsString() @MinLength(32) JWT_REFRESH_SECRET?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() FRONTEND_URL?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() R2_ENDPOINT?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() R2_ACCESS_KEY_ID?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() R2_SECRET_ACCESS_KEY?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() R2_BUCKET_NAME?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() R2_PUBLIC_URL?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() UPSTASH_REDIS_URL?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() RAZORPAY_KEY_ID?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() RAZORPAY_KEY_SECRET?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() RAZORPAY_WEBHOOK_SECRET?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() WHATSAPP_TOKEN?: string;
  @ValidateIf(inProduction) @IsString() @IsNotEmpty() WHATSAPP_PHONE_ID?: string;

  // Required together with QSTASH_TOKEN
  @IsOptional() @IsString() QSTASH_TOKEN?: string;
  @ValidateIf(qstashEnabled) @IsString() @IsNotEmpty() QSTASH_URL?: string;
  @ValidateIf(qstashEnabled) @IsString() @IsNotEmpty() QSTASH_CURRENT_SIGNING_KEY?: string;
  @ValidateIf(qstashEnabled) @IsString() @IsNotEmpty() QSTASH_NEXT_SIGNING_KEY?: string;
}

export function validate(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const instance = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(instance, { skipMissingProperties: false });
  if (errors.length > 0) {
    const lines = errors.map(
      (e) =>
        `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
    );
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return config;
}
