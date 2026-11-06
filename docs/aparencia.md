# Aparência: vidro, temas e cores de destaque

Guia para quem cria telas e componentes novos. Tudo vive em `apps/web/src/index.css` (tokens e classes) e `apps/web/src/lib/appearance.ts` (preferências).

## Tokens

As cores são tripletos RGB (`--bg`, `--panel`, `--ink`, `--mute`, `--accent`...) para permitir opacidade (`rgb(var(--accent) / 0.4)`). O tema escuro é o padrão; `data-theme="light"` no `<html>` troca todos.

O vidro tem tokens próprios, também por tema:

| Token | Uso |
|---|---|
| `--glass-bg` / `--glass-bg-hover` | preenchimento translúcido de botões, chips e barras |
| `--glass-bg-strong` | vidro mais denso, para texto longo (diálogos, menus, paleta, avisos) |
| `--glass-border` | borda de luz |
| `--glass-hi` | realce especular no topo (`inset 0 1px 0`) |
| `--glass-shadow` | sombra suave |

## Classes

- `.btn`, `.btn-primary`, `.btn-danger`, `.btn-ghost`, `.btn-icon`, `.chip`, `.kbd`, `.field`, `.card`: já são vidro. Não troque o fundo deles por cor fixa.
- `.glass` (leve) e `.glass-strong` (denso): superfícies flutuantes. Use `glass-strong` quando houver texto para ler.
- `.glass-bar`, `.glass-top`, `.glass-rail`: barras coladas na borda (em cima, embaixo, na lateral).
- `.seg` + `.seg-item`: controle segmentado. A opção ativa é a que tem `aria-selected`, `aria-checked` ou `aria-pressed` verdadeiro.
- `.play-orb`: esfera de vidro tingida do botão de reproduzir.
- `<Tooltip label shortcut hint>` (`components/Tooltip.tsx`): tooltip de vidro; o botão continua precisando de `aria-label`.

As classes ficam em `@layer components`, então utilitários do Tailwind (`bg-danger`, `!h-6`...) continuam vencendo quando você precisa de uma exceção.

## Modos de vidro

Guardados no navegador (`localStorage`) e aplicados como atributo no `<html>`:

| Modo | Atributo | Comportamento |
|---|---|---|
| Vidro sempre ligado (padrão) | nenhum | desfoque e translucidez sempre |
| Seguir o sistema | `data-glass="auto"` | vira sólido quando o sistema pede "reduzir transparência" |
| Superfícies sólidas | `data-glass="solid"` | sempre sólido |

Sem suporte a `backdrop-filter`, uma regra `@supports` usa cores sólidas. Comandos da paleta: "Vidro: ...".

## Cores de destaque

`data-accent` no `<html>` (`blue`, `violet`, `orange`, `pink`; o verde-água é o padrão e não leva atributo) troca só `--accent` e `--accent-ink`, com valores separados para o tema escuro e para o claro. Cores fixas (cursor de reprodução, cores dos clipes por tipo) não mudam.

## Contraste: o que os testes garantem

- `lib/tokens.test.ts`: texto, destaque, botão primário, erro e sucesso, nos dois temas, a no mínimo 4,5:1.
- `lib/glassContrast.test.ts`: o texto continua legível sobre cada preenchimento de vidro, no pior caso do fundo (brilho ambiente a 14% sobre o fundo).
- `lib/accents.test.ts`: cada cor de destaque, em cada tema, como texto no painel e como fundo do botão.

Se você mudar um token de cor, rode `pnpm --filter @editor/web test`: os três testes dizem o que quebrou.

## Regras práticas

1. Superfície nova que flutua sobre o conteúdo: `glass-strong` (com texto) ou `glass` (só ícones).
2. Painéis grandes ficam só translúcidos, sem desfoque (desfocar uma área enorme custa caro e não muda o visual, porque o fundo é um degradê suave).
3. Nunca escreva `bg-white/10`, `bg-black/40` ou cores de destaque fixas em componentes novos: use os tokens, para os dois temas e os modos sólido/sistema funcionarem.
4. Texto sobre vidro usa `text-ink` ou `text-mute`; outras cores precisam ser conferidas no contraste.
