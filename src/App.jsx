import * as Astronomy from "astronomy-engine";
import React, { useState, useMemo, useEffect } from 'react';

const A = Astronomy;

const ZODIAC = [
  { name: "Aries", symbol: "\u2648", element: "Fire", quality: "Cardinal" },
  { name: "Taurus", symbol: "\u2649", element: "Earth", quality: "Fixed" },
  { name: "Gemini", symbol: "\u264A", element: "Air", quality: "Mutable" },
  { name: "Cancer", symbol: "\u264B", element: "Water", quality: "Cardinal" },
  { name: "Leo", symbol: "\u264C", element: "Fire", quality: "Fixed" },
  { name: "Virgo", symbol: "\u264D", element: "Earth", quality: "Mutable" },
  { name: "Libra", symbol: "\u264E", element: "Air", quality: "Cardinal" },
  { name: "Scorpio", symbol: "\u264F", element: "Water", quality: "Fixed" },
  { name: "Sagittarius", symbol: "\u2650", element: "Fire", quality: "Mutable" },
  { name: "Capricorn", symbol: "\u2651", element: "Earth", quality: "Cardinal" },
  { name: "Aquarius", symbol: "\u2652", element: "Air", quality: "Fixed" },
  { name: "Pisces", symbol: "\u2653", element: "Water", quality: "Mutable" },
];

const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const ASPECTS = { Conjunction: 0, Opposition: 180, Trine: 120, Square: 90, Sextile: 60 };
const ORBS = { Conjunction: 8, Opposition: 8, Trine: 8, Square: 6, Sextile: 4 };

const fmt = (n) => n.toFixed(2);
const fmtDeg = (d) => `${Math.floor(d)}° ${Math.floor((d % 1) * 60)}'`;

export default function App() {
  const [form, setForm] = useState({
    name: 'Jane Doe',
    date: '1971-11-28',
    time: '14:30',
    lat: '34.0536909',
    lon: '-118.242766',
    tz: '-7',
    timeMode: 'Noon',
    address: 'Los Angeles, CA',
  });
  const [geocodingStatus, setGeocodingStatus] = useState('');
  const [chartData, setChartData] = useState(null);
  const [houseData, setHouseData] = useState({ asc: null, houses: [] });
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleGeocode = async () => {
    if (!form.address) {
      setGeocodingStatus('Please enter an address.');
      return;
    }
    setGeocodingStatus('Geocoding...');
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(form.address )}&format=json&limit=1`;
      const response = await fetch(url);
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        setForm({ ...form, lat, lon });
        setGeocodingStatus(`Resolved to: ${display_name}`);
      } else {
        setGeocodingStatus('Address not found.');
      }
    } catch (e) {
      setGeocodingStatus(`Error: ${e.message}`);
    }
  };

  const calculateChart = async () => {
    if (!A) {
      setError('Astronomy Engine not loaded. Please refresh the page.');
      return;
    }
    setError('');
    try {
      let utcDate;
      
      if (form.timeMode === 'Exact') {
        const [year, month, day] = form.date.split('-').map(Number);
        const [hour, minute] = form.time.split(':').map(Number);
        const localDate = new Date(year, month - 1, day, hour, minute);
        if (isNaN(localDate.getTime())) {
            setError("Invalid date or time format.");
            return;
        }
        utcDate = new Date(localDate.getTime() - (Number(form.tz) * 3600 * 1000));
      } else {
        const [year, month, day] = form.date.split('-').map(Number);
        const observer = new A.Observer(parseFloat(form.lat), parseFloat(form.lon), 0);
        const dateForSun = new Date(year, month - 1, day, 12);
        let targetHour = 12;
        if (form.timeMode === 'Sunrise') {
            const rise = A.SearchRiseSet(A.Body.Sun, observer, 1, dateForSun, 300);
            if (rise) targetHour = rise.hour;
        }
        if (form.timeMode === 'Sunset') {
            const set = A.SearchRiseSet(A.Body.Sun, observer, -1, dateForSun, 300);
            if (set) targetHour = set.hour;
        }
        if (form.timeMode === 'Midnight') targetHour = 0;
        utcDate = new Date(Date.UTC(year, month - 1, day, targetHour, 0, 0));
      }

      if (isNaN(utcDate.getTime())) {
        setError("Failed to create a valid UTC date. Please check all inputs.");
        return;
      }

      const bodies = PLANETS.map(name => {
        const lon = A.Ecliptic(A.Body[name], utcDate).lon;
        const signIndex = Math.floor(lon / 30);
        const sign = ZODIAC[signIndex];
        return { name, lon, signName: sign.name, element: sign.element, quality: sign.quality, degInSign: lon % 30 };
      });

      const aspects = [];
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const angle = Math.abs(bodies[i].lon - bodies[j].lon);
          const diff = angle > 180 ? 360 - angle : angle;
          for (const aspectName in ASPECTS) {
            if (Math.abs(diff - ASPECTS[aspectName]) < ORBS[aspectName]) {
              aspects.push({ a: bodies[i].name, b: bodies[j].name, aspect: aspectName, orb: Math.abs(diff - ASPECTS[aspectName]) });
            }
          }
        }
      }
      
      setChartData({ bodies, aspects, utc: utcDate });
      await computeAscHousesIfPossible(utcDate, parseFloat(form.lat), parseFloat(form.lon));

    } catch (e) {
      setError(`Calculation Error: ${e.message}`);
      setChartData(null);
    }
  };
  
  const computeAscHousesIfPossible = async (utcDate, lat, lon) => {
    const swe = window.swe;
    if (!swe || form.timeMode !== 'Exact') {
        setHouseData({ asc: null, houses: [] });
        return;
    }
    try {
        if (!swe.initialized) {
            await swe.init();
            swe.initialized = true;
        }
        const jdut = swe.toJulianDay(utcDate);
        const res = swe.housesEx(jdut, lat, lon, 'W');
        const ascLon = res.ascmc[0];
        const houses = Array.from({ length: 12 }, (_, i) => (ascLon + i * 30) % 360);
        setHouseData({ asc: ascLon, houses });
    } catch (e) {
        setError(`Swiss Ephemeris Error: ${e.message}`);
    }
  };

  useEffect(() => {
    calculateChart();
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Astrological Birth Chart</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem', background: '#f9f9f9', padding: '1rem', borderRadius: '8px' }}>
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
          {form.timeMode === 'Exact' && <input name="time" type="time" value={form.time} onChange={handleInputChange} />}
        </div>
        <input name="tz" type="number" value={form.tz} onChange={handleInputChange} placeholder="Timezone Offset (e.g., -7)" />
        <div>
          <input name="address" value={form.address} onChange={handleInputChange} placeholder="Birth Place (e.g., City, State)" style={{width: '70%'}}/>
          <button onClick={handleGeocode} style={{width: '28%'}}>Geocode</button>
          <p style={{fontSize: '0.8em', margin: 0}}>{geocodingStatus}</p>
        </div>
        <input name="lat" value={form.lat} onChange={handleInputChange} placeholder="Latitude" />
        <input name="lon" value={form.lon} onChange={handleInputChange} placeholder="Longitude" />
      </div>
      <button onClick={calculateChart} style={{ marginBottom: '2rem', padding: '0.5rem 1rem', cursor: 'pointer' }}>Generate Chart</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {chartData && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div>
            <h2>Positions</h2>
            <table border="1" cellPadding="5" style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr><th>Planet</th><th>Longitude</th><th>Sign</th><th>Position in Sign</th></tr></thead>
              <tbody>
                {chartData.bodies.map(p => (
                  <tr key={p.name}><td>{p.name}</td><td>{fmt(p.lon)}°</td><td>{p.signName}</td><td>{fmtDeg(p.degInSign)}</td></tr>
                ))}
                {houseData.asc && (
                    <tr><td>Ascendant</td><td>{fmt(houseData.asc)}°</td><td>{ZODIAC[Math.floor(houseData.asc / 30)].name}</td><td>{fmtDeg(houseData.asc % 30)}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div>
            <h2>Aspects</h2>
            <table border="1" cellPadding="5" style={{ borderCollapse: 'collapse', width: '100%' }}>
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
