# Limitações conhecidas

Listadas para que ninguém descubra em produção. Itens marcados com 🔧 têm caminho de evolução claro.

## Preview × exportação
- O preview roda em Canvas 2D a até 960 px de largura e usa efeitos por pixel em JavaScript. Os efeitos são matematicamente alinhados com os filtros do FFmpeg, mas **granulação e glitch usam ruído aleatório** (não coincidem quadro a quadro), e desfoque/nitidez diferem levemente nas bordas.
- **Não aparecem no preview:** estabilização, normalização de loudness e redução de ruído (só na exportação).
- Reprodução **em reverso** no preview avança por quadros e é muda; a exportação usa o filtro `reverse` (carrega o trecho inteiro na memória: evite reverter trechos muito longos).
- Escala animada por keyframes amplia o clipe até a maior escala (limitada a 4×) e encolhe por `perspective`; clipes 4K com zoom grande consomem bastante memória.
- Transições do tipo cortina usam a geometria do próprio clipe; com rotação, o recorte é aproximado no preview.

## Renderização
- A exportação final é **sempre no servidor**. O "rascunho local" grava a prévia em tempo real (WebM, qualidade do preview). Não há ffmpeg.wasm nem WebCodecs. 🔧
- Cada legenda/texto vira uma entrada do FFmpeg. Projetos com **centenas de legendas** ficam lentos; mesclar legendas por faixa em uma única entrada é a otimização prevista. 🔧
- Fontes: o texto é desenhado no servidor com as fontes **instaladas lá**. A imagem Docker inclui Liberation e DejaVu; "Arial" cai para uma fonte métricamente equivalente. Para fontes personalizadas, instale-as no servidor.
- O cancelamento interrompe o FFmpeg principal e as passadas de análise (estabilização); processos de FFmpeg órfãos após um *crash* do servidor não são recolhidos automaticamente.

## Backend
- A fila de tarefas é **persistida no PostgreSQL mas executada no processo da API**; ao reiniciar, tarefas em execução voltam para a fila. Para várias instâncias é preciso mover os *workers* para consumir a mesma tabela (`FOR UPDATE SKIP LOCKED`) ou adotar BullMQ. 🔧
- Armazenamento de mídia **em disco local**. A interface `ObjectStore` permite plugar S3/MinIO, mas isso não foi implementado nem testado. 🔧
- Links assinados são válidos por 1 h (configurável) e ficam em cache do navegador; a revogação antecipada exige trocar `URL_SIGNING_SECRET`.
- O limite diário de IA conta chamadas por usuário, não custo real em tokens.

## IA
- Os provedores externos foram testados apenas contra um servidor local que imita o contrato HTTP; o comportamento com o serviço real (limites, formatos, latência) não foi verificado.
- A transcrição local depende de um binário `whisper.cpp` e de um modelo fornecidos por quem opera o servidor; o caminho local não foi executado neste ambiente. 🔧
- "Melhores trechos" é uma **heurística** (energia do áudio, pausas, trocas de cena), não compreensão de conteúdo. O assistente só propõe operações que passam pela validação da timeline e exige confirmação do usuário.
- Remoção de fundo e isolamento vocal não existem.

## Navegador e acessibilidade
- Testado no Google Chrome (Windows). Firefox, Safari e mobile **não foram testados**; a interface foi pensada para desktop (a gaveta de propriedades existe para telas estreitas, mas a edição por toque não foi validada).
- Os proxies de preview são H.264: navegadores sem decodificação H.264 não reproduzem o vídeo.
- Foram aplicados rótulos ARIA, foco visível e navegação por teclado nos painéis, mas **não houve auditoria de acessibilidade** (leitor de tela, contraste automatizado).
- Modelos de texto e rascunhos ficam no IndexedDB do navegador; limpar os dados do site os apaga (o projeto no servidor não é afetado).

## Novidades de interface
- A **gravação de voz** depende do `MediaRecorder` do navegador e de permissão de microfone; o E2E usa o microfone falso do Chrome (tom sintético), não um microfone real. O WebM gravado não traz duração no cabeçalho: o servidor a mede decodificando o arquivo (mais lento para gravações longas).
- Os **fundos gerados** (cor sólida e degradê) são imagens PNG criadas pelo FFmpeg no servidor com resolução fixa do projeto; não há fundos animados.
- As **animações prontas** viram keyframes comuns de posição, escala, rotação e opacidade; não há animações por caractere ou por palavra.
- A **tira de quadros** da timeline é gerada no processamento da mídia; mídias importadas antes dessa função não a têm e usam a miniatura única.
- O tema claro/escuro e a largura/abertura dos painéis ficam no `localStorage` do navegador, não na conta.

## Revisão, plataformas e listas
- As **zonas seguras e as durações recomendadas** por plataforma (Shorts, Reels, TikTok, Stories…) são aproximações práticas e podem estar defasadas: os aplicativos mudam seus layouts e limites. Os dados ficam em `packages/core/src/platforms.ts`.
- A **Revisão** é um conjunto de regras heurísticas, não uma garantia de aprovação em nenhuma plataforma. Ela não analisa o áudio (não sabe se há fala sem legenda) e só afirma o contraste do texto quando não há vídeo ou imagem por baixo dele.
- O **EDL (CMX 3600)** exporta apenas clipes de mídia (sem textos, efeitos ou transições) e não foi aberto em programas de edição de terceiros neste ambiente; o formato segue a estrutura básica do padrão.
- A **simulação de daltonismo** usa matrizes de cor publicadas (Machado et al., 2009) aplicadas no preview; é uma aproximação, não substitui teste com pessoas.
- As **tarefas de edição** são marcadores cujo nome começa com ☐ ou ☑; se o nome for editado à mão e perder o prefixo, deixam de ser tarefas.
- O **replay do histórico** troca o projeto na tela por estados antigos e pausa o salvamento automático até terminar; fechar a aba no meio do replay pede confirmação.
- A **montagem no ritmo** mexe só na faixa escolhida: clipes ligados (ex.: áudio extraído) em outras faixas não acompanham.

## Landing page
- As demonstrações do laboratório usam um projeto de exemplo montado em memória: nada é salvo nem enviado ao servidor. O limiar de "difícil de distinguir" do daltonismo (distância de cor 70) é um critério prático, não uma norma.
- Os números da landing (efeitos, LUTs, transições, animações, verificações e plataformas) são lidos do código, mas as frases de texto (recursos e perguntas) são escritas à mão e precisam ser revisadas quando o produto mudar.
- Com "menos movimento" ativado no sistema, as animações (palavra alternada, inclinação, faixa de efeitos, contadores, passos e esferas) ficam paradas ou já completas.

## Ferramentas em lote da paleta
- Os comandos usam **valores predefinidos** (±3 dB, 10%, 15°, 5 s, 1/2/5 s…); valores livres só existem nas propriedades do clipe.
- O **ducking** é por tempo, não por conteúdo: ele não detecta fala. "Voz" são os outros clipes com som em **outras faixas**; música e voz na mesma faixa não funcionam. Substitui os keyframes de volume que a música já tinha, e o nível do arquivo exportado não foi medido (🟨 na matriz).
- **Embaralhar** usa uma semente nova a cada clique; a mesma semente só se repete no núcleo (testes), não há campo para escolher a semente.
- **Juntar pedaços contínuos** só une clipes idênticos em tudo (mídia, trecho contínuo, velocidade, efeitos, áudio, transformação); ignora clipes ligados, congelados, invertidos, com keyframes ou com transição.
- **Roteiro em legendas** distribui o tempo pelo tamanho do texto, não pela fala real; as palavras de cada legenda também são proporcionais (o destaque da palavra falada fica aproximado). Não faz sincronização com áudio.
- **Substituir mídia** troca por um arquivo que já está na biblioteca do projeto, do mesmo tipo e com duração suficiente para o trecho de cada clipe; não troca por um arquivo do disco direto.
- **Cortar para uma proporção** corta sempre no centro; não há escolha do ponto de foco. **Preencher o quadro** precisa das dimensões da mídia.
- A **marca d’água** é um texto (não imagem/logo) e usa o nome do projeto como texto inicial; edite o texto nas propriedades.
- **Mostrar todas as faixas** desliga o mudo e o oculto de todas, inclusive os que você tinha ligado antes do solo (o estado anterior não é guardado).
- **Remover o trecho marcado** recusa quando uma faixa bloqueada tem clipe no trecho, e clipes ligados ficam juntos apenas dentro do que foi dividido.
- Os **marcadores nos vãos** consideram todas as faixas: um vão coberto por outra faixa não conta.

## Animações novas
- O **confete** e o brilho/paralaxe dependem de JavaScript/CSS do navegador; com "menos movimento" ativado ficam desligados (o confete nem é criado). O botão magnético só reage a **mouse**, não a toque.
- A lista **"ferramentas"** da segunda faixa da landing é escrita à mão em `content.ts` (diferente da primeira faixa, lida do núcleo); um teste só confere nomes únicos e quantidade mínima, não que cada nome tenha comando na paleta.
- A animação de entrada dos benefícios da tela de login roda uma vez a cada visita; capturas de tela tiradas no primeiro instante mostram a lista ainda invisível.

## Criativo e sincronia
- **Rampa de velocidade, gagueira e boomerang** não vêm com o áudio ligado: a rampa e a gagueira recusam clipes ligados a outro (desvincule antes); no boomerang o clipe ligado é copiado sem o parceiro. A rampa também recusa clipes invertidos, congelados ou com keyframes. A qualidade do som em velocidades extremas (abaixo de 0,5× ou acima de 2×) não foi avaliada.
- A **tela dividida** corta sempre no centro e vale para dois clipes; o preview foi medido, a exportação não foi medida no arquivo. A **imagem dentro da imagem** é posicionada por conta (sem borda nem sombra) e não considera recortes já aplicados.
- Os **cortes suaves** só atuam em cortes secos (clipes encostados a menos de 50 ms) e não foram medidos em áudio real.
- A **transição em todos os cortes** usa a mesma duração (0,5 s) e pula cortes com vão, de textos ou curtos demais; o aviso diz quantas foram aplicadas.
- **Encaixar nos marcadores** usa tolerância fixa de 0,5 s; **esticar até o marcador** depende de a mídia alcançar. **Carimbar** cria cópias sem ligação com o original.
- **Selecionar por critério** usa limites fixos pela paleta (1 s e 5 s); nas propriedades não há filtro livre.
- O botão **Desfazer** dos avisos desfaz a última edição do projeto, que pode não ser a do comando se algo mais foi editado nesse meio-tempo.
- Os atalhos **Alt + I/B/R** podem conflitar com atalhos do sistema ou do teclado (por exemplo, AltGr em alguns layouts).

## Escala
- Não houve teste de carga nem de vídeos muito longos (horas). Os limites configuráveis (2 GB por arquivo, 2 h por mídia, 200 mídias por projeto, 3000 clipes por exportação) existem para proteger o servidor, não foram calibrados com medições.
