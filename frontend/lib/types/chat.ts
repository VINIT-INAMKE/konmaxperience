export interface ChatUser {
  id: string;
  name: string;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  user: ChatUser;
  last_read_at: string | null;
  joined_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender: ChatUser;
  content: string | null;
  attachment_key: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null; // "image" | "file"
  created_at: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string | null;
  avatar_key: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  participants: ConversationParticipant[];
  messages: Message[]; // last message (array of 0-1 from API)
}

export interface MessagesResponse {
  messages: Message[];
  nextCursor: string | null;
}
