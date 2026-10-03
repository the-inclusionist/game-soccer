# game-soccer — futebol na engine do Inclusionist

> Este ficheiro é material de trabalho e está em pt-BR porque é onde decidimos.
> **Tudo o que aterrar no repositório nasce em inglês** — código, identificadores, comentários,
> documentação, mensagens de commit e strings de UI no fonte. pt-BR só nos dicionários de i18n.

## Contexto

O `modelence/open-soccer` é um jogo de futebol arcade em navegador (11v11 contra a CPU, câmera de
transmissão pseudo-3D, regras completas, 48 seleções da Copa 2026, carga de chute/passe por retenção).
Ele **não tem licença** — confirmado pela API do GitHub, `"license": null` — o que significa *todos os
direitos reservados*: nada dele pode ser copiado.

O que se quer é o mesmo **produto**, construído com a nossa engine
(`@the-inclusionist/engine` v6.36.1, em `SP-the-inclusionist-tracer`), num repositório próprio,
`the-inclusionist/game-soccer`. As regras de um jogo não são protegidas por direito autoral; uma
implementação é. Então este é o mesmo movimento que o 2048 fez com os descendentes MIT do Threes! e
que o xadrez fez com o `3D-Hartwig-chess-set`: **reimplementação limpa a partir da descrição das
features**, com crédito dado à origem e nenhuma linha herdada.

E o pedido traz uma segunda metade: um **esquema de controlo de comando de consola** — direcional,
quatro botões da diamante, mais L1/L2/R1/R2, com um **acorde** (R1+R2) e um botão de **retenção**
(L1). A engine ganhou o vocabulário exato para isso *ontem* (ADR-0085, corrigido pelo ADR-0086), mas a
migração ainda não rodou.

### A regra de higiene que atravessa o plano todo

⚠️ **Nada é escrito em `SP-the-inclusionist-tracer` sem o sim explícito do Dev.** Duas sessões dividem
esse repositório: no momento em que este plano foi escrito o `git status` da engine mostrava onze
ficheiros modificados e não commitados, todos em `app/js/input/` e `app/js/ui/` — é a outra sessão a
executar a issue #103. Toda mudança de engine neste plano é **proposta**, apresentada, e só escrita
depois do sim; e antes de qualquer escrita lá, `git log --oneline -5` e
`python scripts/validate-adr.py docs/2-Architecture/adr`.

## A migração para a engine 11.0 — a faixa que corre antes de todas

> Medido a 2026-10-02 contra as duas árvores, não assumido. ⚠️ **O repositório da engine mudou de nome:**
> `SP-the-inclusionist-tracer` → **`the-inclusionist-engine`**. As linhas deste plano com o nome antigo ficam
> citadas e não apagadas; o `package.json:44` e o `vite.config.ts:5` do jogo também o mencionam, em
> comentários que explicam por que o `file:` morreu — texto histórico, não caminho vivo.

### Contexto

A engine publicou **10.0.0** e **11.0.0** (esta a 2026-09-27). O jogo está em `^9.0.0`, árvore limpa, tudo
empurrado, ~1067 portões verdes. Não é actualização de rotina: **o 10.0.0 nomeia o `game-soccer` em seis
entradas de quebra e o 11.0.0 em duas**, e o `docs/6-DevOps-SRE/Breaking-Changes.md` da engine já traz notas
por jogo com ficheiro e linha **deste** repositório. Essas notas são o guia; este plano é a ordem. O
`game-platformer` já está em `^11.0.0` e serve de exemplo trabalhado para cada emenda.

**Decidido pelo Dev a 2026-10-02:** só **paridade** — cruzar 10→11 com o comportamento inalterado. Declarar
as palavras à engine (`preset`/`gameOptions`/`howToPlay`/`hud`) e o eixo de contraste ficam fora, cada um
como faixa própria.

### A espinha, numa frase

O 10 e o 11 **tiraram o estado de módulo da engine**: o que era `import { x }` passou a ser membro do objecto
que o `createGame` devolve — e este jogo já o tem na mão (`motor`, `boot/main.ts:166`). A migração é, na maior
parte, **re-encaminhar imports para `motor.*`** dentro de um ficheiro. Sobre isso vêm três coisas que não são
re-encaminhamento: um **rename pt→en** de símbolos e membros de ctx, **três módulos que saíram da engine**, e
**duas declarações novas e obrigatórias**.

### O que muda, medido pelos imports deste jogo

| o jogo importa hoje | em 11.0 | nota |
|---|---|---|
| `registerDict, t` (`core/i18n`) | `motor.t`; o `DICTS` vai em `createGame({ dictionaries })` | DN |
| `srSay, srAlert` (`core/a11y-sr`) | `motor.say` / `motor.alert` | 10.0 (os sete jogos) |
| `toggleLibras, vlibrasOpen, vlibrasSay, vlTick` (`ui/vlibras`) | `motor.deafMode.{isOn,toggle,captionsOn}` + `motor.mirrorAnnouncements` | 10.0 + DG |
| `* as mixer` (`platform/audio`) | `motor.audio` | DB — nomeia-nos |
| `oneButton, setOneButtonValue, captionsOn, setCaptionsOnValue` (`core/state`) | `motor.settings.*` | CZ — nomeia-nos |
| `padCur` (`input/state`) | `motor.input` | DA — nomeia-nos |
| `initGamepad` + ctx à mão (`:466`) | ctx ganha `padMaps`, `padTable`, `input` (10.0) e `wizardClosed` (11.0); `rotuloDaAcao`→`actionLabel`, `mundoRodando`→`worldRunning`, `menuDePausa`→`pauseMenu` | DA + 11.0 — nomeia-nos 2× |
| `criarArestaComAlternancia` (`:43`, `:543`) | `createLatchedEdge`, com `input` (10.0) e `holdsKeys` (11.0) | DU |
| `startLoop` (`:1065`) | `LoopOptions.onFailure` obrigatório → `motor.onFailure` | 10.0 — diz que não passávamos aviso |
| `createAudioEarcons` | `getCaptionsOn` ← `motor.deafMode.captionsOn` | DG |
| `focaveisNoDom` (`ui/focus-trap`) | `focusablesInDom` | rename |
| `kJogo` (`input/keymap.ts:51,160,204`) | o módulo é fábrica: `createStorage` | DA |
| `conformanceProblems, distance, Heading, Speakable` | ficam; só `dimension` saiu | DY |
| `NavKeys` de `input/edges`, `createRng` | **já certos** | ✓ |
| `assets/vendor/fonts.css` | **continua a resolver** (`./assets/vendor/*` → `app/public/vendor/*`) | DW |

⚠️ **E as fontes não nos custam nada.** O 11.0 tirou a biblioteca de fontes do pacote e manda declarar
`uses: { fonts: [...] }` quem desenha com outra família. Medido: este jogo usa `system-ui` e `ui-monospace` e
mais nada — **não declara nenhuma**, e o `scripts/copy-engine-assets.mjs` segue válido.

### Os três módulos que saíram — e de onde vêm

Vinte e seis módulos deixaram a engine para o `game-platformer` **no ponto de fork v9.0.0**. Três são nossos,
e os três imports são linhas vizinhas de um único ficheiro — `app/js/render/scene.ts:24-26`:

| import | o que faz aqui |
|---|---|
| `Z` (`core/layers`) | a tabela de Z |
| `criarCamera`, `CameraObj` (`render/camera`) | a câmera de transmissão (`camera.seguir`) |
| `posicoesParallax` (`render/parallax`) | as três camadas do estádio (`:533`) |

⚠️ **A procedência certa é a v9.0.0 da engine, e não o platformer.** É exactamente a versão contra a qual este
jogo compila hoje, então o código é o que ele já usa e a mudança de comportamento é zero:
`git -C ../the-inclusionist-engine show v9.0.0:app/js/render/camera.ts`. Código nosso, AGPL, mesmo titular —
vendorizar aqui é mover, não herdar de terceiro. O cabeçalho de cada um diz de onde veio e por quê.

### As duas declarações novas, e só uma é trabalho

1. **`dictionaries`** — o `DICTS` que o `i18n/index.ts` já exporta congelado passa a ir no `createGame`. O
   `installDicts` deixa de existir, e o portão de `tests/i18n` que o percorre segue a nova forma.
2. **`accommodations`** — ⚠️ **obrigatória e COMPLETA** (ADR-0153): as dezoito acomodações `GAME_KEYED`, cada
   uma com as CHAVES das suas palavras ou `false`. Chave ausente não é «não», é declaração malformada. O molde
   é o `app/js/declaration/accommodations.ts` do platformer — sete oferecidas, onze recusadas, cada linha com
   um comentário a nomear o código que a implementa.

**Proposta para as dezoito**, com o código deste jogo que lhe dá assunto:

| oferece | o que lhe dá assunto |
|---|---|
| `cameraSway` | `render/scene.ts` — `SMOOTH`, `LEAD_SECONDS`, `VERTICAL_GAIN` |
| `hints` | a linha de dica e `state.hinted` (`tests/hinted-switch`) |
| `timingWindow` | a janela de carga (`input/charge.ts`, `tests/buffered-strike`) |
| `aimAssist` | o modo assistido (`ui/assists-panel`) |
| `repeatedInput` | as rotas `latch-stepped` / `latch-timed` |
| `intensity` | a intensidade de pressão do plano de equipa (`ai/plan.ts`) |
| `reducedCharacterMotion` | a passada movida por distância, não por relógio (`render/scene.ts`) |
| `contrastOutlines` | o contorno de 1 px cozido no atlas (`render/kit-atlas`) |
| `ownerColors` | a divisa do jogador controlado, por assento (`render/markers`) |
| `detectionLeniency` | o raio de controlo e a distância de contacto (`sim/contact.ts`) |
| `easyMode` | as notas por equipa e o perfil de regras (`ai/ratings.ts`, `rules/profile.ts`) |

`false`: `wheelchairMode` e `caneSpacing` (não há assunto no campo); `pieceSets` e `distinguishableSuits` (não
há peças nem naipes); `lexicalDifficulty`, `wordHighlight` e `textPace` (este jogo não tem leitura).

⚠️ **Quatro são juízo e não medição** — `easyMode`, `detectionLeniency`, `textPace` e `wheelchairMode`. Ficam
propostas e marcadas como dele.

### A ordem, e por que começa por instalar

1. **Ramo próprio.** Nada compila no meio da travessia, e a `main` fica verde.
2. **`npm i @the-inclusionist/engine@11.0.0` && `npm run typecheck`.** ⚠️ **O `tsc` é a lista autoritativa**,
   não a tabela acima: enumera cada quebra com ficheiro e linha, e custa menos que qualquer leitura. A tabela
   diz o que esperar; o `tsc` diz o que é.
3. **Vendorizar os três módulos** — passo mecânico, isolado, verificável sozinho.
4. **Re-encaminhar `boot/main.ts` para `motor.*`**, emenda por emenda, re-correndo o `typecheck` a cada uma.
5. **As duas declarações** (`dictionaries`, `accommodations`).
6. **Os dublês dos testes.** O `MenuNavApi` ganhou `underCursor`/`itemNames`/`pointAt`/`navIntent` e o
   `SettingsStore` quatro membros de sessão: um dublê escrito à mão tem de os ganhar.
7. **`npm run validate` verde pelo código de saída**, e só então o commit.
8. **Reler o `docs/ENGINE-AUDIT.md`** contra 11.0 — ver abaixo.

### O que o 11.0 fecha da nossa própria auditoria

⚠️ **O achado 11 está FECHADO, e era nosso.** Dizia que a navegação da barra vive dentro do `createGame` e
nenhum jogo a alcança, e que a correcção era da engine, não deste repositório. O 11.0 fê-la: o `Engine`
devolve `nav: MenuNavApi`, e o `MenuNavApi` ganhou `underCursor(jogador)`, `itemNames`, `pointAt` e
`navIntent`. O `ENGINE-AUDIT.md` tem de o dizer — um documento que declara aberto o que já fechou mente, e
este repositório já pagou por um (a tabela duplicada do README, que anunciava sete defeitos corrigidos como
abertos).

⚠️ **E é isso que desbloqueia o eixo de contraste**: `setPlayerTheme`/`setPlayerCorrection` são opções do
`createGame` e a barra já se consegue interrogar. **Fica faixa própria, por decisão dele** — as três paletas
em 3:1/4.5:1/7:1 são desenho, e desenho não viaja dentro de uma migração.

### Verificação

- `npm run typecheck` a cada emenda: é o instrumento desta travessia, não só o portão do fim.
- `npm run validate` **pelo código de saída**, nunca pela cauda do cano: 908 portões `node` + ~159 `browser`.
- ⚠️ **Dois portões merecem olhar à mão depois do verde**, porque medem precisamente o que a migração mexeu:
  `tests/cartridge-import.browser.test.ts` (importar o `main.ts` não toca no documento) e
  `tests/i18n.node.test.ts` (as 43 chaves literais e o `DICTS`) — o segundo muda de forma com o `dictionaries`.
- No preview, o que o 10/11 mexeu mais: a barra de acessibilidade, o cartão de pausa, o sonar e as legendas.
  ⚠️ E o visual fica **sem verificação** enquanto ele não autorizar captura de tela.
- ⚠️ Este ficheiro vive em `~/.claude/plans`; pela regra dele, versionar em `<repo>/.claude/plans` antes de
  qualquer reescrita.

### O que NÃO está neste plano

A conversão em cartucho (passos 10–14: o `inclusionist-check-cartridge` é opt-in e o platformer, já em 11.0,
continua a construir com `vite build`, então as duas coisas seguem separáveis); declarar as palavras à engine;
o eixo de contraste; e as decisões que já estavam paradas — o negócio do item J, o `walkDir`, o que o `quit`
significa, e a voz neural.

## A publicação na Cloudflare — a faixa que corre DEPOIS da travessia

> ⚠️ **Esta faixa não começa antes do engine-11 verde.** A publicação muda a forma do `dist/` e os
> ficheiros de infra em volta dele; iniciá-la com a `main` ainda em `^9.0.0` é empilhar duas tempestades.
> A ordem é: migração 11.0 verde → merge → esta faixa.

### Contexto, e por que uma só origem

O alvo é **Cloudflare Pages + R2 + um Router Worker** que serve TODOS os jogos sob **uma origem** —
`o-inclusionista.jrocha.dev.br` — para que a ~1,2 GiB de *heavy* (voz, visão, reconhecimento, leitura) seja
descarregada **uma vez por criança**, não uma por jogo (ADR-0117, cache `incl-pesados-v2`). Cada jogo vive
num subcaminho: `o-inclusionista.jrocha.dev.br/<slug>/*`.

Receita medida em `game-platformer` a 2026-10-02. Qualquer jogo novo copia este padrão, inclusive este.

### Parte 1 — infra da plataforma (fora do repo deste jogo)

Isto é partilhado, não é por jogo; só se mexe quando entra um jogo novo. **A nossa única acção aqui é
acrescentar uma linha**: `'game-soccer': 'game-soccer.pages.dev'` à tabela `GAMES` do Router Worker.

- **Router Worker** em `jrocha.dev.br` com rotas:
  - `o-inclusionista.jrocha.dev.br/<slug>/*` → `<slug>.pages.dev`
  - `o-inclusionista.jrocha.dev.br/heavy/*` → uma origem (qualquer jogo serve; o navegador partilha o balde
    `incl-pesados-v2` por origem, não por caminho)
- **Secret de organização no GitHub**: `CLOUDFLARE_API_TOKEN`, visibilidade "public repos". No plano
  gratuito a trava por zona não funciona; o controlo fica em ser um GitHub Action auditável, não um segredo
  partilhado humano a humano.
- **R2 bucket** com o espelho dos heavy (`the-inclusionist-lfs`, EU). ⚠️ Jurisdicional
  (`.eu.r2.cloudflarestorage.com`) exige `jurisdiction = "eu"` no binding — é o erro «R2 bucket not found»
  mais comum.

### Parte 2 — o que entra NESTE repo

#### 2.1 Ficheiros de infra na raiz

Copiados de `game-platformer`, com `<slug>` = `game-soccer`:

```toml
# wrangler.toml
name = "game-soccer"
compatibility_date = "2024-11-15"
pages_build_output_dir = "dist"
[vars]
INCL_BASE = "/game-soccer/"
[[r2_buckets]]
binding = "LFS"
bucket_name = "the-inclusionist-lfs"
jurisdiction = "eu"
```

📌 **Com `wrangler.toml` presente, o dashboard do CF Pages passa a ser somente leitura para bindings** — a
verdade é o ficheiro. Por desenho.

Também:
- `functions/heavy/[[path]].ts` — proxia `/heavy/<host><path>` para o R2. ⚠️ **A tabela `MIRROR_FOLDERS` da
  engine é inlined aqui**, não importada: o esbuild do CF Pages não resolve o import do pacote de forma
  estável; é mais seguro copiar a tabela do que depender da resolução.
- `scripts/post-build-cloudflare.mjs` — escreve `dist/_headers` com os caminhos prefixados por `INCL_BASE`.
- `.github/workflows/deploy-router-worker.yml` — **opcional por jogo**, só nos repositórios que também
  movem o Router Worker. Este jogo pode não precisar.

#### 2.2 `vite.config.ts` — aceita o subcaminho

```ts
base: process.env.INCL_BASE || '/',
build: {
  outDir: '../dist' + (process.env.INCL_BASE || '').replace(/\/$/, ''),
  emptyOutDir: true,
},
```

Em dev continua a servir na raiz; em produção o Vite reescreve os caminhos para `/game-soccer/`.

#### 2.3 `app/index.html` — `<base>` e os caminhos

**Medido 2026-10-02 contra `app/index.html` deste repo:**

| referência | hoje | o que precisa |
|---|---|---|
| `<link rel="stylesheet" href="/vendor/fonts.css">` | absoluta a `/` | ⚠️ sob subcaminho fica em `/game-soccer/vendor/fonts.css`; o `scripts/copy-engine-assets.mjs` copia para o lugar certo, então **permanece absoluta como está** quando o Vite reescreve o resto |
| `<link rel="stylesheet" href="./css/game.css">` | relativa | Vite com `base` reescreve ✓ |
| `<link rel="manifest" href="./manifest.webmanifest">` | relativa | Vite reescreve ✓ |
| `<link rel="icon" href="./icon.svg">` | relativa | Vite reescreve ✓ |
| `<script src="./js/boot/boot.ts">` | relativa | Vite reescreve ✓ |

⚠️ **E `<base href="/" />` entra no `<head>`**, para que a engine resolva `/heavy/*` na raiz do domínio e
não dentro do subcaminho — é como o balde de heavy fica partilhado.

#### 2.4 `fetch()` e `BaseTexture.from()` com caminhos relativos — **medido, zero neste jogo**

📏 **Medido 2026-10-02** em `app/**`: `0` ocorrências de `fetch(` com caminho relativo e `0` de
`BaseTexture.from` ou `Texture.from`. Arte é toda procedural (crests, kits, bodies, pitch pintados em
`pixelCanvas`); o jogo não lê asset nenhum em tempo de execução.

**Então o passo 4 da ficha curta é «medida vazia» e não trabalho.** Fica escrito aqui com o número exacto
para que, se um dia aparecer um `fetch()`, a quarta ocorrência seja apanhada:

```ts
// A receita que vale para o platformer e, se surgir um fetch neste jogo, vale aqui também:
await fetch(`${import.meta.env.BASE_URL}caminho/do/asset.ext`)
```

#### 2.5 O cartucho (`createGame({ uses })`) — este jogo declara nenhum

- **`neuralVoice`**: NÃO. Já declinado em `declines: { noNeuralVoice: true }`; a Kokoro não vem.
- **`reading`**: NÃO. Nenhuma acomodação de leitura é oferecida (`accommodations.lexicalDifficulty = false`
  entre outras); a engine não precisa carregar os modelos de leitura.
- **`fonts`**: NÃO. O jogo desenha com `system-ui` e `ui-monospace` e com mais nada
  (medido 2026-09-11, válido ainda).

**Logo `uses` é omitido no `createGame`.** Documentar isso aqui é o que impede alguém de o adicionar «para
simetria» e carregar 300 MB de voz para um jogo que não lhe fala.

#### 2.6 As palavras do preset — **já estão nos três dicionários**

📏 **Medido:** `app/js/i18n/{en,pt,es}.ts` contêm as 23 chaves de `act.*` que `app/js/input/preset.ts` nomeia
(`labelKey: 'act.up'`, `hintKey: 'act.up.hint'`, …), nas três línguas. Isto é o portão de ouro deste track
já pago — o `word()` da engine lê só o dicionário do jogo (ADR-0010 pilar 3) e as linhas de «Mapear
teclado / controlo / toque» abririam vazias sem estas chaves. **Passo 6 da ficha: feito, verificado.**

### Parte 3 — o que ESTA faixa não resolve, e é pedido à sessão da engine

⚠️ **Nenhum destes é da nossa travessia; são restrições que a publicação revela e a engine tem de atacar.**
Ficam escritos aqui porque adoptar pausa e HUD únicos da engine (Decisão A da sessão da engine) tornou
visíveis perdas que só a engine conserta — e ignorar a lista é fingir que o jogo pode cobri-las sozinho:

1. **Pausa e HUD por assento numa raiz só.** Hoje a raiz desenha um cartão `#vp-pause-0`, uma barra e um
   HUD, todos do assento 0. START/SELECT dos jogadores 2–4 não abrem o cartão porque
   `leadsTheScreen === 0` (`create-game.js:2520`). Afecta um 1v1 directamente.
2. **Painéis editam as configurações do assento que `setPauseActor` indicou.** Hoje `blindMode`, `cbSafe`,
   `wheelchair`, `oneButton`, `hcOutlineFg`, `letterCase`, `captionsOn` são globais. **Decidido pelo Dev
   em 2026-10-02:** «só o jogador 1 pausa, mas cada um tem a sua própria configuração». A primeira metade
   a engine já cumpre; a segunda, ainda não.
3. **Cores por papel no painel visual** (`offer: { roles: false }`, `create-game.js:1476`): o painel visual
   já não oferece, e as cores que a criança guardou na v9 continuam a valer mas já não se mudam.
4. **«Sair» por assento** (hoje só sai do assento 0).
5. **Gamepad no título** cai no anel genérico — perde-se o `◀▶` sobre número de jogadores.
6. **`inclusionist-heavy --base` não gera no layout que o `/heavy/<host><path>` do CF Pages espera.** Hoje
   o espelho é feito à mão no disco do Dev (`~/Claude/inclusionist-heavy-mirror/heavy/`, 1,2 GiB) e copiado
   com `cp -r` para o `dist/`. **Ou a engine gera o layout certo, ou documenta que o espelho é cópia
   manual.** Em qualquer caso, a cópia manual é pré-requisito do nosso primeiro `git push` que publica.

### Parte 4 — a ficha curta deste jogo, com as linhas já medidas

1. `wrangler.toml`, `functions/heavy/[[path]].ts`, `scripts/post-build-cloudflare.mjs`, workflow — copiar de
   `game-platformer`, trocar `<slug>` para `game-soccer` e os `[vars]`.
2. `vite.config.ts` com `base` configurável por `INCL_BASE`.
3. `app/index.html` com `<base href="/" />`.
4. `fetch(...)` e `BaseTexture.from(...)` com caminho relativo → **medido zero, nada a fazer**.
5. `uses` → **omitido**, com a razão em `2.5`.
6. Chaves do preset nos três idiomas → **já em `app/js/i18n/{en,pt,es}.ts`, verificado**.
7. Linha do slug na tabela `GAMES` do Router Worker.
8. Primeiro `git push` para `main` dispara o build no CF Pages via integração GitHub. Se o CF Pages
   construir o SHA errado (dashboard mostra «Retry deployment» → mesmo SHA): empurrar um commit vazio OU
   «Create deployment» no dashboard.

⚠️ **E o espelho de heavy do Dev tem de estar pronto antes do passo 8**, por causa do pedido 6 à engine
acima. Sem ele a página carrega sem voz, sem visão, sem leitura — tudo o que mora em `/heavy/*` responde
404 e os painéis que o pedem ficam em erro silencioso.

## Decisões já tomadas pelo Dev

| Assunto | Decisão |
|---|---|
| Escopo | **O jogo inteiro**, não uma fatia fina. |
| Times | **Fictícios**, de escola/município, com escudos gerados e paletas nossas. Sem seleções reais, sem marca FIFA/Copa. |
| Relógio | **Três modos**: tempo real puro · tempo real com assistências explícitas · por lances (turnos). |
| Rede | **Não neste plano**, mas a simulação nasce preparada: passo fixo determinístico, RNG semeado, entrada como **comandos por tique**. |
| Multijogador local | Dois assentos no mesmo ecrã, uma câmera seguindo a bola. **Padrão: CO-OP** (os dois no mesmo time contra a CPU); 1v1 é opção que um adulto liga. |
| Competição vs ADR-0006 | Um registo novo **traça a linha** entre o que o 0006 combate (compulsão, sequências, ranking, liga, recompensa aleatória) e a disputa de uma partida que começa e acaba. O xadrez herda a linha em vez de continuar em silêncio. |
| Arte | **Procedural** (`pixelTexture`), sem PNG embutido; uniforme sai da paleta da equipa. |
| Engine | O jogo **não bloqueia**. Adaptação fina no repo do jogo enquanto o #103 não fecha; mudança na engine só com autorização. |

## O que a engine já entrega, e o que não

**Vem de graça, via `createGame()`:** ordem de boot, i18n com `registerDict`, leitor de tela
(`srSay`/`srAlert`), TTS Piper offline, mixer/earcons/jingles, **sonar espacial**, filtros de daltonismo,
alto contraste **por papel semântico**, pilha de cenas modal, matemática de câmera, juice, layout de
escala inteira travado em 320×180, tabela de Z, RNG semeável, e as **catorze ações** já escritas em
`core/actions.ts` com `GAMEPAD_STANDARD` já numerando L1=4, L2=6, R1=5, R2=7.

**Não existe, e o jogo constrói:** toda a simulação de bola e jogadores (o `app/js/game/physics.ts` da
engine é *inimportável de propósito* — `tests/engine-boundary.node.test.js` é o portão), passo de tempo
fixo (o laço hoje é variável e conta em **quadros**, não em segundos), **acorde**, **retenção-vs-toque**
geral, e **magnitude analógica** (`PadButtonLike` só declara `{pressed: boolean}`; `GamepadButton.value`
nunca é lido).

## O repositório

Molde: `SP-the-inclusionist-2048`, que é a referência mais completa. Segue ADR-0082 (repo
`game-<slug>` espelha o pacote), ADR-0083 (um jogo nasce no seu repositório e consome a engine como
pacote — não se constrói dentro da engine para extrair depois) e **ADR-0068 §5: um repositório de jogo
não tem pasta `adr/`, nunca**. Os registos moram na engine e são herdados.

```
C:\Users\candi\Claude\game-soccer\   → github.com/the-inclusionist/game-soccer
  app/index.html                     # marcação exigida: #game-region, #sr-status, #sr-alert (+ painéis)
  app/css/game.css
  app/js/…                           # ver decomposição adiante
  tests/*.node.test.ts               # lógica pura
  tests/*.browser.test.ts            # render e DOM, Chromium via Playwright
  scripts/copy-engine-assets.mjs     # clone do 2048 — require.resolve do fonts.css da engine
  scripts/axe-check.mjs
  docs/CREDITS.md  docs/LICENSES.md  # só o que é próprio: arte, créditos, termos de terceiros
  .github/workflows/ci.yml           # 4 linhas: uses: …/game-ci.yml@main, with: a11y: true
  LICENSE                            # AGPL-3.0-or-later
  package.json                       # @the-inclusionist/game-soccer, private:true, node>=24
```

`dependencies`: `"@the-inclusionist/engine": "^8.0.0"` e `"pixi.js": "7.4.2"` **exato** — duas cópias do
Pixi numa página é bug, não alternativa. `vite.config.ts` com
`optimizeDeps.exclude: ['@the-inclusionist/engine']` e os dois projetos de Vitest.

> ⚠️ **Aterrou, e o `file:` morreu.** O parágrafo original deste plano dizia
> `"file:../SP-the-inclusionist-tracer"` e explicava, com a medição do whackwhack
> (`docs/ADR-0083-conformidade-medida.md`), que `file:<diretório>` é `npm link` com outra grafia — o
> `node_modules` fica com um symlink que passa por cima do campo `files`, e um defeito de empacotamento
> permanece invisível até alguém instalar de fora. A engine foi publicada em 2026-09-06 e este
> repositório deixou de ser caso especial no mesmo dia. **A frase antiga fica citada e não apagada**,
> porque a razão dela é o que continua a valer: o `package.json` carrega hoje o `comment:dependencies`
> que a explica.
>
> ⚠️ **E a secção adiante sobre o cartucho muda três destas linhas.** `private: true` cai, a engine e o
> Pixi passam a `peerDependencies` **e** `devDependencies`, e o `vite.config.ts` ganha um segundo
> destino de build. Nada disso é feito antes do whackwhack (ADR-0068 §6).

## O cartucho — o que este repositório passa a ser

Material de origem, lido em 2026-09-11: `the-inclusionist-site/docs/cartridge-brief.md`,
`cartridge-contract.md` e `architecture.md`, e os registos **ADR-0139** (um cartucho fornece metade do
`CreateGameOptions` e nunca chama `createGame`), **ADR-0140** (PWA autónomo *e* cartucho, de uma só
fonte), **ADR-0141** (um cartucho é dono da sua corrente aleatória), **ADR-0142** (a engine monta e
desmonta um cartucho) e **ADR-0117** (a unidade de instalação é o *site*, não o jogo).

⚠️ **Os três documentos do site são a leitura longa; a decisão mora nos registos.** O próprio
`architecture.md` diz por que: a forma foi escrita primeiro lá, onde vinculava seis repositórios de
dentro de um deles, o ADR-0068 §5 existe exactamente contra isso, e o Dev apanhou. Onde divergirem,
ganham os ADRs.

### A mudança de topologia, em uma frase

A criança abre **uma origem**. Uma PWA, um *service worker*, uma instalação. A plataforma monta a barra
de acessibilidade, o cartão de pausa, os filtros de daltonismo, o TTS, o sonar, o painel de opções e o
runtime de teclado **antes de qualquer código nosso correr**. O nosso jogo é o ecrã 3 e nada mais.

E a razão não é gosto: o Cache Storage é particionado por origem, então um jogo por origem seria um
*service worker*, um precache e um conjunto de preferências de acessibilidade **por jogo** — nenhum dos
quais segue a criança de um jogo para o seguinte.

### O que já está conforme, medido neste repositório hoje

⚠️ **Isto não foi assumido das tabelas do site: aquelas medem seis jogos e este não é nenhum deles.**
Medido a 2026-09-11 contra a nossa própria árvore:

| Exigência | Estado | Onde |
|---|---|---|
| Sem auto-boot; o boot é uma fábrica | ✅ **já** | `boot/main.ts` — `bootar(doc, win)`, e o cabeçalho explica por que: o 2048 mediu um boot duplo vindo de uma linha no fim do ficheiro |
| Sem `let` em escopo de módulo (D14) | ✅ **já** | todos os `let` vivem dentro de `bootar` |
| Já devolve um *teardown* | ✅ **já** | `Booted.stop()` — desmonta a cena, o ticker e os dois ouvintes do documento |
| Não importa `rnd`/`randInt`/`shuffle`/`reseed` (ADR-0141) | ✅ **já** | `teams/clubs.ts` e `teams/roster.ts` usam `createRng`, que é corrente própria |
| Não lê `location.search` | ✅ **já** | zero ocorrências; `ctx.params` não tem o que corrigir aqui |
| Engine a par | ❌ **não, e é a dívida** | `^9.0.0` com a engine em **11.0.0** — duas *majors* atrás. ⚠️ Esta linha era «Engine 8 ✅ já, sem a divergência que o platformer tem»: hoje é o platformer que está a par (`^11.0.0`) e nós que divergimos |
| É PWA em modo autónomo | ✅ **já** | `manifest.webmanifest` + `scripts/build-sw.mjs`, com orçamento de precache no CI |
| Dicionários exportados | ✅ **já** | `i18n/index.ts` exporta `DICTS` congelado, além de `installDicts` |
| Pixi pinado no peer exacto da engine | ✅ **já** | `7.4.2` |
| Teclado em `#game-region`, não em `window` | ✅ **já** | e a memória do projeto registra a armadilha |

**Nove das exigências do *brief* já estão pagas.** A razão é que este repositório nasceu depois dos
seis e herdou as medições deles — o boot duplo, o `file:`, o teclado na `window`. O trabalho que resta
é pequeno e é específico.

### O que falta, e cada item é uma linha do contrato

1. **`bootar` chama `createGame`** (`boot/main.ts:154`). ADR-0139 §2 é a cláusula de que as outras
   pendem: o cartucho **fornece** metade do `CreateGameOptions` e quem o hospeda chama `createGame` —
   uma vez. Seis chamadas deduplicam os bytes e multiplicam o runtime: N barras de acessibilidade, N
   TTS, N runtimes de teclado a disputar um documento. É pior do que enviar a engine duas vezes, porque
   aparece como defeito e não como peso.
2. **`bootar` chama `startLoop`** (`:849`). O laço é do shell. ⚠️ E a conversão aqui é mecânica de um
   jeito que vale dizer: o *callback* que hoje entregamos ao `startLoop` é uma closure dentro de
   `bootar`, e é **exactamente** o `update(dt)` que o `GameInstance` pede. Não há nada a escrever — há
   uma closure a devolver em vez de a entregar.
3. **Não existe `src/index.ts`** exportando o `Cartridge`: `slug`, `declaration`, `dicts`, `hooks`,
   `create(ctx)`.
4. **`create(ctx)` tem de consumir o `ctx`** em vez de construir o mundo: `ctx.engine` (o que
   `createGame` devolveu), `ctx.region` (onde `#pitch` é procurado hoje), `ctx.rng`, `ctx.t`,
   `ctx.params`.
5. **Sem destino `lib`.** `vite.config.ts` ganha dois destinos de um só ficheiro, comutados por modo:
   **app** (hoje: engine embutida, PWA ligada, entrada `app/index.html`) e **lib** (`build.lib`,
   `formats: ['es']`, `external` para a engine e o Pixi, sem HTML e sem *service worker*).
6. **`package.json`**: `private: true` cai; entram `exports` e `files`; a engine e o `pixi.js` passam a
   estar declarados **duas vezes** — `peerDependencies`, para o consumidor instalar uma cópia só, e
   `devDependencies`, para um clone limpo continuar a construir e a testar-se sozinho. ⚠️ Não é
   redundância: `peerDependencies` **não instala nada**.
7. **Os dois ouvintes fora da região.** `win.addEventListener('blur', …)` (`:272`) e
   `doc.addEventListener('keydown', routeToPanel, true)` (`:534`). O `stop()` já os remove — e o
   cabeçalho do `stop()` já diz por que, citando o anfitrião de demonstração da engine que troca de
   jogo sem recarregar. A regra do cartucho é mais forte do que "remove no fim": escreve-se **dentro**
   da região e o que ficar fora é um defeito com endereço.
8. **O calço do `@mintplex-labs/piper-tts-web`.** Está em `dependencies` para tapar um furo do pacote da
   engine. Num mundo de *peers* isso precisa de decisão própria, e a memória do projeto já registra que
   ele sai no dia em que a engine declarar o import.

### O que NÃO muda, e é bom que esteja escrito

As nossas regras, os nossos testes, a nossa arte, o conteúdo da declaração, a licença e o
`docs/CREDITS.md` (ADR-0068 §1). Nenhuma pasta `adr/` neste repositório, nunca (ADR-0068 §5).
Artefactos em inglês; pt-BR só onde é conteúdo de produto. `dt` contado em **quadros**, não em segundos.

⚠️ **E o ADR-0142 não nos pede nada — e desde 2026-09-11 já está CONSTRUÍDO.** O registo foi lido com
«⚠️ NOT BUILT, so no `confirmed-by`» e a engine 9.0.0 implementou-o: `Engine` ganhou
`mount(declaration, ganchos?)` e `unmount()`, o `create-game.js` passou a guardar um ponteiro
`cartucho` mutável, o `declines` virou função que lê por ele, os problemas do hospedeiro e os do
cartucho separaram-se, e o `REACH_NOTICE_ID` entrou para o aviso de alcance poder ser **retirado** —
que era a única coisa que o registo dizia que «no amount of shell code» alcançava.

⚠️ **O QUE ISSO PAGA É A DÍVIDA DO ADR-0139 §5**, e é a única linha deste plano que muda por causa
dele. Aquela cláusula dizia que `engine.problems` e `engine.alcance` não são de confiança em modo
plataforma e que o shell teria de re-executar o `conformanceProblems` por conta própria — «a duplicate
of a diagnostic the engine owns, and it is a debt, not a design». Já não há o que duplicar: o próprio
`mount` diz que os dois «descrevem o cartucho montado porque são DERIVADOS, não porque o `mount` os
copie». E lança numa declaração malformada em vez de a pôr em `problems`, porque o contrato é
pré-condição e não diagnóstico.

⚠️ **E NADA MAIS NESTE PLANO MUDA.** Um cartucho continua a fornecer metade do `CreateGameOptions` e a
nunca chamar `createGame`; os passos 10 a 14 abaixo são os mesmos. O que deixa de existir é o shell da
plataforma herdar um diagnóstico que ele sabia estar errado.

### A ordem, e ela diz para não começar

⚠️ **O ADR-0068 §6 manda um jogo ir de ponta a ponta antes de os outros começarem**, e o *brief* é
explícito sobre quem: **whackwhack** — a *build* mais pequena (344 KB), já na engine 8, com CI e 24
ficheiros de teste, e só o Zdog como dependência pesada de render. E o *brief* diz a frase toda:
*"se você não é o whackwhack, espere que o contrato volte com os seus buracos preenchidos."*

**Não somos o whackwhack.** Então o que esta secção manda fazer agora é o que é grátis e não depende do
contrato assentar:

- **Nada de conversão.** Nem `src/index.ts`, nem destino `lib`, nem tirar o `private`.
- **Não regredir o que já está conforme.** As nove linhas verdes acima são fáceis de perder sem ninguém
  notar: um `let` em escopo de módulo, um `import { shuffle }`, uma leitura de `location.search`, um
  `startLoop` num sítio novo. ⚠️ **Isso é portão, não boa intenção**, e é o único trabalho de cartucho
  que faz sentido hoje (ver *Verificação*).
- ~~**Manter a engine em 8.**~~ ⚠️ **CORRIGIDO a 2026-10-02, e a frase fica citada porque a razão dela é o
  que continua a valer:** «um jogo uma *major* atrás é uma decisão, não um acidente a descobrir em produção».
  A engine foi a 9.0.0, depois a 10.0.0 e a 11.0.0, e o jogo ficou **duas** atrás — que é precisamente o
  acidente que a frase recusava. A travessia é a secção **A migração para a engine 11.0**, no topo deste
  ficheiro, e corre antes de tudo o resto.

### Três coisas que não se inventam

O *brief* nomeia-as, e o ADR-0139 repete-as na sua própria secção de "não decide":

- **A forma exacta do `ctx`** deriva-se do que o `CreateGameOptions` já toma; não se projecta de novo.
- **De quem é o `declines`** — lê-se como afirmação sobre o que um *jogo* não tem, o que o poria em
  `CartridgeHooks`, mas o `createGame` também devolve um `declines` resolvido. A direcção lê-se da
  implementação. ⚠️ E o nosso `boot/main.ts:301` já tem uma nota dizendo que o campo não existe aqui
  ainda, que é a mesma pergunta vista do outro lado.
- **A política de semente** — quem escolhe a semente de um cartucho, e se uma corrida é reprodutível
  entre shells. ⚠️ **E esta é a que nos morde**, porque a nossa simulação é determinística por desenho e
  o resumo FNV-1a é ao mesmo tempo o detector de dessincronia e o teste de mestre-dourado. Um cartucho
  cuja semente o shell escolhe é um mestre-dourado cuja premissa mudou. Pergunta a fazer, não a
  responder aqui.

### E uma leitura que é nossa e vale registar

⚠️ **O `createRng(i * 2654435761 + 17)` de `teams/roster.ts` é uma excepção fundamentada, não uma
infracção.** O ADR-0141 proíbe os quatro imports partilhados e manda tomar `ctx.rng`; o que temos é
`createRng`, que é corrente independente, semeada a partir do **índice do clube** de propósito, para
que o escudo e o uniforme do clube 3 sejam os mesmos em qualquer partida e em qualquer shell. Passar a
`ctx.rng` faria a cor de um clube depender de quantas vezes a corrente já foi consultada — que é
precisamente o defeito que o registo combate, entrando pela outra porta. O cabeçalho de `clubs.ts` já
diz que o que este ficheiro produz é **cor**, que nunca entra na simulação.

## Licenciamento e proveniência

- Código: **AGPL-3.0-or-later**; titularidade econômica do **Município** (Lei 9.609/1998 art. 4), como
  em `docs/LICENSES.md` da engine.
- Arte procedural: **é programa, logo AGPL** — decidido pelo Dev em 2026-09-06. Nenhum ficheiro de arte
  é versionado; o que existe é a função que pinta, e ela é código sob AGPL com o Município como titular.
  O `docs/LICENSES.md` do jogo diz isso em uma frase e não promete mais do que isso.
  A emenda de 2026-08-27 ao pilar 10 ("não existe arte própria a licenciar", porque a arte desenhada do
  projeto é de terceiro sob a licença da autora) continua a valer para **arte desenhada** — este jogo
  simplesmente não tem nenhuma.
- `docs/CREDITS.md` credita a origem do gênero e o `open-soccer` como referência de paridade, dizendo
  explicitamente que **nenhuma linha e nenhum dado dele foi herdado**.
- Disciplina de sala limpa, escrita no README: as features vieram do **README** do `open-soccer` e da
  lista de nomes de ficheiros; **o fonte dele não é lido** por ninguém que escreva este jogo.
- Sem seleções nacionais, sem escudos de federação, sem marca FIFA ou "Copa 2026". Times fictícios.

---

## Os pilares que este jogo tem de satisfazer, e o que cada um força

Os dez pilares do ADR-0010 são a constituição, e futebol encosta em mais deles do que o 2048 encostou.

| Pilar | O que força neste jogo |
|---|---|
| **1 · Hardware fraco de escola pública** — 60fps em 320×180 num tablet Positivo/Chromebook | É a restrição de engenharia dominante. Vinte e dois agentes, uma bola e regras a 60Hz num tablet barato **não sobrevivem a uma IA ingênua por jogador por quadro**. Orçamento de CPU é requisito, não afinação. |
| **2 · Acessibilidade** — WCAG 2.2, **texto sempre no DOM** | O HUD (placar, relógio, nome de quem você controla) é DOM sobre o canvas, como o 2048 fez com os números. O canvas não carrega texto. |
| **3 · i18n real**, zero string cravada | pt-BR, en, es desde o primeiro commit, por `registerDict`. Um gate impede chave só num dicionário. |
| **5 · Grade 320×180** | Um campo inteiro não cabe: a câmera **tem** de seguir a bola, o que por acaso é exatamente a feature de paridade (tele cam). |
| **7 · Multijogador em ecrãs separados, sem split-screen** — N viewports, uma sim | **Lido pelo Dev em 2026-09-06:** o pilar existe contra *dividir* o ecrã, que a 320×180 cortaria a resolução útil pela metade. Duas crianças a olhar o **mesmo campo inteiro** é o oposto disso. Os dois assentos partilhados seguem, e essa leitura fica escrita no README do jogo, junto com o desvio. |
| **8 · Offline (PWA)** | Nada de rede em tempo de jogo; o precache tem orçamento no CI. |
| **10 · Aberto, livre, sem *dark pattern*** (com ADR-0006 e ADR-0049) | **Sem loop de compulsão, sem recompensa aleatória, sem placar persistido.** Ver abaixo. |

E dois registos cortam features que o jogo de referência tem:

- **ADR-0037 — não há save e não se guarda nada sobre uma criança.** Então: sem carreira, sem
  progressão entre partidas, sem recorde persistido. A partida vive e morre na sessão. O que *pode*
  persistir é preferência de acessibilidade e remapeamento, que é sobre o **dispositivo**, não sobre a
  criança (`platform/storage.ts`, `kJogo(name)`).
- **ADR-0006 + ADR-0049 — sem compulsão, e toda recompensa é determinística.** Nada de sorte a decidir
  um lance: o resultado sai de perícia e posição. As notas por equipa modulam de forma **determinística**
  e legível, e o RNG semeado serve reprodutibilidade, não loteria.

E o mais interessante: **`tick`**. O 2048 satisfazia a WCAG 2.2.1 (Timing Adjustable) *por construção*,
com `tick: 'player'`. Futebol em tempo real não pode. É por isso que os três modos de relógio não são
enfeite — são **como este jogo paga a 2.2.1**: o modo por lances satisfaz por construção, o modo com
assistências satisfaz por ajuste, e o modo puro existe porque um adulto pode escolhê-lo com os outros
dois disponíveis ao lado.

## Inventário de paridade — o que "o jogo inteiro" quer dizer

Esta lista veio do **README** do `open-soccer` e da lista de nomes de ficheiros do repositório dele.
Nenhuma linha do fonte dele foi lida, e nenhuma será. É a lista de *features*, e é contra ela que se
mede "pronto".

| # | Feature do jogo de referência | Como fica aqui |
|---|---|---|
| 1 | Partida 11v11 arcade contra a CPU | Igual, com IA nossa |
| 2 | Câmera de transmissão pseudo-3D seguindo a bola, com suavização, deslocamento em profundidade e paralaxe de estádio | Igual, dentro de 320×180 e em pixel inteiro (ADR-0001) |
| 3 | Saída de bola, lateral, escanteio, tiro de meta, impedimento, fim de jogo | Igual, como máquina de estados |
| 4 | Modo treino — campo livre com um goleiro e sem estrutura de partida | Igual |
| 5 | 48 seleções com uniformes, uniformes reserva, escudos e notas por equipa | **Times fictícios** de escola/município, escudos gerados, paletas nossas, notas nossas |
| 6 | Chute e passe **carregam enquanto o botão é segurado** e disparam ao soltar | Igual, **mais** a alternativa aperta-para-começar/aperta-para-soltar (WCAG 2.5.1) |
| 7 | Teclas remapeáveis persistidas em `localStorage` | Vem **de graça** da engine: remapeamento de teclado, assistente de pad por modelo de comando e slots de toque, todos já persistidos |
| 8 | — | **A mais:** leitor de tela, sonar espacial, alto contraste por papel, varredura, Libras, TTS offline, três idiomas, três modos de relógio, dois assentos no mesmo ecrã |

O item 8 é o ponto: a paridade é o piso, não o teto. O que a engine dá de graça é o que torna este jogo
diferente do que estamos a reimplementar.

## O esquema de controlo

A engine já tem as catorze posições (`core/actions.ts`), e o `GAMEPAD_STANDARD` de
`input/default-bindings.ts` já numera todas. O jogo fornece as **palavras**; a engine só conhece
**posições** (ADR-0074, mantido pelo ADR-0086).

| Posição da engine | Pad | O jogo chama | Semântica |
|---|---|---|---|
| `up`/`down`/`left`/`right` | direcional | Move | contínuo |
| `action1` **e** `leftTrigger` | botão 1 e L2 | Sprint | contínuo, duas ranhuras para uma ação (ADR-0079 permite) |
| `action2` | botão 2 | Shot / Tackle | contextual; **carrega** ao segurar |
| `action3` | botão 3 | Short pass | contextual; **carrega** |
| `action4` | botão 4 | Long pass / Slide | contextual; **carrega** |
| `rightShoulder` | R1 | Through pass | **carrega** |
| `rightShoulder` + `rightTrigger` | R1+R2 | Lofted through ball | **acorde** |
| `rightTrigger` | R2 | Switch player | toque |
| `leftShoulder` | L1 | Contain / jockey | **retenção** |
| `start` | Start | Pausa | sistema |
| `select` | Select | (livre) | sistema |

Três coisas nesse quadro **não existem na engine hoje** e são o coração do trabalho de input:

1. **O acorde.** R2 sozinho troca de jogador, R1+R2 é lançamento por cobertura — logo o R2 do acorde
   **não pode** disparar a troca. Existe exatamente um acorde no repositório inteiro, cravado no
   platformer (`app/js/game/physics.ts`, `swap` + `especial`); não há mecanismo geral.
2. **Retenção-vs-toque e a carga.** O padrão da casa é ad-hoc (`_swapT > 18` quadros ≈ 0,3s). O
   **ADR-0077 já decidiu** que isto vira opção por ação e por jogador — e diz na sua própria secção de
   confirmação que ainda não passa.
3. **Magnitude analógica.** `PadButtonLike` declara só `{pressed: boolean}` e `GamepadButton.value`
   nunca é lido; a zona morta é uma constante global `PAD_DEAD = 0.5` (metade do curso, por ergonomia,
   ADR-0013). Para um jogo de esporte isso é grosso: gatilho e analógico ficam liga/desliga.

E há uma **colisão medida** que o ADR-0085 já registou e entregou à issue #103:
`input/gamepad.ts` faz hoje `run: b(2) || b(5) || b(7)` — ou seja, **R1 e R2 já estão presos ao `run`**
do platformer. Sem o #103, ligar R1/R2 ao futebol produziria ação dupla intermitente, que aparece como
esquisitice e não como erro.

### O acorde, resolvido

Regra: **R1 é a âncora, R2 é modificador enquanto uma carga de R1 estiver aberta, e o verbo próprio do R2
é adiado por uma janela de tolerância.**

1. R1 desce → abre carga `through` com `lofted = R2 já segurado`. **Não dispara nada.**
2. R2 desce → se há carga aberta, marca `lofted = true` e **não dispara nada**; senão arma uma *troca
   pendente* com prazo `tique + CHORD_GRACE`.
3. R1 desce com troca pendente → **descarta a pendente** e abre a carga com `lofted = true`.
4. A pendente resolve no que vier primeiro, soltar o R2 ou o prazo → emite **uma** troca.
5. R1 sobe → emite **um** `through` com `power`, `powerStep`, `lofted`; limpa a carga.

`CHORD_GRACE` = **3 tiques (50 ms a 60Hz)**, por jogador, ajustável de 0 a 12. Em 0 a reinterpretação
some: R2 primeiro sempre troca, R1 primeiro sempre faz acorde.

Por que não pode disparar duas vezes: cada aresta física mapeia para **no máximo um** comando, e as duas
guardas (`cargaAberta` e `trocaPendente`) são limpas na mesma instrução que dispara. Nenhuma descida de
R2 pode produzir troca **e** lançamento por cobertura. Prova exaustiva: as 24 ordenações das quatro
arestas, num teste (adiante).

`lofted` é **pegajoso** pela vida da carga — soltar o R2 no meio ainda dá bola por cobertura. Exigir os
dois segurados até o fim dobra a exigência motora sem ganho de jogo e faz o resultado depender de um
milissegundo.

### E o que a criança de um único acionador recebe

O `oneButton` da engine **solta todas as outras teclas de jogo** quando uma nova chega
(`input/keydown.ts:407`). Acorde ali é estruturalmente impossível. Então:

> **O acorde vira modificador travado.** Um acionamento *arma* "cobertura"; o `through ball` seguinte
> consome e desarma. É exatamente o StickyKeys, que é o precedente do próprio sistema operativo para
> este problema, e é o argumento do ADR-0077 §2 uma camada adiante.

A cláusula que proponho para o registo: **um acorde sem equivalente travado é falha de conformidade** —
a engine só pode oferecer acorde onde o mesmo resultado é alcançável por acionamentos únicos.

⚠️ **Defeito da engine achado de passagem:** o `oneButton` só é honrado no caminho do teclado. O
`pollPads` não tem equivalente — uma criança em modo de um botão **com um pad ligado não está em modo de
um botão**. É um buraco silencioso no pilar 2 e merece issue própria.

### A carga, e a alternativa obrigatória

`power = minPower + (1 - minPower) · clamp01((segurado - dead) / (max - dead))`, linear, acompanhada de
um **`powerStep` discreto de 1 a 5**.

⚠️ **`minPower > 0` não é arredondamento, é a acomodação.** Um toque tem de produzir um passe utilizável.
Se toque dá potência zero, a criança que não consegue segurar recebe um passe que não anda e conclui que
o jogo está quebrado. É a primeira asserção do ficheiro de teste.

Linear e com passo contável porque **uma barra não serve a quem não vê**: "três de cinco" serve, com um
tom por passo. É a mesma lição do `{have} de {need}` do 2048.

Três sub-modos, porque o ADR-0077 já decidiu que retenção-vs-trava é opção **por ação e por jogador**:

| modo | como | exige tempo? |
|---|---|---|
| `hold` | aperta, segura, solta (padrão) | sim, contínuo |
| `latch-timed` | aperta começa, o relógio enche a barra, segundo aperto dispara | **ainda sim** |
| `latch-stepped` | cada aperto avança um `powerStep`; uma pausa sem aperto dispara | **nenhum** |

⚠️ `latch-timed` sozinho **não basta** — tira o segurar e mantém o cronometrar, que é metade da barreira.
`latch-stepped` é a resposta honesta, e é o padrão sempre que `oneButton` ou varredura estiver ligado.

E um limite de tempo obrigatório: uma carga que passe de `max + tolerância` **dispara sozinha e limpa**.
Isso não é regra de jogo, é **WCAG 2.1.2 (No Keyboard Trap)** — um acionador preso não pode congelar a
jogadora para sempre.

### WCAG, citado com honestidade

- **2.2.1 Timing Adjustable (A)** — *literal, e morde*. Janela de carga, tolerância do acorde e disparo
  automático são todos limites de tempo. Conformidade por duas vias ao mesmo tempo: **ajustável** (tudo é
  opção) e **removível** (`latch-stepped` não tem relógio). O modo por lances herda inteira a construção
  do 2048.
- **2.1.1 Keyboard (A)** — *literal, e é o que de facto governa o caso de um acionador*, porque uma
  interface de acionador se apresenta como teclado.
- **2.5.1 Pointer Gestures (A)** — ⚠️ **por analogia, e o registo tem de dizer isso.** O 2.5.1 governa
  gestos de *ponteiro*; um acorde de comando não é gesto de ponteiro. A analogia é exata em substância e
  inexata em letra, e reivindicar conformidade literal aqui seria a desonestidade em massa que o
  ADR-0010 proíbe.

## A fronteira: o que é da engine e o que é do jogo

O critério é o do 2048 — *um consumidor vale mais do que o próprio ecrã: é a única coisa que mede o que
uma engine de facto entrega.* E este jogo mede muito, porque **é o primeiro consumidor a saturar o
conjunto**: futebol usa as catorze posições.

| Capacidade | Lado | Porquê |
|---|---|---|
| **Resolução de acorde** | **ENGINE** | Um acorde é propriedade de *como um transporte é operado*, e todo transporte precisa da mesma resposta. Construído no jogo, o segundo jogo constrói de novo — e **o equivalente travado, que é a parte que importa, só existe onde alguém lembrou**. É o argumento M3 do ADR-0077 palavra por palavra. |
| Quais pares são acorde, e o que significam | JOGO | Significado. `R1+R2 = bola por cobertura` é palavra, e palavra é do jogo (ADR-0074). |
| **Retenção-vs-toque e a carga** | **ENGINE** | O ADR-0077 já decidiu que é opção por ação e por jogador, e rejeitou o M3 pelo nome. Uma carga é essa decisão **com uma magnitude**. No jogo, é o M3 reconstruído com um campo a mais, trezentas vezes. |
| Os números da curva (`min`, `dead`, `max`, `N`) | JOGO | Afinação. |
| **Magnitude analógica** (`GamepadButton.value`, valor de eixo) | **ENGINE** | ⚠️ **Um jogo não recupera um número que o transporte já deitou fora.** O próprio `default-bindings.ts` diz: *"`padActions` só lê `pressed`, o que funciona mas descarta o curso do gatilho."* |
| **Zona morta configurável** | **ENGINE** | `PAD_DEAD = 0.5` é `const` de módulo, global a todo jogador e todo pad. **As duas crianças deste 1v1 podem precisar de valores opostos** — um tremor pede mais, uma amplitude limitada pede menos — e um jogo nunca vê o eixo. |
| **Arte e nome falado de L1/L2/R1/R2/select** | **ENGINE** | `PAD_DESIGNS` cobre só os botões 0–3. Qual silkscreen um pad carrega é conhecimento de hardware — o ADR-0086 recusou `L1` como vocabulário *precisamente porque* a Nintendo escreve `ZL`. |
| **Assistente de pad de 9 para 14 passos** | **ENGINE** | Dois defeitos de uma vez: os rótulos são **literais pt-BR cravados** (`'CIMA'`, `'PULAR'`), contra o pilar 3; e são as palavras do platformer dentro da engine. Forma certa: **`PADWIZ_STEPS` vira lista ordenada de `Action`, e o rótulo vem do preset do jogo**, resolvido ao vivo — mata os dois defeitos e pergunta *"aperte: PASSE CURTO"* no idioma da criança. |
| **"Este transporte não carrega este jogo"** | **ENGINE** | A confirmação do ADR-0079 §3 exige a frase e marca-a como não construída. Toque tem **9 ranhuras**; futebol usa **14**. Este é o primeiro caso que força a conta. |
| `gamepadconnected` / `disconnected` | ENGINE | Nada escuta; um pad perdido faz o laço `continue` **em silêncio**. Num 1v1 isso é uma criança cujo jogador deixa de existir sem mensagem. |
| O `ActionPreset` (palavras e dicas) | JOGO | É o ponto inteiro do ADR-0074. |
| O registo de comando e o amostrador | JOGO | A engine não tem simulação e não deve ganhar uma. |
| Resolução contextual (chute vs desarme) | **JOGO (sim)** | Significado, e depende de estado do mundo que a camada de entrada **não pode** ler. |
| Assistências (mira automática, passe assistido) | **JOGO (sim), como MODO declarado** | Mudam *probabilidade* → são **regra**, não operação (ADR-0046). Carga, trava, zona morta e tolerância não mudam nem alcance nem probabilidade → são **operação**, e a engine oferece-as sem o jogo poder recusar. |

### Os três registos a propor na engine

Redijo e **apresento**; escrevo só depois do seu sim, e por **supersessão, nunca emenda no lugar**
(ADR-0057), em `docs/2-Architecture/adr/` da engine — nunca no repo do jogo (ADR-0068 §5).

1. **"Um acorde é ranhura derivada, e todo acorde deve um equivalente travado"** — supersede em parte o
   ADR-0079 (ranhuras são singulares) e estende o ADR-0077 §2.
2. **"Segurar é magnitude, não booleano — uma carga é facilidade de controlo com piso de toque e trava
   por passos"** — supersede em parte o ADR-0077 §2.
3. **"Uma ranhura pode ter FAIXA, a zona morta é por jogador, e 0,5 passa a ser o padrão"** — supersede em
   parte o ADR-0079 e o ADR-0013.

Mais dois:

4. **O registo de endereço** (ADR-0067/0082), que declara `the-inclusionist/game-soccer`, como o ADR-0081
   fez pelo 2048.
5. **"O que o ADR-0006 proíbe é o loop de compulsão, não a disputa de uma partida"** — supersede em parte
   o ADR-0006 na cláusula `&coop`. Traça a linha: sequência, ranking, liga, recompensa aleatória e placar
   persistido continuam proibidos; uma partida que começa, acaba e não deixa rasto não é o que o registo
   combate. Consulta o ADR-0008 ("a turma joga junta") e regulariza o **`game-chess`, que já é competitivo
   e nunca escreveu uma linha sobre isto** — é o registo a apanhar uma dívida do ecossistema, não uma
   licença escrita para este jogo.

⚠️ Antes de qualquer escrita lá: `git log --oneline -5` e
`python scripts/validate-adr.py docs/2-Architecture/adr`. Foram exatamente estas duas verificações que
faltaram nas duas colisões anteriores — número de ADR já usado, e uma âncora que engoliu a aspa de fecho
do ADR-0068.

## A adaptação enquanto o #103 não fecha

`app/js/input/shim-catorze.ts`, no repo do jogo, com **uma** função: ler `navigator.getGamepads()` e um
conjunto de teclas, e produzir um registo `Held` sobre as catorze ações — **usando as tabelas da própria
engine** (`ACTIONS`, `KEYBOARD_SOLO`, `GAMEPAD_STANDARD`, todas já exportadas e já com portão de teste).
Não inventa vocabulário nem tabela; ~60–80 linhas.

O que o torna descartável: **a única saída dele é `Held`**, e `chord.ts`, `charge.ts` e `command.ts`
consomem mais nada. Esses três são módulos-folha puros, sem import de jogo — então, se os registos
acima passarem, promovê-los para a engine é **mover ficheiro, não reescrever**.

O teste que o mata: `tests/shim-has-an-expiry.node.test.ts` **sonda o pacote da engine instalado** pela
capacidade que o shim substitui (o `padActions` devolve as catorze chaves? alimentar um pad falso com
`{pressed:true, value:0.4}` produz magnitude ou só booleano?) e afirma *"a engine ainda não faz isto"*,
falhando com a mensagem:

> `#103 landed — delete app/js/input/shim-catorze.ts and this test.`

⚠️ E a mensagem é obrigatória, porque um teste que fica vermelho quando uma dependência **melhora**
parece uma quebra: sem essa frase, a próxima pessoa "conserta" apagando a asserção em vez do shim.

⚠️ **Pré-requisito real:** o shim assume o formato que o #103 vai produzir. Se o #103 aterrar num formato
diferente, o shim não morre — **traduz para sempre**. O formato do `Held` precisa de ser combinado com
quem está a executar o #103 antes de o shim ser escrito.

## A simulação

### A métrica: metros e segundos — não azulejos, não pixels

`TILE = 16` é constante de grade de azulejos e aqui não há grade. Pixel é facto de **renderização** e
mora só em `project.ts`.

```
PITCH  = { length: 90, width: 56 }   // metros, encolhido do 105×68 real, para arcade
PACE_M = 1.5                          // o passo — a unidade que a criança conta
GOAL   = { width: 7.0, height: 2.44 }
```

### Passo fixo dentro de um laço de passo variável

O `startLoop` entrega `PIXI.Ticker.deltaTime`, que é **quadro**, não segundo. Converte-se **uma vez**, na
fronteira, e nunca mais: `ms = dtQuadros · (1000/60)`, e um acumulador roda `step()` a `DT = 1/60`
exato, literal, nunca derivado de tempo medido.

⚠️ **O `maxDt = 2` padrão tem de subir.** Dois quadros ≈ 33 ms; com acumulador, um engasgo de 200 ms
entrega só 33 ms de tempo simulado e a simulação **fica para trás do relógio de parede, para sempre, uma
vez por engasgo**. Passa-se `maxDt = 6` (≈100 ms), com `MAX_TICKS_PER_FRAME = 6` e um contador de tempo
descartado visível no painel de depuração. Descartar tempo é seguro **porque o fluxo de comandos é
indexado por tique, não por relógio de parede**.

### Uma simulação, três condutores

`step(state, frame, ctx) → state` é função pura: não lê relógio, nem dispositivo, nem `Date.now`, nem
`Math.random`. Tudo o que um modo muda está em **quem preenche o `frame` e quando `step` é chamado**.

- **tempo real** — acumulador clássico.
- **com assistências** — o *mesmo* acumulador com `acc += ms · tempo` (0,5 / 0,75 / 1,0). **`DT` não se
  toca**, então a física é idêntica bit a bit em qualquer ritmo; o mundo apenas recebe menos tempo de
  parede. Mais pausa em qualquer ponto, relógio ajustável ou ausente, e limiar de carga configurável.
- **por lances** — sem relógio nenhum. Roda `step` em rajada até `isDecisionPoint()`, congela e espera um
  comando comprometido. A WCAG 2.2.1 é satisfeita **por construção**, como o 2048 fez.

A afirmação que torna isso *uma* simulação e não três é testável, e é o portão mais valioso do plano:
**o mesmo fluxo de comandos pelo condutor de tempo real e pelo de lances produz o mesmo resumo (digest).**

### O modelo de comando

```ts
type Verb = 'none'|'pass'|'through'|'lob'|'shoot'|'tackle'|'switch';
interface Command {
  readonly tick: number; readonly seat: number;
  readonly dx: number; readonly dy: number;   // -1..1, quantizado em 1/16
  readonly verb: Verb;
  readonly power: number;                      // 0..255, JÁ INTEGRADO
  readonly flags: number;                      // bit 0 sprint, bit 1 modificador, bit 2 travado
}
```

**A decisão que carrega o desenho inteiro: `power` é um NÚMERO no comando, não um bit segurado que a
simulação integra.** Três retornos:

1. **É o que faz os três modos de relógio serem uma simulação só.** Tempo real integra uma retenção num
   número; por lances a criança *escolhe* o número; aperta-para-começar/aperta-para-soltar integra entre
   duas arestas. A simulação vê uma coisa só.
2. **Põe a carga do lado certo da linha que a própria engine traçou** (`input/latch.ts`): uma adaptação
   cruza de OPERAÇÃO para REGRA quando muda o *conjunto de estados alcançáveis* ou a *probabilidade*.
   Aperta-para-soltar alcança exatamente as mesmas potências que segurar. Logo carga é **operação**, é da
   camada de entrada, e não pode morar na simulação.
3. **Rede.** Uma retenção de 45 tiques são 45 bits duplicados no fio; uma potência solta é um evento de
   8 bits.

E o **resumo (digest)** — FNV-1a sobre os bits float64 numa ordem de campos declarada — é ao mesmo tempo
o detetor de dessincronia da rede futura **e** o teste de mestre-dourado. É assim que "nascer pronto para
rede" se paga com trabalho que já ia ser feito. ⚠️ Não pode quantizar: quantizar mascararia exatamente a
deriva que ele existe para apanhar.

### A regra de aritmética — um portão, não uma esperança

> Dentro de `sim/`, `rules/` e `ai/`: só `+ - * /`, comparações, `Math.sqrt`, `abs`, `min/max`, `floor`.
> **Proibidos: `Math.hypot`, `sin/cos/tan/atan2`, `pow`, `exp`, `random`, `Date.now`, `performance.now`.**

`Math.sqrt` é exatamente arredondado pela IEEE-754. `hypot`, trigonometria e `pow` **não** têm resultado
especificado e variam entre motores e plataformas — o que é uma dessincronia entre o Chromebook da escola
e o portátil do professor, aparecendo como *"a repetição diverge depois de 40 segundos"* e mais nenhum
sintoma. Ângulos são vetores unitários; a direção de 8 pontos sai por comparação.

### A regra de futebol, como máquina de estados

`PRE_MATCH → KICKOFF → LIVE`, e de `LIVE` saem `THROW_IN`, `CORNER`, `GOAL_KICK`, `GOAL`,
`FREE_KICK(indireto)` por impedimento, `HALF_TIME` e `FULL_TIME`. A tabela de transições é **dado**, não
código. Um `RulesProfile` liga e desliga transições: **treino é o mesmo árbitro com todas desligadas** e
um ponto de reposição — não é um segundo jogo.

**Impedimento**, na simplificação correta para um jogo: no *momento do passe*, marca-se numa máscara de 11
bits quem está (a) no campo adversário, (b) estritamente mais perto da linha de fundo adversária do que a
bola **e** do que o penúltimo defensor, (c) não é quem passou. A bandeira só **sobe** quando um marcado dá
o primeiro toque. ⚠️ **`[Fronteira]` — quem está exatamente em linha com o penúltimo defensor está em
JOGO.** A regra é "mais perto que"; trocar `>` por `>=` é o erro clássico e tem portão próprio.

⚠️ **Os lados trocam no intervalo, então bússola é mentira.** Toda direção narrada deriva de
`attackingDirection`, nunca do `Heading` cru — senão a criança que aprendeu "leste é o gol deles" ouve o
contrário durante o segundo tempo inteiro. Resolve-se uma vez, em `narration.ts`.

**Fora de escopo, e é o inventário de paridade que decide:** falta, cartão e pênalti não estão na lista
do jogo de referência. Ficam de fora, e a decisão fica escrita.

### A IA — 22 cérebros com orçamento

Duas camadas e um teto de custo:

- **Plano de equipa**, um por lado, a **5 Hz**: modo, altura da linha, largura, intensidade de pressão e
  **exatamente um pressionador designado** — o que sozinho elimina o enxame em volta da bola que torna IA
  barata de futebol insuportável.
- **Decisão do agente**, a **10 Hz e escalonada**: o agente `i` pensa quando `(tique + i) % 6 === 0`. São
  **~4 decisões por tique**, não 22.
- **Direção**, todo tique, para todos: um *seek/arrive* até o ponto em cache. Quatro multiplicações.

A decisão é uma **cascata de 7 regras**, não uma árvore de comportamento: goleiro · sou o portador ·
temos a bola (ponto de apoio) · bola solta e sou o mais perto · sou o pressionador · marcar · voltar.
Forma é dado (`formation.ts`), e `casa = âncora·(altura, largura) + 0,25·(bolaNorm − âncoraNorm)` produz
todo o comportamento de "a forma desliza com a bola" em quatro multiplicações.

**Não há módulo de CPU adversária.** A mesma IA roda nos 22; a única diferença é que um ou dois deles têm
a velocidade desejada e o verbo sobrescritos por um `Command`. Isso corta o código pela metade, garante
que a CPU nunca recebe informação que a criança não tem, e faz o treino com um goleiro ser
`teamSize = 1` mais um perfil.

**As notas por equipa são seis números** (`pace`, `control`, `passing`, `shooting`, `defending`,
`composure`) e **todas se aplicam no ponto da AÇÃO, nunca ramificando a cascata**. As mesmas 200 linhas
jogam de time fraco e de time forte; dificuldade é seis floats — e determinística, como o ADR-0049 exige.

## A declaração — as sete perguntas, para futebol

É o **terceiro preset da história da engine** (`hotspots` no quiz, `grid` no 2048, agora `continuous`), e
é a contribuição real deste jogo. Os campos que importam:

**1 · `topology()`** → `{ kind:'continuous', width: 90, height: 56, unit: 1.5 }`, **em metros, com o
`unit` sendo um PASSO.** O `distance()` do contrato divide por `unit` e o comentário do próprio ficheiro
diz que o resultado é *"quantos passos, não quantos pixels"*. Logo `unit` não é fator de escala: é **a
coisa em que a narração conta**. A criança cega precisa de *"a bola está a oito passos à sua direita"*, e
não de "6,4 metros" e muito menos de "51 pixels". E é **função** com razão: o campo de treino é metade do
campo, escolhido em tempo de execução (ADR-0084).

**2 · `roleAt(at)`** — e aqui está o achado de que mais me orgulho neste desenho:

| condição | papel |
|---|---|
| não temos a bola, e `at` é a bola | `goal` — quando você não a tem, a bola **é** o que a rodada pede |
| temos a bola, e `at` é a boca do gol adversário | `goal` |
| `at` está além da linha de impedimento no campo de ataque | **`gate`** |
| adversário em distância de desarme do nosso portador | `hazard` |
| relva, linhas, traves | `structure` / `free` |

**A linha do `gate` é o prémio.** O alto contraste da engine pinta por papel — o que significa que uma
criança de baixa visão recebe **a zona de impedimento visivelmente tingida**, de graça, saindo do
contrato, com zero linhas neste jogo e zero linhas na engine. Nenhum jogo comercial de futebol entrega
isso.

**5b · `targetsOf()`** — a metade que o sonar usa, e a decisão de maior alavanca do projeto inteiro:

```
não temos a bola             → [ a bola ]
temos, não sou o portador    → [ o meu melhor espaço para receber ]
sou o portador               → [ até 3 recetores livres e legais ] ∪ [ o gol, se o remate estiver ligado ]
bola morta contra nós        → [ ]   ← vazio é RESPOSTA
```

⚠️ **Nunca devolver os 10 companheiros.** É a falha "correto e inútil" do quiz com outra forma — um sonar
que apita dez vezes é um sonar que não diz nada. O conjunto responde *o que é acionável neste instante*, e
isso são no máximo quatro pontos. O que isto compra: **uma criança cega com a bola varre o sonar, ouve
duas ou três direções distintas, escolhe uma e passa.** Isso é jogar futebol sem ver, e cai direto das
sete perguntas.

**6 · `tick`** — `'clock'` nos dois modos de tempo real, `'player'` no modo por lances. ⚠️ **`tick` é o
único campo do contrato ainda declarado como DADO** (o `topology` virou função no ADR-0084, que escreveu
"agora `tick` é o único"). Como o `createGame` captura a declaração uma vez, **trocar de modo reinicia a
partida**. É *um* consumidor a pedir, e o padrão do próprio projeto é que uma emenda que aparece duas
vezes é o contrato a pedir mudança — então isto fica **registado como achado, não como mudança**.

### Achado medido na engine: o sonar fica surdo num campo em metros

`platform/audio-sonar.ts` calcula a panorâmica assim:

```ts
return Math.max(-1, Math.min(1, (wx - pl.x) / (ctx.LOGICAL_W * 0.55)));
```

O denominador é `320 · 0,55 = 176`, e essa constante **assume que o eixo x da topologia está em pixels
lógicos** — verdade para o platformer, vazia para `grid` e `hotspots`. Num campo de 90 metros, um
companheiro a 10 m à direita panoramiza `10/176 = 0,057`, ou seja, **mono**. Seria o sonar *correto e
inaudível* — a mesma classe de falha que o quiz registou.

A correção é pequena e é na engine: o denominador deve sair de `topology()` (`PAN_PACES · unit`), não da
largura do ecrã. **É o terceiro preset a pagar por si no primeiro dia.** Vai como achado medido para você
e para a sessão que está no `input/`; entretanto, o jogo narra o lado em palavras (*"à sua direita"*) para
que a informação chegue à criança pela fala, e nada é declarado como funcionando quando não funciona.

## A câmera e a leitura a 320×180

Projeção afim, e só em `project.ts`: `sx = x·8`, `sy = y·5 − z·7`. Mundo de 768×312 px, ecrã de 320×180 —
o enquadramento mostra ~40 m × 36 m, que é um recorte de transmissão plausível. `SY/SX = 0,625` dá uma
inclinação de ~51°: **tele alta, não tele rasante** — e isso é escolha de acessibilidade, porque a
inclinação real de transmissão põe 6 jogadores no ecrã e a criança de baixa visão perde a forma do jogo.

**Nada de divisão em perspetiva e nada de zoom.** Perspetiva faria o jogador próximo maior que o distante,
e a 12 px de altura um dos dois deixa de se ler; zoom a 320×180 quebra a grade de pixel inteiro que o
ADR-0001 existe para proteger.

O jeito de transmissão vem do **alvo**, não da projeção: `alvo = projetar(bola + 0,35·v)`, deslocado 12 px
para cima, seguido por interpolação fixa de 0,12 por tique (~0,4 s), com ganho vertical a metade do
horizontal — é isso que faz ler como *transmissão* e não como *helicóptero*.

⚠️ **Pixel inteiro em dois pontos, não um.** Arredonda-se a câmera **e** cada sprite. Arredondar só o
contentor deixa os sprites em coordenadas fracionárias e a amostragem NEAREST cintila; arredondar só os
sprites faz a cena inteira deslizar em sub-pixel como um bloco.

**Como 22 figuras de 12 px se leem**, por ordem do que mais compra:

1. **Sombra elíptica sob cada corpo e sob a bola.** É o maior ganho isolado — separa todo sprite da relva
   seja qual for a cor do uniforme, e **a sombra da bola ficar no chão enquanto a bola sobe é a única
   forma de uma bola de 3 px comunicar altura**.
2. **Contorno de 1 px** cozido no atlas.
3. **Cor do uniforme vinda da paleta da equipa**, com regra imposta: **as cores primárias dos dois times
   diferem em luminância em ≥ 40/255**, e os uniformes de guarda-redes diferem de ambos. É portão de
   teste, e serve diretamente a criança daltônica.
4. **Divisa de 5×3 px sobre a cabeça de quem você controla.** Sem isso a criança não acha o próprio
   jogador, e essa é a diferença entre um jogo e um protetor de ecrã.
5. **O campo é cozido uma vez** — linhas, círculo central como *elipse* (73×46 px depois do achatamento) e
   faixas de corte de 6 m, que dão de brinde uma régua de distância e uma pista de profundidade.

E o pilar 2: texto sempre no DOM. Futebol não tem grade para espelhar, então `ui/state-mirror.ts` publica
**o estado de jogo** como texto real — placar, fase, de quem é a bola, quem você controla, e as suas
opções de passe. No modo por lances, `ui/turn-panel.ts` desenha a decisão como botões focáveis com um
seletor de potência, **o que torna o jogo inteiro operável por leitor de tela e por varredura sem um único
pixel**.

## Os módulos

`[P]` = puro, roda no projeto `node` do Vitest, zero DOM e zero PIXI. `[B]` = só navegador.
São ~55 ficheiros, **34 deles puros** — e essa proporção *é* o desenho.

```
app/js/
  sim/        [P] units · vec · ids · state · command · ball · body · broadphase ·
                  contact · possession · step · digest · rng
  rules/      [P] phase · events · out-of-play · offside · restart · clock · profile · referee
  ai/         [P] formation · plan · agent · carrier · keeper · steering · ratings · schedule
  drivers/    [P] driver · driver-realtime · driver-assisted · driver-turn ·
                  decision-point · charge · recorder
  input/      [P] intent · seats · switcher · chord · command-build
              [B] sampler          [P] shim-catorze.ts  ← morre quando o #103 aterrar
  teams/      [P] clubs · palette · crest · squad
  render/     [B] pitch-texture · kit-atlas · crest-texture · crowd-texture · shadows ·
                  sprites · camera-rig · markers · hud
  ui/         [B] state-mirror · turn-panel · setup-scene
  scenes/     [B] title · match · practice · halftime · fulltime
  boot/       [B] boot · main         ⚠️ sem auto-boot no fim do main.ts — o 2048 mediu um
                                        boot duplo vindo exatamente dessa linha
  declaration.ts [P]   narration.ts [P]   project.ts [P]
```

`broadphase.ts` é a grade uniforme de 8×8 m que a engine não tem — o `core/collision.ts` dela só faz
consultas de grade de azulejos. São ~60 linhas, e cada corpo checa a própria célula mais 8 vizinhas.

⚠️ **E a conversão em cartucho acrescenta `src/`, não reorganiza `app/js/`.** Dois ficheiros novos ao
lado da árvore — `src/index.ts`, o cartucho, e `src/standalone.ts`, o shell — e a razão de serem dois é a
mesma pela qual `boot/boot.ts` já é separado de `boot/main.ts`: a metade que só existe num navegador fica
onde só existe num navegador. A decomposição acima não se toca; `boot/main.ts` deixa de chamar
`createGame` e `startLoop` e passa a **devolver** o que os dois recebiam.

## Achados na engine que viram issue, não registo

Encontrados de passagem, e cada um é um defeito real. Vão para você como issues — **não escrevo nada lá**:

1. **O modo de um botão só é honrado no teclado.** O `pollPads` não tem equivalente: uma criança em modo
   de um botão **com um pad ligado não está em modo de um botão**. É um buraco silencioso no pilar 2.
2. **`KB_DEFAULTS.p2[1]` liga `Numpad8/5/9/6`** — inutilizável num Chromebook, que é o hardware que o
   pilar 1 nomeia.
3. **`PADWIZ_STEPS` tem literais pt-BR cravados** (`'CIMA'`, `'PULAR'`) dentro da engine, contra o pilar 3
   e contra a regra que o `input/devices.ts` enuncia no próprio cabeçalho.
4. **Um pad desligado faz o `pollPads` seguir em silêncio.** Num jogo de dois assentos isso é uma criança
   cujo jogador deixa de existir sem mensagem nenhuma.
5. **`panFor` divide pela largura do ecrã** — o achado do sonar, acima. É o mais consequente dos cinco.

## Verificação

Estilo da casa: ZOMBIES × Right-BICEP, **todo portão nasce vermelho com a mutação confirmada**. Os que
não podem faltar:

**Projeto `node`** (a maioria — ~34 dos ~55 módulos são puros)

| Portão | Mutação que o prova |
|---|---|
| Mesmo `(semente, comandos)` → mesmo resumo após 10 000 tiques | virar um bit da semente |
| **Tempo real e por lances produzem o mesmo rasto de resumo** — a prova de "uma simulação, três condutores" | fazer o condutor assistido escalar `DT` em vez do acumulador |
| **Varredura de aritmética** em `sim/`,`rules/`,`ai/` por `hypot|sin|cos|pow|exp|random|Date.now` | plantar um `Math.hypot` |
| Repetição dourada de 90 s, presa à versão do `MatchRecord`; versão diferente é **recusada**, não corrida | — |
| **Impedimento: em linha com o penúltimo defensor está em JOGO** | `>` → `>=` |
| Bola exatamente sobre a linha **não** é gol; totalmente além é | — |
| `conformanceProblems` vazio em **todas** as fases, e `topology()` **muda** de partida para treino | cachear a topologia |
| `targetsOf` nunca passa de 4, nunca contém impedido, é `[]` com bola morta | remover o filtro de impedimento |
| `nameAt(bola).gender === 'f'` e `nameAt(gol).gender === 'm'` | trocar os géneros |
| Orçamento de IA: 600 tiques × 22 agentes ⇒ ≤ ~2 200 chamadas a `decide()` | remover o escalonamento |
| Monotonia de perícia: `passing 0.9` completa estritamente mais passes que `0.3`, em 20 sementes | — |
| Anti-travamento: sem entrada humana, em 3 000 tiques × 10 sementes, sai gol e a bola sai de jogo | — |
| 500 pares de clubes semeados: separação de luminância ≥ 40 | — |
| **`shim-has-an-expiry`** — falha com `#103 landed — delete the shim` | apontar para uma engine falsa que já tem a capacidade |
| **Acorde: as 24 ordenações das quatro arestas** — nunca troca **e** cobertura da mesma descida de R2 | disparar a troca na descida em vez de adiar |
| **Carga: 0 tiques segurados ainda dispara, em `minPower`** — a asserção que protege uma criança | potência zero no toque |
| `latch-stepped` alcança o mesmo conjunto de `powerStep` que `hold` — a asserção de 2.2.1 | contagem de passos diferente |

**Projeto `browser`** (só o que precisa de canvas ou de anel de foco real)

- O boot cria **exatamente um** `<canvas>` e **exatamente um** ouvinte de teclado — o 2048 embarcou um
  boot duplo que nenhum teste de lógica e nenhuma captura de ecrã via.
- `createGame(...).problems` vazio contra o `index.html` real.
- **Pixel inteiro**: leva a câmera a posição fracionária e exige `x`/`y` inteiros em todo sprite.
- **ADR-0054**: injeta um quadro que lança; o laço para **e** o `#sr-alert` recebe texto.
- Um gol dispara `srAlert` exatamente **uma** vez.
- `npm run test:a11y` — axe contra o jogo **servido**, `a11y: true` no CI, **sem exclusão nenhuma** (a
  exclusão da engine é o widget VLibras, que este jogo não carrega).

**Portões de cartucho — os que se escrevem AGORA, antes de haver conversão nenhuma**

⚠️ **A razão de existirem hoje é que as nove conformidades já pagas são invisíveis e perdem-se sem
ninguém notar.** Um `let` içado para o escopo do módulo por um refactor, um `import { shuffle }` que
parece ergonomia, uma leitura de `location.search` num painel novo, um segundo `startLoop`: nada disso
falha nenhum teste que exista, e todos custam a conversão. São portões de **ausência**, e um portão de
ausência que ninguém escreve enquanto a ausência é verdadeira nunca se escreve.

| Portão | Mutação que o prova |
|---|---|
| Nenhum `let`/`var` em escopo de módulo em `app/js/**` (D14) | içar um `let` para fora de `bootar` |
| Nenhum import de `rnd`, `randInt`, `shuffle` ou `reseed` de `core/rng` (ADR-0141 §3) | importar `shuffle` num módulo qualquer |
| Nenhuma leitura de `location.search` nem `new URLSearchParams` fora de um shell | ler `?seed=` em `boot/main.ts` |
| `createGame` e `startLoop` aparecem **exactamente uma vez cada**, e só em `boot/` | chamar `startLoop` num segundo sítio |
| `i18n/index.ts` exporta `DICTS`, e `installDicts` percorre-o em vez de uma lista própria | registar um dicionário à mão |
| ⚠️ `boot/main.ts` importado **sem** ser chamado não toca no documento | pôr `bootar()` no fim do ficheiro — a linha exacta que o 2048 mediu |

⚠️ **O último é o mais valioso e é o único que não é um `grep`.** O ADR-0139 nomeia-o como o seu primeiro
portão de confirmação — *"um cartucho que é importado e nunca instanciado tem de não fazer nada
observável: sem DOM, sem ouvinte, sem registo"* — e é a forma correcta de gatear uma propriedade que o
cabeçalho do nosso `main.ts` hoje só **afirma**. É um teste do projeto `browser`: importa o módulo,
compara o `innerHTML` do documento e a contagem de ouvintes antes e depois.

⚠️ **E um portão que NÃO se escreve hoje**, dito para não ser inventado depois: *"o CI constrói os dois
destinos"* (ADR-0140, portão 1). Não há destino `lib` para construir, e um portão vermelho por não
existir o que ele mede é um portão que alguém apaga.

**Fecho:** `npm run validate` (typecheck + vitest node + vitest browser + build) verde, e o CI a chamar
`game-ci.yml@main`.

## Ordem de trabalho

1. **`sim/` + resumo + arnês de repetição.** Nada renderiza. A primeira coisa que existe é uma partida de
   futebol sem cabeça que se consegue resumir num número.
2. **Comando + os três condutores + o portão cruzado.** Provar "uma simulação, três condutores" **antes**
   de qualquer um deles ter interface.
3. **`rules/` + impedimento.** Ainda sem cabeça.
4. **`declaration.ts` + ligação ao sonar — *antes de qualquer pixel*.** Se as sete perguntas se respondem
   a partir de uma simulação sem cabeça, a alegação do ADR-0030 está provada; se o `targetsOf` só se
   consegue escrever olhando o ecrã, o desenho está errado — e descobrimos na semana dois, não na dez.
5. **Renderizador feio**: campo cozido, sombras, manchas coloridas, câmera. Jogável e feio. **É aqui que
   isto vai à sua frente**, porque o risco de legibilidade não se resolve por raciocínio.
6. **IA**: formação → cascata → portador → goleiro → notas.
7. **Arte**: atlas de uniformes, escudos, multidão, paralaxe, marcadores.
8. **Modos**: perfil de treino, painel de lances, opções de assistência.
9. **Acabamento**: áudio, frases de narração, legendas, espelho de estado.

E os quatro registos da engine (endereço, acorde, carga, faixa analógica), **apresentados a você e
escritos só depois do sim**, entram entre o passo 2 e o 3 — quando o formato do `Held` já estiver combinado
com quem executa o #103.

### E a conversão em cartucho é uma décima faixa, que não começa agora

⚠️ **Ela não se intercala nos nove passos, e a razão é o ADR-0068 §6.** Um jogo vai de ponta a ponta
primeiro, e esse jogo é o whackwhack; o *brief* diz por escrito que quem não é o whackwhack espera que o
contrato volte com os buracos preenchidos. Fazer os seis — sete — em paralelo seria descobrir os furos
do contrato sete vezes.

O que fica desta faixa **agora** é a linha de cima da *Verificação*: os portões de ausência, que
protegem nove conformidades já pagas e custam um ficheiro de teste.

O que fica para **depois do whackwhack**, na ordem em que se faz:

10. **`src/index.ts`** — o `Cartridge`: `slug`, `declaration`, `dicts`, `hooks`, `create(ctx)`. É onde a
    closure que hoje entregamos ao `startLoop` passa a ser devolvida como `update(dt)`, e o `Booted.stop()`
    passa a chamar-se `teardown()`.
11. **`src/standalone.ts`** — o shell de aplicação, ~30 linhas: chama `createGame`, monta o `ctx`, chama a
    fábrica e corre o laço. `app/index.html` carrega **isto** em vez de `boot/boot.ts`. ⚠️ E o CSS e o
    registo do *service worker*, que hoje vivem no `boot.ts` por uma razão mecânica escrita lá — o projeto
    `node` importa o `main.ts` e não tem *bundler* para uma folha de estilos — mudam de casa para cá, que
    é o sítio onde a mesma razão continua a valer.
12. **`vite.config.ts`** — dois destinos comutados por modo; o `app` fica exactamente como está.
13. **`package.json`** — `exports`, `files`, fora o `private`, engine e Pixi em *peer* **e** *dev*.
14. **`ctx.region`** em vez de `doc.querySelector('#pitch')`, e os dois ouvintes de documento revistos
    contra a regra "escreve-se dentro da região".

⚠️ **E a pergunta a fazer antes do passo 10, não durante:** a política de semente. O nosso mestre-dourado
é um resumo FNV-1a sobre uma simulação determinística; se o shell escolher a semente, a premissa do
mestre-dourado mudou. O ADR-0139 e o ADR-0141 deixam isso aberto de propósito, os dois com a mesma frase.

## Decisões que tomei, e que você pode reverter

| Assunto | O que assumi |
|---|---|
| Falta, cartão, pênalti | **Fora.** Não estão na lista de paridade do jogo de referência. |
| Lados trocam no intervalo | **Sim**, e toda narração deriva de `attackingDirection`. |
| Exportar repetição para ficheiro | **Não** — só em memória e em fixturas de teste (ADR-0037). |
| Frequência da simulação | **60 Hz** com o escalonamento; 30 Hz é recuo medido, e mudaria as fixturas douradas. |
| `objectiveOf` | `'{have} de {need} gols'` com `need = max(golsDeles + 1, meusGols)` — enuncia o que a rodada pede **agora**, como o 2048 fez com as dobras. |
| `select` | Abre a barra rápida de acessibilidade — mantém-se função de **sessão**, como o ADR-0085 §2 exige. |
| Duração da partida | Ajustável, incluindo "sem relógio", pelo perfil de regras. |
| Falta, cartão, pênalti (**revertido por você**) | **Dentro.** A linha acima ficou desactualizada e fica citada em vez de apagada: a decisão de as deixar fora era minha, o README apresentou-a como sua, você perguntou quando a tinha tomado — e não a tinha. As três existem, medidas e gateadas. |
| Quando converter em cartucho | **Não agora.** ADR-0068 §6 e o *brief*: o whackwhack vai primeiro, e quem não é ele espera o contrato voltar. O que se faz hoje são os portões de ausência. |
| `teams/roster.ts` e `ctx.rng` | **Fica com `createRng` semeado pelo índice do clube.** Passar a `ctx.rng` faria a cor de um clube depender de quantas vezes a corrente foi consultada, que é o defeito do ADR-0141 entrando pela outra porta. Excepção fundamentada, não infracção. |
| O calço do `piper-tts-web` sob *peers* | **Sai quando a engine declarar o import**, e não antes; não é dependência nossa, é um furo do pacote dela. |


