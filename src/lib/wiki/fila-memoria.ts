import { ErroWiki, conferirFontes, type MetadadosWiki, type PublicacaoWiki } from "./tipos";
import type { NotaCompleta } from "../repositorio-de-notas/tipos";
import type { AutomacaoWiki, ConceitoWiki, TrabalhoWiki } from "./automacao-tipos";
import { ESTABILIDADE_DA_WIKI_SEGUNDOS } from "./configuracao";
import { renovarEnergiaEm, type EventoWiki } from "./observabilidade-tipos";
import { eventoDoDiagnostico, textoDaPublicacao, textoDoAdiamento, textoDaConservacao } from "./diario";

type Registro = Omit<TrabalhoWiki, "posse"> & { posse: string | null; ate: number; disponivel: number; estado: string; ultimoErro?: string };
/** Conteúdo novo pede processamento; renomear, mover, etiquetar ou reescrever ligações só acompanha a revisão. */
export type MudancaDeNota = "conteudo" | "organizacao";
/** Implementação descartável com as mesmas garantias observáveis do adaptador persistente. */
export function criarFilaWikiEmMemoria(acesso: {
  notas: Map<string, NotaCompleta>; paginas: Map<string, MetadadosWiki>;
  publicarAtomico: (publicacoes: PublicacaoWiki[]) => string[];
}) {
  const trabalhos = new Map<string, Registro>();
  const conceitos = new Map<string, ConceitoWiki>();
  const consumo = new Map<string, { dia: string; reservado: number; confirmado: boolean }>();
  const eventos = new Map<string, EventoWiki>();
  const evento = (chave: string, dados: Omit<EventoWiki, "id" | "criadoEm">) => {
    if (!eventos.has(chave)) eventos.set(chave, { ...dados, id: crypto.randomUUID(), criadoEm: new Date().toISOString() });
  };
  const dia = () => new Date().toISOString().slice(0, 10);
  function registrar(nota: NotaCompleta, mudanca: MudancaDeNota = "conteudo") {
    if (acesso.paginas.has(nota.id)) {
      const conceito = conceitos.get(nota.id); if (!conceito) return;
      if (mudanca === "conteudo") conceito.protegida = true;
      // Só acompanha quem estava em dia: uma edição manual anterior continua detectável pela divergência.
      else if (!conceito.protegida && conceito.revisaoGerenciada === nota.revisao - 1) conceito.revisaoGerenciada = nota.revisao;
      // A dependência continua sendo a origem pessoal, evitando realimentação entre sínteses.
      return;
    }
    const anterior = trabalhos.get(nota.id);
    if (mudanca === "organizacao") {
      if (anterior?.revisao === nota.revisao - 1) anterior.revisao = nota.revisao;
      // As sínteses que se apoiavam na revisão anterior continuam em dia (mesmo critério do banco).
      for (const conceito of conceitos.values()) if (conceito.origens[nota.id] === nota.revisao - 1) conceito.origens[nota.id] = nota.revisao;
      return;
    }
    if (anterior?.revisao === nota.revisao) return;
    trabalhos.set(nota.id, { notaId: nota.id, revisao: nota.revisao, geracao: (anterior?.geracao ?? 0) + 1,
      cursor: 0, posse: null, ate: 0, disponivel: Date.now() + ESTABILIDADE_DA_WIKI_SEGUNDOS * 1000, tentativas: 0,
      estado: anterior?.estado === "configuracao" ? "configuracao" : "pendente" });
  }
  function exigir(trabalho: TrabalhoWiki) {
    const atual = trabalhos.get(trabalho.notaId);
    if (!atual || atual.geracao !== trabalho.geracao || atual.posse !== trabalho.posse || atual.ate <= Date.now()) throw new ErroWiki("Trabalho superado.", 409);
    return atual;
  }
  const fila: AutomacaoWiki = {
    async solicitar(id) { const nota = acesso.notas.get(id); if (nota) registrar(nota); },
    async reprocessar(id, revisao) {
      const nota = acesso.notas.get(id);
      if (!nota) return "nao-encontrada";
      if (nota.revisao !== revisao) return "conflito";
      if (acesso.paginas.has(id)) return "derivada";
      const anterior = trabalhos.get(id);
      if (anterior && anterior.ate > Date.now()) return "ocupado";
      if (anterior?.estado === "configuracao") return "configuracao";
      trabalhos.set(id, { notaId: id, revisao, geracao: (anterior?.geracao ?? 0) + 1, cursor: 0, posse: null,
        ate: 0, disponivel: Date.now(), tentativas: 0, estado: "pendente" });
      return "ok";
    },
    async reconciliar(limite) {
      let registradas = 0;
      for (const nota of acesso.notas.values()) {
        if (registradas >= limite) break;
        if (!acesso.paginas.has(nota.id) && trabalhos.get(nota.id)?.revisao !== nota.revisao) { registrar(nota); registradas++; }
      }
      return registradas;
    },
    async reivindicar(notaId) {
      const valores = [...trabalhos.values()];
      if (valores.some((t) => t.estado === "configuracao" || t.ate > Date.now())) return null;
      for (const t of valores) if (t.estado === "pendente" && t.tentativas >= 3) t.estado = "temporario";
      const trabalho = valores.find((t) => (notaId === undefined || t.notaId === notaId) && t.estado === "pendente" && t.disponivel <= Date.now() && !acesso.paginas.has(t.notaId));
      if (!trabalho) return null;
      trabalho.posse = crypto.randomUUID(); trabalho.ate = Date.now() + 120_000; trabalho.tentativas++;
      return { notaId: trabalho.notaId, revisao: trabalho.revisao, geracao: trabalho.geracao,
        cursor: trabalho.cursor, posse: trabalho.posse, tentativas: trabalho.tentativas };
    },
    async conceitos() { return [...conceitos.values()].map((c) => ({ ...c, aliases: [...c.aliases], origens: { ...c.origens },
      ...(c.diagnostico ? { diagnostico: { ...c.diagnostico, alertas: [...c.diagnostico.alertas] } } : {}) })); },
    async cobertura() {
      const valores = [...trabalhos.values()].filter((t) => acesso.notas.has(t.notaId) && !acesso.paginas.has(t.notaId));
      const elegiveis = [...acesso.notas.values()].filter((n) => !acesso.paginas.has(n.id));
      const naoRegistradas = elegiveis.filter((n) => trabalhos.get(n.id)?.revisao !== n.revisao).length;
      return { elegiveis: elegiveis.length, naoRegistradas, pendentes: valores.filter((t) => t.estado === "pendente").length + naoRegistradas,
        concluidos: valores.filter((t) => t.estado === "concluido").length,
        impedidos: valores.filter((t) => !["pendente", "concluido"].includes(t.estado)).length };
    },
    async reservar(trabalho, quantidade, teto) {
      exigir(trabalho);
      if (!Number.isSafeInteger(quantidade) || quantidade < 1 || !Number.isSafeInteger(teto) || teto < 1) throw new ErroWiki("Orçamento inválido.");
      const usado = [...consumo.values()].filter((v) => v.dia === dia()).reduce((s, v) => s + v.reservado, 0);
      if (usado + quantidade > teto) return null;
      const id = crypto.randomUUID(); consumo.set(id, { dia: dia(), reservado: quantidade, confirmado: false }); return id;
    },
    async confirmarConsumo(id, uso) {
      const reserva = consumo.get(id); if (!reserva || reserva.confirmado) return;
      if (uso) { reserva.reservado = uso.entrada + uso.saida; reserva.confirmado = true; }
    },
    async concluir(trabalho, publicacoes, cursor, avaliadas = [], revisar = false, decisao) {
      const atual = exigir(trabalho);
      if (acesso.notas.get(trabalho.notaId)?.revisao !== trabalho.revisao) throw new ErroWiki("Origem superada.", 409);
      const chaves = new Set<string>(); const alvos = new Set<string>();
      for (const p of publicacoes) {
        conferirFontes(p.fontes, p.fontes.map((f) => acesso.notas.get(f.id) ?? null), new Set(acesso.paginas.keys()));
        if (!p.conceito || chaves.has(p.conceito.chave)) throw new ErroWiki("Conceito repetido.", 422);
        chaves.add(p.conceito.chave);
        if ([...conceitos.values()].some((c) => c.chave === p.conceito!.chave && c.notaId !== p.alvo?.id)) throw new ErroWiki("Conceito já existente.", 409);
        if (p.alvo) {
          if (alvos.has(p.alvo.id) || !acesso.paginas.has(p.alvo.id) || conceitos.get(p.alvo.id)?.protegida || conceitos.get(p.alvo.id)?.pausada || acesso.notas.get(p.alvo.id)?.revisao !== p.alvo.revisao) throw new ErroWiki("Edição protegida ou superada.", 409);
          alvos.add(p.alvo.id);
        }
      }
      const ids = acesso.publicarAtomico(publicacoes);
      for (const [i, p] of publicacoes.entries()) {
        const revisao = acesso.notas.get(ids[i])!.revisao;
        conceitos.set(ids[i], { notaId: ids[i], ...p.conceito!, protegida: false, pausada: false, origens: Object.fromEntries(p.fontes.map((f) => [f.id, f.revisao])), revisaoGerenciada: revisao });
        evento(`publicacao:${ids[i]}:${revisao}`, { tipo: p.alvo ? "cresceu" : "nasceu", sinteseId: ids[i], origemId: trabalho.notaId, texto: textoDaPublicacao(p.titulo, !p.alvo) });
      }
      for (const id of avaliadas) {
        const conceito = conceitos.get(id);
        if (conceito && !conceito.protegida && !conceito.pausada && conceito.origens[trabalho.notaId] !== undefined) conceito.origens[trabalho.notaId] = trabalho.revisao;
      }
      const progresso = publicacoes.some((p) => p.alvo) || avaliadas.length > 0 || cursor !== trabalho.cursor;
      atual.cursor = cursor ?? atual.cursor; atual.estado = revisar ? "revisar" : cursor === null ? "concluido" : "pendente";
      atual.posse = null; atual.ate = 0; atual.ultimoErro = revisar ? "PropostaEditorialRecusada:422" : undefined;
      atual.disponivel = progresso || cursor === null ? Date.now() : Date.now() + 30_000 * atual.tentativas;
      if (progresso) atual.tentativas = 0;
      if (revisar) evento(`falha:${trabalho.notaId}:${trabalho.geracao}`, { tipo: "precisa_de_voce", sinteseId: null, origemId: trabalho.notaId, texto: textoDoAdiamento() });
      else if (!publicacoes.length && cursor === null) evento(`leitura:${trabalho.notaId}:${trabalho.geracao}`, { tipo: "sem_novidade", sinteseId: null, origemId: trabalho.notaId, texto: textoDaConservacao(decisao) });
    },
    async falhar(trabalho, motivo, erro, decisao) {
      let atual: Registro; try { atual = exigir(trabalho); } catch { return; }
      atual.posse = null; atual.ate = 0; atual.ultimoErro = motivo === "orcamento" ? "orcamento" : erro;
      // Faltar orçamento não é falha do trabalho: a tentativa da reivindicação é devolvida.
      if (motivo === "orcamento") atual.tentativas = Math.max(0, atual.tentativas - 1);
      atual.estado = motivo === "temporario" && atual.tentativas < 3 || motivo === "orcamento" ? "pendente" : motivo;
      atual.disponivel = motivo === "orcamento" ? Date.parse(`${dia()}T00:00:00Z`) + 86_400_000 : Date.now() + 30_000 * atual.tentativas;
      if (motivo === "orcamento") evento(`energia:${dia()}`, { tipo: "energia", sinteseId: null, origemId: null, texto: "A energia disponível não comporta outra leitura. A fila retoma após a renovação diária." });
      else if (atual.estado !== "pendente") evento(`falha:${trabalho.notaId}:${trabalho.geracao}`, { tipo: "precisa_de_voce", sinteseId: null, origemId: trabalho.notaId, texto: textoDoAdiamento(decisao) });
    },
    async retomar() {
      for (const t of trabalhos.values()) if (["configuracao", "temporario"].includes(t.estado) || t.estado === "revisar" && t.ultimoErro?.startsWith("ErroOpenAI:")) {
        t.estado = "pendente"; t.tentativas = 0; t.disponivel = Date.now(); t.posse = null; t.ate = 0;
      }
    },
    async gerenciar(id, revisao, gerenciada) {
      const nota = acesso.notas.get(id); const conceito = conceitos.get(id);
      if (!nota || !conceito) return "nao-encontrada";
      if (nota.revisao !== revisao) return "conflito";
      conceito.protegida = !gerenciada; conceito.revisaoGerenciada = revisao;
      if (gerenciada) for (const raiz of Object.keys(conceito.origens)) {
        const origem = acesso.notas.get(raiz); if (!origem) continue;
        registrar(origem); const trabalho = trabalhos.get(raiz)!;
        trabalho.geracao++; trabalho.cursor = 0; trabalho.posse = null; trabalho.ate = 0;
        trabalho.estado = "pendente"; trabalho.tentativas = 0; trabalho.disponivel = Date.now();
      }
      return "ok";
    },
    async pausar(id, revisao, pausada) {
      const nota = acesso.notas.get(id); const conceito = conceitos.get(id);
      if (!nota || !conceito) return "nao-encontrada";
      if (nota.revisao !== revisao) return "conflito";
      conceito.pausada = pausada;
      if (!pausada && !conceito.protegida) for (const raiz of Object.keys(conceito.origens)) {
        const t = trabalhos.get(raiz); if (!t) continue;
        t.geracao++; t.cursor = 0; t.estado = "pendente"; t.tentativas = 0; t.posse = null; t.ate = 0; t.disponivel = Date.now();
      }
      return "ok";
    },
    async diario(p) {
      const antesEm = p.antes && new Date(p.antes.criadoEm).toISOString();
      return [...eventos.values()].filter((e) => e.criadoEm >= new Date(p.inicio).toISOString() && e.criadoEm < new Date(p.fim).toISOString()
        && (!p.antes || e.criadoEm < antesEm! || e.criadoEm === antesEm && e.id < p.antes.id))
        .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm) || b.id.localeCompare(a.id)).slice(0, Math.max(1, Math.min(p.limite ?? 50, 101))).map((e) => ({ ...e }));
    },
    async energia(teto) {
      const utilizada = [...consumo.values()].filter((v) => v.dia === dia()).reduce((s, v) => s + v.reservado, 0);
      return { teto, utilizada, restante: Math.max(0, teto - utilizada), renovaEm: renovarEnergiaEm() };
    },
    async registrarDiagnostico(id, revisao, diagnostico) {
      const c = conceitos.get(id); if (!c || acesso.notas.get(id)?.revisao !== revisao) return;
      if (c.diagnostico?.assinatura !== diagnostico.assinatura && diagnostico.alertas.length) {
        evento(`lint:${id}:${diagnostico.verificadoEm}:${diagnostico.assinatura}`, { ...eventoDoDiagnostico(diagnostico.alertas), sinteseId: id, origemId: null });
      }
      c.diagnostico = { ...diagnostico, alertas: [...diagnostico.alertas] };
    },
  };
  /** Revisão que a automação considera sua; divergir dela é edição manual. */
  function gerencia(id: string) {
    const conceito = conceitos.get(id);
    return conceito && { revisao: conceito.revisaoGerenciada, protegida: conceito.protegida };
  }
  return { fila, registrar, gerencia };
}
