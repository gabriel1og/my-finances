'use client';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { currentMonth } from '@/lib/format';
import { objectValue, parseAnswer } from '@/lib/assistant/contracts';
import { AssistantResponse } from './AssistantResponse';
import { useAssistant } from './useAssistant';

const suggestions = [
  'Quanto gastei com alimentação nos últimos três meses?',
  'Por que minhas despesas aumentaram?',
  'Quais parcelas e despesas fixas tenho para os próximos meses?',
  'Quais categorias ultrapassaram o orçamento?',
];

/** Responsive authenticated assistant workspace. Example: <AssistantChat />. */
export function AssistantChat() {
  const params = useSearchParams();
  const selected = params.get('month') ?? currentMonth();
  const month = /^\d{4}-(0[1-9]|1[0-2])-01$/.test(selected) ? selected : currentMonth();
  const chat = useAssistant(month);
  const bottom = useRef<HTMLDivElement>(null);
  const lastMessageId = chat.messages.at(-1)?.id;
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [lastMessageId, chat.busy]);
  const disabled = chat.busy || chat.loading;

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-border bg-surface p-3">
        <button
          type="button"
          className="btn-primary w-full"
          disabled={disabled}
          onClick={chat.newConversation}
        >
          Nova conversa
        </button>
        <details className="mt-3" open>
          <summary className="cursor-pointer text-sm font-semibold">Histórico de conversas</summary>
          <ul className="mt-3 max-h-60 space-y-2 overflow-y-auto xl:max-h-[60vh]">
            {chat.conversations.map((conversation) => (
              <li
                key={conversation.id}
                className={`flex gap-2 rounded-md p-2 ${conversation.id === chat.conversationId ? 'bg-surfaceAlt' : ''}`}
              >
                <button
                  className="min-w-0 flex-1 truncate text-left text-xs"
                  disabled={disabled}
                  onClick={() => chat.openConversation(conversation.id)}
                  aria-current={conversation.id === chat.conversationId ? 'true' : undefined}
                >
                  {conversation.title}
                </button>
                <button
                  className="text-xs text-textMuted hover:text-expense"
                  disabled={disabled}
                  aria-label={`Excluir conversa ${conversation.title}`}
                  onClick={() => {
                    if (window.confirm('Excluir esta conversa e suas mensagens?'))
                      void chat.deleteConversation(conversation.id);
                  }}
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
          {!chat.conversations.length && (
            <p className="mt-3 text-xs text-textMuted">Suas conversas aparecerão aqui.</p>
          )}
          {chat.moreConversations && (
            <button
              className="btn-secondary mt-3 w-full"
              disabled={disabled}
              onClick={chat.loadConversations}
            >
              Mais conversas
            </button>
          )}
        </details>
      </aside>
      <section className="min-w-0" aria-label="Conversa com assistente">
        <div className="mb-4 rounded-lg border border-border bg-surface p-4 text-xs leading-relaxed text-textSecondary">
          Pergunte sobre seus dados no Flowly. O assistente apenas consulta informações e não altera
          seus registros. Os dados necessários à resposta são enviados à OpenAI, que pode manter
          registros conforme sua política de retenção.{' '}
          <a
            className="text-accent underline"
            href="https://developers.openai.com/api/docs/guides/your-data"
            target="_blank"
            rel="noreferrer"
          >
            Saiba mais
          </a>
          <p className="mt-2">
            Limite: <span className="font-mono">30</span> perguntas por dia, com renovação à
            meia-noite em São Paulo. Contexto padrão:{' '}
            <span className="font-mono">{month.slice(0, 7)}</span>.
          </p>
        </div>
        {!chat.messages.length && !chat.loading && (
          <div className="mb-5">
            <h2 className="text-lg font-semibold">O que você quer entender sobre suas finanças?</h2>
            <p className="mt-2 text-sm text-textSecondary">
              Consulte gastos, saldos, faturas, orçamentos e compromissos futuros.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {suggestions.map((question) => (
                <button
                  key={question}
                  className="rounded-md border border-border bg-surface p-3 text-left text-xs hover:bg-surfaceAlt"
                  disabled={disabled}
                  onClick={() => chat.setDraft(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}
        {chat.moreMessages && chat.conversationId && (
          <button
            className="btn-secondary mb-4"
            disabled={disabled}
            onClick={() => chat.openConversation(chat.conversationId!, true)}
          >
            Carregar mensagens anteriores
          </button>
        )}
        <div className="space-y-4" aria-label="Mensagens">
          {chat.messages.map((message) => (
            <div key={message.id}>
              {message.role === 'assistant' ? (
                <StoredAnswer content={message.content} />
              ) : (
                <div className="ml-auto max-w-[90%] rounded-lg border border-border bg-surfaceAlt p-4">
                  <p className="mb-2 text-xs text-textMuted">Você</p>
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {messageText(message.content)}
                  </p>
                  {message.requestStatus === 'failed' && (
                    <button
                      type="button"
                      className="mt-2 text-xs text-accent underline"
                      disabled={disabled}
                      onClick={() => chat.retryMessage(message)}
                    >
                      Consulta interrompida — preparar nova tentativa
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <div ref={bottom} />
        <p role="status" aria-live="polite" className="my-3 text-xs text-textSecondary">
          {chat.loading ? 'Carregando conversa…' : chat.busy ? chat.status : ''}
        </p>
        {chat.error && (
          <div role="alert" className="mb-3 rounded-md border border-expense p-3 text-sm">
            <p>{chat.error.message}</p>
            {chat.error.code === 'unauthorized' ? (
              <a href="/login" className="text-accent underline">
                Entrar novamente
              </a>
            ) : chat.draft ? (
              <button
                className="mt-2 text-accent underline"
                disabled={disabled || chat.error.code === 'quota'}
                onClick={chat.submit}
              >
                Repetir solicitação
              </button>
            ) : (
              <button
                className="mt-2 text-accent underline"
                disabled={disabled}
                onClick={chat.loadConversations}
              >
                Recarregar histórico
              </button>
            )}
          </div>
        )}
        <form
          className="sticky bottom-0 mt-4 rounded-lg border border-border bg-bg p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void chat.submit();
          }}
        >
          <label htmlFor="assistant-question" className="mb-2 block text-xs font-semibold">
            Sua pergunta
          </label>
          <textarea
            id="assistant-question"
            className="w-full resize-y rounded-md border border-border bg-surface p-3 text-sm outline-none focus:border-accent"
            rows={3}
            maxLength={4000}
            value={chat.draft}
            disabled={disabled}
            onChange={(event) => chat.setDraft(event.target.value)}
            placeholder="Pergunte sobre qualquer dado registrado no sistema…"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void chat.submit();
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-textMuted">
              {chat.draft.length}/4000 · Shift+Enter para nova linha
            </span>
            <button type="submit" className="btn-primary" disabled={disabled || !chat.draft.trim()}>
              {chat.busy ? 'Consultando…' : 'Enviar'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function messageText(content: unknown) {
  try {
    return String(objectValue(content).text ?? '');
  } catch {
    return 'Mensagem indisponível.';
  }
}
function StoredAnswer({ content }: { content: unknown }) {
  try {
    return <AssistantResponse answer={parseAnswer(content)} />;
  } catch {
    return <p className="text-sm text-textMuted">Não foi possível exibir esta resposta.</p>;
  }
}
