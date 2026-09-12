// Coordenadas de referencia del municipio y sus zonas.
// La ciudad de Huehuetenango se divide en 12 zonas. Como no se guarda una
// coordenada exacta por paciente, cada "Zona N" se representa con un punto de
// referencia aproximado (se puede afinar aquí según el mapa real).
export const MUNICIPIO = {
  nombre: "Zaculeu, Huehuetenango, Guatemala",
  centro: [15.3147, -91.4761],
  centroSalud: {
    nombre: "Centro Médico Nacional (Centro Médico Público de Zaculeu)",
    lat: 15.3263237,
    lng: -91.4974738,
  },
};

export const ZONAS = [
  { clave: "Zona 1",  nombre: "Zona 1",  lat: 15.3147, lng: -91.4761 },
  { clave: "Zona 2",  nombre: "Zona 2",  lat: 15.3185, lng: -91.4790 },
  { clave: "Zona 3",  nombre: "Zona 3",  lat: 15.3075, lng: -91.4795 },
  { clave: "Zona 4",  nombre: "Zona 4",  lat: 15.3120, lng: -91.4715 },
  { clave: "Zona 5",  nombre: "Zona 5",  lat: 15.3205, lng: -91.4725 },
  { clave: "Zona 6",  nombre: "Zona 6",  lat: 15.3260, lng: -91.4780 },
  { clave: "Zona 7",  nombre: "Zona 7",  lat: 15.3070, lng: -91.4850 },
  { clave: "Zona 8",  nombre: "Zona 8",  lat: 15.3015, lng: -91.4740 },
  { clave: "Zona 9",  nombre: "Zona 9",  lat: 15.3263237, lng: -91.4974738 },
  { clave: "Zona 10", nombre: "Zona 10", lat: 15.3225, lng: -91.4660 },
  { clave: "Zona 11", nombre: "Zona 11", lat: 15.3140, lng: -91.4660 },
  { clave: "Zona 12", nombre: "Zona 12", lat: 15.3305, lng: -91.4830 },
];

// Otros lugares (aldeas, municipios cercanos): se detectan por palabra clave
// en la dirección. Agregar aquí más lugares con su patrón de búsqueda.
export const LUGARES = [
  { clave: "Chiantla", nombre: "Chiantla", lat: 15.3567, lng: -91.4568, patron: /\bchiantla\b/i },
];

// Mapa de búsqueda rápida: "Zona 9" → {lat, lng} y "Chiantla" → {...}
export const CATALOGO_LUGARES = (() => {
  const m = {};
  ZONAS.forEach((z) => { m[z.clave] = z; });
  LUGARES.forEach((l) => { m[l.clave] = l; });
  return m;
})();