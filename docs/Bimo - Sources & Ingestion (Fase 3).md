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
- [x] Relacionamento entre fontes e conhecimento
- [ ] Transcrições

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

## Decisão 5 — Relacionamento entre fontes e conhecimento: camada de dados primeiro

Este item do checklist tem duas partes de natureza bem diferente:

1. **A camada de dados** — gravar/consultar o vínculo Fonte↔Entidade/Nota. Mecânica, sem decisão de design em aberto (a tabela `proveniencia` já existe desde a Fase 2).
2. **O pipeline de ingestão de verdade** — texto extraído → Gemini decide quais Entidades/Notas criar ou atualizar → cada uma grava sua proveniência. Essa parte tem decisões reais em aberto (quando disparar, que autonomia o agente tem) e ainda não foi implementada — ver "Próximo ponto do checklist" abaixo.

[src/lib/proveniencia.ts](../src/lib/proveniencia.ts) resolve a parte 1, espelhando a forma de `relacoes.ts`: `vincularFonte` (confirma que a Fonte e o nó — Entidade ou Nota, via `nos` — pertencem ao mesmo usuário antes de gravar), `listarProvenienciaDaFonte` (o que uma Fonte originou) e `listarFontesDoNo` (o que embasou uma Entidade/Nota). Sem "remover": apagar proveniência apagaria de onde o conhecimento veio (Princípio 2 do doc de visão), então o vínculo é só criado, nunca desfeito.

Suíte inteira de `src/lib`: **171 testes passando**. `tsc`/lint limpos (os erros que aparecem em `mobile/` são de um gap de config pré-existente, alheio a esta mudança).

Decisão sobre a parte 2 (pipeline de ingestão), com o usuário: **disparo explícito** (não roda sozinho ao criar a Fonte — mais previsível, mais fácil de depurar/testar isoladamente, e não gasta uma chamada ao Gemini toda vez que alguém sobe um arquivo) e **toda Entidade criada por ingestão nasce `status: "rascunho"`**, nunca `aprovada` (Princípio 4 do doc de visão — o agente não aprova sozinho o que ele mesmo extraiu; fica pendente de revisão humana).

[src/lib/ingestao.ts](../src/lib/ingestao.ts): `processarFonte(userId, fonteId)` — extrai o texto da Fonte (reusa `extrairTextoDaFonte`), pede ao Gemini uma sugestão de Entidades/Notas via **saída estruturada** (`responseSchema`, não o laço de function calling de `agente.ts` — aqui é uma extração em lote de uma vez só, sem conversa de ida e volta), cria cada uma (`criadoPor: "agente"`, `criadoPorFerramenta: "processar_fonte"`, Entidade sempre `rascunho`) e grava a proveniência de cada uma de volta pra Fonte via `vincularFonte`. Devolve cedo (`{ entidadesCriadas: 0, notasCriadas: 0 }`, sem chamar o Gemini) quando o texto extraído vem vazio.

Nota não tem campo de status/workflow (só Entidade tem — ver `entidades.ts`), então pra Nota a autoria (`criadoPor: "agente"`) já é o sinal equivalente de "veio da ingestão, ainda não revisado por ninguém".

Testado com mocks (Gemini, extração, criação de Entidade/Nota, proveniência) cobrindo: erro sem `GEMINI_API_KEY`, texto vazio não chama o Gemini, Entidade/Nota sugeridas são criadas e vinculadas corretamente, resposta do Gemini com listas ausentes vira lista vazia (não quebra), erro quando o Gemini não devolve texto. **Não foi possível rodar um E2E contra a API real do Gemini** — `GEMINI_API_KEY` não está configurada no `.env` deste ambiente (gap de documentação pré-existente, também presente em `agente.ts`/chat; adicionei `GEMINI_API_KEY`/`GEMINI_MODEL` ao `.env.example`, que faltavam). Fica como verificação pendente assim que houver uma chave disponível.

Suíte inteira de `src/lib`: **177 testes passando**. `tsc`/lint limpos.

## Próximo ponto do checklist

**Transcrições** — áudio/vídeo, precisa de decisão de serviço externo (ex.: Whisper API) — maior decisão de custo/dependência da Fase 3, por isso deixada por último.
