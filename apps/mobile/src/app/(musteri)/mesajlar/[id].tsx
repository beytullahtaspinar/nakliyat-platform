import { useLocalSearchParams } from 'expo-router';
import { ConversationScreen } from '@/components/conversation-screen';

/** Anlaşılan firmayla yazışma */
export default function MessagesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ConversationScreen
      id={id}
      backLabel="Talep"
      emptyText="Henüz mesaj yok. Taşınma günü, eşyalar ya da adresle ilgili sorularını buradan firmaya yazabilirsin."
    />
  );
}
