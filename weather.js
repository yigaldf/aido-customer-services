/* Neon Peach — external data source: Open-Meteo weather API (free, public, no API key).
 * Docs: https://open-meteo.com/en/docs
 * Model: ECMWF IFS 0.25° (closest to other public forecasts for Tel Aviv evenings; see WORKLOG #20).
 * Shows tonight's weather and a 10-day outlook at the bar, and decides when terrace
 * bookings are allowed. Works in the browser and in Node 18+ (for tests).
 */
(function (root) {
  "use strict";

  const BAR = { name: "רוטשילד 42, תל אביב", latitude: 32.0636, longitude: 34.7741, timezone: "Asia/Jerusalem" };
  const API = "https://api.open-meteo.com/v1/forecast";
  const MODEL = "ecmwf_ifs025";
  const DAYS = 10;
  const CACHE_KEY = "neon-peach-weather-v3";
  const CACHE_MS = 30 * 60 * 1000; // the forecast updates every few hours; 30 minutes is plenty
  const OPEN_HOUR = 18, CLOSE_HOUR = 2;

  /**
   * Terrace rules — one place, used for tonight, for the 10-day outlook and for every booking.
   * The terrace is closed if, during the hours checked, the temperature drops below 14°
   * or rain is expected (rain probability ≥ 40%, any forecast rain ≥ 0.1 mm, or a rain/storm weather code).
   */
  const TERRACE_RULES = { minTemp: 14, rainProbability: 40, rainMm: 0.1, sittingHours: 3 };

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
  const isRainCode = (c) => c >= 51; // drizzle, rain, snow, showers, thunderstorms

  function buildUrl(loc = BAR) {
    const q = new URLSearchParams({
      latitude: loc.latitude, longitude: loc.longitude, timezone: loc.timezone,
      models: MODEL, forecast_days: String(DAYS + 1), // +1 so the 10th night (until 02:00) is covered
      current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation",
      hourly: "temperature_2m,precipitation_probability,precipitation,weather_code",
      daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code",
    });
    return `${API}?${q}`;
  }

  const shift = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
  const fmtDate = (d) => d.split("-").reverse().slice(0, 2).join(".");

  /** Apply the terrace rules to a list of hourly indices. */
  function evaluate(h, idx) {
    const temps = idx.map((i) => h.temperature_2m[i]);
    const probs = idx.map((i) => h.precipitation_probability?.[i] ?? 0);
    const mms = idx.map((i) => h.precipitation?.[i] ?? 0);
    const codes = idx.map((i) => h.weather_code[i]);
    const minTemp = Math.round(Math.min(...temps));
    const maxTemp = Math.round(Math.max(...temps));
    const maxRain = Math.max(...probs);
    const rainMm = Math.round(mms.reduce((a, b) => a + b, 0) * 10) / 10;
    const rainy = maxRain >= TERRACE_RULES.rainProbability || mms.some((m) => m >= TERRACE_RULES.rainMm) || codes.some(isRainCode);
    const cold = minTemp < TERRACE_RULES.minTemp;
    const worst = codes.reduce((a, b) => (b > a ? b : a), codes[0]);
    const why = rainy && cold ? `צפוי גשם וקר (עד ${minTemp}°)`
      : rainy ? `צפוי גשם (סיכוי ${maxRain}%${rainMm ? `, ${rainMm} מ"מ` : ""})`
      : cold ? `קר, הטמפרטורה יורדת ל-${minTemp}°` : null;
    return { known: true, ok: !why, minTemp, maxTemp, maxRain, rainMm, rainy, cold, why, ...describe(worst) };
  }

  /** Hourly indices for the bar's opening hours of the night that starts on `date`. Null if any hour is missing. */
  function nightIndices(h, date, fromHour = OPEN_HOUR) {
    const idx = [];
    const hours = [];
    for (let hr = OPEN_HOUR; hr < 24 + CLOSE_HOUR; hr++) if (hr >= fromHour) hours.push(hr);
    for (const hr of hours) {
      const d = hr >= 24 ? shift(date, 1) : date;
      const i = h.time.indexOf(`${d}T${String(hr % 24).padStart(2, "0")}:00`);
      if (i < 0 || h.temperature_2m[i] == null) return null;
      idx.push(i);
    }
    return idx;
  }

  /** `now` is the local time at the bar as "YYYY-MM-DDTHH:MM" (the API's own time format). */
  function summarizeTonight(data, now = data.current.time) {
    const h = data.hourly;
    const hourNow = Number(now.slice(11, 13));
    // After midnight but before closing, "tonight" is the night that started yesterday.
    const afterMidnight = hourNow < CLOSE_HOUR;
    const night = afterMidnight ? shift(now.slice(0, 10), -1) : now.slice(0, 10);
    const fromHour = afterMidnight ? 24 + hourNow : Math.max(OPEN_HOUR, hourNow);
    const idx = nightIndices(h, night, fromHour);
    if (!idx || !idx.length) return null;
    const e = evaluate(h, idx);
    return {
      ...e,
      date: night,
      from: h.time[idx[0]].slice(11, 16),
      to: `${String(CLOSE_HOUR).padStart(2, "0")}:00`,
      hours: idx.map((i) => ({ time: h.time[i].slice(11, 16), temp: Math.round(h.temperature_2m[i]), rain: h.precipitation_probability?.[i] ?? 0, ...describe(h.weather_code[i]) })),
      terrace: e.ok
        ? { open: true, text: "המרפסת פתוחה הערב, ואפשר להזמין מקום במרפסת", why: `בין ${e.minTemp}° ל-${e.maxTemp}°, סיכוי לגשם עד ${e.maxRain}%` }
        : { open: false, text: "המרפסת סגורה הערב, ואין הזמנות למרפסת", why: e.why },
    };
  }

  /** The next 10 days: the day's weather plus the terrace decision for that evening (18:00–02:00). */
  function nextDays(data, days = DAYS) {
    const dl = data.daily, h = data.hourly;
    const names = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
    const today = data.current.time.slice(0, 10);
    return dl.time.slice(0, days).map((date, i) => {
      const idx = nightIndices(h, date);
      const night = idx ? evaluate(h, idx) : { known: false, ok: false, why: "אין תחזית לכל שעות הערב" };
      const dow = new Date(date + "T12:00:00Z").getUTCDay();
      return {
        date,
        name: date === today ? "היום" : date === shift(today, 1) ? "מחר" : names[dow],
        dateLabel: fmtDate(date),
        max: Math.round(dl.temperature_2m_max[i]),
        min: Math.round(dl.temperature_2m_min[i]),
        rainProbability: dl.precipitation_probability_max?.[i] ?? 0,
        rainMm: dl.precipitation_sum?.[i] ?? 0,
        ...describe(dl.weather_code[i]),
        night,
      };
    });
  }

  /**
   * Can a terrace table be booked for `date` ("YYYY-MM-DD") at `time` ("HH:MM")?
   * Checks the sitting (the booked hour + the next 2 hours, within opening hours).
   * Without a forecast for those hours: known=false, ok=false (no terrace without a forecast).
   */
  function checkTerrace(data, date, time) {
    const none = (reason) => ({ known: false, ok: false, reason });
    if (!data || !data.hourly || !date || !/^\d{2}:\d{2}$/.test(time || "")) {
      return none("אין תחזית זמינה, ולכן אי אפשר להזמין מקום במרפסת");
    }
    const h = data.hourly;
    const startHour = Number(time.slice(0, 2));
    const slots = [];
    for (let k = 0; k < TERRACE_RULES.sittingHours; k++) {
      const hr = startHour + k;
      if (k > 0 && hr % 24 >= CLOSE_HOUR && hr % 24 < OPEN_HOUR) break; // past closing time
      const d = hr >= 24 ? shift(date, 1) : date;
      const i = h.time.indexOf(`${d}T${String(hr % 24).padStart(2, "0")}:00`);
      if (i < 0 || h.temperature_2m[i] == null) {
        return none(`אין תחזית ל-${fmtDate(date)} בשעה ${time} (התחזית מכסה ${DAYS} ימים), ולכן אי אפשר להזמין מקום במרפסת`);
      }
      slots.push(i);
    }
    const e = evaluate(h, slots);
    return e.ok
      ? { ...e, reason: `המרפסת פתוחה: ${e.minTemp}°, סיכוי לגשם ${e.maxRain}%` }
      : { ...e, reason: `המרפסת סגורה להזמנות בשעה הזו: ${e.why}` };
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

  const api = { BAR, MODEL, DAYS, TERRACE_RULES, buildUrl, describe, evaluate, summarizeTonight, nextDays, checkTerrace, fetchWeather };
  root.NPWeather = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
