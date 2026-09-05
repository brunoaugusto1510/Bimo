/**
 * Busca o HTML de uma página web pela URL — cliente fino de rede, sem
 * lógica de extração (isso fica em `extracao/pagina-web.ts`).
 *
 * Bloqueia alvos óbvios de SSRF antes de buscar (e a cada redirecionamento
 * seguido manualmente): esquemas que não sejam http/https, localhost e
 * faixas de IP privadas/link-local — inclusive o endereço de metadata de
 * nuvem (169.254.169.254), um alvo clássico de SSRF.
 *
 * É uma checagem por *nome do host*, não por IP resolvido — não protege
 * contra DNS rebinding (um domínio público que resolve pra um IP privado no
 * momento da requisição). Suficiente pro cenário atual (uso pessoal, URL
 * escolhida pelo próprio usuário ou pelo agente agindo por ele), não uma
 * defesa exaustiva contra atacante adversarial.
 */

const TAMANHO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10 MB
const TIMEOUT_MS = 15_000;
const MAXIMO_REDIRECIONAMENTOS = 5;

export class BuscaWebError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BuscaWebError";
  }
}

const PADROES_HOST_BLOQUEADO = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./, // inclui o endereço de metadata de provedores de nuvem
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,
  /^fe80:/i,
];

function validarUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BuscaWebError(`Esquema "${url.protocol}" não permitido — use http ou https.`);
  }

  const host = url.hostname.replace(/^\[|\]$/g, ""); // remove colchetes de host IPv6
  if (PADROES_HOST_BLOQUEADO.some((padrao) => padrao.test(host))) {
    throw new BuscaWebError(`Host "${host}" não é permitido (endereço local/privado).`);
  }
}

async function buscarComRedirecionamentoControlado(
  url: URL,
  tentativasRestantes: number,
): Promise<Response> {
  validarUrl(url);

  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      signal: controlador.signal,
      redirect: "manual",
      headers: { "User-Agent": "bimo-ingestao/1.0" },
    });
  } catch (erro) {
    throw new BuscaWebError(
      `Falha ao buscar "${url.toString()}": ${erro instanceof Error ? erro.message : String(erro)}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  const local = resposta.headers.get("location");
  const ehRedirecionamento = resposta.status >= 300 && resposta.status < 400 && local;

  if (ehRedirecionamento) {
    if (tentativasRestantes <= 0) {
      throw new BuscaWebError("Excesso de redirecionamentos.");
    }
    // Revalida o próximo salto — impede redirecionar pra um endereço interno
    // depois que a URL original já passou na checagem.
    return buscarComRedirecionamentoControlado(new URL(local, url), tentativasRestantes - 1);
  }

  return resposta;
}

export type PaginaBaixada = {
  conteudo: Buffer;
  tipoMime: string;
};

/** Busca uma página web, seguindo redirecionamentos com revalidação e limitando o tamanho. */
export async function buscarPagina(urlBruta: string): Promise<PaginaBaixada> {
  const url = new URL(urlBruta);
  const resposta = await buscarComRedirecionamentoControlado(url, MAXIMO_REDIRECIONAMENTOS);

  if (!resposta.ok) {
    throw new BuscaWebError(`"${urlBruta}" respondeu ${resposta.status}.`);
  }

  const tamanhoDeclarado = Number(resposta.headers.get("content-length") ?? 0);
  if (tamanhoDeclarado > TAMANHO_MAXIMO_BYTES) {
    throw new BuscaWebError(`Página maior que o limite de ${TAMANHO_MAXIMO_BYTES} bytes.`);
  }

  const bytes = await resposta.arrayBuffer();
  if (bytes.byteLength > TAMANHO_MAXIMO_BYTES) {
    throw new BuscaWebError(`Página maior que o limite de ${TAMANHO_MAXIMO_BYTES} bytes.`);
  }

  const tipoMime = (resposta.headers.get("content-type") ?? "text/html").split(";")[0].trim();

  return { conteudo: Buffer.from(bytes), tipoMime };
}
