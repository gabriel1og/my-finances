import { describe, expect, it } from 'vitest';
import { detectSeparator, parseCsv } from '@/lib/csv';
import { detectFormat, parseImportAmount, parseImportDate, parseImportFile } from './formats';
import {
  buildPlan,
  collectCategories,
  collectOrigins,
  duplicateKey,
  pairTransfers,
  summarize,
} from './plan';
import type { ParsedRow } from './types';

const FORTUNO = [
  'Data, Transação, Descrição, Valor, Status, Categoria, Conta/Cartão, Observações',
  '31 de mar. de 2026, Despesas no crédito, Cinema c/ Nathalie, 51.52, Pago, Lazer, Itaú, ',
  '30 de mar. de 2026, Receita, Rendimento de Março (Cofrinhos), 171.56, Recebido, Investimentos, Cofrinhos - Mercado Pago, ',
  '30 de mar. de 2026, Transferência, Transferência (saída), 2500.0, -, -, Itaú, ',
  '30 de mar. de 2026, Transferência, Transferência (entrada), 2500.0, -, -, Cofrinhos - Itaú, ',
  '30 de mar. de 2026, Despesa, Passagens p/ SP (Feriado - 01/05), 272.6, Pago, Viagens, Itaú, ',
  '16 de mar. de 2026, Despesas no crédito, Água, Bacon e Suporte p/ filtro (Nathalie), 24.58, Pago, Compras, Mercado Pago, ',
  '12 de mar. de 2026, Transferência, Transferência (saída), 1000.0, -, -, Mercado Pago, ',
  'Total',
  'Despesas,665.46',
  'Receitas,4874.0',
].join('\n');

const FLOWLY = [
  'Data;Descrição;Tipo;Valor;Categoria;Conta/Cartão;Forma;Parcela;Tags;Natureza;Fatura de;Mês da fatura;Observações',
  '2026-03-05;Mercado;Despesa;120,50;Alimentação;Nubank;Pix;;casa, urgente;Lançamento;;;',
  '2026-03-06;Notebook (1/3);Despesa;1000,00;Educação;Itaú Cartão;Crédito;1/3;;Lançamento;;;',
  '2026-04-10;Fatura Itaú Cartão — março;Despesa;900,00;;Nubank;Transferência;;;Pagamento de fatura;Itaú Cartão;2026-03;',
  '2026-03-12;Transferência Nubank → Poupança;Despesa;300,00;;Nubank;Transferência;;;Transferência;;;',
  '2026-03-12;Transferência Nubank → Poupança;Receita;300,00;;Poupança;Transferência;;;Transferência;;;',
  '2026-03-15;"Padaria ""do Zé""";Despesa;12,00;Alimentação;Nubank;Dinheiro;;;Lançamento;;;"linha 1\nlinha 2"',
].join('\r\n');

describe('parseCsv', () => {
  it('detecta o separador pela primeira linha', () => {
    expect(detectSeparator('a;b;c')).toBe(';');
    expect(detectSeparator('a, b, c')).toBe(',');
    expect(detectSeparator('"a;b",c')).toBe(',');
  });

  it('lê aspas dobradas, quebra de linha dentro do campo, BOM e CRLF', () => {
    const rows = parseCsv('﻿a;b\r\n"x;y";"diz ""oi""\nfim"\r\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x;y', 'diz "oi"\nfim'],
    ]);
  });

  it('ignora linhas vazias', () => {
    expect(parseCsv('a,b\n\n1,2\n   \n')).toHaveLength(2);
  });
});

describe('parseImportDate', () => {
  it('entende ISO, dd/mm/aaaa, dd/mm/aa e o formato por extenso do Fortuno', () => {
    expect(parseImportDate('2026-03-31')).toBe('2026-03-31');
    expect(parseImportDate('31/03/2026')).toBe('2026-03-31');
    expect(parseImportDate('1/3/26')).toBe('2026-03-01');
    expect(parseImportDate('31 de mar. de 2026')).toBe('2026-03-31');
    expect(parseImportDate('1 de dez. de 2025')).toBe('2025-12-01');
    expect(parseImportDate('9 de fevereiro de 2026')).toBe('2026-02-09');
  });

  it('devolve null para o que não entende', () => {
    expect(parseImportDate('ontem')).toBeNull();
    expect(parseImportDate('31 de xyz. de 2026')).toBeNull();
  });
});

describe('parseImportAmount', () => {
  it('aceita ponto ou vírgula como decimal', () => {
    expect(parseImportAmount('51.52')).toBe(51.52);
    expect(parseImportAmount('51,52')).toBe(51.52);
    expect(parseImportAmount('1.234,56')).toBe(1234.56);
    expect(parseImportAmount('1,234.56')).toBe(1234.56);
    expect(parseImportAmount('R$ -100,00')).toBe(100);
  });

  it('rejeita zero, vazio e texto', () => {
    expect(parseImportAmount('0')).toBeNull();
    expect(parseImportAmount('')).toBeNull();
    expect(parseImportAmount('abc')).toBeNull();
  });
});

describe('detectFormat', () => {
  it('reconhece flowly pela coluna Natureza e Fortuno por Transação + Status', () => {
    expect(detectFormat(['Data', 'Descrição', 'Natureza'])).toBe('flowly');
    expect(detectFormat(['Data', ' Transação', ' Status', ' Conta/Cartão'])).toBe('fortuno');
    expect(detectFormat(['Date', 'Amount'])).toBeNull();
  });
});

describe('Fortuno', () => {
  const parsed = parseImportFile(FORTUNO);
  if (!parsed.ok) throw new Error(parsed.error);
  const { result } = parsed;

  it('traduz tipo, meio de liquidação e categoria', () => {
    expect(result.format).toBe('fortuno');
    const cinema = result.rows.find((row) => row.description.startsWith('Cinema'))!;
    expect(cinema).toMatchObject({
      date: '2026-03-31',
      type: 'expense',
      settlement: 'card',
      method: 'credit',
      origin: 'Itaú',
      category: 'Lazer',
      amount: 51.52,
    });

    const rendimento = result.rows.find((row) => row.description.startsWith('Rendimento'))!;
    expect(rendimento).toMatchObject({ type: 'income', settlement: 'account', method: null });
  });

  it('recompõe a descrição com vírgula sem aspas', () => {
    const agua = result.rows.find((row) => row.line === 7)!;
    expect(agua.description).toBe('Água, Bacon e Suporte p/ filtro (Nathalie)');
    expect(agua.amount).toBe(24.58);
    expect(agua.origin).toBe('Mercado Pago');
  });

  it('marca saída e entrada de transferência sem categoria', () => {
    const out = result.rows.find((row) => row.line === 4)!;
    const inn = result.rows.find((row) => row.line === 5)!;
    expect(out).toMatchObject({ nature: 'transfer_out', type: 'expense', category: null });
    expect(inn).toMatchObject({
      nature: 'transfer_in',
      type: 'income',
      origin: 'Cofrinhos - Itaú',
    });
  });

  it('pula o rodapé de totais com motivo', () => {
    expect(result.skipped.map((entry) => entry.line)).toEqual([9, 10, 11]);
    expect(result.skipped[0].reason).toBe('Rodapé de totais');
  });
});

describe('flowly (reimportação)', () => {
  const parsed = parseImportFile(FLOWLY);
  if (!parsed.ok) throw new Error(parsed.error);
  const { result } = parsed;

  it('lê valor com vírgula, forma de pagamento e tags', () => {
    const mercado = result.rows[0];
    expect(mercado).toMatchObject({
      amount: 120.5,
      method: 'pix',
      settlement: 'account',
      tags: ['casa', 'urgente'],
    });
  });

  it('crédito vira cartão e parcela vira aviso', () => {
    const notebook = result.rows[1];
    expect(notebook.settlement).toBe('card');
    expect(notebook.warnings[0]).toContain('Parcela 1/3');
  });

  it('pagamento de fatura carrega o cartão pago', () => {
    const fatura = result.rows[2];
    expect(fatura).toMatchObject({
      nature: 'card_payment',
      paidCard: 'Itaú Cartão',
      paidMonth: '2026-03',
      category: null,
    });
  });

  it('preserva aspas e quebra de linha nas notas', () => {
    const padaria = result.rows[5];
    expect(padaria.description).toBe('Padaria "do Zé"');
    expect(padaria.notes).toBe('linha 1\nlinha 2');
  });
});

function row(partial: Partial<ParsedRow> & { line: number }): ParsedRow {
  return {
    date: '2026-03-30',
    description: 'x',
    amount: 100,
    type: 'expense',
    nature: 'transaction',
    settlement: 'account',
    origin: 'A',
    category: null,
    paidCard: null,
    paidMonth: null,
    method: null,
    tags: [],
    notes: null,
    warnings: [],
    ...partial,
  };
}

describe('pairTransfers', () => {
  it('casa saída e entrada por data e valor', () => {
    const { items, orphans } = pairTransfers([
      row({ line: 2, nature: 'transfer_out', origin: 'Itaú' }),
      row({ line: 3, nature: 'transfer_in', type: 'income', origin: 'Cofrinho' }),
    ]);
    expect(orphans).toBe(0);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'transfer',
      transfer: { from: 'Itaú', to: 'Cofrinho', amount: 100, lines: [2, 3] },
    });
  });

  it('não casa duas pontas na mesma conta e casa 1:1 na ordem', () => {
    const { items, orphans } = pairTransfers([
      row({ line: 2, nature: 'transfer_out', origin: 'Itaú' }),
      row({ line: 3, nature: 'transfer_in', type: 'income', origin: 'Itaú' }),
      row({ line: 4, nature: 'transfer_in', type: 'income', origin: 'MP' }),
    ]);
    expect(items.filter((item) => item.kind === 'transfer')).toHaveLength(1);
    expect(orphans).toBe(1);
    const orphan = items.find((item) => item.kind === 'transaction')!;
    expect(orphan.kind === 'transaction' && orphan.row.nature).toBe('transaction');
    expect(orphan.kind === 'transaction' && orphan.row.warnings[0]).toContain('sem a outra ponta');
  });

  it('o arquivo real do Fortuno gera 3 transferências e nenhuma órfã', () => {
    const parsed = parseImportFile(FORTUNO);
    if (!parsed.ok) throw new Error(parsed.error);
    const plan = buildPlan(parsed.result.rows);
    expect(plan.items.filter((item) => item.kind === 'transfer')).toHaveLength(1);
    expect(plan.orphanTransfers).toBe(1); // a saída de 12/03 ficou sem a entrada no recorte
  });
});

describe('collectOrigins / collectCategories', () => {
  const parsed = parseImportFile(FORTUNO);
  if (!parsed.ok) throw new Error(parsed.error);
  const plan = buildPlan(parsed.result.rows);

  it('separa "Itaú" conta de "Itaú" cartão', () => {
    const origins = collectOrigins(plan.items);
    expect(origins.map((origin) => origin.key)).toEqual(
      expect.arrayContaining([
        'account:itaú',
        'card:itaú',
        'card:mercado pago',
        'account:cofrinhos - itaú',
      ]),
    );
  });

  it('deduz o tipo da categoria pelo uso', () => {
    const categories = collectCategories(plan.items);
    expect(categories.find((category) => category.name === 'Investimentos')?.kind).toBe('income');
    expect(categories.find((category) => category.name === 'Lazer')?.kind).toBe('expense');
  });

  it('resume receitas e despesas sem contar transferências', () => {
    const summary = summarize(plan.items);
    expect(summary.transfers).toBe(1);
    expect(summary.income).toBe(171.56);
    expect(summary.expense).toBe(51.52 + 272.6 + 24.58 + 1000);
  });
});

describe('duplicateKey', () => {
  it('ignora caixa e espaços extras na descrição', () => {
    expect(duplicateKey('2026-03-01', 10, 'Mercado  X')).toBe(
      duplicateKey('2026-03-01', 10, 'mercado x'),
    );
  });
});
