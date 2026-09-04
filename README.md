# Passagens Aéreas · Buscador WebGL

Ferramenta WebGL (globo 3D) para encontrar passagens mais baratas cruzando
**vários métodos** de busca. Cada método é uma _estratégia plugável_ que
implementa a mesma interface; um agregador roda todas em paralelo e ordena por
preço.

- **Front-end:** React + react-three-fiber (Three.js/WebGL) + Vite
- **Proxy backend:** Node/Express (`server/`) — guarda as credenciais e faz o
  OAuth server-side (resolve CORS e não expõe o segredo no browser)
- **Núcleo de dados real:** Amadeus Self-Service API (tier gratuito), via proxy
- **Métodos sem API pública:** implementados como estratégias _mock_ realistas,
  prontas para trocar por fonte real depois.

## Rodar

```bash
npm install
npm run dev      # sobe front (5173) + proxy (3001) juntos
npm run build    # bundle de produção em dist/
npm start        # produção: proxy serve dist/ e a API em uma porta só
```

- `npm run dev` roda **web + api** juntos (concurrently). Em dev, o Vite
  encaminha `/api` para o proxy na porta 3001.
- Rodar separado: `npm run web` e `npm run server`.

### Dados reais (Amadeus)

Sem chaves, o app roda 100% em **modo mock** (nada quebra; os chips no topo mostram
o estado de cada fonte). Para voos reais:

1. Crie um app grátis em https://developers.amadeus.com
2. `cp .env.example .env` e preencha `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET`
3. Reinicie o `npm run dev`

### Milhas reais (seats.aero)

A estratégia **Programas de milhas** usa o seats.aero Partner API para
disponibilidade real de award ([`strategies/miles.ts`](src/strategies/miles.ts)).

1. Pegue uma **Partner API key** em https://seats.aero (Partner API)
2. Preencha `SEATS_AERO_API_KEY` no `.env` e reinicie
3. O chip "milhas mock" vira "seats.aero ao vivo"

### Consolidador / NDC real (Duffel)

A estratégia **Consolidadores / IATA** usa o Duffel para ofertas reais de
companhia + NDC + agências ([`strategies/consolidator.ts`](src/strategies/consolidator.ts)).

1. Crie uma conta em https://duffel.com e pegue um **access token**
2. Preencha `DUFFEL_ACCESS_TOKEN` no `.env` e reinicie
3. O chip "consolidador mock" vira "Duffel ao vivo"

> O **token de TEST** do Duffel retorna ofertas sintéticas para **qualquer
> rota** — ótimo para demonstrar sem cobrança. O proxy cria um `offer_request`
> (`POST /air/offer_requests`) e devolve as ofertas mais baratas normalizadas.

Como funciona: busca o award por trecho (`/partnerapi/search`), pega a **melhor
opção por programa** (menos milhas), e para ida-e-volta **soma o award one-way de
cada perna** por programa (aproximação transparente, marcada com a tag `ida+volta`).
As taxas vêm em moeda estrangeira e são **convertidas para BRL com câmbio
aproximado** (`FX` em `miles.ts`), para o custo efetivo continuar coerente. Sem
chave ou sem disponibilidade, cai no mock.

> ✅ **Segredo fica no servidor.** O browser só fala com `/api` (proxy). As
> credenciais nunca vão para o bundle e não há problema de CORS. Se o proxy não
> tiver credenciais ou a Amadeus não retornar, o app cai em mock automaticamente.

### Endpoints do proxy

| Rota | O que faz |
|---|---|
| `GET /api/health` | `{ amadeus: bool, env }` — o front usa para o badge |
| `POST /api/flight-offers` | proxy para `shopping/flight-offers` (OAuth server-side + cache de token) |
| `GET /api/flight-dates` | proxy para `shopping/flight-dates` (grade de datas mais baratas) |
| `GET /api/award-search` | proxy para o **seats.aero** Partner API (disponibilidade de award/milhas) |
| `POST /api/duffel-offers` | proxy para o **Duffel** (ofertas reais: cia + NDC + agências) |

### Cache e rate-limit ([`server/cacheLimit.js`](server/cacheLimit.js))

As chamadas aos upstreams passam por um gate: **cache → limite por IP → teto do
upstream → auth**.

- **Cache em memória (TTL + LRU):** respostas idênticas não repetem chamada.
  `flight-offers` 5 min, `flight-dates`/award 30 min. Cabeçalho `X-Cache: HIT|MISS`.
- **Rate-limit por IP** (janela fixa): padrão 60 req/min → `429` + `Retry-After`.
- **Teto de chamadas por upstream** (Amadeus 40/min, seats.aero 10/min): protege
  as cotas dos tiers grátis. Ao estourar, responde com `reason: "rate-limited"` e
  o front cai no mock/estimador — nada quebra.
- Tudo configurável por env (ver `.env.example`). `GET /api/health` expõe
  `cache` e `budget` (por upstream) para observabilidade.

## Arquitetura

```
server/
  index.js                 # proxy Express: OAuth Amadeus + /api + serve dist/
src/
  types.ts                 # FareStrategy, FareResult, SearchQuery
  strategies/
    index.ts               # registro central
    amadeus.ts             # busca GDS real (via /api) -> mock de fallback
    mockStrategies.ts      # os 9 métodos sem API pública
  lib/
    amadeusClient.ts       # cliente do browser: fala só com /api
    aggregate.ts           # roda todas as estratégias em paralelo
    mockFares.ts           # preço-base por distância + RNG determinística
    airports.ts / geo.ts   # coords + matemática do globo
  components/
    Globe.tsx / Arc.tsx    # cena WebGL, arcos animados
    SearchPanel.tsx        # formulário + toggles de método
    ResultsList.tsx        # cartões de resultado
```

**Adicionar um método novo:** crie um objeto `FareStrategy`, registre em
`strategies/index.ts`. Ele aparece sozinho nos toggles, no globo e nos resultados.

## Status honesto de cada método

| Método | Estado | Como virar real |
|---|---|---|
| Busca padrão (GDS) | **Real** (Amadeus) ou mock | já integrado |
| Consolidadores / IATA | **Real** (Duffel) ou mock | já integrado |
| Tarifas privadas / corporativas | mock | tarifas CAT-35 via GDS com contrato |
| Combinações / hidden-city | mock | motor de virtual interlining (ex: Kiwi) |
| Fare basis específico | mock | fare rules / pricing no GDS |
| Mercado de origem / point-of-sale | mock | pricing multi-POS no GDS |
| Programas de milhas | **Real** (seats.aero) ou mock | já integrado |
| Pontos + dinheiro (cash & points) | mock | idem award APIs |
| Error fares | **Scanner de outliers** (real/mock) | já integrado |
| Promoções relâmpago | mock | monitoramento contínuo + alertas |

## Campo de busca e resultados

- **Origem/Destino:** combobox ([`components/AirportSelect.tsx`](src/components/AirportSelect.tsx))
  que filtra por **cidade, nome do aeroporto ou código IATA**, sobre uma base de
  **~3.200 aeroportos comerciais do mundo** ([`lib/airports.data.json`](src/lib/airports.data.json),
  gerada de OurAirports por [`scripts/gen-airports.mjs`](scripts/gen-airports.mjs)).
  Para regenerar: baixe `airports.csv` do OurAirports e rode
  `node scripts/gen-airports.mjs airports.csv`.
- **Conexões:** os hubs de escala variam por rota (semeados) e **Lisboa nunca é
  usada como escala** — só como destino (`pickVia` em
  [`strategies/mockStrategies.ts`](src/strategies/mockStrategies.ts)).
- **Cada resultado** mostra os trechos com **companhia + número do voo** e um
  botão **Comprar na {companhia} ↗**. O link segue esta ordem
  ([`lib/carriers.ts`](src/lib/carriers.ts) · `bookingUrlFor`):
  1. **deep-link prefilled** da cia (rota/datas/pax/cabine já preenchidos) — só
     para companhias com formato **verificado** (`AIRLINE_DEEPLINKS`; hoje
     **LATAM** LA/JJ);
  2. **site oficial** da cia (`AIRLINE_SITES`) — home de reserva;
  3. **Kayak** por rota/datas — fallback para cia fora do mapa.

  Tarifas com pontos mostram **Buscar award ↗** para a busca do programa.

  > Adicionar deep-link de outra cia = 1 entrada em `DEEPLINKS`, **depois de
  > verificar o formato ao vivo** (formatos de IBE quebram fácil — por isso só
  > entram os verificados).

## Scanner de error fares

A estratégia **Error fares** não é um preço fixo: é um **scanner de outliers**
([`lib/errorFareScanner.ts`](src/lib/errorFareScanner.ts) +
[`strategies/errorFare.ts`](src/strategies/errorFare.ts)).

1. **Amostra** os preços da rota numa janela de ±14 dias — via **Amadeus
   flight-dates** (real) quando há cobertura, senão pela amostra estimada.
2. **Detecta** os preços anomalamente baratos: `preço < 0,55 × mediana` da rota
   (≥ 45% abaixo do típico) — detecção robusta por mediana.
3. Reporta cada anomalia com **% abaixo do normal**, a **baseline** da rota e a
   data, marcada `scanner (real)` ou `scanner (mock)`.

Sem anomalias, a estratégia **não retorna nada** (honesto). No modo demo (sem
credenciais), a amostra recebe 1–2 anomalias sintéticas para exercitar o
detector — a lógica de detecção é a mesma que roda sobre dados reais.

## Custo efetivo (comparação justa dinheiro × milhas)

A ordenação usa **custo efetivo = dinheiro + pontos × valor do ponto**
([`lib/pricing.ts`](src/lib/pricing.ts)), então uma tarifa de milhas não fica
artificialmente no topo só por ter "pouco dinheiro". O **valor do ponto** é um
slider na UI (padrão 2,5 ¢/pt): subir penaliza resgates em milhas, abaixar os
favorece — e a lista reordena na hora, sem refazer a busca. Cada cartão mostra o
custo efetivo em destaque e a composição (dinheiro + pontos) abaixo.

## Busca por mês (calendário heat map)

O campo de busca tem dois modos (`SearchPanel`):

- **Datas exatas** — ida/volta + a matriz flexível ida×volta (abaixo).
- **Por mês** — escolhe um **mês** (e, para ida-e-volta, a **duração em noites**).
  A busca monta um **calendário do mês** com o preço de cada dia de partida
  ([`components/MonthCalendar.tsx`](src/components/MonthCalendar.tsx),
  `buildMonthMatrix` em [`lib/flexMatrix.ts`](src/lib/flexMatrix.ts)), **auto-seleciona
  o dia mais barato** (★) e roda a busca completa nele. Clicar em qualquer dia
  refaz a busca para aquele dia (volta = dia + noites), mantendo o calendário.

Mesma fonte dupla dos preços: **Amadeus flight-dates** (real, cheapest-per-date no
mês inteiro numa chamada) quando há cobertura, senão o **estimador** — sinalizado
pelo selo `Amadeus (real)` / `estimado`.

## Datas flexíveis (mapa de calor)

Com "Datas flexíveis" ligado, a busca monta uma **matriz ida × volta** (± 3 dias)
com um **mapa de calor** verde→vermelho ([`lib/flexMatrix.ts`](src/lib/flexMatrix.ts)
+ [`components/DateMatrix.tsx`](src/components/DateMatrix.tsx)). Clicar numa célula
busca aquele par e recentra a grade; ★ marca o par mais barato.

**Fonte dos preços (com selo na UI):**

- **`Amadeus (real)`** — usa o **Flight Cheapest Date Search**
  (`GET /v1/shopping/flight-dates`) numa única chamada; os pares retornados
  preenchem a grade na **moeda do mercado** (`meta.currency`, pode ser EUR),
  células sem preço em cache ficam vazias.
- **`estimado`** — fallback quando não há credencial ou a rota não tem dado em
  cache. Preço estimado sensível a **fim de semana** e **alta temporada**
  (Dez/Jan/Jul). Não misturamos as duas escalas: é uma fonte ou a outra.

> ⚠️ **Cobertura:** o `flight-dates` só responde para rotas que a Amadeus tem em
> cache. No ambiente **test** isso é bem restrito (poucos pares), então mesmo com
> credenciais de teste rotas como GRU–LIS podem voltar vazias e a grade fica
> `estimado`. Cobertura ampla exige credenciais de **produção**.

## Limitações conhecidas (próximos passos)

- Não há emissão/checkout — é um _buscador/comparador_.
- A matriz real depende da cobertura do `flight-dates` (limitada em `test`); sem
  dado em cache, cai no estimador — comportamento esperado e sinalizado na UI.
- Cache/rate-limit são em memória (por processo). Para múltiplas instâncias em
  produção, trocar por um store compartilhado (ex: Redis).
- Award ida-e-volta soma o melhor one-way de cada perna por programa e converte
  taxas para BRL com câmbio **fixo aproximado** (`FX` em `miles.ts`) — trocar por
  câmbio ao vivo quando precisar de precisão.
- Dataset de aeroportos é reduzido (`lib/airports.ts`); ampliar com OpenFlights.
- O proxy não tem rate-limit/cache de resultados ainda — adicionar antes de expor
  publicamente (a Amadeus tem cotas no tier gratuito).
