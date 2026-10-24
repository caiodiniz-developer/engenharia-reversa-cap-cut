# Segurança

Resumo do que existe, **onde está implementado** e **onde é verificado**. O que não está aqui não deve ser assumido.

## Autenticação e sessão
- Senhas com **scrypt** (N=16384, r=8, p=1, sal aleatório de 16 bytes), comparação em tempo constante. `apps/api/src/security.ts` · `test/security.test.ts`.
- Login devolve a mesma resposta para usuário inexistente e senha errada e faz o hash mesmo assim (reduz enumeração por tempo/mensagem). `test/auth.test.ts`.
- **JWT HS256**, 7 dias, `alg=none` rejeitado. `JWT_SECRET` (≥ 32 caracteres) é obrigatório em produção. O token fica no `localStorage` do navegador: um XSS o exporia — por isso a CSP abaixo. Não há revogação individual (trocar o segredo invalida todos). Não há 2FA nem recuperação de senha.
- Rate limit global por IP e mais rígido em `/auth/*`. `test/auth.test.ts`.

## Autorização
- Toda rota de projeto/mídia/exportação/tarefa filtra por `ownerId` e responde **404** (não 403) para recursos de outros usuários. `test/projects|media|exports.test.ts` exercitam usuário A × B.
- Ao salvar, o servidor confere que toda mídia do documento pertence ao projeto (impede referenciar a mídia de outro usuário). `projects.test.ts`.
- A exportação renderiza o **documento salvo no servidor**, nunca dados enviados no corpo da requisição. `exports.test.ts` ("usa o documento salvo…").

## Mídia, uploads e downloads
- Limites de tamanho (2 GB), duração (2 h), nº de mídias por projeto e clipes por exportação; validação **por conteúdo** com ffprobe (um arquivo de texto com extensão/MIME de vídeo é recusado com 415). `media.test.ts`.
- Upload resumível: offset verificado, corpo gravado em streaming e limitado ao tamanho declarado, sessão restrita ao dono, identificador de 128 bits.
- Nomes de arquivo sanitizados; chaves de armazenamento validadas contra *path traversal*. `security.test.ts`.
- **URLs assinadas** (HMAC-SHA256 de recurso|usuário|expiração, comparação em tempo constante) para mídia e download; tampering, expiração e troca de usuário são recusados. Suporta `Range` sem expor o disco.
- `Content-Disposition` conforme RFC 6266 (ASCII + `filename*`), pois cabeçalhos não aceitam caracteres arbitrários. *(Bug encontrado e corrigido pelo E2E de produção.)*

## Execução de FFmpeg
- Sempre `spawn`/`execFile` **sem shell**, com argumentos montados no servidor a partir do documento validado; o navegador nunca envia comandos ou argumentos. Caminhos entram em filtros somente via `escapeFilterPath`.
- Concorrência limitada por tipo, timeout por tarefa (padrão 1 h), cancelamento mata o processo, temporários removidos no `finally`. Exportações expiram (padrão 24 h) e são apagadas pela rotina de retenção.
- Recomendado em produção: executar a API em contêiner sem privilégios (a imagem usa o usuário `node`) com limites de CPU/memória (o `docker-compose.yml` define).

## Front-end e transporte
- A API usa `helmet`; CORS apenas para `CORS_ORIGINS`; WebSocket verifica `Origin`, autentica pela primeira mensagem (token fora da URL, sem aparecer em logs) com prazo de 5 s e `maxPayload` pequeno.
- O nginx aplica **CSP restritiva** (`default-src 'self'`; scripts só do próprio domínio; `frame-ancestors 'none'`), `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` (`deploy/security-headers.conf`). `e2e-prod/prod.spec.ts` roda o **build de produção sob essa CSP** e exige zero violações e zero erros de console.
- `style-src 'unsafe-inline'` é necessário hoje por estilos inline do React/Framer Motion; é a principal concessão da CSP.
- Use HTTPS no proxy de borda (terminação TLS não faz parte deste repositório) e `HSTS` lá.

## IA e privacidade
- Chaves ficam **somente no servidor**; nunca vão ao navegador. Sem provedor configurado, a API responde 503 — nada é simulado.
- Provedores externos (transcrição por API, assistente) exigem **consentimento explícito** do usuário na interface antes do envio; o servidor expõe `transcriptionSendsDataExternally`/`assistantSendsDataExternally`. Análises locais (silêncio, cenas, destaques) não enviam nada. Transcrição com `whisper.cpp` mantém o áudio no servidor.
- Orçamento diário de chamadas de IA por usuário (`AI_DAILY_CALL_LIMIT`), com 429 ao exceder.
- A saída do LLM é tratada como **entrada não confiável**: validada por Zod e executada apenas por operações da timeline; o resultado é uma proposta que o usuário confirma.

## Fora do escopo / riscos conhecidos
Sem auditoria externa, sem teste de penetração, sem 2FA, sem revogação de sessão, sem varredura antivírus de uploads, sem política formal de privacidade/LGPD (o produto apenas expõe retenção configurável e exclusão de projetos e mídias), sem proteção contra DoS volumétrico (depende da borda).
