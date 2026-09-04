import { BIOMETRIC_LOCK_CLASS, BIOMETRIC_STORAGE_KEY } from '@/lib/biometric';

/**
 * Cobre a tela **antes da primeira pintura**, quando há cadeado registrado.
 *
 * Sem isto o cadeado teria um buraco visível: as rotas de `(app)` são
 * `force-dynamic`, então o HTML já chega com saldo e lançamentos e o navegador
 * pinta tudo antes de o React hidratar — a tela de bloqueio só apareceria
 * depois. Um script inline síncrono roda no lugar em que está, antes do
 * conteúdo abaixo dele, e é a única coisa que fecha essa janela.
 *
 * Só marca o `<html>`; quem pinta é a regra `html.flowly-locked::before` em
 * `globals.css`, e quem tira a marca é o `BiometricGuard` ao assumir.
 *
 * O `userId` entra pelo servidor para que a credencial de outra conta no mesmo
 * aparelho não bloqueie esta — a mesma regra do `parseBiometricSetting`.
 */
export function BiometricLockPaint({ userId }: { userId: string }) {
  const script =
    '(function(){try{' +
    `var raw=window.localStorage.getItem(${JSON.stringify(BIOMETRIC_STORAGE_KEY)});` +
    'if(!raw)return;var s=JSON.parse(raw);' +
    `if(s&&s.credentialId&&s.userId===${JSON.stringify(userId)})` +
    `document.documentElement.classList.add(${JSON.stringify(BIOMETRIC_LOCK_CLASS)});` +
    '}catch(e){}})();';

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
