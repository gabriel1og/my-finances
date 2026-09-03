import { describe, expect, it } from 'vitest';
import { EXPORT_ENTITIES, isExportEntity } from '@/lib/export';

describe('EXPORT_ENTITIES', () => {
  it('não tem chave repetida', () => {
    const keys = EXPORT_ENTITIES.map((entity) => entity.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('descreve toda entidade — a lista alimenta a UI', () => {
    for (const entity of EXPORT_ENTITIES) {
      expect(entity.label.length).toBeGreaterThan(0);
      expect(entity.description.length).toBeGreaterThan(0);
    }
  });
});

describe('isExportEntity', () => {
  it('aceita só o que está na lista', () => {
    expect(isExportEntity('transactions')).toBe(true);
    expect(isExportEntity('tags')).toBe(true);
    // A rota valida a URL por aqui: qualquer coisa fora da lista é 404.
    expect(isExportEntity('../../etc/passwd')).toBe(false);
    expect(isExportEntity('profiles')).toBe(false);
    expect(isExportEntity('')).toBe(false);
  });
});
