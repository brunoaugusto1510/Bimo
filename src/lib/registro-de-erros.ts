/**
 * Categoria de uma falha para os logs do servidor: nome, status HTTP e código SQLSTATE.
 * A mensagem fica de fora de propósito — pode carregar SQL, parâmetros ou texto das notas.
 */
export function descreverErro(erro: unknown): string {
  if (!(erro instanceof Error)) return "desconhecido";
  const status = "status" in erro && typeof erro.status === "number" ? erro.status : undefined;
  const codigo = codigoSql(erro) ?? codigoSql(erro.cause);
  return [erro.name, status, codigo].filter((parte) => parte !== undefined).join(":").slice(0, 100);
}

function codigoSql(erro: unknown): string | undefined {
  if (!erro || typeof erro !== "object" || !("code" in erro) || typeof erro.code !== "string") return undefined;
  return /^[0-9A-Z]{5}$/.test(erro.code) ? erro.code : undefined;
}
