import { View } from 'react-native';
import { useUniwind } from 'uniwind';

import { Mascot, type MascotMood } from '@/components/brand/mascot';
import type { ChatMessage } from '@/lib/ai/chat/messages';
import { tid } from '@/lib/test-ids';

/** What the chat's cat is doing: listening to the mic, thinking while a reply is on its way, else at rest. */
export function chatMood(messages: readonly ChatMessage[], listening: boolean): MascotMood {
  if (listening) return 'listening';
  return messages.some((message) => message.kind === 'assistant_status') ? 'thinking' : 'neutral';
}

/** Moni chat's one cat: a 28 Ink circle beside the name, the Paper cat inside (Kit 3 chat crop). */
export function ChatCat({ mood }: { mood: MascotMood }) {
  const dark = useUniwind().theme === 'dark';
  return (
    <View className="h-7 w-7 items-center justify-center rounded-full bg-primary pt-0.5">
      <Mascot
        testID={tid('chat', 'cat')}
        mood={mood}
        size={20}
        variant={dark ? 'light' : 'dark'}
      />
    </View>
  );
}
