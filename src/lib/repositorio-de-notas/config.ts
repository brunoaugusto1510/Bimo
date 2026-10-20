/**
 * De onde as notas vêm, lido do ambiente — sem importar nada do banco.
 *
 * Isso importa: `db/cliente.ts` lança erro assim que é importado sem
 * `DATABASE_URL`. Se este arquivo (ou a página) o importasse, a falha suave
 * quebraria e o app inteiro cairia em vez de mostrar "falta configurar".
 * Quem precisa do banco só o carrega (`await import`) depois que esta
 * validação passou.
 */

export type ConfiguracaoDeNotas =
  | { fonte: "memoria" }
  | { fonte: "banco"; userId: string };

/** Uma configuração que falta ou está errada — a interface mostra `mensagem` e lista `variaveis`. */
export class ErroDeConfiguracao extends Error {
  constructor(
    mensagem: string,
    readonly variaveis: string[],
  ) {
    super(mensagem);
    this.name = "ErroDeConfiguracao";
  }
}

const FONTES = ["banco", "memoria"] as const;
export const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `NOTAS_FONTE` escolhe a fonte; ausente, vale `banco`. `memoria` só existe
 * para testes e desenvolvimento. A fonte `github` foi removida: dá erro claro
 * em vez de cair em outra fonte sem avisar.
 */
export function lerConfiguracaoDeNotas(env: NodeJS.ProcessEnv = process.env): ConfiguracaoDeNotas {
  const fonte = (env.NOTAS_FONTE ?? "").trim().toLowerCase() || "banco";

  if (fonte === "github") {
    throw new ErroDeConfiguracao(
      "A fonte GitHub foi removida: as notas agora ficam no banco. Troque NOTAS_FONTE por banco (ou apague a variável).",
      ["NOTAS_FONTE"],
    );
  }

  if (!(FONTES as readonly string[]).includes(fonte)) {
    throw new ErroDeConfiguracao(
      "NOTAS_FONTE tem um valor que não existe. Use banco ou memoria.",
      ["NOTAS_FONTE"],
    );
  }

  if (fonte === "memoria") {
    if (env.NODE_ENV === "production") {
      throw new ErroDeConfiguracao(
        "NOTAS_FONTE=memoria não pode ser usada em produção: tudo se perderia a cada reinício.",
        ["NOTAS_FONTE"],
      );
    }
    return { fonte: "memoria" };
  }

  const userId = env.USER_ID_PADRAO?.trim();
  const faltando = [!env.DATABASE_URL?.trim() && "DATABASE_URL", !userId && "USER_ID_PADRAO"].filter(
    (nome): nome is string => Boolean(nome),
  );
  if (faltando.length > 0) {
    throw new ErroDeConfiguracao(`Para guardar as notas no banco, falta configurar: ${faltando.join(", ")}.`, faltando);
  }
  if (!REGEX_UUID.test(userId!)) {
    throw new ErroDeConfiguracao("USER_ID_PADRAO precisa ser o UUID de um usuário do Supabase Auth.", [
      "USER_ID_PADRAO",
    ]);
  }
  return { fonte: "banco", userId: userId! };
}
