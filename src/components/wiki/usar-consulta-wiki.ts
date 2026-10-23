"use client";
import { useEffect, useState } from "react";

export function useConsultaWiki<T>(url: string | null, revisao = 0) {
  const [resposta, definir] = useState<{ url: string; dados?: T; erro?: string; status?: number } | null>(null);
  useEffect(() => {
    if (!url) return;
    const controle = new AbortController();
    const carregar = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await fetch(url, { cache: "no-store", signal: controle.signal });
        if (!r.ok) throw Object.assign(new Error(r.status === 503 ? "O cérebro ainda não está habilitado neste ambiente." : r.status === 401 ? "Sua sessão expirou. Entre novamente." : "Não consegui carregar estes dados. Tente novamente."), { status: r.status });
        const dados = await r.json() as T;
        if (!controle.signal.aborted) definir({ url, dados });
      } catch (erro) {
        if (!controle.signal.aborted) definir({ url, erro: erro instanceof Error ? erro.message : "Não consegui carregar estes dados.", status: (erro as { status?: number }).status });
      }
    };
    void carregar();
    const intervalo = setInterval(() => void carregar(), 30_000);
    document.addEventListener("visibilitychange", carregar);
    return () => { controle.abort(); clearInterval(intervalo); document.removeEventListener("visibilitychange", carregar); };
  }, [url, revisao]);
  return resposta?.url === url ? resposta : null;
}
