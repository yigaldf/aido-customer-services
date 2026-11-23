/* Neon Peach — external data source: Open-Meteo weather API (free, public, no API key).
 * Docs: https://open-meteo.com/en/docs
 * Shows the weather at the bar tonight (opening hours 18:00–02:00) and recommends
 * whether to open the terrace. Works in the browser and in Node 18+ (for tests).
 */
(function (root) {
  "use strict";

  const BAR = { name: "רוטשילד 42, תל אביב", latitude: 32.0636, longitude: 34.7741, timezone: "Asia/Jerusalem" };
  const API = "https://api.open-meteo.com/v1/forecast";
  const CACHE_KEY = "neon-peach-weather-v1";
  const CACHE_MS = 30 * 60 * 1000; // the forecast updates hourly; 30 minutes is plenty
  const OPEN_HOUR = 18, CLOSE_HOUR = 2;

  // WMO weather interpretation codes → Hebrew label + emoji
  const WMO = [
    [[0], "בהיר", "☀️"], [[1], "בהיר בעיקר", "🌤️"], [[2], "מעונן חלקית", "⛅"], [[3], "מעונן", "☁️"],
    [[45, 48], "ערפל", "🌫️"], [[51, 53, 55, 56, 57], "טפטוף", "🌦️"], [[61, 63, 65, 66, 67], "גשם", "🌧️"],
    [[71, 73, 75, 77, 85, 86], "שלג", "❄️"], [[80, 81, 82], "ממטרים", "🌦️"], [[95, 96, 99], "סופת רעמים", "⛈️"],
  ];
  function describe(code) {
    const hit = WMO.find(([codes]) => codes.includes(code));
    return hit ? { label: hit[1], emoji: hit[2] } : { label: "לא ידוע", emoji: "🌡️" };
  }

  function buildUrl(loc = BAR) {
    const q = new URLSearchParams({
      latitude: loc.latitude, longitude: loc.longitude, timezone: loc.timezone, forecast_days: "2",
      current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation",
      hourly: "temperature_2m,precipitation_probability,weather_code,wind_speed_10m",
    });
    return `${API}?${q}`;
  }

  /** `now` is the local time at the bar as "YYYY-MM-DDTHH:MM" (the API's own time format). */
  function summarizeTonight(data, now = data.current.time) {
    const h = data.hourly;
    const today = now.slice(0, 10);
    const hourNow = Number(now.slice(11, 13));
    // After midnight but before closing, "tonight" is the night that started yesterday.
    const start = hourNow < CLOSE_HOUR ? now.slice(0, 13) : `${today}T${String(Math.max(OPEN_HOUR, hourNow)).padStart(2, "0")}`;
    const startIdx = h.time.findIndex((t) => t.slice(0, 13) >= start);
    const shift = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
    const night = hourNow < CLOSE_HOUR ? shift(today, -1) : today; // the date the night started
    const morning = shift(night, 1);
    const idx = [];
    for (let i = Math.max(0, startIdx); i < h.time.length && startIdx >= 0; i++) {
      const date = h.time[i].slice(0, 10), hr = Number(h.time[i].slice(11, 13));
      if ((date === night && hr >= OPEN_HOUR) || (date === morning && hr < CLOSE_HOUR)) idx.push(i);
      else if (date > night && !(date === morning && hr < CLOSE_HOUR)) break;
    }
    if (!idx.length) return null;
    const temps = idx.map((i) => h.temperature_2m[i]);
    const rain = idx.map((i) => h.precipitation_probability[i] ?? 0);
    const wind = idx.map((i) => h.wind_speed_10m[i] ?? 0);
    const codes = idx.map((i) => h.weather_code[i]);
    // the "worst" weather of the night decides the label
    const worst = codes.reduce((a, b) => (b > a ? b : a), codes[0]);
    const summary = {
      from: h.time[idx[0]].slice(11, 16),
      to: `${String(CLOSE_HOUR).padStart(2, "0")}:00`,
      minTemp: Math.round(Math.min(...temps)),
      maxTemp: Math.round(Math.max(...temps)),
      maxRain: Math.max(...rain),
      maxWind: Math.round(Math.max(...wind)),
      ...describe(worst),
      hours: idx.map((i) => ({ time: h.time[i].slice(11, 16), temp: Math.round(h.temperature_2m[i]), rain: h.precipitation_probability[i] ?? 0, ...describe(h.weather_code[i]) })),
    };
    summary.terrace = summary.maxRain >= 40 || summary.minTemp < 14 || summary.maxWind >= 30
      ? { open: false, text: "מומלץ לסגור את המרפסת הערב", why: summary.maxRain >= 40 ? `סיכוי לגשם עד ${summary.maxRain}%` : summary.minTemp < 14 ? `קר, עד ${summary.minTemp}°` : `רוח עד ${summary.maxWind} קמ"ש` }
      : { open: true, text: "אפשר לפתוח את המרפסת הערב", why: `בין ${summary.minTemp}° ל-${summary.maxTemp}°, סיכוי לגשם עד ${summary.maxRain}%` };
    return summary;
  }

  async function fetchWeather({ useCache = true } = {}) {
    if (useCache) {
      try {
        const c = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (c && Date.now() - c.savedAt < CACHE_MS) return c.data;
      } catch { /* no cache */ }
    }
    let res;
    for (let attempt = 0; ; attempt++) {
      try {
        res = await fetch(buildUrl());
        if (res.ok || res.status < 500 || attempt >= 1) break;
      } catch (e) {
        if (attempt >= 1) throw e;
      }
      await new Promise((r) => setTimeout(r, 1000)); // one retry for a network hiccup or 5xx
    }
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(`Open-Meteo: ${data.reason}`);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data })); } catch { /* storage blocked */ }
    return data;
  }

  const api = { BAR, buildUrl, describe, summarizeTonight, fetchWeather };
  root.NPWeather = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
