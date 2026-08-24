import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  private client: Redis | null = null;

  onModuleInit() {
    const url = process.env.UPSTASH_REDIS_URL;
    if (!url) {
      this.logger.warn('[CustomerAuth] UPSTASH_REDIS_URL not set -- OTP storage disabled');
      return;
    }
    let errorLogged = false;
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      connectTimeout: 5000,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times > 3) {
          if (!errorLogged) {
            this.logger.warn('[Redis] Unreachable after 3 attempts — disabling. App continues without OTP/dedup.');
            errorLogged = true;
          }
          this.client = null;
          return null; // stop retrying
        }
        return Math.min(times * 1000, 3000);
      },
    });
    this.client.on('error', (err) => {
      if (!errorLogged) {
        this.logger.error(`[Redis] ${err.message}`);
      }
    });
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }

  getClient(): Redis | null {
    return this.client;
  }
}
