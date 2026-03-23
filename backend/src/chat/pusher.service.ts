import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Pusher from 'pusher';

@Injectable()
export class PusherService {
  private readonly logger = new Logger(PusherService.name);
  private readonly pusher: Pusher | null;

  constructor(private readonly config: ConfigService) {
    const appId = this.config.get<string>('PUSHER_APP_ID');
    const key = this.config.get<string>('PUSHER_KEY');
    const secret = this.config.get<string>('PUSHER_SECRET');
    const cluster = this.config.get<string>('PUSHER_CLUSTER');

    if (!appId || !key || !secret || !cluster) {
      this.logger.warn(
        'Pusher env vars not fully configured — real-time chat disabled. Set PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER.',
      );
      this.pusher = null;
      return;
    }

    this.pusher = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    });
  }

  async trigger(
    channel: string,
    event: string,
    data: unknown,
  ): Promise<void> {
    if (!this.pusher) {
      this.logger.warn(
        'Pusher not configured — skipping trigger for event: ' + event,
      );
      return;
    }
    await this.pusher.trigger(channel, event, data);
  }

  authorizeChannel(
    socketId: string,
    channelName: string,
  ): Pusher.AuthResponse {
    if (!this.pusher) {
      throw new Error(
        'Pusher not configured — cannot authorize channel',
      );
    }
    return this.pusher.authorizeChannel(socketId, channelName);
  }
}
