/**
 * Cálculos de compra parcelada. Ficam fora do arquivo de server actions para
 * poderem ser testados isoladamente — um arquivo 'use server' só exporta
 * funções assíncronas.
 */

/**
 * Divide o total em parcelas de centavos inteiros. A sobra da divisão vai para
 * a primeira parcela, como fazem as operadoras: garante que a soma das
 * parcelas seja exatamente o valor da compra.
 */
export function splitInstallments(total: number, count: number): number[] {
  const totalCents = Math.round(total * 100);
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, index) =>
    index === 0 ? (base + remainder) / 100 : base / 100,
  );
}

/** Mesmo dia nos meses seguintes, grampeado ao último dia do mês. */
export function shiftMonths(iso: string, months: number): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  const target = new Date(year, month - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(
    Math.min(day, lastDay),
  ).padStart(2, '0')}`;
}
