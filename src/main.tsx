import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// Leaflet's own base stylesheet -- never imported anywhere in this project.
// Without it, .leaflet-container/.leaflet-tile-pane/etc. have none of the
// positioning, sizing, or stacking rules react-leaflet's DOM structure
// depends on, so every map (hotspots inline card, hotspots expanded view)
// rendered as a small, oddly-positioned box instead of filling its
// container, regardless of any fitBounds()/invalidateSize() JS logic.
import 'leaflet/dist/leaflet.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
