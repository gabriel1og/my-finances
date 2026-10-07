import { describe, expect, it } from 'vitest';
import {
  objectValue,
  uuidValue,
  dateValue,
  parseSubmission,
  parseModelAnswer,
  parseAnswer,
} from './contracts';

const id = '11111111-1111-4111-8111-111111111111';
const submission = {
  conversationId: id,
  requestId: id,
  selectedMonth: '2026-10-01',
  message: ' Quanto gastei? ',
};
const answer = {
  text: 'R$ 10,00',
  tables: [],
  sources: [{ label: 'Transações', href: '/transactions?month=2026-10-01', period: 'Outubro' }],
  period: 'Outubro',
  consultedAt: '2026-10-07T00:00:00Z',
};

describe('assistant contracts', () => {
  it('normalizes a valid submission and rejects missing IDs, oversized text and invalid calendar months', () => {
    expect(parseSubmission(submission).message).toBe('Quanto gastei?');
    for (const input of [
      { ...submission, requestId: 'user-1' },
      { ...submission, message: 'a'.repeat(4001) },
      { ...submission, selectedMonth: '2026-02-30' },
      { ...submission, selectedMonth: '2026-10-02' },
      { ...submission, message: ' ' },
    ])
      expect(() => parseSubmission(input)).toThrow();
  });
  it('rejects malformed objects, UUIDs and nonexistent dates', () => {
    expect(objectValue({ key: 1 })).toEqual({ key: 1 });
    expect(uuidValue(id)).toBe(id);
    expect(dateValue('2024-02-29')).toBe('2024-02-29');
    for (const value of [null, [], 'data']) expect(() => objectValue(value)).toThrow();
    expect(() => dateValue('2025-02-29')).toThrow();
    expect(() => uuidValue('a),user_id.neq.1')).toThrow();
  });
  it('validates table shapes and prevents unsafe source links', () => {
    expect(parseAnswer(answer)).toEqual(answer);
    expect(
      parseModelAnswer({
        text: 'Total',
        tables: [{ title: 'Gastos', columns: ['Valor'], rows: [['10']] }],
      }).tables,
    ).toHaveLength(1);
    expect(() =>
      parseModelAnswer({
        text: 'Total',
        tables: [{ title: 'Gastos', columns: ['Valor'], rows: [['10', '20']] }],
      }),
    ).toThrow();
    for (const href of [
      'https://example.com',
      '//example.com',
      '/api/assistant/messages',
      '/transactions/../../login',
    ])
      expect(() => parseAnswer({ ...answer, sources: [{ ...answer.sources[0], href }] })).toThrow();
    expect(() => parseAnswer({ ...answer, consultedAt: 'bad' })).toThrow();
  });
});
