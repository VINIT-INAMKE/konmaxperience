import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.PRISMA_LOG === 'true'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'error' },
              { emit: 'stdout', level: 'warn' },
            ]
          : [
              { emit: 'stdout', level: 'error' },
              { emit: 'stdout', level: 'warn' },
            ],
    });
  }

  async onModuleInit() {
    if (process.env.PRISMA_LOG === 'true') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).$on('query', (e: { query: string; params: string; duration: number }) => {
        this.logger.debug(`Query: ${e.query}`);
        this.logger.debug(`Params: ${e.params}`);
        this.logger.debug(`Duration: ${e.duration}ms`);
      });
    }
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Connect with retry — handles Neon cold starts and transient connection failures.
   * Retries 3 times with exponential backoff (1s, 2s, 4s).
   */
  private async connectWithRetry(retries = 3, delay = 1000): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Database connected');
        return;
      } catch (error) {
        this.logger.warn(
          `Database connection attempt ${attempt}/${retries} failed — retrying in ${delay}ms`,
        );
        if (attempt === retries) {
          this.logger.error('Database connection failed after all retries', error);
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }

  /**
   * Execute a query with automatic reconnect on connection-closed errors.
   * Wraps any Prisma operation — use for cron jobs and background tasks
   * where Neon may have suspended the database between runs.
   */
  async withReconnect<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      // P1001 = Can't reach database, P1017 = Connection closed
      if (error?.code === 'P1001' || error?.code === 'P1017' ||
          (error?.message && error.message.includes('kind: Closed'))) {
        this.logger.warn('Connection lost — reconnecting...');
        await this.connectWithRetry(2, 2000);
        return fn(); // retry once after reconnect
      }
      throw error;
    }
  }
}
