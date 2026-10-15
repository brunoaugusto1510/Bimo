# Bimo - Visão e Direção do Projeto

> **Bimo** é um "Personal Brain": um sistema de conhecimento pessoal no qual o usuário pode armazenar, organizar, consultar e evoluir seu conhecimento com auxílio de Inteligência Artificial.

Este documento define a visão atual do projeto, seu estado presente, sua direção futura e os princípios que devem orientar as decisões de arquitetura e desenvolvimento.

---

# 1. Visão

O objetivo do Bimo é evoluir de uma interface para consulta de um vault do Obsidian para uma **plataforma de conhecimento pessoal com memória persistente e um agente de IA capaz de compreender, relacionar e evoluir esse conhecimento**.

A ideia central não é simplesmente criar um chatbot que responde perguntas sobre documentos.

O objetivo é construir uma camada de conhecimento na qual:

```text
Fontes
   ↓
Conhecimento
   ↓
Relações
   ↓
Memória
   ↓
Agente
   ↓
Novos conhecimentos e conexões
```

O sistema deve permitir que o conhecimento do usuário cresça continuamente, mantendo sua origem, contexto, relações e histórico.

---

# 2. Estado atual

O Bimo atualmente é uma aplicação web construída com:

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Vitest
- Gemini API
- GitHub API
- Obsidian

A aplicação utiliza um repositório GitHub contendo um vault do Obsidian como fonte de dados.

A arquitetura atual é essencialmente:

```text
Obsidian Vault
      ↓
GitHub Repository
      ↓
Bimo / Next.js
      ↓
Gemini
      ↓
Function Calling
```

O Bimo já possui uma base funcional de agente.

---

# 3. Funcionalidades atuais

## 3.1 Integração com Obsidian

O Bimo consegue ler um vault real do Obsidian armazenado em um repositório GitHub.

As notas são arquivos Markdown.

A aplicação:

- obtém a árvore de arquivos do repositório;
- identifica pastas e notas;
- ignora arquivos internos do Obsidian;
- carrega o conteúdo das notas sob demanda;
- interpreta links `[[wikilink]]`;
- constrói um grafo das relações existentes entre notas.

Atualmente, o GitHub é a fonte primária dos dados.

---

## 3.2 Interface

A interface atual possui:

- árvore de pastas e notas;
- leitor de notas;
- chat com o agente;
- grafo visual;
- navegação entre notas;
- interface responsiva;
- suporte a tema claro/escuro.

A aplicação utiliza uma separação entre Server Components e Client Components.

---

# 4. Agente atual

O Bimo já possui um agente baseado em function calling.

O fluxo atual é:

```text
Usuário
   ↓
Chat
   ↓
Gemini
   ↓
Function Calling
   ↓
Ferramenta
   ↓
Resultado
   ↓
Gemini
   ↓
Resposta
```

O agente possui atualmente ferramentas para:

### Leitura

```text
buscar_notas
listar_notas
ler_nota
```

### Escrita

```text
criar_nota
editar_nota
```

As operações de escrita são realizadas diretamente no repositório GitHub e geram commits.

Portanto, o Bimo já possui o primeiro estágio de um sistema agentic.

---

# 5. Autenticação e segurança atual

O projeto possui autenticação baseada em senha e sessão assinada.

A aplicação utiliza:

- senha protegida com scrypt;
- cookie de sessão assinado;
- proteção das rotas;
- limite de tentativas de login;
- separação entre configuração pública e credenciais;
- token do GitHub mantido exclusivamente no servidor.

A autenticação atual foi projetada para o cenário de uso pessoal do projeto.

Ela não representa ainda a arquitetura definitiva de autenticação para um SaaS multiusuário.

---

# 6. O que o Bimo ainda é

Atualmente, o Bimo deve ser entendido como:

> **Uma interface web para um vault pessoal do Obsidian, com um agente de IA capaz de ler e modificar esse vault.**

Essa definição é importante porque evita antecipar funcionalidades que ainda não existem.

---

# 7. Direção futura

O objetivo é transformar o Bimo em uma **plataforma de conhecimento pessoal com memória persistente e agente de IA**.

A arquitetura futura deverá deixar de depender do GitHub como armazenamento principal.

O modelo desejado será:

```text
                    BIMO
                     │
          ┌──────────┴──────────┐
          │                     │
       Usuário                Agente
          │                     │
          └──────────┬──────────┘
                     │
              Knowledge Core
                     │
       ┌─────────────┼─────────────┐
       │             │             │
     Notes         Sources       Knowledge
       │             │             │
       └─────────────┼─────────────┘
                     │
                 Relations
                     │
                  Search
                     │
                  Memory
```

---

# 8. Knowledge Core

O futuro núcleo do Bimo será o **Knowledge Core**.

Ele deverá armazenar e relacionar diferentes tipos de informação.

Entre eles:

- notas;
- fontes;
- conceitos;
- entidades;
- relações;
- chunks;
- embeddings;
- histórico;
- conversas;
- alterações realizadas pela IA.

A ideia é que uma nota não seja apenas um arquivo Markdown.

Ela deverá ser uma entidade persistente dentro do sistema.

---

# 9. Raw Layer

O Bimo deverá preservar as fontes originais.

Exemplos:

- PDFs;
- páginas web;
- vídeos;
- transcrições;
- artigos;
- documentos;
- textos;
- notas importadas;
- informações adicionadas pelo usuário.

A fonte original deve permanecer preservada.

O conhecimento derivado pela IA não deve substituir a fonte.

A relação deverá ser:

```text
Fonte original
      ↓
Extração
      ↓
Conhecimento
      ↓
Nota / Conceito
```

Isso permite rastreabilidade e reduz o risco de perder o contexto original.

---

# 10. Wiki / Knowledge Layer

A partir das fontes, o Bimo poderá criar ou atualizar conhecimento estruturado.

Exemplo:

```text
RAG
│
├── Embeddings
├── Retrieval
├── Vector Database
├── Chunking
└── Reranking
```

Cada conceito poderá possuir relações com outros conceitos e referências para suas fontes.

A Wiki não deverá ser apenas uma coleção de páginas.

Ela deverá representar a estrutura do conhecimento do usuário.

---

# 11. Knowledge Graph

O Bimo deverá possuir uma camada de relações entre entidades.

Exemplo:

```text
RAG
 │
 ├── uses → Embeddings
 │
 ├── uses → Vector Database
 │
 ├── contains → Retrieval
 │
 └── improved_by → Reranking
```

Inicialmente, essas relações poderão ser armazenadas em um banco relacional.

Não existe necessidade de utilizar um banco de grafos especializado no início do projeto.

O grafo visual será uma representação dessas relações, não necessariamente o armazenamento primário.

---

# 12. Retrieval

O Bimo deverá evoluir do sistema atual de busca para um sistema de recuperação de conhecimento mais completo.

A arquitetura desejada é:

```text
Query
  │
  ├── Busca textual
  │
  ├── Busca semântica
  │
  └── Busca por relações
          │
          ▼
       Reranking
          │
          ▼
     Contexto relevante
          │
          ▼
           LLM
```

O objetivo é combinar diferentes formas de recuperação.

A busca vetorial não deverá ser considerada suficiente por si só.

---

# 13. Banco de dados futuro

Quando o Bimo deixar de ser exclusivamente baseado em Obsidian/GitHub, o banco principal deverá ser avaliado para armazenar:

- usuários;
- notas;
- fontes;
- entidades;
- relações;
- revisões;
- conversas;
- embeddings;
- metadados.

A direção inicial recomendada é:

> **PostgreSQL + pgvector**

Isso permite manter os dados relacionais e os embeddings dentro da mesma infraestrutura.

A adoção definitiva deverá ocorrer após a definição do modelo de dados do Knowledge Core.

---

# 14. Agente futuro

O agente atual deverá evoluir de um agente que manipula arquivos para um agente que manipula conhecimento.

As ferramentas futuras poderão incluir:

```text
search_knowledge
search_sources

get_note
create_note
update_note

create_entity
update_entity

create_relationship
remove_relationship

find_related
find_duplicates
find_conflicts

suggest_update
```

O agente deverá conseguir:

1. pesquisar conhecimento;
2. consultar fontes;
3. compreender relações;
4. criar conhecimento;
5. atualizar conhecimento;
6. estabelecer relações;
7. identificar possíveis conflitos;
8. sugerir melhorias;
9. manter a base organizada.

---

# 15. Memória e evolução do conhecimento

Um dos principais objetivos do Bimo é permitir que a base evolua ao longo do tempo.

Exemplo:

```text
Usuário aprende algo novo
        ↓
Agente identifica conceitos
        ↓
Verifica conhecimento existente
        ↓
Encontra conceitos relacionados
        ↓
Cria ou atualiza relações
        ↓
Registra a fonte
        ↓
Atualiza o conhecimento
```

Assim, o sistema não apenas recupera conhecimento existente.

Ele também pode **consolidar novos conhecimentos na memória do usuário**.

---

# 16. Controle das alterações da IA

A IA não deverá possuir liberdade irrestrita sobre todo o conhecimento.

As alterações deverão possuir diferentes níveis de risco.

Exemplo:

### Baixo risco

Criar uma relação simples.

```text
RAG → uses → Embeddings
```

Pode ser executado automaticamente.

### Médio risco

Alterar uma nota existente.

A alteração deverá possuir histórico e possibilidade de reversão.

### Alto risco

- excluir conhecimento;
- mesclar conceitos;
- substituir informações;
- modificar conhecimento consolidado.

Essas operações poderão exigir aprovação do usuário.

---

# 17. Versionamento

O sistema deverá manter histórico das alterações.

O objetivo é permitir:

```text
Nota v1
   ↓
Nota v2
   ↓
Nota v3
   ↓
Nota v4
```

O usuário deverá poder identificar:

- o que mudou;
- quando mudou;
- quem realizou a mudança;
- se foi uma alteração manual ou da IA;
- restaurar versões anteriores.

Git é excelente para o estágio atual baseado em Markdown.

No futuro SaaS, o versionamento deverá ser tratado pelo próprio sistema.

---

# 18. Obsidian no futuro

Obsidian não deverá necessariamente desaparecer.

A função dele deverá mudar.

No estágio atual:

```text
Obsidian
   ↓
GitHub
   ↓
Bimo
```

No futuro:

```text
                 Bimo
                  │
        ┌─────────┴─────────┐
        │                   │
     Cloud               Export
        │                   │
 PostgreSQL             Markdown
        │                   │
        └─────────┬─────────┘
                  ↓
               Obsidian
```

O armazenamento principal será o Bimo.

O Obsidian poderá ser uma integração e um formato de exportação.

---

# 19. Exportação

O usuário deverá poder exportar seu conhecimento de maneira estruturada.

Um possível formato:

```text
bimo-export/
│
├── notes/
├── sources/
├── attachments/
├── relationships/
└── manifest.json
```

A exportação é importante para:

- portabilidade;
- backup;
- independência da plataforma;
- transparência;
- requisitos de privacidade;
- possibilidade de continuar utilizando o conhecimento fora do Bimo.

---

# 20. SaaS

O objetivo de longo prazo é permitir que o Bimo seja utilizado por múltiplos usuários.

A arquitetura deverá ser preparada para isolamento entre usuários.

Exemplo:

```text
Usuário A
├── Notes
├── Sources
└── Knowledge

Usuário B
├── Notes
├── Sources
└── Knowledge
```

Um usuário jamais deverá conseguir recuperar ou modificar conhecimento pertencente a outro.

A arquitetura multiusuário deverá ser considerada antes da implementação definitiva do banco e do Knowledge Core.

---

# 21. Stack prevista

A stack atual e a direção planejada são:

| Componente | Direção |
|---|---|
| Frontend | Next.js |
| Backend | Node.js / Next.js conforme responsabilidade |
| Linguagem | TypeScript |
| Banco | PostgreSQL |
| Vetores | pgvector |
| IA | Gemini inicialmente |
| Storage | Object Storage compatível com S3 |
| Jobs | Redis / sistema de filas quando necessário |
| Knowledge format | Markdown + modelo estruturado |
| Exportação | Markdown + metadata |
| Deploy | Cloud / PaaS inicialmente |

A introdução de cada tecnologia deverá ocorrer somente quando houver necessidade real.

---

# 22. Roadmap

## Fase 0 - Protótipo atual

**Status: em grande parte concluído**

- [x] Next.js
- [x] Interface
- [x] Obsidian
- [x] GitHub
- [x] Leitura de notas
- [x] Grafo de wikilinks
- [x] Autenticação
- [x] Function calling
- [x] Criação de notas
- [x] Edição de notas
- [x] Testes

---

## Fase 1 - Architecture Audit

**Status: concluída** — decisões registradas em [Bimo - Architecture Audit.md](./Bimo%20-%20Architecture%20Audit.md)

- [x] Definir modelo conceitual do conhecimento
- [x] Definir o que é uma nota
- [x] Definir o que é uma fonte
- [x] Definir entidades
- [x] Definir relações
- [x] Definir proveniência
- [x] Definir versionamento
- [x] Definir responsabilidades do agente
- [x] Definir papel futuro do Obsidian
- [x] Definir arquitetura multiusuário

Nenhuma migração estrutural foi realizada nesta etapa — apenas o desenho conceitual que orienta a Fase 2.

---

## Fase 2 - Knowledge Core

**Status: concluída** — decisões registradas em [Bimo - Knowledge Core (Fase 2).md](./Bimo%20-%20Knowledge%20Core%20%28Fase%202%29.md)

- [x] Definir banco
- [x] Configurar PostgreSQL
- [x] Criar modelo de dados
- [x] Implementar notas
- [x] Implementar fontes
- [x] Implementar entidades
- [x] Implementar relações
- [x] Implementar revisões
- [x] Implementar metadata

---

## Fase 3 - Sources & Ingestion

**Status: concluída** (Transcrições adiada) — decisões registradas em [Bimo - Sources & Ingestion (Fase 3).md](./Bimo%20-%20Sources%20%26%20Ingestion%20%28Fase%203%29.md)

- [x] Upload de fontes
- [x] Armazenamento
- [x] Extração de texto
- [x] Processamento de PDFs
- [x] Processamento de Markdown
- [x] Processamento de páginas web
- [ ] Transcrições — adiada por enquanto (custo e dependência de serviço externo)
- [x] Relacionamento entre fontes e conhecimento

---

## Fase 4 - Retrieval

**Status: em andamento** — decisões registradas em [Bimo - Retrieval (Fase 4).md](./Bimo%20-%20Retrieval%20%28Fase%204%29.md)

- [x] Busca textual
- [ ] Embeddings
- [ ] pgvector
- [ ] Busca semântica
- [ ] Busca por relações
- [ ] Reranking
- [ ] Context assembly
- [ ] Citações

---

## Fase 5 - Agent 2.0

- [ ] Adaptar agente ao Knowledge Core
- [ ] Novas ferramentas
- [ ] Pesquisa de conhecimento
- [ ] Criação de conhecimento
- [ ] Atualização
- [ ] Relações
- [ ] Detecção de duplicatas
- [ ] Detecção de conflitos

---

## Fase 6 - Knowledge Intelligence

- [ ] Extração automática de conceitos
- [ ] Extração de entidades
- [ ] Sugestão de relações
- [ ] Consolidação de conhecimento
- [ ] Detecção de duplicatas
- [ ] Detecção de conflitos
- [ ] Sistema de confiança
- [ ] Sistema de aprovação

---

## Fase 7 - Maintenance Agent

- [ ] Verificação da base
- [ ] Notas órfãs
- [ ] Relações quebradas
- [ ] Notas duplicadas
- [ ] Conhecimento sem fonte
- [ ] Informações conflitantes
- [ ] Sugestões de manutenção
- [ ] Rotinas automáticas

---

## Fase 8 - SaaS

- [ ] Multiusuário
- [ ] Autenticação definitiva
- [ ] Isolamento de dados
- [ ] Storage
- [ ] Limites de utilização
- [ ] Planos
- [ ] Billing
- [ ] Dashboard
- [ ] Exportação
- [ ] Exclusão de conta
- [ ] Recursos de privacidade

---

# 23. Princípios do projeto

As seguintes regras devem orientar decisões futuras.

### 1. Não substituir a fonte original

Conhecimento derivado não deve destruir a informação original.

### 2. Toda informação importante deve possuir proveniência

Sempre que possível, o sistema deve saber de onde uma informação veio.

### 3. O agente deve utilizar ferramentas

O agente não deve depender exclusivamente de contexto enviado no prompt.

### 4. O agente não deve possuir liberdade ilimitada

Operações de maior impacto devem possuir controle e histórico.

### 5. O conhecimento deve ser relacionado

Notas isoladas são úteis, mas relações entre conceitos são parte fundamental do Bimo.

### 6. Busca vetorial não é memória

Embeddings são uma ferramenta de recuperação, não a representação completa do conhecimento.

### 7. O banco é o futuro núcleo do SaaS

GitHub/Obsidian são excelentes para o estágio atual, mas não devem limitar a arquitetura definitiva.

### 8. Portabilidade é importante

O usuário deve conseguir retirar seus dados do sistema de maneira estruturada.

### 9. Não adicionar complexidade sem necessidade

Novas tecnologias, bancos ou serviços devem ser introduzidos quando resolverem um problema real.

### 10. Preservar o que já funciona

A evolução do Bimo deve aproveitar o agente, interface e integração atuais sempre que possível.

---

# 24. Definição de sucesso

O Bimo estará cumprindo sua visão quando o usuário puder:

```text
Adicionar uma fonte
       ↓
Bimo entende seu conteúdo
       ↓
Identifica conceitos
       ↓
Relaciona com conhecimento existente
       ↓
Atualiza sua base
       ↓
Preserva a fonte original
       ↓
Mantém histórico
       ↓
Permite ao usuário consultar tudo
       ↓
Agente utiliza esse conhecimento
       ↓
Novos conhecimentos continuam alimentando o sistema
```

Nesse estágio, o Bimo deixa de ser apenas:

> "um chatbot para meu Obsidian"

e passa a ser:

> **uma memória pessoal estruturada, persistente e evolutiva, assistida por IA.**

---

# 25. Estado de decisão

As decisões abaixo são consideradas direcionamento do projeto, mas podem ser revistas durante a Architecture Audit caso o código atual ou testes demonstrem uma alternativa melhor.

### Confirmado

- Next.js
- TypeScript
- Node.js
- Gemini como modelo inicial
- Obsidian como integração no estágio atual
- GitHub como armazenamento no estágio atual
- Agente baseado em ferramentas/function calling
- Evolução para Knowledge Core
- Arquitetura baseada em fontes, conhecimento e relações

### Direção recomendada

- PostgreSQL
- pgvector
- armazenamento de objetos
- versionamento interno
- exportação estruturada
- arquitetura multiusuário
- retrieval híbrido entre texto, semântica e relações

### Ainda não decidido

- ORM
- provedor definitivo de PostgreSQL
- provedor de storage
- estratégia definitiva de autenticação SaaS
- modelo de billing
- arquitetura definitiva de deploy
- necessidade de Redis
- modelo final de entidades e relações
- grau de autonomia do agente

Essas decisões devem ser tomadas conforme as respectivas fases forem iniciadas.
