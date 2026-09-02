import { describe, expect, it } from 'vitest';
import { csvNumber, escapeCsvValue, toCsv } from '@/lib/csv';

describe('escapeCsvValue', () => {
  it('deixa texto simples intacto', () => {
    expect(escapeCsvValue('Mercado')).toBe('Mercado');
  });

  it('envolve em aspas quando há o separador', () => {
    expect(escapeCsvValue('Mercado; feira')).toBe('"Mercado; feira"');
  });

  it('dobra as aspas internas', () => {
    expect(escapeCsvValue('Padaria "do Ze"')).toBe('"Padaria ""do Ze"""');
  });

  it('envolve em aspas quando há quebra de linha', () => {
    expect(escapeCsvValue('linha1\nlinha2')).toBe('"linha1\nlinha2"');
  });

  it('trata null e undefined como vazio', () => {
    expect(escapeCsvValue(null)).toBe('');
    expect(escapeCsvValue(undefined)).toBe('');
  });

  it('respeita separador alternativo', () => {
    expect(escapeCsvValue('a,b', ',')).toBe('"a,b"');
    expect(escapeCsvValue('a,b', ';')).toBe('a,b');
  });
});

describe('toCsv', () => {
  const columns = [
    { key: 'date', label: 'Data' },
    { key: 'description', label: 'Descrição' },
  ];

  it('monta cabeçalho e linhas separados por CRLF', () => {
    const csv = toCsv([{ date: '2026-09-01', description: 'Mercado' }], columns);
    expect(csv).toBe('Data;Descrição\r\n2026-09-01;Mercado');
  });

  it('preenche vazio para chave ausente', () => {
    const csv = toCsv([{ date: '2026-09-01' }], columns);
    expect(csv).toBe('Data;Descrição\r\n2026-09-01;');
  });

  it('devolve só o cabeçalho para lista vazia', () => {
    expect(toCsv([], columns)).toBe('Data;Descrição');
  });
});

describe('csvNumber', () => {
  it('usa vírgula decimal e duas casas', () => {
    expect(csvNumber(1234.5)).toBe('1234,50');
    expect(csvNumber(0)).toBe('0,00');
  });
});
