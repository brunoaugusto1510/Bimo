import ConfiguracaoNecessaria from "@/components/ConfiguracaoNecessaria";
import PaginaPrincipal from "@/components/PaginaPrincipal";
import { obterArvoreDoVault } from "@/lib/vault-real";

// Sem isto, o Next.js pode tentar "congelar" esta página como HTML estático
// no build de produção (ótimo para conteúdo que não muda, ruim aqui: o vault
// pode ganhar notas novas a qualquer momento). Isso força buscar de novo a
// cada visita — o cache de 5 minutos em vault-real.ts já evita bater na API
// do GitHub toda hora.
export const dynamic = "force-dynamic";

/**
 * Este arquivo não tem "use client": ele roda no servidor. É aqui que dá para
 * usar o GITHUB_TOKEN com segurança — ele nunca chega ao navegador, porque
 * este componente já devolve HTML pronto (com a árvore do vault dentro).
 *
 * Tudo que precisa de estado e clique (useState, onClick) fica em
 * PaginaPrincipal, que é "use client" e recebe os dados prontos por prop.
 */
export default async function Pagina() {
  try {
    const { itens, aviso } = await obterArvoreDoVault();
    return <PaginaPrincipal itens={itens} aviso={aviso} />;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Erro desconhecido.";
    return <ConfiguracaoNecessaria mensagem={mensagem} />;
  }
}
