import * as Astronomy from "astronomy-engine";
import React, { useState, useEffect } from "react";

const A = Astronomy;

const ZODIAC = [
  { name: "Aries",       symbol: "\u2648", element: "Fire",  quality: "Cardinal" },
  { name: "Taurus",      symbol: "\u2649", element: "Earth", quality: "Fixed" },
  { name: "Gemini",      symbol: "\u264A", element: "Air",   quality: "Mutable" },
  { name: "Cancer",      symbol: "\u264B", element: "Water", quality: "Cardinal" },
  { name: "Leo",         symbol: "\u264C", element: "Fire",  quality: "Fixed" },
  { name: "Virgo",       symbol: "\u264D", element: "Earth", quality: "Mutable" },
  { name: "Libra",       symbol: "\u264E", element: "Air",   quality: "Cardinal" },
  { name: "Scorpio",     symbol: "\u264F", element: "Water", quality: "Fixed" },
  { name: "Sagittarius", symbol: "\u2650", element: "Fire",  quality: "Mutable" },
  { name: "Capricorn",   symbol: "\u2651", element: "Earth", quality: "Cardinal" },
  { name: "Aquarius",    symbol: "\u2652", element: "Air",   quality: "Fixed" },
  { name: "Pisces",      symbol: "\u2653", element: "Water", quality: "Mutable" },
];

const PLANETS  = ["Sun","Moon","Mercury","Venus","Mars","Jupiter","Saturn","Uranus","Neptune","Pluto"];
const ASPECTS  = { Conjunction: 0, Opposition: 180, Trine: 120, Square: 90, Sextile: 60 };
const ORBS     = { Conjunction: 8, Opposition: 8, Trine: 8, Square: 6, Sextile: 4 };

const fmt = (n) => Number(n).toFixed(2);
const fmtDeg = (d) => `${Math.floor(d)}° ${Math.floor((d % 1) * 60)}'`;

function signFor(lon) {
  const idx = Math.floor((lon % 360) / 30);
  const s = ZODIAC[idx >= 0 ? idx : idx + 12];
  return { ...s, degInSign: (lon % 30 + 30) % 30 };
}

export default function App() {
  const [form, setForm] = useState({
    name: "Jane Doe",
    date: "1971-11-28",
    time: "14:30",
    tz: "-7",
    timeMode: "Noon", // "Exact" | "Noon" | "Sunrise" | "Sunset" | "Midnight"
    address: "Los Angeles, CA",
    lat: "34.0536909",
    lon: "-118.242766",
  });

  const [geocodingStatus, setGeocodingStatus] = useState("");
  const [chartData, setChartData] = useState(null);
  const [houseData, setHouseData] = useState({ asc: null, houses: [] });
  const [error, setError] = useState("");
  const [selfTest, setSelfTest] = useState(null);

  const handleInputChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function handleGeocode() {
    if (!form.address) {
      setGeocodingStatus("Please enter an address.");
      return;
    }
    setGeocodingStatus("Geocoding...");
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(form.address)}&format=json&limit=1`;
      const r = await fetch(url, { headers: { "Accept": "application/json" }});
      const data = await r.json();
      if (Array.isArray(data) && data.length) {
        const { lat, lon, display_name } = data[0];
        setForm((f) => ({ ...f, lat, lon }));
        setGeocodingStatus(`Resolved to: ${display_name}`);
      } else {
        setGeocodingStatus("Address not found.");
      }
    } catch (e) {
      setGeocodingStatus(`Error: ${e.message}`);
    }
  }

  function buildUTC() {
    const [year, month, day] = form.date.split("-").map(Number);
    if (form.timeMode === "Exact") {
      const [H, M] = form.time.split(":").map(Number);
      const local = new Date(year, month - 1, day, H, M, 0);
      if (isNaN(local.getTime())) throw new Error("Invalid local date/time.");
      return new Date(local.getTime() - Number(form.tz) * 3600 * 1000);
    }

    // Approximate modes via Astronomy when possible; else reasonable defaults.
    const lat = parseFloat(form.lat), lon = parseFloat(form.lon);
    const haveObs = Number.isFinite(lat) && Number.isFinite(lon);
    const baseUTC = Date.UTC(year, month - 1, day, 12, 0, 0);
    let utcDate = new Date(baseUTC);

    if ((form.timeMode === "Sunrise" || form.timeMode === "Sunset") && haveObs) {
      try {
        const obs = new A.Observer(lat, lon, 0);
        const start = new A.AstroTime(utcDate);
        const dir = form.timeMode === "Sunrise" ? +1 : -1;
        const ev = A.SearchRiseSet(A.Body.Sun, obs, dir, start, 2); // search within 2 days
        const t = ev?.time ?? ev; // some versions return the AstroTime directly
        if (t && t.date instanceof Date) {
          utcDate = t.date;
        } else {
          utcDate = new Date(Date.UTC(year, month - 1, day, form.timeMode === "Sunrise" ? 6 : 18, 0, 0));
        }
      } catch {
        utcDate = new Date(Date.UTC(year, month - 1, day, form.timeMode === "Sunrise" ? 6 : 18, 0, 0));
      }
    } else if (form.timeMode === "Midnight") {
      utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    } else if (form.timeMode === "Noon") {
      utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    }
    return utcDate;
  }

  async function calculateChart() {
    try {
      if (!A) throw new Error("Astronomy Engine not loaded.");
      const utcDate = buildUTC();
      if (isNaN(utcDate.getTime())) throw new Error("Invalid UTC date, check inputs.");
      const time = new A.AstroTime(utcDate);

      // Longitudes using EclipticLongitude(...).elon
      const bodies = PLANETS.map((name) => {
        const elon = A.EclipticLongitude(A.Body[name], time).elon; // degrees
        const s = signFor(elon);
        return { name, lon: elon, signName: s.name, element: s.element, quality: s.quality, degInSign: s.degInSign };
      });

      // Aspects
      const aspects = [];
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const angle = Math.abs(bodies[i].lon - bodies[j].lon);
          const diff = angle > 180 ? 360 - angle : angle;
          for (const aspectName in ASPECTS) {
            const exact = ASPECTS[aspectName];
            if (Math.abs(diff - exact) < ORBS[aspectName]) {
              aspects.push({ a: bodies[i].name, b: bodies[j].name, aspect: aspectName, orb: Math.abs(diff - exact) });
            }
          }
        }
      }

      setChartData({ bodies, aspects, utc: utcDate });
      await computeAscHousesIfPossible(utcDate, parseFloat(form.lat), parseFloat(form.lon));
      setError("");
    } catch (e) {
      setError(`Calculation Error: ${e.message}`);
      setChartData(null);
    }
  }

  async function computeAscHousesIfPossible(utcDate, lat, lon) {
    // Whole-sign fallback without Swiss Ephemeris; if SWE present and Exact time, compute real ASC.
    const swe = window?.swe;
    if (!swe || form.timeMode !== "Exact" || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      setHouseData({ asc: null, houses: [] });
      return;
    }
    try {
      if (!swe.initialized) { await swe.init(); swe.initialized = true; }
      const jdut = swe.toJulianDay(utcDate);
      const res = swe.housesEx(jdut, lat, lon, "W"); // Whole Sign
      const ascLon = res.ascmc[0];
      const houses = Array.from({ length: 12 }, (_, i) => (ascLon + i * 30) % 360);
      setHouseData({ asc: ascLon, houses });
    } catch (e) {
      setError(`Swiss Ephemeris Error: ${e.message}`);
    }
  }

  useEffect(() => { calculateChart(); /* run on mount */ }, []);

  function runSelfTest() {
    try {
      const utc = buildUTC();
      const time = new A.AstroTime(utc);
      const elon = A.EclipticLongitude(A.Body.Sun, time).elon;
      const ok = Number.isFinite(elon);
      setSelfTest(ok ? "✅ Astronomy Engine OK" : "❌ Astronomy call failed");
    } catch (e) {
      setSelfTest("❌ " + e.message);
    }
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Astrological Birth Chart</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem", background: "#f9f9f9", padding: "1rem", borderRadius: 8 }}>
        <input name="name" value={form.name} onChange={handleInputChange} placeholder="Name" />
        <input name="date" type="date" value={form.date} onChange={handleInputChange} />
        <div>
          <select name="timeMode" value={form.timeMode} onChange={handleInputChange}>
            <option>Exact</option>
            <option>Noon</option>
            <option>Sunrise</option>
            <option>Sunset</option>
            <option>Midnight</option>
          </select>
          {form.timeMode === "Exact" && <input name="time" type="time" value={form.time} onChange={handleInputChange} />}
        </div>
        <input name="tz" type="number" value={form.tz} onChange={handleInputChange} placeholder="Timezone Offset (e.g., -7)" />
        <div>
          <input name="address" value={form.address} onChange={handleInputChange} placeholder="Birth Place (e.g., City, State)" style={{ width: "70%" }} />
          <button onClick={handleGeocode} style={{ width: "28%" }}>Geocode</button>
          <p style={{ fontSize: "0.8em", margin: 0 }}>{geocodingStatus}</p>
        </div>
        <input name="lat" value={form.lat} onChange={handleInputChange} placeholder="Latitude" />
        <input name="lon" value={form.lon} onChange={handleInputChange} placeholder="Longitude" />
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button onClick={calculateChart}>Generate Chart</button>
        <button onClick={runSelfTest}>Self-test</button>
        {selfTest && <span style={{ fontSize: 12, color: "#555" }}>{selfTest}</span>}
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {chartData && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
          <div>
            <h2>Positions</h2>
            <table border="1" cellPadding="5" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr><th>Planet</th><th>Longitude</th><th>Sign</th><th>Position in Sign</th></tr></thead>
              <tbody>
                {chartData.bodies.map(p => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>{fmt(p.lon)}°</td>
                    <td>{p.signName}</td>
                    <td>{fmtDeg(p.degInSign)}</td>
                  </tr>
                ))}
                {Number.isFinite(houseData.asc) && (
                  <tr>
                    <td>Ascendant</td>
                    <td>{fmt(houseData.asc)}°</td>
                    <td>{signFor(houseData.asc).name}</td>
                    <td>{fmtDeg(houseData.asc % 30)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div>
            <h2>Aspects</h2>
            <table border="1" cellPadding="5" style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr><th>Planet A</th><th>Planet B</th><th>Aspect</th><th>Orb</th></tr></thead>
              <tbody>
                {chartData.aspects.map((a, i) => (
                  <tr key={i}><td>{a.a}</td><td>{a.b}</td><td>{a.aspect}</td><td>{fmt(a.orb)}°</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
