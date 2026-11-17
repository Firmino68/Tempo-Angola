(() => {
  const $ = (id) => document.getElementById(id);
  const CITIES = ["Luanda", "Benguela", "Huambo", "Lubango", "Cabinda", "Malanje", "Uíge", "Namibe", "Saurimo", "Menongue"];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Códigos WMO usados pela Open-Meteo -> [ícone, descrição]
  function describe(code) {
    if (code === 0) return ["☀️", "Céu limpo"];
    if (code === 1) return ["🌤️", "Quase limpo"];
    if (code === 2) return ["⛅", "Parcialmente nublado"];
    if (code === 3) return ["☁️", "Nublado"];
    if (code === 45 || code === 48) return ["🌫️", "Nevoeiro"];
    if (code >= 51 && code <= 57) return ["🌦️", "Chuvisco"];
    if (code >= 61 && code <= 67) return ["🌧️", "Chuva"];
    if (code >= 71 && code <= 77) return ["❄️", "Neve"];
    if (code >= 80 && code <= 82) return ["🌦️", "Aguaceiros"];
    if (code >= 95) return ["⛈️", "Trovoada"];
    return ["🌡️", "Sem informação"];
  }

  let req = 0; // evita que uma resposta antiga substitua uma mais recente
  const setStatus = (msg, error = false) => {
    $("status").textContent = msg;
    $("status").className = "status" + (error ? " error" : "");
  };

  async function getJson(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error("Falha na ligação ao serviço do tempo.");
    return r.json();
  }

  async function searchCity(name) {
    const id = ++req;
    setStatus("A procurar…");
    try {
      const geo = await getJson(
        "https://geocoding-api.open-meteo.com/v1/search?count=1&language=pt&format=json&countryCode=AO&name=" + encodeURIComponent(name));
      if (id !== req) return;
      const c = geo.results && geo.results[0];
      if (!c) return setStatus(`Não encontrei "${name}" em Angola. Verifique o nome e tente de novo.`, true);
      await loadWeather(c.latitude, c.longitude, c.name, c.admin1, id);
      try { localStorage.setItem("tempo-cidade", c.name); } catch {}
    } catch (e) {
      if (id === req) setStatus(navigator.onLine ? e.message : "Sem ligação à internet.", true);
    }
  }

  async function loadWeather(lat, lon, city, region, id = ++req) {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
      "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7";
    const w = await getJson(url);
    if (id !== req) return;
    render(w, city, region);
    setStatus("");
  }

  function render(w, city, region) {
    const c = w.current, d = w.daily;
    const [icon, text] = describe(c.weather_code);
    document.body.dataset.theme = c.is_day ? "day" : "night";
    $("place").textContent = region && region !== city ? `${city}, ${region}` : city;
    $("icon").textContent = icon;
    $("temp").textContent = Math.round(c.temperature_2m) + "°C";
    $("desc").textContent = text;
    $("feels").textContent = Math.round(c.apparent_temperature) + "°C";
    $("hum").textContent = c.relative_humidity_2m + "%";
    $("wind").textContent = Math.round(c.wind_speed_10m) + " km/h";
    $("current").hidden = false;

    const fmt = new Intl.DateTimeFormat("pt-PT", { weekday: "short" });
    $("forecast").innerHTML = d.time.map((t, i) => {
      const [ic, tx] = describe(d.weather_code[i]);
      const name = i === 0 ? "Hoje" : fmt.format(new Date(t + "T12:00"));
      const rain = d.precipitation_probability_max[i];
      return `<div class="day" title="${esc(tx)}">
        <div class="d-name">${esc(name.replace(".", ""))}</div>
        <div class="d-icon" aria-hidden="true">${ic}</div>
        <div><strong>${Math.round(d.temperature_2m_max[i])}°</strong> / ${Math.round(d.temperature_2m_min[i])}°</div>
        <div class="rain">💧 ${rain ?? 0}%</div></div>`;
    }).join("");
    $("forecastBox").hidden = false;
  }

  $("form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("q").value.trim();
    if (q) searchCity(q);
  });
  $("chips").innerHTML = CITIES.map((c) => `<button class="chip" type="button">${esc(c)}</button>`).join("");
  $("chips").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    $("q").value = b.textContent;
    searchCity(b.textContent);
  });
  $("geo").addEventListener("click", () => {
    if (!navigator.geolocation) return setStatus("O seu navegador não suporta localização.", true);
    setStatus("A obter a sua localização…");
    navigator.geolocation.getCurrentPosition(
      (p) => loadWeather(p.coords.latitude, p.coords.longitude, "A sua localização", "")
        .catch((e) => setStatus(e.message, true)),
      () => setStatus("Não foi possível obter a localização. Verifique a permissão do navegador.", true));
  });

  let last = "Luanda";
  try { last = localStorage.getItem("tempo-cidade") || last; } catch {}
  $("q").value = last;
  searchCity(last);
})();
