/* eslint-disable react-hooks/set-state-in-effect -- Os dois setState em efeito
   aqui reagem a mudança vinda de fora (dimensões da tela, rajada de partículas)
   e sincronizam a lista que o React desenha com o shared value que o loop de
   quadros avança. Não cascateiam: as dependências são props e valores
   memoizados, nenhuma delas mudada por esses efeitos. */
/* eslint-disable react-hooks/immutability -- O React Compiler modela todo valor
   criado no corpo do hook como imutável, mas o shared value do Reanimated é o
   oposto: uma caixa mutável de identidade estável, e mutá-la é a API da
   biblioteca. A regra aceita mutar num efeito OU num callback, nunca nos dois —
   e este componente precisa dos dois, porque a lista de nós é remontada por
   efeito e as posições avançam no loop de quadros. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useFrameCallback, useSharedValue } from "react-native-reanimated";
// `runOnJS` está preterido no Reanimated 4 em favor de `scheduleOnRN`, que vem
// do react-native-worklets — já dependência direta do projeto.
import { scheduleOnRN } from "react-native-worklets";
import Svg from "react-native-svg";
import { useTema } from "@/compartilhado/tema";
import {
  avancarCampoEmLugar,
  avancarParticulasEmLugar,
  calcularLigacoes,
  criarCampo,
  criarParticulas,
  deveRecalcularLigacoes,
  nascerNo,
  raioDoCampo,
  type NoAmbiente,
  type OpcoesDeCampo,
  type Particula,
} from "../fisica";
import { LigacaoDoCampo, NoDoCampo, ParticulaDoCampo } from "./elementosDoCampo";
import type { PropsDoCampoDeGrafo } from "../contrato";

const PARTICULAS_POR_RAJADA = 8;
// Teto de partículas simultâneas. O pool é alocado uma vez e reaproveitado: o
// que "morre" só sai do pedaço vivo do array, nada é criado por quadro.
const MAXIMO_DE_PARTICULAS = 48;
// O campo é decoração de fundo: 30 passos por segundo bastam para ele parecer
// vivo, e segurar esse ritmo deixa os quadros restantes do aparelho para o que
// o dedo está tocando.
const INTERVALO_DO_CAMPO_MS = 1000 / 30;

function poolDeParticulas(): Particula[] {
  return Array.from({ length: MAXIMO_DE_PARTICULAS }, () => ({
    deX: 0, deY: 0, paraX: 0, paraY: 0, progresso: 1, velocidade: 0,
  }));
}

export function CampoDeGrafoSvg({ densidade, ligado, particulasLigadas, pulso, crescer }: PropsDoCampoDeGrafo) {
  const { cores } = useTema();
  const { width: largura, height: altura } = useWindowDimensions();

  const opcoes: OpcoesDeCampo = useMemo(
    () => ({ largura, altura, quantidade: densidade, aleatorio: Math.random }),
    [largura, altura, densidade],
  );

  // A lista de nós vive no React porque só muda em eventos raros (densidade,
  // rotação, nó que nasce); as posições vivem no shared value e são avançadas
  // pelo loop de quadros, sem passar pelo React.
  const [nos, setNos] = useState<NoAmbiente[]>(() => criarCampo(opcoes));
  const [ligacoes, setLigacoes] = useState<[number, number][]>([]);
  const [particulasVivas, setParticulasVivas] = useState(0);

  const campo = useSharedValue<NoAmbiente[]>(nos);
  const particulas = useSharedValue<Particula[]>(poolDeParticulas());
  const vivas = useSharedValue(0);
  const ultimoPasso = useSharedValue(0);
  const ultimoCalculoDeLigacoes = useSharedValue(0);

  const opcoesRef = useRef(opcoes);
  useEffect(() => {
    opcoesRef.current = opcoes;
  }, [opcoes]);

  // Só o conjunto de ligações volta ao React, e no máximo a cada 200 ms: são
  // O(n²) para calcular (1770 pares na densidade padrão) e mudam devagar.
  const publicarLigacoes = useCallback((posicoes: NoAmbiente[]) => {
    const { largura: l, altura: a } = opcoesRef.current;
    setLigacoes(calcularLigacoes(posicoes, raioDoCampo(l, a)));
  }, []);

  const publicarVivas = useCallback((quantidade: number) => setParticulasVivas(quantidade), []);

  // Declarados antes do loop porque o worklet captura o que usa no momento em
  // que é criado: definidos depois, chegariam como `undefined` na UI.
  const larguraDoCampo = useSharedValue(largura);
  const alturaDoCampo = useSharedValue(altura);

  const quadro = useFrameCallback((info) => {
    "worklet";
    const agora = info.timeSinceFirstFrame;
    if (agora - ultimoPasso.value < INTERVALO_DO_CAMPO_MS) return;
    ultimoPasso.value = agora;

    avancarCampoEmLugar(campo.value, larguraDoCampo.value, alturaDoCampo.value);

    const restantes = avancarParticulasEmLugar(particulas.value, vivas.value);
    if (restantes !== vivas.value) {
      vivas.value = restantes;
      scheduleOnRN(publicarVivas, restantes);
    }

    if (deveRecalcularLigacoes(ultimoCalculoDeLigacoes.value, agora)) {
      ultimoCalculoDeLigacoes.value = agora;
      scheduleOnRN(publicarLigacoes, campo.value.map((no) => ({ ...no })));
    }
  }, false);

  // Os shared values ficam fora das listas de dependências deste arquivo. São
  // estáveis por construção no runtime real, e listá-los faz o efeito
  // re-executar a cada render sob o mock do Jest, onde `useSharedValue`
  // devolve um objeto novo — o que dá "Maximum update depth exceeded".
  useEffect(() => {
    larguraDoCampo.value = largura;
    alturaDoCampo.value = altura;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [largura, altura]);

  useEffect(() => {
    const novo = criarCampo(opcoes);
    setNos(novo);
    campo.value = novo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opcoes]);

  useEffect(() => {
    quadro.setActive(ligado);
  }, [ligado, quadro]);

  useEffect(() => {
    if (pulso === 0 || !particulasLigadas) return;

    const novas = criarParticulas(campo.value, PARTICULAS_POR_RAJADA, Math.random);
    const pool = particulas.value;
    let indice = vivas.value;

    for (const nova of novas) {
      if (indice >= MAXIMO_DE_PARTICULAS) break;
      pool[indice] = nova;
      indice += 1;
    }

    vivas.value = indice;
    setParticulasVivas(indice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulso, particulasLigadas]);

  useEffect(() => {
    if (crescer === 0) return;
    const comMaisUm = nascerNo(campo.value, opcoesRef.current);
    setNos(comMaisUm);
    campo.value = comMaisUm;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crescer]);

  if (!ligado) return null;

  return (
    <View
      testID="campo-de-grafo"
      style={[StyleSheet.absoluteFill, { opacity: 0.8, pointerEvents: "none" }]}
    >
      <Svg width={largura} height={altura}>
        {ligacoes.map(([a, b]) => (
          <LigacaoDoCampo key={`${a}-${b}`} campo={campo} de={a} para={b} cor={cores.grafoLigacao} />
        ))}
        {nos.map((no, indice) => (
          <NoDoCampo key={indice} campo={campo} indice={indice} tom={no.tom} cores={cores} />
        ))}
        {Array.from({ length: Math.min(particulasVivas, MAXIMO_DE_PARTICULAS) }, (_, indice) => (
          <ParticulaDoCampo
            key={`particula-${indice}`}
            particulas={particulas}
            indice={indice}
            vivas={vivas}
            cor={cores.grafoNoSinal}
          />
        ))}
      </Svg>
    </View>
  );
}
