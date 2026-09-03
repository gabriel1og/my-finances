import { describe, expect, it } from 'vitest';
import { dayInMonth, dueDateFor, statementMonth } from '@/lib/statements';

describe('statementMonth', () => {
  it('entra na fatura do próprio mês quando a compra é antes do fechamento', () => {
    // O caso que o usuário descreveu: compra dia 26, fechamento dia 28.
    expect(statementMonth('2026-08-26', 28)).toBe('2026-08-01');
  });

  it('vai para o mês seguinte no dia do fechamento', () => {
    expect(statementMonth('2026-08-28', 28)).toBe('2026-09-01');
  });

  it('vai para o mês seguinte depois do fechamento', () => {
    expect(statementMonth('2026-08-30', 28)).toBe('2026-09-01');
  });

  it('vira o ano em dezembro', () => {
    expect(statementMonth('2026-12-20', 10)).toBe('2027-01-01');
  });

  it('grampeia o fechamento 31 ao último dia de fevereiro', () => {
    // Fechamento 31 em fevereiro vale 28: dia 27 ainda é do próprio mês,
    // dia 28 já cai na fatura de março.
    expect(statementMonth('2026-02-27', 31)).toBe('2026-02-01');
    expect(statementMonth('2026-02-28', 31)).toBe('2026-03-01');
  });

  it('trata fechamento no dia 1 mandando tudo para o mês seguinte', () => {
    expect(statementMonth('2026-05-01', 1)).toBe('2026-06-01');
    expect(statementMonth('2026-05-31', 1)).toBe('2026-06-01');
  });
});

describe('dueDateFor', () => {
  it('vence no mês seguinte ao da fatura', () => {
    // Regra da 0017: fatura de agosto vence em setembro.
    expect(dueDateFor('2026-08-01', 10)).toBe('2026-09-10');
  });

  it('vence no mês seguinte mesmo com due_day menor que closing_day', () => {
    // O caso que a 0011 errou e a 0017 fixou: vencimento dia 5 não volta para
    // o próprio mês da fatura.
    expect(dueDateFor('2026-08-01', 5)).toBe('2026-09-05');
  });

  it('vira o ano na fatura de dezembro', () => {
    expect(dueDateFor('2026-12-01', 15)).toBe('2027-01-15');
  });

  it('grampeia o vencimento 31 ao último dia do mês de vencimento', () => {
    // Fatura de janeiro vence em fevereiro: dia 31 vira 28, ou 29 em bissexto.
    expect(dueDateFor('2026-01-01', 31)).toBe('2026-02-28');
    expect(dueDateFor('2028-01-01', 31)).toBe('2028-02-29');
    expect(dueDateFor('2026-03-01', 31)).toBe('2026-04-30');
  });

  it('aceita o mês da fatura como data completa', () => {
    // As telas passam o mês selecionado, que circula como 'YYYY-MM-01'.
    expect(dueDateFor('2026-08-01', 10)).toBe(dueDateFor('2026-08-31', 10));
  });
});

describe('dayInMonth', () => {
  it('devolve o dia pedido quando ele existe no mês', () => {
    expect(dayInMonth('2026-08-01', 15)).toBe('2026-08-15');
  });

  it('grampeia ao último dia do mês', () => {
    expect(dayInMonth('2026-02-01', 31)).toBe('2026-02-28');
    expect(dayInMonth('2028-02-01', 31)).toBe('2028-02-29');
    expect(dayInMonth('2026-04-01', 31)).toBe('2026-04-30');
  });
});
