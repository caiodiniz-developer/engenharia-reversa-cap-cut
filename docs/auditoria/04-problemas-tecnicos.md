# 4. Problemas técnicos

1. Sem código-base: toda a fundação precisa ser criada.
2. FFmpeg/FFprobe ausentes: bloqueia a renderização e a extração de metadados.
3. Sem Docker, PostgreSQL e Redis locais: bloqueia banco e filas. Alternativas: instalar, ou usar SQLite/fila em memória apenas em dev (documentado como limitação).
4. README vazio e sem documentação de produto.
5. O escopo do master prompt é gigantesco. Exige entrega fatiada por fases, com critérios de aceitação verificáveis.
6. O nome do repositório ("engenharia reversa") sugere cópia do CapCut. O master prompt exige produto independente: apenas comportamento observável público, sem código proprietário nem desbloqueio de recursos pagos.
