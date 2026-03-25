import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;

  onModuleInit() {
    const url = process.env.UPSTASH_REDIS_URL;
    if (!url) {
      console.warn('[CustomerAuth] UPSTASH_REDIS_URL not set -- OTP storage disabled');
      return;
    }
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      connectTimeout: 5000,
      lazyConnect: true,
    });
    this.client.on('error', (err) => console.error('[Redis]', err.message));
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }

  getClient(): Redis | null {
    return this.client;
  }
}
