# 10. Hospedagem, armazenamento e renderização

- **Dev:** docker compose com Postgres, Redis e MinIO (S3 local).
- **Prod:** web estático em CDN; API e workers em containers separados; Postgres gerenciado; S3 compatível; Redis gerenciado.
- **Render:** workers escalam pelo tamanho da fila; limite de CPU/memória/tempo por job; FFmpeg com argumentos montados pelo servidor; temporários em volume efêmero, limpos ao final.
- **Mídia:** upload resumível (tus), URLs assinadas de curta duração, política de retenção configurável.
- **Privacidade:** o usuário é informado antes de qualquer envio ao servidor ou a IA externa.
- **Limitações a documentar:** efeitos de preview em tempo real dependem da GPU; ffmpeg.wasm é limitado pela memória do navegador.
