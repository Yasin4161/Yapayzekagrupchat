
export type Role = 'user' | 'assistant';
export type Provider = 'google' | 'openai' | 'anthropic';

export interface Message {
  id: string;
  role: Role;
  content: string;
  senderName: string;
  senderId: string;
  timestamp: Date;
  modelType: string;
}

export interface AIPersona {
  id: string;
  name: string;
  provider: Provider;
  modelName: string;
  description: string;
  color: string;
  icon: string;
  systemInstruction: string;
  isActive: boolean;
}

export interface ApiKeys {
  openai?: string;
  anthropic?: string;
}
