import type { EstadoDoNeuronio } from "@/lib/wiki/observabilidade-tipos";

/**
 * O neurônio em tamanho de ícone, com a mesma forma por estado que o grafo
 * desenha (prancheta "Estados de um neurônio"): o estado muda o traço e o
 * miolo, nunca só a cor. `halo` acrescenta o fundo azul-suave dos cartões em
 * que o neurônio é o assunto (nascimento no diário, legenda do cérebro).
 */
export default function GlifoDoNeuronio({ estado = "vivo", tamanho = 18, halo = false }: { estado?: EstadoDoNeuronio; tamanho?: number; halo?: boolean }) {
  const seu = estado === "seu";
  const semRaizes = estado === "sem_raizes";
  const tracejado = estado === "reconsolidando" || semRaizes ? "3 2.5" : undefined;
  const anel = seu ? "stroke-texto" : semRaizes ? "stroke-suave" : "stroke-destaque";
  const miolo = seu ? "fill-texto" : semRaizes ? "fill-suave" : "fill-destaque";
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      {halo && !seu && !semRaizes && <circle cx="12" cy="12" r="11.5" className="fill-destaque-suave" />}
      <circle cx="12" cy="12" r="6.5" strokeWidth="2.4" strokeDasharray={tracejado} className={`fill-painel ${anel} ${estado === "em_pausa" ? "opacity-50" : ""}`} />
      {estado === "em_tensao" && <path d="M12 6.5 A5.5 5.5 0 0 1 12 17.5 Z" className="fill-grafo-cor-2" />}
      {estado === "em_pausa" ? (
        <>
          <rect x="9.5" y="9" width="1.8" height="6" rx="0.9" className="fill-destaque" />
          <rect x="12.7" y="9" width="1.8" height="6" rx="0.9" className="fill-destaque" />
        </>
      ) : (
        <circle cx="12" cy="12" r="2.6" className={miolo} />
      )}
      {seu && <circle cx="18.5" cy="5.5" r="3" className="fill-destaque" />}
    </svg>
  );
}
