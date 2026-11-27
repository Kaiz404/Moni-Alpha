'use client';

import { setShell } from '@/components/shell/shell-store';
import type { ChatMessage } from '@/lib/chat-thread';

export type MoniMessage = Extract<ChatMessage, { role: 'moni' }>;
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export function append(message: DistributiveOmit<ChatMessage, 'id' | 'at'>): string {
  const id = newId();
  setShell((shell) => ({ chat: [...shell.chat, { ...message, id, at: now() } as ChatMessage] }));
  return id;
}

export function replace(id: string, next: DistributiveOmit<MoniMessage, 'id' | 'at'>) {
  setShell((shell) => ({
    chat: shell.chat.map((message) => (message.id === id ? ({ ...next, id, at: now() } as ChatMessage) : message)),
  }));
}

