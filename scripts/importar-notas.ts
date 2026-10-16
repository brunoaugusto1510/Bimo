import "dotenv/config";
import { AVISO_SIMULACAO, formatarRelatorio, importarNotas, interpretarArgumentos } from "../src/lib/importacao-de-notas";
import { lerConfiguracaoDeNotas } from "../src/lib/repositorio-de-notas/config";
import { obterNotasPlanas, lerConteudoDaNota } from "../src/lib/vault-real";

let etapa = "validar configuração";

async function principal() {
  const opcoes = interpretarArgumentos(process.argv.slice(2));
  if (!opcoes.executar) console.log(AVISO_SIMULACAO);
  try {
    const configuracao = lerConfiguracaoDeNotas({ ...process.env, NOTAS_FONTE: "banco" });
    if (configuracao.fonte !== "banco") throw new Error("Configuração do banco indisponível.");
    if (!process.env.VAULT_REPO || !/^[^/\s]+\/[^/\s]+$/.test(process.env.VAULT_REPO) || !process.env.GITHUB_TOKEN) {
      throw new Error("Configure VAULT_REPO (dono/repositorio) e GITHUB_TOKEN para ler as notas.");
    }
    etapa = "carregar adaptador do banco";
    const { criarRepositorioDoBanco } = await import("../src/lib/repositorio-de-notas/banco");
    const relatorio = await importarNotas({
      fonte: {
        obterNotasPlanas: async () => {
          etapa = "listar notas do GitHub";
          const listagem = await obterNotasPlanas();
          etapa = "consultar notas existentes no banco";
          return listagem;
        },
        lerConteudoDaNota,
      },
      repositorio: criarRepositorioDoBanco(configuracao.userId), opcoes,
    });
    console.log(formatarRelatorio(relatorio, false));
    process.exitCode = relatorio.codigoDeSaida;
  } finally {
    if (!opcoes.executar) console.log(AVISO_SIMULACAO);
  }
}

principal().catch((erro: unknown) => {
  // Erros de drivers e APIs podem conter credenciais, URLs e dados do usuário.
  const mensagem = erro instanceof Error && (
    erro.name === "ErroDeConfiguracao" || erro.message.includes("Flags disponíveis:") ||
    erro.message.startsWith("Configure VAULT_REPO") || erro.message.startsWith("Listagem incompleta:")
  ) ? erro.message : `Não foi possível ${etapa}. Verifique a configuração e o acesso ao GitHub e ao banco.`;
  console.error(mensagem);
  process.exitCode = 1;
}).finally(() => {
  // O pool é privado ao cliente do app e mantém sockets ociosos depois do relatório.
  process.exit(process.exitCode ?? 0);
});
