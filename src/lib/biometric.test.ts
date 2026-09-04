import { describe, expect, it } from 'vitest';
import {
  BIOMETRIC_RELOCK_SECONDS,
  fromBase64Url,
  parseBiometricSetting,
  shouldRelock,
  toBase64Url,
} from '@/lib/biometric';

describe('base64url', () => {
  it('sobrevive à ida e volta com bytes que geram + e / no base64 comum', () => {
    const bytes = new Uint8Array([0xfb, 0xff, 0xbe, 0x00, 0x7f, 0x10]);
    const encoded = toBase64Url(bytes.buffer);

    expect(encoded).not.toMatch(/[+/=]/);
    expect(Array.from(fromBase64Url(encoded))).toEqual(Array.from(bytes));
  });

  it('recoloca o padding que o base64url descarta', () => {
    // 1 byte vira 2 caracteres + 2 '=' no base64 comum; sem repor, atob quebra.
    expect(Array.from(fromBase64Url(toBase64Url(new Uint8Array([7]).buffer)))).toEqual([7]);
  });
});

describe('parseBiometricSetting', () => {
  const raw = (value: unknown) => JSON.stringify(value);

  it('lê um registro íntegro do próprio usuário', () => {
    expect(parseBiometricSetting(raw({ credentialId: 'abc', userId: 'u1' }), 'u1')).toEqual({
      credentialId: 'abc',
      userId: 'u1',
    });
  });

  it('ignora credencial de outra conta no mesmo aparelho', () => {
    // Sem isto, quem instalasse o app para outra pessoa no mesmo celular ficaria
    // preso numa tela de bloqueio cuja credencial não é dele.
    expect(parseBiometricSetting(raw({ credentialId: 'abc', userId: 'u2' }), 'u1')).toBeNull();
  });

  it('trata storage vazio, JSON quebrado e registro incompleto como "sem cadeado"', () => {
    expect(parseBiometricSetting(null, 'u1')).toBeNull();
    expect(parseBiometricSetting('{nao é json', 'u1')).toBeNull();
    expect(parseBiometricSetting(raw({ userId: 'u1' }), 'u1')).toBeNull();
    expect(parseBiometricSetting(raw({ credentialId: '', userId: 'u1' }), 'u1')).toBeNull();
  });
});

describe('shouldRelock', () => {
  it('não bloqueia quem nunca saiu do app', () => {
    expect(shouldRelock(null)).toBe(false);
  });

  it('tolera a ida rápida a outro app e bloqueia a demora', () => {
    const limit = BIOMETRIC_RELOCK_SECONDS * 1000;
    expect(shouldRelock(0, limit - 1)).toBe(false);
    expect(shouldRelock(0, limit)).toBe(true);
  });
});
