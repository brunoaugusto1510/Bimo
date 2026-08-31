export type Tom = "base" | "suave" | "tenue" | "sinal";

export type NoAmbiente = {
  x: number; y: number; vx: number; vy: number;
  raio: number; tom: Tom; fase: number;
  escala: number;
  framesDeVida: number | null;
};

export type Particula = { deX: number; deY: number; paraX: number; paraY: number; progresso: number; velocidade: number };

export type OpcoesDeCampo = { largura: number; altura: number; quantidade: number; aleatorio: () => number };

const FRACAO_DO_RAIO = 0.62;
const LIMITE_DE_FUGA = 1.1;
const VELOCIDADE_MAXIMA = 0.12;
const FRACAO_DE_LIGACAO = 0.22;
const MAXIMO_DE_LIGACOES = 6;
const FRAMES_ATE_CRESCER = 50;
const ESCALA_INICIAL = 0.4;
const PASSO_DA_FASE = 0.05;

// Leva "worklet" porque `avancarCampoEmLugar` a chama no loop de quadros, na
// UI. Continua chamável do lado do React — a diretiva não impede isso.
export function raioDoCampo(largura: number, altura: number): number {
  "worklet";
  return Math.min(largura, altura) * FRACAO_DO_RAIO;
}

function sortearRaio(sorteio: number): number {
  if (sorteio < 0.02) return 3.2;
  if (sorteio < 0.1) return 2;
  return 1.1;
}

function sortearTom(sorteio: number): Tom {
  if (sorteio < 0.06) return "sinal";
  if (sorteio < 0.4) return "suave";
  if (sorteio < 0.6) return "tenue";
  return "base";
}

export function criarCampo({ largura, altura, quantidade, aleatorio }: OpcoesDeCampo): NoAmbiente[] {
  const raio = raioDoCampo(largura, altura);
  const centroX = largura / 2;
  const centroY = altura / 2;

  return Array.from({ length: quantidade }, () => {
    const angulo = aleatorio() * Math.PI * 2;
    const distancia = Math.sqrt(aleatorio()) * raio;
    return {
      x: centroX + Math.cos(angulo) * distancia,
      y: centroY + Math.sin(angulo) * distancia,
      vx: (aleatorio() - 0.5) * 2 * VELOCIDADE_MAXIMA,
      vy: (aleatorio() - 0.5) * 2 * VELOCIDADE_MAXIMA,
      raio: sortearRaio(aleatorio()),
      tom: sortearTom(aleatorio()),
      fase: aleatorio() * Math.PI * 2,
      escala: 1,
      framesDeVida: null,
    };
  });
}

export function avancarCampo(nos: NoAmbiente[], { largura, altura }: OpcoesDeCampo): NoAmbiente[] {
  const raio = raioDoCampo(largura, altura);
  const limite = raio * LIMITE_DE_FUGA;
  const centroX = largura / 2;
  const centroY = altura / 2;

  return nos.map((no) => {
    const fugiu = Math.hypot(no.x - centroX, no.y - centroY) > limite;
    const vx = fugiu ? -no.vx : no.vx;
    const vy = fugiu ? -no.vy : no.vy;
    const framesDeVida = no.framesDeVida === null ? null : no.framesDeVida + 1;
    const escala =
      framesDeVida === null
        ? 1
        : Math.min(1, ESCALA_INICIAL + (1 - ESCALA_INICIAL) * (framesDeVida / FRAMES_ATE_CRESCER));

    return { ...no, x: no.x + vx, y: no.y + vy, vx, vy, fase: no.fase + PASSO_DA_FASE, escala, framesDeVida };
  });
}

export function calcularLigacoes(nos: NoAmbiente[], raio: number): [number, number][] {
  const distanciaMaxima = raio * FRACAO_DE_LIGACAO;
  const grau = new Array<number>(nos.length).fill(0);
  const ligacoes: [number, number][] = [];

  for (let a = 0; a < nos.length; a += 1) {
    for (let b = a + 1; b < nos.length; b += 1) {
      if (grau[a] >= MAXIMO_DE_LIGACOES || grau[b] >= MAXIMO_DE_LIGACOES) continue;
      if (Math.hypot(nos[a].x - nos[b].x, nos[a].y - nos[b].y) > distanciaMaxima) continue;
      ligacoes.push([a, b]);
      grau[a] += 1;
      grau[b] += 1;
    }
  }

  return ligacoes;
}

export function criarParticulas(nos: NoAmbiente[], quantidade: number, aleatorio: () => number): Particula[] {
  if (nos.length < 2) return [];

  return Array.from({ length: quantidade }, () => {
    const origem = nos[Math.floor(aleatorio() * nos.length)];
    const destino = nos[Math.floor(aleatorio() * nos.length)];
    return {
      deX: origem.x, deY: origem.y,
      paraX: destino.x, paraY: destino.y,
      progresso: 0,
      velocidade: 0.012 + aleatorio() * 0.012,
    };
  });
}

export function avancarParticulas(particulas: Particula[]): Particula[] {
  return particulas
    .map((particula) => ({ ...particula, progresso: particula.progresso + particula.velocidade }))
    .filter((particula) => particula.progresso < 1);
}

export function opacidadeDaParticula(progresso: number): number {
  "worklet";
  return Math.sin(progresso * Math.PI);
}

export function nascerNo(nos: NoAmbiente[], { largura, altura, aleatorio }: OpcoesDeCampo): NoAmbiente[] {
  const raio = raioDoCampo(largura, altura);
  const angulo = aleatorio() * Math.PI * 2;

  return [
    ...nos,
    {
      x: largura / 2 + Math.cos(angulo) * raio * 0.3,
      y: altura / 2 + Math.sin(angulo) * raio * 0.3,
      vx: (aleatorio() - 0.5) * 2 * VELOCIDADE_MAXIMA,
      vy: (aleatorio() - 0.5) * 2 * VELOCIDADE_MAXIMA,
      raio: 2,
      tom: "sinal",
      fase: 0,
      escala: ESCALA_INICIAL,
      framesDeVida: 0,
    },
  ];
}

export function deveRotular(peso: number, selecionado: boolean): boolean {
  return selecionado || peso >= 1.2;
}

// As ligações do campo ambiente mudam devagar — os nós andam a menos de
// 0,12 px por quadro. Recalculá-las por quadro custava 1770 pares na
// densidade padrão de 60, e era o caminho quente que travava a 120 Hz.
const INTERVALO_DAS_LIGACOES_MS = 200;

export function deveRecalcularLigacoes(ultimoCalculo: number, agora: number): boolean {
  "worklet";
  // Zero é a sentinela de "nunca calculou". Sem esse caso, um primeiro quadro
  // com timestamp abaixo do intervalo deixaria o campo sem ligação nenhuma
  // até os 200 ms fecharem — um piscar visível na entrada da tela.
  if (ultimoCalculo === 0) return true;
  return agora - ultimoCalculo >= INTERVALO_DAS_LIGACOES_MS;
}

// Versão in-place de `avancarCampo`, para rodar como worklet na UI thread. A
// original devolve um array novo por passo, o que serve ao caminho de React
// mas produz lixo se chamada a cada quadro — mesma decisão já tomada em
// `avancarSimulacao`. As duas coexistem porque `nascerNo` e `criarCampo`
// continuam no lado do React, onde a lista de nós é montada.
export function avancarCampoEmLugar(nos: NoAmbiente[], largura: number, altura: number): void {
  "worklet";
  const raio = raioDoCampo(largura, altura);
  const limite = raio * LIMITE_DE_FUGA;
  const centroX = largura / 2;
  const centroY = altura / 2;

  for (let i = 0; i < nos.length; i += 1) {
    const no = nos[i];

    if (Math.hypot(no.x - centroX, no.y - centroY) > limite) {
      no.vx = -no.vx;
      no.vy = -no.vy;
    }

    no.x += no.vx;
    no.y += no.vy;
    no.fase += PASSO_DA_FASE;

    if (no.framesDeVida !== null) {
      no.framesDeVida += 1;
      no.escala = Math.min(1, ESCALA_INICIAL + (1 - ESCALA_INICIAL) * (no.framesDeVida / FRAMES_ATE_CRESCER));
    }
  }
}

// Idem para as partículas: avança o progresso e devolve quantas continuam
// vivas, compactando as sobreviventes no início do array. Compactar em vez de
// filtrar evita alocar por quadro.
export function avancarParticulasEmLugar(particulas: Particula[], vivas: number): number {
  "worklet";
  let restantes = 0;

  for (let i = 0; i < vivas; i += 1) {
    const particula = particulas[i];
    particula.progresso += particula.velocidade;
    if (particula.progresso >= 1) continue;

    if (restantes !== i) {
      const alvo = particulas[restantes];
      alvo.deX = particula.deX;
      alvo.deY = particula.deY;
      alvo.paraX = particula.paraX;
      alvo.paraY = particula.paraY;
      alvo.progresso = particula.progresso;
      alvo.velocidade = particula.velocidade;
    }
    restantes += 1;
  }

  return restantes;
}
