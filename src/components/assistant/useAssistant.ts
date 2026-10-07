'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { assistantJson, sendAssistantMessage } from '@/lib/assistant/client';
import {
  AssistantError,
  objectValue,
  type AssistantConversation,
  type AssistantMessage,
  type AssistantSubmission,
} from '@/lib/assistant/contracts';

type HistoryPage = {
  conversation: AssistantConversation;
  messages: AssistantMessage[];
  hasMore: boolean;
};
type ConversationsPage = { conversations: AssistantConversation[]; hasMore: boolean };

/** Owns conversation navigation and submission recovery. Example: useAssistant(selectedMonth). */
export function useAssistant(month: string) {
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<AssistantError | null>(null);
  const [moreMessages, setMoreMessages] = useState(false);
  const [moreConversations, setMoreConversations] = useState(false);
  const retry = useRef<AssistantSubmission | null>(null);
  const lock = useRef(false);
  const navigation = useRef(0);

  const refreshConversations = useCallback(
    async (append = false) => {
      const last = append ? conversations.at(-1) : undefined;
      const cursor = last
        ? `?before=${encodeURIComponent(JSON.stringify({ id: last.id, updated_at: last.updated_at }))}`
        : '';
      const page = await assistantJson<ConversationsPage>(`/api/assistant/conversations${cursor}`);
      setConversations((previous) =>
        append ? [...previous, ...page.conversations] : page.conversations,
      );
      setMoreConversations(page.hasMore);
    },
    [conversations],
  );

  useEffect(() => {
    let active = true;
    const navigationRef = navigation;
    assistantJson<ConversationsPage>('/api/assistant/conversations')
      .then((page) => {
        if (active) {
          setConversations(page.conversations);
          setMoreConversations(page.hasMore);
        }
      })
      .catch((error) => {
        if (active) reportError(error);
      });
    return () => {
      active = false;
      navigationRef.current++;
    };
  }, []);

  function reportError(error: unknown) {
    setError(
      error instanceof AssistantError
        ? error
        : new AssistantError(
            'unavailable',
            'Não foi possível concluir a solicitação. Tente novamente.',
          ),
    );
  }

  async function openConversation(id: string, older = false) {
    if (lock.current || loading) return;
    const version = ++navigation.current;
    setLoading(true);
    setError(null);
    try {
      const cursor = older && messages[0] ? `?before=${messages[0].id}` : '';
      const page = await assistantJson<HistoryPage>(`/api/assistant/conversations/${id}${cursor}`);
      if (version !== navigation.current) return;
      setConversationId(id);
      setMessages((previous) => (older ? [...page.messages, ...previous] : page.messages));
      setMoreMessages(page.hasMore);
      if (!older) {
        setDraft('');
        retry.current = null;
      }
    } catch (error) {
      reportError(error);
    } finally {
      if (version === navigation.current) setLoading(false);
    }
  }

  function newConversation() {
    if (lock.current || loading) return;
    navigation.current++;
    setConversationId(null);
    setMessages([]);
    setDraft('');
    setError(null);
    setMoreMessages(false);
    retry.current = null;
  }

  async function deleteConversation(id: string) {
    if (lock.current || loading) return;
    setLoading(true);
    setError(null);
    try {
      await assistantJson(`/api/assistant/conversations/${id}`, { method: 'DELETE' });
      setConversations((previous) => previous.filter((conversation) => conversation.id !== id));
      if (id === conversationId) {
        setConversationId(null);
        setMessages([]);
        setDraft('');
        setMoreMessages(false);
        retry.current = null;
      }
    } catch (error) {
      reportError(error);
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (lock.current || loading || !draft.trim()) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setStatus('Preparando consulta…');
    try {
      const message = draft.trim();
      let id = conversationId;
      if (!id) {
        const created = await assistantJson<AssistantConversation>('/api/assistant/conversations', {
          method: 'POST',
          body: JSON.stringify({ title: message.slice(0, 120) }),
        });
        id = created.id;
        setConversationId(id);
      }
      const prior = retry.current;
      const submission =
        prior?.message === message && prior.selectedMonth === month && prior.conversationId === id
          ? prior
          : { conversationId: id, requestId: crypto.randomUUID(), message, selectedMonth: month };
      retry.current = submission;
      const answer = await sendAssistantMessage(submission, setStatus);
      const now = new Date().toISOString();
      setMessages((previous) => [
        ...previous,
        { id: -Date.now(), role: 'user', content: { text: message }, created_at: now },
        { id: -Date.now() - 1, role: 'assistant', content: answer, created_at: now },
      ]);
      setDraft('');
      retry.current = null;
      setStatus('Resposta concluída.');
      const page = await assistantJson<HistoryPage>(`/api/assistant/conversations/${id}`);
      setMessages(page.messages);
      setMoreMessages(page.hasMore);
      await refreshConversations();
    } catch (error) {
      reportError(error);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function loadConversations() {
    try {
      await refreshConversations(true);
    } catch (error) {
      reportError(error);
    }
  }
  function retryMessage(message: AssistantMessage) {
    if (lock.current || loading || !conversationId || !message.requestId) return;
    const content = objectValue(message.content);
    setDraft(String(content.text ?? ''));
    retry.current = {
      conversationId,
      requestId: message.requestId,
      message: String(content.text ?? ''),
      selectedMonth: String(content.selectedMonth ?? month),
    };
  }
  return {
    conversations,
    conversationId,
    messages,
    draft,
    setDraft,
    busy,
    loading,
    status,
    error,
    moreMessages,
    moreConversations,
    openConversation,
    newConversation,
    deleteConversation,
    submit,
    loadConversations,
    retryMessage,
  };
}
