/**
 * Mensagens do Supabase Auth chegam em inglês. Traduzir só as que o usuário
 * realmente encontra — o resto cai no texto original, que é melhor que um
 * "erro inesperado" genérico na hora de depurar.
 */
const MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme o e-mail antes de entrar. Verifique sua caixa de entrada.',
  'User already registered': 'Este e-mail já tem conta. Entre em vez de cadastrar.',
  'Password should be at least 6 characters.': 'A senha precisa ter ao menos 6 caracteres.',
  'Signups not allowed for this instance': 'Cadastro desativado no momento.',
  'Email address not authorized':
    'O envio de e-mail do projeto ainda está restrito. Configure o SMTP ou desligue a confirmação.',
};

export function translateAuthError(message: string) {
  return MESSAGES[message] ?? message;
}

export const ACCOUNT_EXISTS = 'Este e-mail já tem conta. Entre em vez de cadastrar.';
export const SESSION_EXPIRED = 'Sua sessão expirou por inatividade. Entre novamente.';
