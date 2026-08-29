import type { Nota } from "../tipos";

export const notas: Nota[] = [
  {
    id: "notas-atomicas",
    titulo: "Notas atômicas",
    pasta: "Zettelkasten",
    tags: ["#método", "#escrita"],
    corpo:
      "Uma nota atômica carrega uma ideia só. O teste é conseguir dar a ela um título que seja uma afirmação completa.\n\nQuando o título precisa de um 'e' para caber, são duas notas.\n\nA vantagem não é a organização: é que uma ideia isolada pode ser ligada a qualquer outra sem arrastar contexto junto.",
    resumo: "Uma nota carrega uma ideia só; o título tem que funcionar como afirmação completa.",
    editadaEm: "2026-01-14",
    conexoes: 7,
  },
  {
    id: "ligacao-forte-versus-ligacao-fraca",
    titulo: "Ligação forte versus ligação fraca",
    pasta: "Zettelkasten",
    tags: ["#método", "#vault"],
    corpo:
      "Toda vez que ligo duas notas eu me pergunto se a ligação sustenta um porquê ou só um sobre-o-quê. Ligação forte é aquela em que consigo escrever, na própria linha do link, a razão da conexão — esta nota discorda daquela, esta continua aquela, esta é o caso concreto daquela regra.\n\nLigação fraca é o link por assunto: as duas notas falam de vault, então ligo. Isso não é errado, mas se o grafo só tiver ligações fracas ele vira um dicionário de sinônimos, não um raciocínio.\n\nO risco prático é que ligação fraca é barata de fazer e ligação forte exige parar e escrever a razão. Sob pressão de tempo eu sempre escolho a barata, e o grafo acumula ligações que não dizem nada quando releio um ano depois.\n\nA regra que adotei: toda ligação leva uma frase de justificativa entre parênteses. Se não consigo escrever a frase, a ligação é fraca e eu marco como tal em vez de fingir que é argumento.",
    resumo:
      "Ligação forte carrega o porquê da conexão escrito por extenso; ligação fraca é só assunto compartilhado, e o grafo não distingue as duas sem esforço deliberado.",
    editadaEm: "2026-01-18",
    conexoes: 4,
  },
  {
    id: "hub-nao-e-indice",
    titulo: "Hub não é índice",
    pasta: "Zettelkasten",
    tags: ["#método", "#estrutura"],
    corpo:
      "Um índice lista. Um hub argumenta. A diferença fica óbvia quando tento escrever a nota 'Zettelkasten' pela segunda vez: da primeira vez ela virou uma lista de dezoito links sem ordem, e eu não conseguia dizer o que aquela nota defendia.\n\nUm hub de verdade tem uma tese — mesmo que pequena — e os links aparecem no corpo do texto, na frase que os justifica, não numa lista solta no fim. 'Notas atômicas' funciona como hub informal do meu método justamente porque cada link sai de uma frase que explica a relação.\n\nO índice tem seu lugar: uma pasta com quarenta notas de projeto se beneficia de uma lista cronológica simples, sem pretensão de argumento. O erro é usar a forma de índice quando a intenção era argumentar, ou forçar argumento onde só cabia listar.\n\nNa prática, se estou reescrevendo uma nota-hub pela terceira vez e ela continua sem tese, o problema não é a escrita — é que ainda não sei o que penso sobre o tema, e a nota está fazendo esse trabalho por mim, mal.",
    resumo:
      "Um hub defende uma tese e os links saem de frases que a sustentam; um índice apenas lista, e confundir as duas formas produz notas sem argumento.",
    editadaEm: "2026-01-22",
    conexoes: 4,
  },
  {
    id: "friccao-de-captura",
    titulo: "Fricção de captura",
    pasta: "Zettelkasten",
    tags: ["#método", "#hábito"],
    corpo:
      "Passei uma semana testando captura direto no Bimo pelo celular contra o hábito antigo de anotar num caderno e passar a limpo à noite. A fricção zero da captura direta não compensou: sem o intervalo entre anotar e formalizar, quase nada virava nota atômica — virava trecho colado, sem título, sem ligação.\n\nA fricção não é só ruim. O passo de reler o rabisco horas depois e perguntar 'isso ainda faz sentido' é o que separa ideia de ruído. Cortar esse passo corta também o filtro.\n\nO que funcionou foi um meio-termo: captura rápida em qualquer formato, mas um horário fixo à noite para revisar o que entrou no dia e decidir o que vira nota de verdade. A maior parte do que capturo nunca chega a virar nota — e isso é o esperado, não uma falha do sistema.\n\nA métrica errada aqui seria contar notas criadas por dia. A métrica certa é quantas notas de uma semana atrás eu ainda releio sem vergonha.",
    resumo:
      "Cortar toda fricção da captura tira também o filtro que separa ideia de ruído; um horário fixo de revisão diária substitui melhor esse filtro do que a captura instantânea.",
    editadaEm: "2026-02-02",
    conexoes: 3,
  },
  {
    id: "reescrever-e-pensar-de-novo",
    titulo: "Reescrever é pensar de novo",
    pasta: "Zettelkasten",
    tags: ["#método", "#escrita"],
    corpo:
      "Reescrevi 'Ligação forte versus ligação fraca' três vezes este mês, e cada versão discordava um pouco da anterior. Isso costumava me incomodar — parecia indecisão. Percebi que é o oposto: a nota registra onde meu pensamento estava, não uma verdade fixa, e reescrever é o processo de pensar de novo com mais informação.\n\nO erro que eu cometia era tratar a nota como arquivo — escrever uma vez e nunca voltar, como se a primeira formulação já fosse a definitiva. Sob esse regime as notas envelhecem mal: ficam presas na versão mais rasa da ideia, a que eu tive tempo de escrever antes de entender o assunto direito.\n\nO livro do Klinkenborg tem uma frase que citei em 'Frase curta carrega uma ideia': cada frase é uma ideia testada, não uma ideia decorada. Reescrever uma nota é repetir esse teste com o que aprendi desde a última vez.\n\nNa prática isso significa não ter medo de apagar parágrafo inteiro numa nota antiga. A data de edição é mais honesta que a data de criação — ela diz quando eu pensei sobre aquilo pela última vez, não só quando anotei pela primeira.",
    resumo:
      "Reescrever uma nota antiga é repetir o teste de uma ideia com o que se aprendeu desde então, não um sinal de indecisão; a data de edição importa mais que a de criação.",
    editadaEm: "2026-02-10",
    conexoes: 3,
  },
  {
    id: "bimo-v0-leitor-de-vault",
    titulo: "Bimo v0: leitor de vault",
    pasta: "Projetos",
    tags: ["#projeto", "#bimo"],
    corpo:
      "Defini o escopo da primeira versão do Bimo: um chat que lê o vault do GitHub e responde perguntas sobre ele, sem escrever nada de volta. Antes de qualquer function calling que edite nota, quero confiar que a leitura funciona — árvore de pastas, conteúdo de nota individual, e o grafo de links entre elas.\n\nA decisão mais importante foi manter o token do GitHub só no servidor. O cliente nunca vê a chave; toda leitura passa por uma rota que autentica, busca e devolve. Isso complica um pouco o fluxo, mas fechar essa porta logo no v0 evita ter que revisitar segurança depois que a superfície de ataque já cresceu.\n\nO grafo de links saiu de um jeito mais simples do que eu esperava: percorrer o texto de cada nota atrás de wikilinks, montar um mapa de id para vizinhos, e cachear por alguns minutos porque baixar oitocentas notas do GitHub a cada carregamento de página seria lento demais.\n\nA parte que ficou para depois é a mais interessante: deixar o Bimo escrever nota nova ou editar uma existente via commit real. Por enquanto ele só lê.",
    resumo:
      "O escopo do v0 do Bimo é leitura pura do vault — árvore, conteúdo e grafo de links — com o token do GitHub isolado no servidor; escrita fica para uma etapa futura.",
    editadaEm: "2026-03-01",
    conexoes: 6,
  },
  {
    id: "migracao-do-vault-para-github",
    titulo: "Migração do vault para GitHub",
    pasta: "Projetos",
    tags: ["#projeto", "#github"],
    corpo:
      "O vault morava só no notebook, sincronizado por um app de notas comum. Para o Bimo ler qualquer coisa ele precisa de uma fonte que dê para consultar por API, então a migração para um repositório GitHub virou pré-requisito, não opcional.\n\nA estrutura de pastas ficou quase igual à do app antigo — Zettelkasten, Projetos, Diário, Referências — porque trocar a estrutura junto com a plataforma ia misturar dois problemas numa migração só. Prefiro estabilizar a plataforma primeiro e só depois questionar se a estrutura de pastas ainda faz sentido.\n\nUma decisão pequena que rendeu mais do que esperava: manter as notas do Obsidian como estavam, pasta `.obsidian` e tudo, em vez de limpar antes de subir. O leitor do Bimo simplesmente ignora o que não é markdown de conteúdo, então não havia motivo para gastar tempo arrumando a casa antes de mudar de endereço.\n\nO branch principal ficou como fonte da verdade; uma subpasta configurável permite apontar o Bimo só para uma fatia do repositório se um dia eu quiser separar notas pessoais de notas de trabalho no mesmo repo.",
    resumo:
      "Migrar o vault para um repositório GitHub era pré-requisito para o Bimo poder ler qualquer coisa via API; a estrutura de pastas e os arquivos do Obsidian foram mantidos como estavam para não misturar dois problemas na mesma mudança.",
    editadaEm: "2026-03-10",
    conexoes: 4,
  },
  {
    id: "prototipo-mobile-em-expo",
    titulo: "Protótipo mobile em Expo",
    pasta: "Projetos",
    tags: ["#projeto", "#mobile"],
    corpo:
      "A versão web do Bimo já funciona, mas eu só abro o vault do computador — no celular a ideia de perguntar algo rápido para o Bimo nunca vinga porque abrir o navegador e logar dá trabalho demais para uma pergunta de dez segundos.\n\nEscolhi Expo em vez de React Native puro pela mesma razão que escolhi Next.js para a web: quero gastar tempo no produto, não em configuração de toolchain. O roteamento por arquivo do expo-router também espelha o App Router que já uso, então a curva de aprendizado fica menor.\n\nA primeira decisão de verdade foi não portar tela por tela da versão web. O celular pede outra hierarquia — uma coisa de cada vez na tela, navegação por gesto, texto maior — então o protótipo parte de telas pensadas para toque, com o layout desktop como referência de conteúdo, não de forma.\n\nPor enquanto o protótipo roda inteiro sobre dados de exemplo, sem tocar a API real. Isso deixa eu validar a experiência de tela sem esperar o backend mobile ficar pronto, e a troca por uma implementação real depois é, na teoria, um único arquivo novo.",
    resumo:
      "O protótipo mobile usa Expo em vez de React Native puro para minimizar configuração, e propositalmente redesenha as telas para toque em vez de portar o layout desktop direto.",
    editadaEm: "2026-04-02",
    conexoes: 3,
  },
  {
    id: "piloto-do-agente-com-function-calling",
    titulo: "Piloto do agente com function calling",
    pasta: "Projetos",
    tags: ["#projeto", "#agente"],
    corpo:
      "Testei o Gemini com cinco ferramentas expostas: busca e listagem e leitura de nota para consulta, criação e edição de nota para escrita. A parte que mais me preocupava — o modelo escrever no vault sem supervisão — acabou sendo a mais tranquila: cada chamada de escrita gera um commit real, então toda edição fica no histórico do GitHub, revisável e reversível.\n\nO problema real apareceu na leitura: o modelo buscava com termos genéricos demais e recebia trinta resultados, aí tentava ler todos antes de responder. Limitei o loop a um número máximo de voltas — cinco chamadas de ferramenta por turno — para que uma busca ruim não vire uma sequência infinita de leituras.\n\nOutra coisa que ajustei foi o tom das respostas. Sem instrução, o modelo respondia com a educação padrão de assistente — frases de abertura, hedging, ponto de exclamação — que não combina com o resto do produto. O Bimo devia soar como alguém que já leu as notas e vai direto ao que encontrou, sem preâmbulo.\n\nO commit de cada edição referencia a nota alterada no corpo da mensagem, o que deixou o histórico do repositório mais legível do que eu esperava: dá para ver, olhando só o log do Git, quais notas o agente tocou e quando.",
    resumo:
      "O piloto expôs cinco ferramentas ao Gemini — três de leitura e duas de escrita, cada escrita virando commit real — e o ajuste mais necessário não foi a escrita, e sim limitar buscas genéricas que disparavam leituras em cascata.",
    editadaEm: "2026-04-20",
    conexoes: 4,
  },
  {
    id: "terca-de-revisao-lenta",
    titulo: "Terça de revisão lenta",
    pasta: "Diário",
    tags: ["#diário", "#hábito"],
    corpo:
      "Separei a tarde inteira só para reler notas antigas da pasta Zettelkasten, sem criar nada novo. Achei que ia ser tedioso e virou o contrário: reler 'Hub não é índice' de janeiro me mostrou que eu já tinha percebido o problema bem antes de decidir fazer algo a respeito.\n\nO que mais rendeu não foi encontrar erro, foi encontrar ligação que eu não tinha feito na hora — duas notas sobre fricção de captura e sobre reescrita que conversam claramente e que eu tinha deixado soltas por meses.\n\nVou tentar reservar essa tarde de terça toda semana, não só quando sobra tempo. A vaidade de só criar nota nova é fácil de ceder; revisão lenta parece a parte do método que mais fica de lado quando a agenda aperta.",
    resumo:
      "Uma tarde inteira de releitura sem criar nada novo revelou ligações entre notas antigas que tinham ficado soltas; a intenção agora é reservar esse horário toda semana, não só quando sobra tempo.",
    editadaEm: "2026-05-05",
    conexoes: 3,
  },
  {
    id: "retomada-depois-das-ferias",
    titulo: "Retomada depois das férias",
    pasta: "Diário",
    tags: ["#diário"],
    corpo:
      "Duas semanas sem abrir o vault e a primeira reação ao voltar foi de estranhamento — não lembrava por que tinha ligado 'Fricção de captura' a 'Protótipo mobile em Expo', duas notas que na hora fizeram sentido juntas e agora exigem reconstruir o raciocínio do zero.\n\nIsso não é um defeito do sistema, é o próprio teste do método: se a ligação fosse forte de verdade, a frase de justificativa devia bastar para eu recuperar o raciocínio sem precisar lembrar do contexto da semana em que escrevi. Em algumas ligações funcionou; em outras não, e essas eu marquei para revisar.\n\nA retomada mais fácil foi pelas notas de Diário — reler as últimas três entradas antes de férias recolocou o estado de espírito de onde eu tinha parado muito mais rápido do que reler notas de método.\n\nDecidi que, da próxima vez que tirar férias, a última nota antes de sair vai ser deliberadamente um resumo do que está em aberto, não só o que aconteceu no dia. Um bilhete para a versão futura de mim mesma.",
    resumo:
      "Duas semanas fora do vault expuseram que nem toda ligação registrada tinha justificativa forte o bastante para se sustentar sem o contexto da época; as notas de Diário recentes ajudaram a recolocar o estado de espírito mais rápido do que as notas de método.",
    editadaEm: "2026-06-01",
    conexoes: 3,
  },
  {
    id: "reuniao-sobre-o-roadmap-do-bimo",
    titulo: "Reunião sobre o roadmap do Bimo",
    pasta: "Diário",
    tags: ["#diário", "#bimo"],
    corpo:
      "Passei a manhã revisando o roadmap do Bimo sozinha, com café e a lista de tudo que ficou para depois desde o v0. Duas frentes disputam a próxima etapa: o protótipo mobile e o piloto do agente com function calling. Decidi seguir os dois em paralelo em vez de sequencial, porque são independentes o bastante — um mexe em telas, o outro mexe em backend — para não travarem um no outro.\n\nA parte que mais discuti comigo mesma foi se o agente devia ganhar escrita antes do mobile existir. Optei por sim: melhor validar o risco maior, o modelo escrevendo no vault sem supervisão direta, enquanto ainda só existe um cliente, a versão web, do que empilhar dois riscos novos ao mesmo tempo.\n\nSaiu da reunião — comigo mesma — uma lista curta: piloto do agente primeiro, protótipo mobile sobre dados de exemplo em paralelo, e só depois ligar as duas pontas. Documentei aqui para não reabrir a mesma discussão daqui a um mês.\n\nO próximo marco natural é o mobile deixar de rodar sobre fixture e falar com a mesma API que a versão web já usa — nesse ponto as duas frentes se encontram.",
    resumo:
      "O roadmap decidiu tocar o piloto do agente com function calling e o protótipo mobile em paralelo, por serem independentes o bastante, com escrita do agente validada antes do mobile existir para não empilhar dois riscos ao mesmo tempo.",
    editadaEm: "2026-07-15",
    conexoes: 4,
  },
  {
    id: "frase-curta-carrega-uma-ideia",
    titulo: "Frase curta carrega uma ideia",
    pasta: "Referências",
    tags: ["#leitura", "#escrita"],
    corpo:
      "Anotações de leitura de 'Several Short Sentences About Writing', de Verlyn Klinkenborg. A tese do livro cabe no próprio título: cada frase devia carregar uma ideia testada, não uma ideia decorada de subordinadas.\n\nO que mais me atingiu foi a distinção entre frase que soa bem e frase que pensa. Uma frase longa cheia de vírgulas pode soar elegante e ainda assim não ter testado nada — é decoração em cima de uma ideia que nunca foi examinada de perto. Klinkenborg pede o oposto: escrever a frase curta primeiro, e só complicar a sintaxe se a ideia realmente precisar disso.\n\nA ligação com 'Notas atômicas' é direta e por isso resolvi manter as duas notas ligadas: o teste do título como afirmação completa é basicamente o teste da frase curta aplicado ao nível da nota inteira, não da sentença.\n\nO ponto que ainda não apliquei direito é o conselho de escrever uma frase, parar, e perguntar se ela é verdadeira antes de escrever a próxima. Nas notas de projeto eu ainda escrevo parágrafo inteiro de uma vez e só reviso depois — o que o livro sugere é inverter isso.",
    resumo:
      "Do livro de Klinkenborg, a ideia central é escrever a frase curta primeiro e só complicar a sintaxe se a ideia exigir; a ligação com 'Notas atômicas' é o mesmo teste aplicado à nota inteira em vez de à sentença.",
    editadaEm: "2026-05-20",
    conexoes: 3,
  },
  {
    id: "segundo-cerebro-e-infraestrutura-nao-habito",
    titulo: "Segundo cérebro é infraestrutura, não hábito",
    pasta: "Referências",
    tags: ["#leitura", "#método"],
    corpo:
      "Anotações de leitura de 'Building a Second Brain', de Tiago Forte. O ponto que ficou depois de fechar o livro não foi nenhuma das siglas — é a ideia de tratar o sistema de notas como infraestrutura que precisa de manutenção própria, e não como um hábito de força de vontade que funciona enquanto eu estiver disciplinada.\n\nForte separa captura, organização, destilação e expressão como quatro movimentos distintos, e a maior parte dos sistemas que eu tentei antes do Zettelkasten misturava os quatro numa etapa só — anotava e já tentava deixar bonito e definitivo na hora, o que é meio caminho para desistir da captura.\n\nO paralelo com 'Fricção de captura' é direto: o livro defende também abaixar a fricção do primeiro movimento e reservar esforço editorial para depois, quando já há mais contexto sobre o que a nota vale.\n\nDiscordo de uma parte: o livro trata organização por projeto como suficiente, e no meu caso isso perde justamente a ligação entre ideias de projetos diferentes que o grafo do Bimo deixa visível. Infraestrutura de projeto e infraestrutura de método não são a mesma coisa, e tratar as duas como uma só foi o que me fez procurar outro sistema.",
    resumo:
      "A contribuição principal do livro de Tiago Forte é tratar o sistema de notas como infraestrutura com manutenção própria, não hábito de disciplina; a discordância é que organizar só por projeto perde a ligação entre ideias de projetos diferentes que o grafo do Bimo revela.",
    editadaEm: "2026-05-28",
    conexoes: 3,
  },
];
