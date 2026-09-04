/**
 * Cadeado biométrico local — Face ID, Touch ID ou a biometria do Android.
 *
 * O que isto é: uma credencial WebAuthn de plataforma (`authenticatorAttachment:
 * 'platform'`) registrada neste aparelho, guardada no `localStorage` só pelo id.
 * Ao abrir o app, `navigator.credentials.get()` obriga o sistema a confirmar a
 * pessoa antes de mostrar o conteúdo. Funciona no PWA instalado na tela de
 * início do iPhone, que é o caso de uso.
 *
 * O que isto **não** é: autenticação. O desafio é aleatório e ninguém o
 * verifica — não existe servidor conferindo a assinatura, porque o servidor já
 * confia nos cookies `sb-*`. O que a credencial prova é "a pessoa que desbloqueia
 * este aparelho está aqui agora", e é exatamente isso que se quer cobrir: celular
 * emprestado, aparelho destravado na mão de outra pessoa. Quem tem o aparelho e
 * abre o Safari com os mesmos cookies passa por volta — mesma natureza do
 * `SessionGuard` (ver `claude/sessao-e-expiracao.md`).
 *
 * Por que `localStorage` e não uma coluna em `profiles`: a credencial vive no
 * autenticador **deste** aparelho. Uma preferência sincronizada exigiria Face ID
 * num aparelho onde nenhuma credencial foi registrada — ou seja, um bloqueio sem
 * chave. O ajuste é por aparelho de propósito.
 */

export const BIOMETRIC_STORAGE_KEY = 'flowly:biometric';

/** Classe posta no <html> antes da primeira pintura; ver `globals.css`. */
export const BIOMETRIC_LOCK_CLASS = 'flowly-locked';

/** Voltar do segundo plano depois disso pede a biometria de novo. */
export const BIOMETRIC_RELOCK_SECONDS = 5 * 60;

export type BiometricSetting = {
  /** Id da credencial WebAuthn, em base64url. */
  credentialId: string;
  /** Dono da credencial: outra conta no mesmo aparelho não é bloqueada por ela. */
  userId: string;
};

export function toBase64Url(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// O parâmetro de tipo é explícito de propósito: `Uint8Array.from` devolve
// `Uint8Array<ArrayBufferLike>`, e a partir do TS 5.7 isso não satisfaz mais o
// `BufferSource` que a WebAuthn API pede.
export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/**
 * Lê o ajuste guardado. Devolve `null` para qualquer coisa que não seja um
 * registro íntegro **deste** usuário — inclusive JSON quebrado, que é o estado
 * em que o storage fica se alguém editar à mão.
 */
export function parseBiometricSetting(raw: string | null, userId: string): BiometricSetting | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BiometricSetting> | null;
    if (typeof parsed?.credentialId !== 'string' || parsed.credentialId === '') return null;
    if (parsed.userId !== userId) return null;
    return { credentialId: parsed.credentialId, userId };
  } catch {
    return null;
  }
}

/** `hiddenAt` é o instante em que a aba foi escondida; `null` = nunca saiu. */
export function shouldRelock(hiddenAt: number | null, now: number = Date.now()): boolean {
  if (hiddenAt === null) return false;
  return now - hiddenAt >= BIOMETRIC_RELOCK_SECONDS * 1000;
}

export function readBiometricSetting(userId: string): BiometricSetting | null {
  try {
    return parseBiometricSetting(window.localStorage.getItem(BIOMETRIC_STORAGE_KEY), userId);
  } catch {
    // Modo privado ou storage bloqueado: sem cadeado, o app segue.
    return null;
  }
}

export function saveBiometricSetting(setting: BiometricSetting): void {
  try {
    window.localStorage.setItem(BIOMETRIC_STORAGE_KEY, JSON.stringify(setting));
  } catch {
    // Sem persistência o cadeado não vale para a próxima abertura.
  }
}

export function clearBiometricSetting(): void {
  try {
    window.localStorage.removeItem(BIOMETRIC_STORAGE_KEY);
  } catch {
    // Nada a fazer.
  }
}

export function hasWebAuthn(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential === 'function' &&
    typeof navigator !== 'undefined' &&
    !!navigator.credentials
  );
}

/**
 * Existe biometria de plataforma neste aparelho? É a pergunta certa: um app de
 * finanças não deve oferecer "Face ID" num desktop que só tem chave USB.
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!hasWebAuthn()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function randomChallenge(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Registra a credencial. `rp` vai **sem `id`**: o navegador usa o domínio atual,
 * então não há um Relying Party ID chumbado no código para virar lixo quando o
 * app trocar de domínio — a credencial simplesmente deixa de ser oferecida e o
 * usuário registra de novo em Configurações.
 */
export async function registerBiometricCredential(user: {
  id: string;
  label: string;
}): Promise<BiometricSetting> {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: 'flowly' },
      user: {
        id: new TextEncoder().encode(user.id),
        name: user.label,
        displayName: user.label,
      },
      // ES256 e RS256: o par que cobre praticamente todo autenticador de
      // plataforma em uso.
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        // Sem chave residente: o id fica no localStorage e é passado em
        // `allowCredentials`. Não há login sem usuário para descobrir.
        residentKey: 'discouraged',
      },
      timeout: 60_000,
      attestation: 'none',
    },
  })) as PublicKeyCredential | null;

  if (!credential) throw new Error('Registro de biometria cancelado.');
  return { credentialId: toBase64Url(credential.rawId), userId: user.id };
}

/** Dispara o Face ID. Resolve quando o sistema confirma; lança quando não. */
export async function verifyBiometricCredential(setting: BiometricSetting): Promise<void> {
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      allowCredentials: [
        {
          type: 'public-key',
          id: fromBase64Url(setting.credentialId),
          transports: ['internal'],
        },
      ],
      userVerification: 'required',
      timeout: 60_000,
    },
  });

  if (!assertion) throw new Error('Biometria não confirmada.');
}
