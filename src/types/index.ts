export type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed' | 'stopped' | 'unknown';

export interface Campaign {
  template?: string;
  id: string;
  name: string;
  status: CampaignStatus;
  template_id: string;
  template_name: string;
  total_contacts: number;
  queued_count: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  replied_count: number;
  failed_count: number;
  opted_out_count: number;
  sending_interval: number; // in seconds
  allowed_days: string[]; // e.g. ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  start_time: string; // e.g. '09:00'
  end_time: string; // e.g. '18:00'
  timezone: string;
  created_at: string;
  updated_at?: string;
}

export type ContactStatus = 'active' | 'opted_out' | 'invalid' | 'valid' | 'queued' | 'sent' | 'replied' | 'failed' | 'unknown';

export interface Contact {
  id: string;
  name: string;
  first_name: string;
  company: string;
  phone: string;
  email?: string;
  city?: string;
  industry?: string;
  status: ContactStatus;
  created_at: string;
  campaign_ids?: string[];
}

export interface Template {
  id: string;
  name: string;
  content: string;
  variables: string[];
  category?: string;
  created_at: string;
  updated_at?: string;
}

export type MessageStatus = 'queued' | 'leased' | 'dispatching' | 'sent' | 'delivered' | 'read' | 'replied' | 'failed' | 'opted_out' | 'unknown' | 'canceled';

export interface OutboundMessage {
  id: string;
  campaign_id?: string;
  campaign_name?: string;
  contact_id: string;
  contact_name: string;
  company: string;
  phone: string;
  message_text: string;
  status: MessageStatus;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  error_message?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'contact' | 'agent' | 'system';
  text: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read';
}

export interface ConversationReply {
  id: string;
  contact_id: string;
  contact_name: string;
  company: string;
  phone: string;
  last_message: string;
  unread_count: number;
  updated_at: string;
  messages: ChatMessage[];
}

export interface SuppressionNumber {
  id: string;
  phone: string;
  contact_name?: string;
  reason: 'opt_out' | 'manual' | 'bounced' | 'complaint';
  added_at: string;
  added_by: string;
  notes?: string;
}

export interface AppSettings {
  api_base_url: string;
  n8n_webhook_url: string;
  n8n_api_key: string;
  whatsapp_session_status: 'connected' | 'disconnected' | 'qr_required' | 'connecting';
  whatsapp_phone: string;
  whatsapp_name: string;
  default_sending_interval: number; // seconds
  default_timezone: string;
  allowed_sending_days: string[];
  default_start_time: string;
  default_end_time: string;
}

export interface DashboardKPIs {
  total_campaigns: number;
  active_campaigns: number;
  total_contacts: number;
  queued_messages: number;
  sent_messages: number;
  delivered_messages: number;
  read_messages: number;
  replied_messages: number;
  failed_messages: number;
  opted_out_contacts: number;
}

export interface ImportValidationResult {
  valid_contacts: Omit<Contact, 'id' | 'created_at' | 'status'>[];
  invalid_rows: {
    row_number: number;
    raw_data: Record<string, any>;
    reason: string;
  }[];
  duplicate_rows: {
    row_number: number;
    phone: string;
    reason: string;
  }[];
  total_rows: number;
}
