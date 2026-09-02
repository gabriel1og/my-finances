/**
 * Ações da página, alinhadas à direita acima do conteúdo.
 *
 * Título e subtítulo saíram daqui: agora vivem no cabeçalho global, descritos
 * uma única vez em `NAV_ITEMS`. O que sobra é o que só a página sabe montar —
 * os modais, que dependem de dados carregados no servidor.
 */
export function PageActions({ children }: { children?: React.ReactNode }) {
  if (!children) return null;

  return <div className="mb-5 flex flex-wrap justify-end gap-2 sm:mb-6">{children}</div>;
}
