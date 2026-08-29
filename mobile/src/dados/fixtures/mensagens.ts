import type { Mensagem } from "../tipos";

export const mensagensIniciais: Mensagem[] = [
  {
    id: "m1",
    autor: "usuario",
    texto: "bom dia. o que ficou pendente do fim de semana?",
    horario: "09:40",
  },
  {
    id: "m2",
    autor: "agente",
    texto:
      "Bom dia. Duas notas mudaram desde sexta: 'Reunião sobre o roadmap do Bimo' registrou a decisão de tocar mobile e agente em paralelo, e 'Piloto do agente com function calling' ganhou o limite de cinco chamadas por turno.",
    horario: "09:41",
    cartoes: ["reuniao-sobre-o-roadmap-do-bimo", "piloto-do-agente-com-function-calling"],
  },
  {
    id: "m3",
    autor: "usuario",
    texto: "me lembra o que ficou definido sobre a fricção de captura",
    horario: "09:42",
  },
  {
    id: "m4",
    autor: "agente",
    texto:
      "A decisão foi manter a captura rápida em qualquer formato e reservar um horário fixo à noite para revisar o que virou nota de verdade. Só uma fração pequena do que você captura chega a virar nota atômica, e isso é esperado.",
    horario: "09:43",
    cartoes: ["friccao-de-captura"],
  },
];
