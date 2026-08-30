# Bimo - Sources & Ingestion (Fase 3)

> Documento de trabalho da Fase 3 do roadmap (ver [Bimo - Visão e Direção do Projeto.md](./Bimo%20-%20Vis%C3%A3o%20e%20Dire%C3%A7%C3%A3o%20do%20Projeto.md), seção 22).

---

## Checklist da Fase 3

- [x] Upload de fontes — já resolvido na Fase 2 (`criarFonte`)
- [x] Armazenamento — já resolvido na Fase 2 (Supabase Storage)
- [x] Extração de texto (base do pipeline)
- [x] Processamento de Markdown
- [x] Processamento de PDFs
- [x] Processamento de páginas web
- [ ] Transcrições
- [ ] Relacionamento entre fontes e conhecimento

Ordem combinada: Markdown/texto puro → PDF → páginas web → relacionamento fonte↔conhecimento → transcrições (por último, maior decisão de serviço externo).

---

## Decisão 1 — Extração de texto: interface única, um extrator por tipo

[src/lib/extracao.ts](../src/lib/extracao.ts): `extrairTexto` despacha por tipo MIME (com fallback pela extensão do arquivo quando o tipo não vem preenchido); cada extrator novo (PDF, web, transcrição) entra como mais um caso, sem mudar quem chama. `extrairTextoDaFonte(userId, fonteId)` é o atalho de ponta a ponta: busca a Fonte, baixa do Storage, extrai.

Assinatura `async` desde já, mesmo o caso trivial de Markdown/texto puro sendo síncrono — evita breaking change quando PDF/web (naturalmente assíncronos) chegarem.

Testado com dado real: cria uma Fonte Markdown, extrai o texto, confirma que bate com o original, limpa via cascade + remoção do blob.

Suíte inteira de `src/lib`: **152 testes passando**.

## Decisão 2 — Registro de extratores (plugin), não if/else crescente

Antes do segundo extrator (PDF), reorganizado `src/lib/extracao.ts` → `src/lib/extracao/` (pasta): `tipos.ts` (tipos compartilhados), `registro.ts` (o despachante — mapa tipo MIME → extrator), `texto-puro.ts` e `pdf.ts` (cada um se registra sozinho ao ser importado), `index.ts` (fachada pública: importa os extratores pelo efeito colateral de registro, reexporta `extrairTexto`/`extrairTextoDaFonte`).

Motivo: o usuário pediu explicitamente pra pensar num jeito de ler "qualquer tipo de fonte" (PDF, Word, Slides, docs em geral) — um `if/else` crescente dentro de uma função só não escala bem pra isso. Com o registro, cada formato futuro (`docx.ts` via `mammoth`, `pptx.ts`/`xlsx.ts` via `officeparser` ou similar, `pagina-web.ts`) é um arquivo novo que se registra e é importado em `index.ts` — nunca precisa tocar em `registro.ts` nem em quem consome `extrairTexto`.

## Decisão 3 — Processamento de PDF via unpdf

[src/lib/extracao/pdf.ts](../src/lib/extracao/pdf.ts): `getDocumentProxy` + `extractText(doc, { mergePages: true })`. Limitação conhecida e documentada no código: PDF escaneado (imagem, sem camada de texto) devolve string vazia — OCR de verdade é um problema à parte, fora de escopo por enquanto.

Testado com dado real: um PDF mínimo escrito à mão, enviado como Fonte de verdade, extraído via `unpdf` de verdade (não mock) contra o Supabase real — texto batendo exatamente.

Suíte inteira de `src/lib`: **153 testes passando**.

## Decisão 4 — Processamento de páginas web (busca + extração + SSRF)

Diferente de PDF/Markdown, a fonte não é enviada — é buscada de uma URL. Isso trouxe uma superfície de risco real (SSRF, "External API calls" — trigger de revisão de segurança das regras globais), tratada explicitamente:

- [src/lib/busca-web.ts](../src/lib/busca-web.ts) — cliente de rede fino. Bloqueia esquemas que não sejam http/https, localhost, faixas de IP privadas/link-local e o endereço de metadata de nuvem (169.254.169.254). Segue redirecionamentos manualmente, **revalidando cada salto** (fecha o gap clássico de "SSRF via redirect" — uma URL legítima que redireciona pra um endereço interno). Limite de tamanho (10 MB) e timeout (15s). Documentado como checagem por *nome do host*, não por IP resolvido — não cobre DNS rebinding, suficiente pro cenário de uso pessoal atual.
- `criarFonteDeUrl` (em [fontes.ts](../src/lib/fontes.ts)) — busca a página, grava o **HTML bruto** como Fonte imutável (Decisão 1). Novo campo `urlOrigem` em `fontes` (migration `0003_fantastic_puck.sql`) pra rastrear de qual URL uma Fonte veio, em vez de forçar isso em `nomeArquivoOriginal`.
- [src/lib/extracao/pagina-web.ts](../src/lib/extracao/pagina-web.ts) — extrai o conteúdo legível do HTML via `@mozilla/readability` + `jsdom` (o mesmo algoritmo do "modo leitura" do Firefox), isolando o artigo do menu/rodapé/ruído.

Testado com dado real: fetch de verdade em `https://example.com` (domínio reservado da IANA, estável), Fonte criada, texto extraído e conferido — mais os 9 casos de SSRF/redirecionamento/limite de tamanho com mock de `fetch`.

Suíte inteira de `src/lib`: **165 testes passando**.

## Próximo ponto do checklist

**Relacionamento entre fontes e conhecimento** — o pipeline que liga texto extraído → Entidade/Nota criada → `proveniencia` gravada. Provavelmente onde entra a primeira chamada ao Gemini no contexto de ingestão.
