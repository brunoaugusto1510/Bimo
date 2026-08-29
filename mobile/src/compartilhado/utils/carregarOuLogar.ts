// Fetches que rodam soltos num `useEffect` (sem `await`, sem estado de
// carregamento) engolem a rejeição em silêncio se ninguém encadear um
// `.catch`. O pior caso não é uma tela vazia: é um estado derivado que
// nunca sai do valor inicial — ver `notaPronta` em `Editor.tsx`, onde uma
// falha silenciosa deixaria o gatilho da IA desabilitado para sempre, sem
// nenhum indício do porquê. Não há UI de erro nesta fase (fora de escopo);
// o mínimo honesto é logar a falha em vez de engoli-la.
//
// `contexto` é uma frase curta e fixa (não a mensagem do erro em si) que
// identifica QUAL carregamento falhou nos logs — várias telas chamam este
// helper e todas caem no mesmo `console.error`.
export function carregarOuLogar<T>(promessa: Promise<T>, aoResolver: (valor: T) => void, contexto: string): void {
  promessa.then(aoResolver).catch((erro: unknown) => console.error(contexto, erro));
}
