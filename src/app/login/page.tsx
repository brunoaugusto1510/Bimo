"use client";

import { useState } from "react";

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
      <div className="w-full rounded-xl border border-borda bg-painel p-6 sm:max-w-sm">
        <h1 className="text-center text-lg font-semibold tracking-tight">Bimo</h1>
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
            className="rounded-lg border border-borda bg-fundo px-3 py-2 text-base outline-none focus:border-destaque"
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
            className="mt-1 rounded-lg bg-destaque px-3 py-2 text-sm font-medium text-painel disabled:opacity-50"
          >
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
