// Force IST timezone — server is in Singapore but business operates in India
process.env.TZ = 'Asia/Kolkata';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { DecimalSerializationInterceptor } from './common/interceptors/decimal-serialization.interceptor';
import type { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Trust Cloudflare proxy — ensures req.ip uses CF-Connecting-IP / X-Forwarded-For
  // Without this, rate limiting treats ALL users as one IP (the Cloudflare edge)
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // Request payload size limits (DDoS protection against large payloads)
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ limit: '1mb', extended: true }));

  // Security headers (hardened)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      crossOriginEmbedderPolicy: false, // Allow cross-origin for R2 images
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
      },
    }),
  );

  // Cookie parsing (required for refresh token httpOnly cookies)
  app.use(cookieParser());

  // CORS (hardened)
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3000',
  ];
  // Also allow www subdomain if FRONTEND_URL is set
  if (process.env.FRONTEND_URL) {
    const url = new URL(process.env.FRONTEND_URL);
    if (!url.hostname.startsWith('www.')) {
      allowedOrigins.push(`${url.protocol}//www.${url.hostname}`);
    }
  }
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600,
  });

  // Simple abuse detection logging
  const requestCounts = new Map<
    string,
    { count: number; firstSeen: number }
  >();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = requestCounts.get(ip) || { count: 0, firstSeen: now };
    entry.count++;

    // Reset every 5 minutes
    if (now - entry.firstSeen > 300000) {
      entry.count = 1;
      entry.firstSeen = now;
    }

    requestCounts.set(ip, entry);

    // Log if > 500 requests in 5 min window
    if (entry.count === 500) {
      console.warn(`[ABUSE] IP ${ip} hit 500 requests in 5 minutes`);
    }

    // Clean up old entries every 1000 requests
    if (requestCounts.size > 10000) {
      const cutoff = now - 300000;
      for (const [key, val] of requestCounts) {
        if (val.firstSeen < cutoff) requestCounts.delete(key);
      }
    }

    next();
  });

  // Global interceptor: convert Prisma Decimal objects to plain numbers in JSON responses
  app.useGlobalInterceptors(new DecimalSerializationInterceptor());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Graceful shutdown — close DB connections before process exits
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 4000;
  const server = await app.listen(port, '0.0.0.0');

  // Slowloris / connection timeout protection
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.requestTimeout = 30000;

  console.log(`Backend running on http://localhost:${port}`);
}
bootstrap();
