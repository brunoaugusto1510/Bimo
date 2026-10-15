"use client";

import { useState } from "react";
import MarcaBimo from "@/components/MarcaBimo";

/**
 * Tela de senha. Mobile-first: o cartão ocupa a largura toda no celular e
 * ganha largura máxima a partir de `sm`.
 *
 * Depois de entrar usamos `window.location.replace` em vez do router do Next
 * porque a home é server component: ela precisa ser renderizada de novo *no
 * servidor*, já com o cookie na requisição. Uma navegação client-side
 * reaproveitaria a árvore atual e a home voltaria vazia.
 */
export default function PaginaDeLogin() {
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;

    setEnviando(true);
    setErro(null);

    try {
      const resposta = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });

      if (resposta.ok) {
        window.location.replace("/");
        return;
      }

      const dados: unknown = await resposta.json().catch(() => null);
      const mensagem =
        typeof dados === "object" && dados !== null && "erro" in dados
          ? String((dados as { erro: unknown }).erro)
          : "Não consegui entrar. Tente de novo.";

      setErro(mensagem);
      setSenha("");
    } catch {
      setErro("Falha de rede. Verifique sua conexão e tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="w-full rounded-painel border border-borda bg-painel p-6 sm:max-w-sm">
        <div className="flex justify-center">
          <MarcaBimo tamanho={56} />
        </div>
        <h1 className="mt-3 text-center text-lg font-semibold tracking-tight">Bimo</h1>
        <p className="mt-1 text-center text-sm text-suave">
          Seu cérebro pessoal. Entre para continuar.
        </p>

        <form onSubmit={entrar} className="mt-6 flex flex-col gap-3">
          <label htmlFor="senha" className="text-sm font-medium">
            Senha
          </label>

          <input
            id="senha"
            name="senha"
            type="password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            autoComplete="current-password"
            autoFocus
            required
            aria-invalid={erro !== null}
            aria-describedby={erro ? "erro-de-login" : undefined}
            className="rounded-bloco border border-borda bg-fundo px-3 py-2.5 text-base outline-none focus:border-destaque"
          />

          {erro && (
            <p
              id="erro-de-login"
              role="alert"
              className="rounded-lg bg-erro-suave px-3 py-2 text-sm text-erro"
            >
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando || senha === ""}
            // Botão "bloco" do design system: largura total, cantos de 10px.
            className="mt-1 rounded-bloco bg-destaque px-5 py-3 text-sm font-semibold text-sobre-destaque transition-colors hover:bg-destaque-hover disabled:cursor-not-allowed disabled:bg-desabilitado disabled:text-desabilitado-texto"
          >
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
