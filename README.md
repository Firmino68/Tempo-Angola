# ⛅ Tempo Angola

> O tempo explicado para o dia a dia, para o campo e para todo o país.

Há muitas apps que mostram "28 °C, nublado". Esta responde às perguntas que as pessoas realmente fazem. Feita com **HTML, CSS e JavaScript puro**, sem frameworks e sem chave de API.

## Funcionalidades

### ☀️ Hoje: "Posso…?"
Veredictos práticos para **hoje ou amanhã**, com semáforo (🟢 bom, 🟡 atenção, 🔴 evitar) e a **melhor janela do dia**:

| Pergunta | Como é decidido |
|---|---|
| 👕 Secar roupa ao sol | Horas entre as 8h e as 17h com menos de 30% de chuva |
| ☂️ Guarda-chuva | Pico de probabilidade de chuva e total previsto |
| 🏖️ Praia e ar livre | Sem chuva e sensação térmica até 33 °C, com aviso de UV |
| ⚽ Desporto | Horas com sensação térmica até 30 °C e sem chuva |
| 🏍️ Moto ou a pé | Chuva e vento (acima de 25 km/h pede atenção; acima de 40 km/h, evitar) |
| 🕶️ Proteção solar | Índice UV do dia e horas de UV 6 ou mais |

### 🌱 Campo
Para quem cultiva: humidade do solo, chuva dos **últimos 7 dias** e dos **próximos 7**, balanço entre chuva e evaporação, gráfico de chuva diária e conselhos sobre **rega**, **sementeira/adubação** e **pulverização**. Indica também se estamos na época das chuvas ou no cacimbo.

### 🇦🇴 Angola
Painel com as **18 capitais de província**: o que está mais quente, onde há maior hipótese de chuva e onde o UV é mais alto. Pode ordenar por calor, chuva ou UV e clicar numa cidade para ver o detalhe.

### Extras
Pesquisa de qualquer cidade angolana, botão 📍 para a localização, fundo de dia e de noite, última cidade guardada, mensagens de erro claras e design responsivo.

## ⚠️ Aviso

Os veredictos e conselhos são **regras simples** calculadas a partir da previsão. Não substituem alertas oficiais nem aconselhamento agrícola profissional. Os limites (por exemplo, solo seco abaixo de 15% de humidade) são aproximações e podem ser ajustados em `js/app.js`.

## API

[Open-Meteo](https://open-meteo.com/): gratuita e sem registo. Usa a Geocoding API (nome para coordenadas) e a Forecast API (tempo atual, horas, dias, UV, solo e evaporação). Para uso comercial, consulte as condições do serviço.

## Estrutura

```
├── index.html
├── css/style.css
└── js/app.js
```

## Como executar

Abra o `index.html` no navegador, ou sirva a pasta com `python -m http.server 8000`. O botão 📍 só funciona em `https://` ou `localhost` (por exemplo, no GitHub Pages).

## O que aprendi

- Consumir APIs REST com `fetch` e `async/await`, incluindo pedidos com várias localizações numa só chamada
- Transformar dados em decisões úteis (regras, janelas de tempo, semáforo)
- Carregar dados sob procura (lazy) e guardá-los em cache
- Evitar respostas fora de ordem, tratar erros e escapar texto antes de o inserir no HTML

## Autor

**Firmino** · [GitHub](https://github.com/Firmino68)
