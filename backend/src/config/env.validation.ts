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
 * SPEC §5.3 — the Shiprocket credentials only matter when the deployment actually
 * calls Shiprocket. `SHIPPING_PROVIDER` mirrors `SystemSetting['shipping'].provider`
 * (the runtime source of truth); development and test boots stay unaffected.
 */
const shiprocketEnabled = (o: EnvironmentVariables) =>
  o.NODE_ENV === 'production' && o.SHIPPING_PROVIDER === 'shiprocket';

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

  // Required only when SHIPPING_PROVIDER=shiprocket in production (SPEC §5.3)
  @IsOptional() @IsString() SHIPPING_PROVIDER?: string;
  /** Sandbox/staging override; defaults to SHIPROCKET_BASE_URL in shipping.constants.ts. */
  @IsOptional() @IsString() SHIPROCKET_BASE_URL?: string;
  @ValidateIf(shiprocketEnabled) @IsString() @IsNotEmpty() SHIPROCKET_EMAIL?: string;
  @ValidateIf(shiprocketEnabled) @IsString() @IsNotEmpty() SHIPROCKET_PASSWORD?: string;
  @ValidateIf(shiprocketEnabled) @IsString() @IsNotEmpty() SHIPROCKET_PICKUP_LOCATION?: string;
  @ValidateIf(shiprocketEnabled) @IsString() @MinLength(16) SHIPROCKET_WEBHOOK_TOKEN?: string;
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
