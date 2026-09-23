// Dependency-free widget export helpers.
//
// SVG-based widgets (NetworkGraph, Recharts bar/line charts) are pure inline
// vector markup, so they rasterize cleanly to PNG via a plain canvas -- no
// html2canvas/dom-to-image needed. The Leaflet map is a mosaic of
// cross-origin OpenStreetMap tile images with no CORS headers, which taints
// any canvas drawn from them (toDataURL throws SecurityError), so a raster
// screenshot of the map can't be produced reliably client-side without a
// server-side proxy. Instead the map exports its underlying hotspot
// coordinates as GeoJSON, a standard format investigators can open directly
// in QGIS/Google Earth -- more useful than a screenshot for follow-up work.

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  triggerDownload(blob, filename);
}

export function downloadHotspotsAsGeoJson(hotspots: Array<{ lat: number; lng: number; label?: string }>, filename: string) {
  const geojson = {
    type: "FeatureCollection",
    features: (hotspots || []).map((h) => ({
      type: "Feature",
      properties: { label: h.label || "Hotspot" },
      geometry: { type: "Point", coordinates: [h.lng, h.lat] },
    })),
  };
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" });
  triggerDownload(blob, filename);
}

// H.1.5: evidence-grade export -- an officer/case/timestamp footer baked
// into the exported PNG (not the source SVG, which stays a clean widget for
// on-screen use) so the file is self-describing when dropped into a
// chargesheet annexure, matching the same provenance idea the PDF dossier's
// own audit_hash already uses. Omitted entirely (no footer band) when no
// caller passes it -- every existing call site is unaffected.
export interface ExportFooter {
  officer?: string;
  badge?: string;
  caseRef?: string;
}

export function downloadSvgAsPng(svgEl: SVGSVGElement, filename: string, scale = 2, footer?: ExportFooter) {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  // Recharts/inline SVGs rely on ambient CSS for text/stroke colors that
  // won't apply once serialized standalone -- bake in dark-panel styling
  // explicitly so the exported PNG isn't invisible white-on-white.
  if (!clone.getAttribute("fill")) clone.setAttribute("fill", "none");
  const bbox = svgEl.getBoundingClientRect();
  const width = svgEl.viewBox?.baseVal?.width || bbox.width || 640;
  const height = svgEl.viewBox?.baseVal?.height || bbox.height || 380;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const svgString = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const footerH = footer ? 26 : 0;
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = (height + footerH) * scale;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);
    if (footer) {
      ctx.strokeStyle = "rgba(199,154,78,0.35)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, height);
      ctx.lineTo(width, height);
      ctx.stroke();
      const stampParts = [
        footer.officer ? `Officer: ${footer.officer}${footer.badge ? ` (${footer.badge})` : ""}` : null,
        footer.caseRef ? `Ref: ${footer.caseRef}` : null,
        `Generated: ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`,
      ].filter(Boolean);
      ctx.fillStyle = "#C79A4E";
      ctx.font = "9px monospace";
      ctx.textBaseline = "middle";
      ctx.fillText(stampParts.join("   •   "), 8, height + footerH / 2);
    }
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, filename);
    }, "image/png");
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}
