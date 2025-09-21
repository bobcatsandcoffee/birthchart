// This is the Chart-to-Art Generator Component
import React, { useEffect, useMemo, useRef, useState } from "react";

// NOTE: This is a simplified version of the V2 generator from your history
// to demonstrate the two-page setup. We can add all the advanced export
// features back in once this is running.

export default function Art() {
  const [jsonText, setJsonText] = useState(() => JSON.stringify({
    name: 'Jane Doe',
    utc: '1990-01-01T12:00:00Z',
    bodies:[{name:'Sun',lon:281.32},{name:'Moon',lon:13.51}],
    aspects:[{a:'Sun',b:'Moon',aspect:'Trine'}],
    asc:105.0
  }, null, 2));

  const data = useMemo(() => { try { return JSON.parse(jsonText); } catch { return {}; } }, [jsonText]);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Chart-to-Art Generator</h1>
      <p>This page will display the art templates.</p>
      <p>Chart data for: <strong>{data.name || '...'}</strong></p>
      
      <textarea 
        value={jsonText}
        onChange={(e) => setJsonText(e.target.value)}
        rows="15"
        style={{ width: '100%', marginTop: '1rem' }}
      />
      
      <div style={{marginTop: '1rem'}}>
        <p><strong>Next Steps:</strong></p>
        <ul>
          <li>Implement the deep-link from the main app to this page.</li>
          <li>Add the SVG rendering logic for the templates (Sky, Floral, etc.).</li>
          <li>Add the export buttons (PDF, PNG, SVG).</li>
        </ul>
      </div>
    </div>
  );
}
