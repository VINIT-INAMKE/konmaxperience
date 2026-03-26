import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@upstash/qstash';
import { NotificationsProcessor } from './notifications.processor';

@Injectable()
export class QStashService implements OnModuleInit {
  private client: Client | null = null;
  private callbackUrl: string | null = null;
  private readonly logger = new Logger(QStashService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly processor: NotificationsProcessor,
  ) {}

  onModuleInit() {
    const token = this.config.get<string>('QSTASH_TOKEN');
    const backendUrl = this.config.get<string>('QSTASH_URL'); // e.g. https://app.konma.store
    if (!token || !backendUrl) {
      this.logger.warn(
        'QSTASH_TOKEN or QSTASH_URL not set — notifications will process inline (no queue)',
      );
      return;
    }
    this.client = new Client({ token });
    this.callbackUrl = `${backendUrl}/notifications/qstash-webhook`;
    this.logger.log(`QStash configured → ${this.callbackUrl}`);
  }

  /**
   * Publish a notification job. If QStash is configured, sends via HTTP queue.
   * Otherwise, processes inline (dev mode / missing config).
   */
  async publish(jobName: string, data: Record<string, any>): Promise<void> {
    const payload = { jobName, data };

    if (this.client && this.callbackUrl) {
      try {
        await this.client.publishJSON({
          url: this.callbackUrl,
          body: payload,
          retries: 3,
        });
        return;
      } catch (error) {
        this.logger.error(
          `QStash publish failed, falling back to inline: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Inline fallback — process directly (dev mode or QStash failure)
    try {
      await this.processor.process(jobName, data);
    } catch (error) {
      this.logger.error(
        `Inline notification processing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
