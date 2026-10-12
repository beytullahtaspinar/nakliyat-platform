import { useLocalSearchParams } from 'expo-router';
import { ConversationScreen } from '@/components/conversation-screen';

/** Müşteriyle yazışma */
export default function MessagesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ConversationScreen
      id={id}
      backLabel="İş"
      emptyText="Henüz mesaj yok. Taşınma günüyle ilgili sorularını buradan müşteriye yazabilirsin."
    />
  );
}
