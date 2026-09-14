export type BasemapMode = "street" | "satellite" | "dark";

export interface BasemapTileDef {
  id: BasemapMode;
  name: string;
  nameKn: string;
  base: string;
  overlay?: string;
  attribution: string;
  maxZoom: number;
}

export const BASEMAP_TILES: Record<BasemapMode, BasemapTileDef> = {
  street: {
    id: "street",
    name: "Street",
    nameKn: "ಬೀದಿ",
    base: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    id: "satellite",
    name: "Satellite",
    nameKn: "ಉಪಗ್ರಹ",
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    overlay: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri, i-cubed, USDA, USGS, GeoEye",
    maxZoom: 19,
  },
  dark: {
    id: "dark",
    name: "Dark",
    nameKn: "ಕಪ್ಪು",
    base: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    overlay: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
    maxZoom: 16,
  },
};
