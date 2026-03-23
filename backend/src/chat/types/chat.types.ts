export enum ChatEvent {
  NEW_MESSAGE = 'new-message',
  MESSAGE_READ = 'message-read',
  CLIENT_TYPING = 'client-typing',
}

export interface MessagePayload {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
  created_at: string;
}

export interface ReadReceiptPayload {
  userId: string;
  readAt: string;
}
