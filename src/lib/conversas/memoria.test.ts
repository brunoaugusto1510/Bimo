import { criarArmazemDeConversas, criarRepositorioDeConversasEmMemoria } from "./memoria";
import { executarContratoDoRepositorioDeConversas } from "./suite-de-contrato";

executarContratoDoRepositorioDeConversas("memória", async () => {
  const armazem = criarArmazemDeConversas();
  return {
    repo: criarRepositorioDeConversasEmMemoria(armazem, "ana"),
    outraPessoa: criarRepositorioDeConversasEmMemoria(armazem, "beto"),
  };
});
