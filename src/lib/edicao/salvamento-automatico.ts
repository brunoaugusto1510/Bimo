import type { ResultadoDoSalvamento } from "../cliente-de-notas";
import type { NotaCompleta } from "../repositorio-de-notas/tipos";

export type EstadoDoSalvamento = "salvo" | "pendente" | "salvando" | "erro" | "conflito" | "recusado";
export type OpcoesDoSalvamento = { checkpoint: boolean; keepalive: boolean };
export type RetratoDaEdicao = { texto: string; nota: NotaCompleta; estado: EstadoDoSalvamento; atual?: NotaCompleta; mensagem?: string };
type Dependencias = {
  nota: NotaCompleta;
  salvar: (conteudo: string, revisaoBase: number, opcoes: OpcoesDoSalvamento) => Promise<ResultadoDoSalvamento>;
  aoMudar?: (retrato: RetratoDaEdicao) => void;
  aoSalvar?: (nota: NotaCompleta, checkpoint: boolean) => void;
  agora?: () => number;
  agendar?: typeof setTimeout;
  cancelar?: typeof clearTimeout;
};

/** Uma fila por nota: só a resposta aceita avança a revisão. Nunca usa a revisão de um conflito sem escolha humana. */
export function criarSalvamentoAutomatico(deps: Dependencias) {
  const agora = deps.agora ?? Date.now;
  const agendar = deps.agendar ?? setTimeout;
  const cancelar = deps.cancelar ?? clearTimeout;
  let retrato: RetratoDaEdicao = { nota: deps.nota, texto: deps.nota.conteudo, estado: "salvo" };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let primeira: number | undefined;
  let voo: Promise<void> | null = null;
  let falhas = 0;
  let destruido = false;
  let sessaoAberta = false;
  let checkpointPendente = false;
  let manterVivo = false;
  let automatico = true;
  let geracao = 0;
  let forcaPendente = false;
  const sujo = () => retrato.texto !== retrato.nota.conteudo;
  function emitir(mudanca: Partial<RetratoDaEdicao>) {
    retrato = { ...retrato, ...mudanca }; deps.aoMudar?.(retrato);
  }
  function limparTimer() { if (timer !== undefined) cancelar(timer); timer = undefined; }
  function programar(ms: number) {
    limparTimer(); if (!destruido && (automatico || retrato.estado === "erro")) timer = agendar(() => { timer = undefined; void executar(); }, ms);
  }
  function bloqueado() { return destruido || retrato.estado === "conflito" || retrato.estado === "recusado"; }
  function executar(): Promise<void> {
    if (voo) return voo;
    if (bloqueado() || (!sujo() && !(checkpointPendente && sessaoAberta))) return Promise.resolve();
    limparTimer();
    const texto = retrato.texto;
    const envio = geracao;
    primeira = undefined;
    const revisao = retrato.nota.revisao;
    const checkpoint = checkpointPendente;
    const keepalive = manterVivo;
    checkpointPendente = false; manterVivo = false; forcaPendente = false;
    emitir({ estado: "salvando" });
    // O microtask protege inclusive uma função injetada que lance antes de devolver a promessa.
    voo = Promise.resolve().then(() => deps.salvar(texto, revisao, { checkpoint, keepalive })).then((resultado) => {
      if (destruido || envio !== geracao) return;
      if (resultado.tipo === "ok" || (resultado.tipo === "conflito" && resultado.atual.conteudo === texto)) {
        const nota = resultado.tipo === "ok" ? resultado.nota : resultado.atual;
        falhas = 0; sessaoAberta = !checkpoint;
        if (!sujoDepois(nota)) primeira = undefined;
        emitir({ nota, atual: undefined, estado: sujoDepois(nota) ? "pendente" : "salvo" });
        deps.aoSalvar?.(nota, checkpoint);
        if (checkpoint && sujo()) checkpointPendente = true;
        if (checkpoint && !sujo()) { checkpointPendente = false; manterVivo = false; }
      } else if (resultado.tipo === "conflito") {
        emitir({ estado: "conflito", atual: resultado.atual });
      } else { emitir({ estado: "recusado", mensagem: resultado.tipo === "grande-demais" ? "O texto excede o limite do servidor. Copie seu texto ou reduza-o antes de tentar de novo." : "O servidor recusou a gravação. Seu texto continua neste dispositivo." }); }
    }).catch(() => {
      if (destruido || envio !== geracao) return;
      checkpointPendente ||= checkpoint;
      emitir({ estado: "erro" });
      programar([5000, 15000, 30000][Math.min(falhas++, 2)]);
    }).finally(() => {
      voo = null;
      if (!bloqueado() && retrato.estado !== "erro" && (sujo() || (checkpointPendente && sessaoAberta))) {
        if (forcaPendente || checkpointPendente) void executar();
        else programar(Math.max(0, Math.min(3000, 30000 - (agora() - (primeira ?? agora())))));
      }
    });
    return voo;
  }
  const sujoDepois = (nota: NotaCompleta) => retrato.texto !== nota.conteudo;
  async function forcar(opcoes: { checkpoint: boolean; keepalive?: boolean }): Promise<void> {
    if (bloqueado()) return;
    if (!voo && !sujo() && !sessaoAberta) return;
    checkpointPendente ||= opcoes.checkpoint;
    forcaPendente = true;
    manterVivo ||= opcoes.keepalive ?? false;
    await executar();
    // Inclui na promessa o texto que chegou durante o voo, sem repetir automaticamente uma falha.
    if (!bloqueado() && retrato.estado !== "erro" && (voo || sujo() || (checkpointPendente && sessaoAberta))) await forcar(opcoes);
  }
  function mudar(texto: string) {
    if (destruido) return;
    emitir({ texto });
    if (bloqueado()) return;
    primeira ??= agora();
    if (voo) return;
    if (!sujo()) { limparTimer(); primeira = undefined; emitir({ estado: "salvo" }); return; }
    if (retrato.estado === "erro") return;
    primeira ??= agora(); emitir({ estado: "pendente" });
    programar(Math.max(0, Math.min(3000, 30000 - (agora() - primeira))));
  }
  function descartar(nota = retrato.atual ?? retrato.nota) {
    geracao++; sessaoAberta = false; forcaPendente = false;
    limparTimer(); primeira = undefined; falhas = 0; checkpointPendente = false;
    emitir({ nota, texto: nota.conteudo, atual: undefined, estado: "salvo" });
  }
  async function resolver(escolha: "manter" | "usar") {
    if (!retrato.atual) return;
    const atual = retrato.atual;
    if (escolha === "usar") { descartar(atual); return; }
    emitir({ nota: atual, atual: undefined, estado: retrato.texto === atual.conteudo ? "salvo" : "pendente" });
    await forcar({ checkpoint: true });
  }
  return {
    obter: () => retrato, mudar, forcar, descartar, resolver,
    recuperarConflito(texto: string, atual: NotaCompleta) { limparTimer(); emitir({ texto, atual, estado: "conflito" }); },
    destruir() { destruido = true; limparTimer(); },
    temAlteracoes: sujo,
    emVoo: () => voo !== null,
    tentarNovamente() { if (retrato.estado === "recusado") emitir({ estado: "pendente", mensagem: undefined }); return forcar({ checkpoint: true }); },
    adotar(nota: NotaCompleta) { if (!sujo() && !voo && retrato.estado === "salvo" && nota.revisao > retrato.nota.revisao) descartar(nota); },
    habilitar(valor: boolean) { automatico = valor; if (!valor && retrato.estado !== "erro") limparTimer(); else if (sujo() && !bloqueado() && !voo) programar(retrato.estado === "erro" ? 5000 : 3000); },
  };
}
export type SalvamentoAutomatico = ReturnType<typeof criarSalvamentoAutomatico>;
