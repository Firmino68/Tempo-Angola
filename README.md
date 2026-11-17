# ⛅ Tempo Angola

Aplicação web que mostra o **clima atual e a previsão para 7 dias** de qualquer cidade de Angola. Feita com **HTML, CSS e JavaScript puro**, sem frameworks e sem chave de API.

## Funcionalidades

- Pesquisa por cidade (limitada a Angola) com atalhos para as principais cidades
- Temperatura, sensação térmica, humidade, vento e descrição do tempo
- Previsão de 7 dias com mínimas, máximas e probabilidade de chuva
- Botão 📍 para usar a localização do dispositivo
- Fundo diferente de dia e de noite
- Lembra a última cidade pesquisada (`localStorage`)
- Mensagens de erro claras (cidade não encontrada, sem internet) e design responsivo

## API usada

[Open-Meteo](https://open-meteo.com/): gratuita, sem registo e sem chave.

- **Geocoding API** para converter o nome da cidade em coordenadas
- **Forecast API** para o tempo atual e a previsão diária

## Estrutura

```
├── index.html
├── css/style.css
└── js/app.js
```

## Como executar

Abra o `index.html` no navegador, ou sirva a pasta:

```bash
python -m http.server 8000
```

A localização (📍) só funciona em `https://` ou `localhost`, por exemplo no GitHub Pages.

## O que aprendi

- Consumir APIs REST com `fetch` e `async/await`
- Tratar erros e estados de carregamento
- Evitar respostas fora de ordem em pedidos concorrentes
- Escapar texto antes de o inserir no HTML

## Autor

**Firmino** · [GitHub](https://github.com/Firmino68)
