import type { Nota, Sugestao, TipoDeAcaoIA } from "@/dados/tipos";
import type { ServicoIA } from "../contratos";
import { notas } from "@/dados/fixtures/notas";
import { atraso } from "./atraso";

const ATRASO_DA_RESPOSTA = 1600;

export const servicoIaFake: ServicoIA = {
  async conversar(texto) {
    await atraso(ATRASO_DA_RESPOSTA);
    const termo = texto.toLowerCase();
    const encontradas = notas
      .filter((nota) => nota.titulo.toLowerCase().includes(termo) || nota.resumo.toLowerCase().includes(termo))
      .slice(0, 2);
    const escolhidas = encontradas.length > 0 ? encontradas : notas.slice(0, 2);

    return {
      texto: `Encontrei ${escolhidas.length} ${escolhidas.length === 1 ? "nota" : "notas"} sobre isso no seu vault. A mais desenvolvida é '${escolhidas[0].titulo}', da pasta ${escolhidas[0].pasta}.`,
      cartoes: escolhidas.map((nota) => nota.id),
    };
  },

  async acaoNaNota(tipo: TipoDeAcaoIA, nota: Nota): Promise<Sugestao> {
    await atraso(900);

    switch (tipo) {
      case "links": {
        const [primeira, segunda] = notas.filter((candidata) => candidata.id !== nota.id);
        return {
          tipo,
          rotulo: "Sugerir links",
          texto: `Esta nota conversa com '${primeira.titulo}' e '${segunda.titulo}'. Posso inserir os dois wikilinks no fim do corpo.\n\n[[${primeira.titulo}]]\n[[${segunda.titulo}]]`,
        };
      }
      case "resumo":
        return {
          tipo,
          rotulo: "Resumir a nota",
          texto: `${nota.resumo} A nota tem ${nota.conexoes} conexões e foi editada em ${nota.editadaEm}.`,
        };
      case "tags":
        return {
          tipo,
          rotulo: "Extrair tags",
          texto: "Três tags cobrem o que está escrito aqui:",
          tags: ["#método", "#vault", "#escrita"],
        };
      case "continuar":
        return {
          tipo,
          rotulo: "Continuar escrevendo",
          texto: "O ponto que falta é o custo: manter notas atômicas exige revisitar títulos toda vez que uma ideia se divide.",
        };
      case "perguntar":
        return {
          tipo,
          rotulo: "Perguntar sobre a nota",
          texto: `Sobre '${nota.titulo}': o que você ainda não desenvolveu é a relação com as notas da pasta ${nota.pasta}.`,
        };
    }
  },
};
