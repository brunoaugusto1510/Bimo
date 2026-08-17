/**
 * Basic auth (RFC 7617) para trancar o Bimo inteiro.
 *
 * Por que basic auth: o vault é pessoal e tem um único usuário, então não vale
 * o peso de um provedor de identidade. O navegador guarda as credenciais por
 * origem e reenvia sozinho em toda requisição seguinte — inclusive nos `fetch`
 * do chat e da leitura de nota, que por isso não precisam de nada especial.
 *
 * Este módulo só decide "pode ou não pode" e monta a resposta de recusa. Quem
 * chama são o `proxy.ts` (barra tudo na borda) e cada rota de API: a doc do
 * Next 16 recomenda não confiar só no proxy, porque uma mudança de `matcher`
 * pode silenciosamente descobrir uma rota.
 */

const REALM = "Bimo";

/** Discriminated union em vez de boolean: cada recusa gera uma resposta diferente. */
export type ResultadoAutenticacao =
  | { tipo: "ok" }
  | { tipo: "sem-credenciais" }
  | { tipo: "credenciais-invalidas" }
  | { tipo: "nao-configurado"; mensagem: string };

/** Tudo menos "ok" — assim `respostaDeDesafio` não aceita um acesso liberado. */
export type RecusaDeAutenticacao = Exclude<ResultadoAutenticacao, { tipo: "ok" }>;

type Credenciais = { usuario: string; senha: string };

function lerCredenciaisEsperadas(): Credenciais | null {
  const usuario = process.env.BASIC_USER;
  const senha = process.env.BASIC_PASS;

  // String vazia conta como ausente: senha em branco é trancar a porta e
  // deixar a chave na fechadura.
  if (!usuario || !senha) return null;

  return { usuario, senha };
}

function decodificarBasic(cabecalho: string): Credenciais | null {
  const espaco = cabecalho.indexOf(" ");
  if (espaco === -1) return null;

  const esquema = cabecalho.slice(0, espaco);
  const base64 = cabecalho.slice(espaco + 1).trim();
  if (esquema.toLowerCase() !== "basic" || base64 === "") return null;

  let texto: string;
  try {
    // `atob` devolve um byte por caractere; o TextDecoder remonta o UTF-8.
    // Sem isso, senha com acento nunca casaria — o navegador manda UTF-8.
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Base64 inválido ou bytes que não formam UTF-8: credencial malformada,
    // não um erro nosso.
    return null;
  }

  // Só o primeiro ":" separa; o resto pertence à senha (RFC 7617).
  const separador = texto.indexOf(":");
  if (separador === -1) return null;

  return { usuario: texto.slice(0, separador), senha: texto.slice(separador + 1) };
}

/**
 * Comparação em tempo constante: um `===` normal para de comparar no primeiro
 * caractere diferente, e essa diferença de tempo vaza o prefixo correto da
 * senha para quem medir com paciência.
 */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  const codificador = new TextEncoder();
  const bytesA = codificador.encode(a);
  const bytesB = codificador.encode(b);

  if (bytesA.length !== bytesB.length) return false;

  let diferenca = 0;
  for (let i = 0; i < bytesA.length; i++) {
    diferenca |= bytesA[i] ^ bytesB[i];
  }

  return diferenca === 0;
}

export function verificarCredenciais(request: Request): ResultadoAutenticacao {
  const esperadas = lerCredenciaisEsperadas();

  // Falha fechada, de propósito: se as variáveis sumirem, o certo é o app
  // parar de responder — e não voltar a servir o vault para o mundo.
  if (!esperadas) {
    return {
      tipo: "nao-configurado",
      mensagem:
        "BASIC_USER e BASIC_PASS não estão configuradas. Sem elas o Bimo recusa " +
        "todo acesso, para não expor o vault por descuido.",
    };
  }

  const cabecalho = request.headers.get("authorization");
  if (!cabecalho) return { tipo: "sem-credenciais" };

  const recebidas = decodificarBasic(cabecalho);
  if (!recebidas) return { tipo: "credenciais-invalidas" };

  // Os dois campos são comparados sempre, sem curto-circuito, para o tempo de
  // resposta não contar se foi o usuário ou a senha que errou.
  const usuarioOk = iguaisEmTempoConstante(recebidas.usuario, esperadas.usuario);
  const senhaOk = iguaisEmTempoConstante(recebidas.senha, esperadas.senha);

  return usuarioOk && senhaOk ? { tipo: "ok" } : { tipo: "credenciais-invalidas" };
}

export function respostaDeDesafio(recusa: RecusaDeAutenticacao): Response {
  // Problema de configuração não se resolve pedindo senha: sem desafio aqui,
  // senão o navegador fica repetindo o popup para sempre.
  if (recusa.tipo === "nao-configurado") {
    return Response.json({ erro: recusa.mensagem }, { status: 503 });
  }

  return Response.json(
    { erro: "Acesso restrito." },
    {
      status: 401,
      headers: {
        // `charset="UTF-8"` avisa o navegador para codificar a senha em UTF-8,
        // que é exatamente o que `decodificarBasic` espera na volta.
        "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
      },
    },
  );
}
