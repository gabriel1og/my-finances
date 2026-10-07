import { Suspense } from 'react';
import { AssistantChat } from '@/components/assistant/AssistantChat';

export default function AssistantPage() {
  return (
    <Suspense fallback={<p role="status">Carregando assistente…</p>}>
      <AssistantChat />
    </Suspense>
  );
}
