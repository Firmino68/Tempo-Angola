(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const API = "https://api.open-meteo.com/v1/forecast";
  const CITIES = ["Luanda", "Benguela", "Huambo", "Lubango", "Cabinda", "Malanje", "Uíge", "Namibe", "Saurimo", "Menongue"];
  // Capitais das 18 províncias: [nome, latitude, longitude]
  const CAPITALS = [["Luanda", -8.839, 13.289], ["Caxito", -8.578, 13.664], ["Benguela", -12.578, 13.405], ["Kuito", -12.383, 16.939],
    ["Cabinda", -5.557, 12.189], ["Menongue", -14.658, 17.691], ["N'dalatando", -9.298, 14.912], ["Sumbe", -11.206, 13.844],
    ["Ondjiva", -17.066, 15.733], ["Huambo", -12.776, 15.739], ["Lubango", -14.917, 13.493], ["Dundo", -7.367, 20.833],
    ["Saurimo", -9.661, 20.392], ["Malanje", -9.543, 16.341], ["Luena", -11.783, 19.917], ["Namibe", -15.196, 12.152],
    ["Uíge", -7.608, 15.061], ["M'banza Kongo", -6.268, 14.243]];
  const sum = (a) => a.reduce((s, x) => s + (x || 0), 0);
  const max = (a, d = 0) => (a.length ? Math.max(...a) : d);

  function describe(code) {
    if (code === 0) return ["☀️", "Céu limpo"];
    if (code === 1) return ["🌤️", "Quase limpo"];
    if (code === 2) return ["⛅", "Parcialmente nublado"];
    if (code === 3) return ["☁️", "Nublado"];
    if (code === 45 || code === 48) return ["🌫️", "Nevoeiro"];
    if (code >= 51 && code <= 57) return ["🌦️", "Chuvisco"];
    if (code >= 61 && code <= 67) return ["🌧️", "Chuva"];
    if (code >= 80 && code <= 82) return ["🌦️", "Aguaceiros"];
    if (code >= 95) return ["⛈️", "Trovoada"];
    return ["🌡️", "Sem informação"];
  }

  let req = 0, st = { city: null, w: null, day: 0 }, fieldCache = {}, country = null, sortBy = "az", tab = "hoje";
  const setStatus = (msg, error = false, id = "status") => { $(id).textContent = msg; $(id).className = "status" + (error ? " error" : ""); };
  async function getJson(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error("Falha na ligação ao serviço do tempo.");
    return r.json();
  }
  const errMsg = (e) => (navigator.onLine ? e.message : "Sem ligação à internet.");

  // ================= A) Veredictos "Posso…?" =================
  // Horas do dia (6h-20h) com os valores de que as regras precisam
  function dayRows(w, d) {
    const day = w.daily.time[d], h = w.hourly, out = [];
    h.time.forEach((t, i) => {
      const hr = +t.slice(11, 13);
      if (t.startsWith(day) && hr >= 6 && hr <= 20)
        out.push({ hr, f: h.apparent_temperature[i], pp: h.precipitation_probability[i] ?? 0, pr: h.precipitation[i] ?? 0, wind: h.wind_speed_10m[i] ?? 0, uv: h.uv_index[i] ?? 0 });
    });
    return out;
  }
  // Maior período seguido de horas que cumpre a condição
  function bestWindow(rows, ok) {
    let best = null, cur = null;
    rows.forEach((r) => {
      if (ok(r)) { cur = cur ? { a: cur.a, b: r.hr } : { a: r.hr, b: r.hr }; if (!best || cur.b - cur.a > best.b - best.a) best = { ...cur }; } else cur = null;
    });
    return best;
  }
  const span = (w) => (w ? w.b - w.a + 1 : 0);
  const fmtWin = (w) => (w.a === w.b ? `por volta das ${w.a}h` : `entre as ${w.a}h e as ${w.b + 1}h`);
  const uvLabel = (u) => (u < 3 ? "baixo" : u < 6 ? "moderado" : u < 8 ? "alto" : u < 11 ? "muito alto" : "extremo");

  // Cada regra devolve [nível (0 bom, 1 atenção, 2 evitar), texto, etiqueta]
  const RULES = [
    { icon: "👕", q: "Secar roupa ao sol", f: (R) => {
      const w = bestWindow(R, (r) => r.pp < 30 && r.pr < 0.1 && r.hr >= 8 && r.hr <= 17);
      if (span(w) >= 4) return [0, `Sim, ${fmtWin(w)}.`, "Pode"];
      if (span(w) >= 2) return [1, `Só um período curto: ${fmtWin(w)}.`, "Com cuidado"];
      return [2, `Chuva provável (até ${max(R.map((r) => r.pp))}%). Seque dentro de casa.`, "Não"]; } },
    { icon: "☂️", q: "Levar guarda-chuva", f: (R) => {
      const p = R.reduce((a, r) => (r.pp > a.pp ? r : a), R[0]);
      if (p.pp >= 60 || sum(R.map((r) => r.pr)) >= 5) return [2, `Chuva provável por volta das ${p.hr}h (${p.pp}%).`, "Leve"];
      if (p.pp >= 30) return [1, `${p.pp}% de hipótese de chuva por volta das ${p.hr}h.`, "Talvez"];
      return [0, "Dia seco, não é preciso.", "Dispensa"]; } },
    { icon: "🏖️", q: "Praia e ar livre", f: (R) => {
      const w = bestWindow(R, (r) => r.pp < 30 && r.f <= 33 && r.hr >= 8 && r.hr <= 17), uv = max(R.map((r) => r.uv));
      const note = uv >= 8 ? " UV muito alto ao meio-dia." : "";
      if (span(w) >= 3) return [0, `Boas condições ${fmtWin(w)}.${note}`, "Bom"];
      if (span(w) >= 1) return [1, `Só ${fmtWin(w)}.${note}`, "Atenção"];
      return [2, "Chuva ou calor a mais para ficar ao ar livre.", "Evite"]; } },
    { icon: "⚽", q: "Desporto e exercício", f: (R) => {
      const w = bestWindow(R, (r) => r.f <= 30 && r.pp < 30);
      if (span(w) >= 2) return [0, `Melhor ${fmtWin(w)}.`, "Bom"];
      if (R.some((r) => r.f <= 33 && r.pp < 60)) return [1, "Calor ou chuva possíveis. Hidrate-se e faça pausas.", "Atenção"];
      return [2, "Muito calor ou chuva. Prefira espaços cobertos.", "Evite"]; } },
    { icon: "🏍️", q: "Viajar de moto ou a pé", f: (R) => {
      const pp = max(R.map((r) => r.pp)), wd = Math.round(max(R.map((r) => r.wind)));
      if (pp >= 60 || wd >= 40) return [2, `Chuva até ${pp}% e vento até ${wd} km/h. Estrada escorregadia.`, "Evite"];
      if (pp >= 30 || wd >= 25) return [1, `Chuva até ${pp}% e vento até ${wd} km/h. Redobre a atenção.`, "Atenção"];
      return [0, "Sem chuva nem vento relevantes.", "Bom"]; } },
    { icon: "🕶️", q: "Proteção solar", f: (R, w, d) => {
      const uv = Math.round(w.daily.uv_index_max[d] ?? 0), hi = bestWindow(R, (r) => r.uv >= 6);
      const when = hi ? ` Evite o sol ${fmtWin(hi)}.` : "";
      return [uv < 3 ? 0 : uv < 8 ? 1 : 2, `Índice UV ${uv} (${uvLabel(uv)}).${uv >= 3 ? " Use protetor solar." : ""}${when}`, uv < 3 ? "Baixo" : uv < 8 ? "Moderado" : "Alto"]; } }
  ];

  function renderVerdicts() {
    const R = dayRows(st.w, st.day);
    $("verdicts").innerHTML = R.length ? RULES.map((r) => {
      const [lv, text, label] = r.f(R, st.w, st.day);
      return `<article class="v l${lv}"><div class="v-ic" aria-hidden="true">${r.icon}</div><div><h3>${r.q}</h3><span class="pill">${label}</span><p>${esc(text)}</p></div></article>`;
    }).join("") : "<p>Sem dados horários para este dia.</p>";
  }

  // ================= Tempo atual e previsão =================
  async function selectCity(city) {
    const id = ++req;
    setStatus("A carregar…");
    try {
      const w = await getJson(`${API}?latitude=${city.lat}&longitude=${city.lon}` +
        "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day" +
        "&hourly=apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,uv_index" +
        "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto&forecast_days=7");
      if (id !== req) return;
      st.city = city; st.w = w; st.day = 0;
      renderToday(w, city);
      setStatus("");
      if (tab === "campo") loadField();
    } catch (e) { if (id === req) setStatus(errMsg(e), true); }
  }

  function renderToday(w, city) {
    const c = w.current, d = w.daily, [icon, text] = describe(c.weather_code);
    document.body.dataset.theme = c.is_day ? "day" : "night";
    $("place").textContent = city.region && city.region !== city.name ? `${city.name}, ${city.region}` : city.name;
    $("icon").textContent = icon; $("temp").textContent = Math.round(c.temperature_2m) + "°C"; $("desc").textContent = text;
    $("feels").textContent = Math.round(c.apparent_temperature) + "°C"; $("hum").textContent = c.relative_humidity_2m + "%";
    $("wind").textContent = Math.round(c.wind_speed_10m) + " km/h";
    const fmt = new Intl.DateTimeFormat("pt-PT", { weekday: "short" });
    $("forecast").innerHTML = d.time.map((t, i) => {
      const [ic, tx] = describe(d.weather_code[i]);
      return `<div class="day" title="${esc(tx)}"><div class="d-name">${i === 0 ? "Hoje" : esc(fmt.format(new Date(t + "T12:00")).replace(".", ""))}</div>
        <div class="d-icon" aria-hidden="true">${ic}</div><div><strong>${Math.round(d.temperature_2m_max[i])}°</strong> / ${Math.round(d.temperature_2m_min[i])}°</div>
        <div class="rain">💧 ${d.precipitation_probability_max[i] ?? 0}%</div></div>`;
    }).join("");
    document.querySelectorAll("#dayseg button").forEach((b) => b.classList.toggle("on", b.dataset.day === "0"));
    renderVerdicts();
    ["current", "ask", "forecastBox"].forEach((i) => ($(i).hidden = false));
  }

  // ================= B) Modo Campo =================
  async function loadField() {
    if (!st.city) return setStatus("Escolha primeiro uma cidade.", false, "fieldStatus");
    const c = st.city, key = c.lat + "," + c.lon;
    $("field").innerHTML = "";
    try {
      if (!fieldCache[key]) {
        setStatus("A carregar dados do solo e da chuva…", false, "fieldStatus");
        fieldCache[key] = await getJson(`${API}?latitude=${c.lat}&longitude=${c.lon}&past_days=7&forecast_days=7&timezone=auto` +
          "&daily=precipitation_sum,et0_fao_evapotranspiration,wind_speed_10m_max,precipitation_probability_max&hourly=soil_moisture_3_to_9cm");
      }
      if (st.city !== c) return;
      renderField(fieldCache[key], c);
      setStatus("", false, "fieldStatus");
    } catch (e) { setStatus(errMsg(e), true, "fieldStatus"); }
  }

  function renderField(w, c) {
    const d = w.daily, local = new Date(Date.now() + (w.utc_offset_seconds || 0) * 1000).toISOString();
    const i0 = Math.max(0, d.time.indexOf(local.slice(0, 10)));
    const past = d.precipitation_sum.slice(Math.max(0, i0 - 7), i0), next = d.precipitation_sum.slice(i0, i0 + 7);
    const rainPast = sum(past), rainNext = sum(next), rain3 = sum(next.slice(0, 3)), maxDay3 = max(next.slice(0, 3).map((x) => x || 0));
    const et = sum(d.et0_fao_evapotranspiration.slice(i0, i0 + 7)), balance = rainNext - et;
    const hi = w.hourly.time.findIndex((t) => t.startsWith(local.slice(0, 13)));
    let sm = null;
    for (let i = hi >= 0 ? hi : w.hourly.soil_moisture_3_to_9cm.length - 1; i >= 0 && sm === null; i--) sm = w.hourly.soil_moisture_3_to_9cm[i];
    const smTxt = sm === null ? "n/d" : sm < 0.15 ? "Seco" : sm <= 0.3 ? "Adequado" : "Húmido";
    const windMax = max(d.wind_speed_10m_max.slice(i0, i0 + 2)), pp = d.precipitation_probability_max[i0] ?? 0;

    const advice = [];
    if (sm !== null && sm < 0.15 && rain3 < 5) advice.push([2, "💧", "Regar", `Solo seco e só ${rain3.toFixed(0)} mm de chuva nos próximos 3 dias: rega recomendada.`]);
    else if ((sm !== null && sm > 0.3) || rain3 >= 10) advice.push([0, "💧", "Não regar", `Solo húmido ou chuva a caminho (${rain3.toFixed(0)} mm em 3 dias).`]);
    else advice.push([1, "💧", "Rega moderada", "Solo e chuva em equilíbrio. Observe o terreno antes de regar."]);
    if (maxDay3 >= 30) advice.push([2, "🌱", "Adie adubação e sementeira", `Chuva forte (até ${Math.round(maxDay3)} mm num dia) pode arrastar sementes e adubo.`]);
    else if (rain3 >= 5 && (sm === null || sm >= 0.15)) advice.push([0, "🌱", "Boas condições para semear", "Humidade suficiente e sem chuva excessiva prevista."]);
    else advice.push([1, "🌱", "Semear com cuidado", "Solo pouco húmido: só semeie se puder regar."]);
    if (windMax >= 20 || pp >= 50) advice.push([2, "🧴", "Evite pulverizar", `Vento até ${Math.round(windMax)} km/h ou chuva provável (${pp}%).`]);
    else advice.push([0, "🧴", "Pulverização possível", "Vento fraco e baixa hipótese de chuva nos próximos dias."]);

    const month = new Date().getMonth() + 1, wet = month >= 10 || month <= 4;
    const maxMm = Math.max(1, max(d.precipitation_sum.slice(Math.max(0, i0 - 7), i0 + 7).map((x) => x || 0)));
    const bars = d.time.slice(Math.max(0, i0 - 7), i0 + 7).map((t, k) => {
      const idx = Math.max(0, i0 - 7) + k, mm = d.precipitation_sum[idx] || 0, cls = idx < i0 ? "past" : idx === i0 ? "today" : "";
      return `<div class="bar ${cls}" title="${t}: ${mm.toFixed(1)} mm"><span>${Math.round(mm)}</span><i style="height:${Math.max(2, (mm / maxMm) * 85)}%"></i></div>`;
    }).join("");

    $("field").innerHTML = `<h2 class="sec">${esc(c.name)} · condições para o campo</h2>
      <div class="season">${wet ? "🌧️ <strong>Época das chuvas</strong> (aprox. outubro a abril)." : "🌤️ <strong>Cacimbo</strong> (aprox. maio a setembro): mais seco e fresco."}
        Em algumas zonas do norte a época seca é mais curta.</div>
      <div class="stats">
        <div class="stat"><b>${smTxt}</b><span>Solo${sm !== null ? " · " + Math.round(sm * 100) + "% humidade" : ""}</span></div>
        <div class="stat"><b>${rainPast.toFixed(0)} mm</b><span>Chuva nos últimos 7 dias</span></div>
        <div class="stat"><b>${rainNext.toFixed(0)} mm</b><span>Chuva prevista (7 dias)</span></div>
        <div class="stat"><b>${balance >= 0 ? "+" : ""}${balance.toFixed(0)} mm</b><span>Balanço (chuva − evaporação)</span></div>
      </div>
      <h2 class="sec" style="margin-top:20px">O que fazer</h2>
      <div class="advice">${advice.map(([lv, ic, t, tx]) => `<article class="v l${lv}"><div class="v-ic" aria-hidden="true">${ic}</div><div><h3>${t}</h3><p>${esc(tx)}</p></div></article>`).join("")}</div>
      <h2 class="sec" style="margin-top:20px">Chuva diária (mm)</h2>
      <div class="bars" role="img" aria-label="Gráfico da chuva dos últimos 7 dias e dos próximos 7 dias">${bars}</div>
      <p class="legend">Cinzento: últimos 7 dias · Escuro: hoje · Azul: previsão.</p>`;
  }

  // ================= C) Angola de relance =================
  async function loadCountry() {
    if (country) return renderCountry();
    setStatus("A carregar as 18 capitais…", false, "countryStatus");
    try {
      const data = await getJson(`${API}?latitude=${CAPITALS.map((c) => c[1]).join(",")}&longitude=${CAPITALS.map((c) => c[2]).join(",")}` +
        "&current=temperature_2m,weather_code&daily=temperature_2m_max,precipitation_probability_max,precipitation_sum,uv_index_max&timezone=auto&forecast_days=1");
      const arr = Array.isArray(data) ? data : [data];
      country = CAPITALS.map(([name, lat, lon], i) => ({ name, lat, lon, t: arr[i].current.temperature_2m, code: arr[i].current.weather_code,
        tmax: arr[i].daily.temperature_2m_max[0], pp: arr[i].daily.precipitation_probability_max[0] ?? 0, mm: arr[i].daily.precipitation_sum[0] ?? 0, uv: arr[i].daily.uv_index_max[0] ?? 0 }));
      setStatus("", false, "countryStatus");
      renderCountry();
    } catch (e) { setStatus(errMsg(e), true, "countryStatus"); }
  }
  function renderCountry() {
    const by = (k) => country.reduce((a, c) => (c[k] > a[k] ? c : a));
    const hot = by("tmax"), wet = country.reduce((a, c) => (c.pp > a.pp || (c.pp === a.pp && c.mm > a.mm) ? c : a)), uv = by("uv");
    $("ranks").innerHTML = `<div class="rank">🔥 <strong>Mais quente hoje:</strong> ${esc(hot.name)} (${Math.round(hot.tmax)}°C)</div>
      <div class="rank">🌧️ ${wet.pp > 0 ? `<strong>Maior hipótese de chuva:</strong> ${esc(wet.name)} (${wet.pp}%)` : "<strong>Sem chuva prevista</strong> em nenhuma capital hoje"}</div>
      <div class="rank">🕶️ <strong>UV mais alto:</strong> ${esc(uv.name)} (${Math.round(uv.uv)}, ${uvLabel(uv.uv)})</div>`;
    const list = [...country];
    if (sortBy === "az") list.sort((a, b) => a.name.localeCompare(b.name, "pt"));
    if (sortBy === "hot") list.sort((a, b) => b.tmax - a.tmax);
    if (sortBy === "rain") list.sort((a, b) => b.pp - a.pp || b.mm - a.mm);
    if (sortBy === "uv") list.sort((a, b) => b.uv - a.uv);
    $("country").innerHTML = list.map((c) => `<button class="c" data-i="${CAPITALS.findIndex((x) => x[0] === c.name)}" aria-label="Ver ${esc(c.name)}">
      <h3>${esc(c.name)}</h3><span class="big">${describe(c.code)[0]} ${Math.round(c.t)}°</span>
      <small>Máx. ${Math.round(c.tmax)}° · 💧 ${c.pp}%</small><small>UV ${Math.round(c.uv)}</small></button>`).join("");
  }

  // ================= Eventos =================
  function showTab(name) {
    tab = name;
    document.querySelectorAll("[data-tab]").forEach((b) => {
      const on = b.dataset.tab === name;
      b.setAttribute("aria-selected", on); $("p-" + b.dataset.tab).hidden = !on;
    });
    if (name === "campo") loadField();
    if (name === "angola") loadCountry();
  }
  async function searchCity(name) {
    const id = ++req;
    setStatus("A procurar…");
    try {
      const geo = await getJson("https://geocoding-api.open-meteo.com/v1/search?count=1&language=pt&format=json&countryCode=AO&name=" + encodeURIComponent(name));
      if (id !== req) return;
      const c = geo.results && geo.results[0];
      if (!c) return setStatus(`Não encontrei "${name}" em Angola. Verifique o nome e tente de novo.`, true);
      try { localStorage.setItem("tempo-cidade", c.name); } catch {}
      selectCity({ lat: c.latitude, lon: c.longitude, name: c.name, region: c.admin1 });
    } catch (e) { if (id === req) setStatus(errMsg(e), true); }
  }

  document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  $("form").addEventListener("submit", (e) => { e.preventDefault(); const q = $("q").value.trim(); if (q) { showTab("hoje"); searchCity(q); } });
  $("chips").innerHTML = CITIES.map((c) => `<button class="chip" type="button">${esc(c)}</button>`).join("");
  $("chips").addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (b) { $("q").value = b.textContent; searchCity(b.textContent); } });
  $("dayseg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || !st.w) return;
    st.day = +b.dataset.day; document.querySelectorAll("#dayseg button").forEach((x) => x.classList.toggle("on", x === b)); renderVerdicts();
  });
  $("sort").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    sortBy = b.dataset.sort; document.querySelectorAll("#sort button").forEach((x) => x.classList.toggle("on", x === b)); if (country) renderCountry();
  });
  $("country").addEventListener("click", (e) => {
    const b = e.target.closest(".c"); if (!b) return;
    const [name, lat, lon] = CAPITALS[+b.dataset.i];
    $("q").value = name; showTab("hoje"); selectCity({ lat, lon, name, region: "" });
  });
  $("geo").addEventListener("click", () => {
    if (!navigator.geolocation) return setStatus("O seu navegador não suporta localização.", true);
    setStatus("A obter a sua localização…");
    navigator.geolocation.getCurrentPosition(
      (p) => { showTab("hoje"); selectCity({ lat: p.coords.latitude, lon: p.coords.longitude, name: "A sua localização", region: "" }); },
      () => setStatus("Não foi possível obter a localização. Verifique a permissão do navegador.", true));
  });

  let last = "Luanda";
  try { last = localStorage.getItem("tempo-cidade") || last; } catch {}
  $("q").value = last;
  searchCity(last);
})();
