import { describe, expect, it } from 'vitest';
import { parseImportFile } from './formats';
import { buildPlan, summarize } from './plan';

describe('CSV de estorno', () => {
  it('preserva a natureza e o mês explícito sem somar renda', () => {
    const parsed = parseImportFile(
      'Data;Descrição;Tipo;Valor;Categoria;Conta/Cartão;Forma;Natureza;Mês da fatura;ID do lançamento;Compra relacionada\n2026-10-19;Estorno loja;Receita;150,00;Compras;Visa;Crédito;Estorno no cartão;2026-09;refund-id;purchase-id',
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.result.skipped).toEqual([]);
    const [row] = parsed.result.rows;
    expect(row).toMatchObject({
      nature: 'card_refund',
      statementMonth: '2026-09',
      relatedPurchaseSourceId: 'purchase-id',
    });
    const plan = buildPlan(parsed.result.rows);
    expect(plan.categories[0].kind).toBe('expense');
    expect(summarize(plan.items)).toMatchObject({ income: 0, expense: -150 });
  });
});
