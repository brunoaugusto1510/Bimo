/** Classes compartilhadas pelas telas da Wiki Viva, no desenho do artifact "Bimo — Wiki Viva: conceitos e telas". */
const botao = "inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-controle transition-[background-color,color,transform] motion-safe:active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destaque disabled:cursor-wait disabled:opacity-50 aria-disabled:cursor-wait aria-disabled:opacity-50";

/** A ação principal do cartão ou da tela: azul cheio. */
export const botaoPrimario = `${botao} bg-destaque font-semibold text-sobre-destaque hover:bg-destaque-hover`;
/** Ação secundária: pílula contornada, texto neutro. */
export const botaoSecundario = `${botao} border border-borda bg-painel text-texto hover:bg-painel-alt`;
/** Ações que falam com o Bimo ("Perguntar ao Bimo", "Devolver ao Bimo"): contorno azul. */
export const botaoDoBimo = `${botao} border border-destaque bg-painel font-semibold text-destaque-texto hover:bg-destaque-suave`;
/** Botão só com ícone (fechar, anterior/próxima). */
export const botaoIcone = "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-suave transition-[background-color,color,transform] hover:bg-painel-alt hover:text-texto motion-safe:active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-destaque";
/** Ação em forma de link dentro de cartões ("Abrir nota", "Ver o que mudou"). */
export const acaoDeTexto = "inline-flex min-h-10 items-center text-controle font-semibold text-destaque-texto hover:underline focus-visible:outline-2 focus-visible:outline-destaque";
/** Chip de filtro: o ativo é azul cheio, os outros são contornados. */
export const chip = (ativo: boolean) => ativo ? `${botao} bg-destaque font-semibold text-sobre-destaque` : `${botao} border border-borda bg-painel text-texto hover:bg-painel-alt`;
export const cartao = "rounded-card border border-borda bg-painel";
export const rotuloDeSecao = "text-secao font-semibold tracking-[0.08em] text-suave uppercase";

/** Mantido para quem ainda usa o nome antigo: é a ação secundária. */
export const acaoWiki = botaoSecundario;
