// ============================================================
// DATOS DE LA GRÁFICA: Clasificación nutricional según IMC y
// semanas de gestación.
// ------------------------------------------------------------
// Valores de fronteras extraídos de la gráfica de referencia
// (nomograma "Gráfica No.1"), muestreados semana a semana entre
// las 10 y las 42 semanas de gestación.
//
//   Cada punto es [semana de gestación, IMC (kg/m²)].
//
// Este archivo está separado a propósito: el dibujo vive en
// ../components/GraficaIMCEmbarazo.jsx y sólo consume estos datos.
// Si se actualiza la fuente, sólo hay que reemplazar FRONTERAS.
// ============================================================

export const EJES = {
    x: {
        min: 10,
        max: 42,
        etiqueta: "Semanas de gestación",
        // Se rotula cada `pasoEtiqueta` semanas; la cuadrícula menor va cada 1.
        pasoEtiqueta: 2,
    },
    y: {
        min: 17,
        max: 33,
        etiqueta: "Índice de Masa Corporal (kg/m²)",
        // Etiquetas cada 1; cuadrícula menor cada 0.5.
        pasoEtiqueta: 1,
        pasoMenor: 0.5,
    },
};

// Zonas de clasificación (colores muestreados de la gráfica de referencia).
// El orden es de abajo hacia arriba.
export const ZONAS = [
    { id: "bajo_peso", nombre: "Bajo peso", color: "#e40000", texto: "#ffffff" },
    { id: "normal", nombre: "Normal", color: "#88c088", texto: "#123c12" },
    { id: "sobrepeso", nombre: "Sobrepeso", color: "#f7f700", texto: "#3a3000" },
    { id: "obesidad", nombre: "Obesidad", color: "#f48058", texto: "#4a1a0a" },
];

// Fronteras entre zonas. Cada arreglo tiene puntos [semana, imc] y se dibuja
// como una curva suavizada ascendente. El orden es de abajo hacia arriba:
//   * bajoNormal       -> límite entre Bajo peso y Normal
//   * normalSobrepeso  -> límite entre Normal y Sobrepeso
//   * sobrepesoObesidad-> límite entre Sobrepeso y Obesidad
export const FRONTERAS = {
    bajoNormal: [
        [10, 21.24], [11, 21.25], [12, 21.33], [13, 21.39], [14, 21.46], [15, 21.6], [16, 21.77],
        [17, 21.96], [18, 22.14], [19, 22.31], [20, 22.46], [21, 22.65], [22, 22.82], [23, 22.99],
        [24, 23.18], [25, 23.39], [26, 23.6], [27, 23.82], [28, 24.01], [29, 24.26], [30, 24.51],
        [31, 24.75], [32, 24.98], [33, 25.21], [34, 25.43], [35, 25.71], [36, 25.88], [37, 26.1],
        [38, 26.3], [39, 26.49], [40, 26.65], [41, 26.85], [42, 27.05],
    ],
    normalSobrepeso: [
        [10, 24.57], [11, 24.6], [12, 24.65], [13, 24.82], [14, 24.95], [15, 25.05], [16, 25.21],
        [17, 25.33], [18, 25.45], [19, 25.61], [20, 25.73], [21, 25.82], [22, 26.04], [23, 26.18],
        [24, 26.32], [25, 26.48], [26, 26.67], [27, 26.82], [28, 27.01], [29, 27.23], [30, 27.43],
        [31, 27.6], [32, 27.8], [33, 27.99], [34, 28.16], [35, 28.3], [36, 28.46], [37, 28.61],
        [38, 28.8], [39, 28.93], [40, 29.08], [41, 29.26], [42, 29.44],
    ],
    sobrepesoObesidad: [
        [10, 26.7], [11, 26.76], [12, 26.82], [13, 26.95], [14, 27.02], [15, 27.14], [16, 27.24],
        [17, 27.39], [18, 27.51], [19, 27.6], [20, 27.76], [21, 27.88], [22, 28.02], [23, 28.15],
        [24, 28.29], [25, 28.42], [26, 28.55], [27, 28.68], [28, 28.79], [29, 28.95], [30, 29.07],
        [31, 29.2], [32, 29.33], [33, 29.46], [34, 29.6], [35, 29.7], [36, 29.79], [37, 29.89],
        [38, 30.01], [39, 30.15], [40, 30.23], [41, 30.24], [42, 30.25],
    ],
};

// Curvas de frontera dibujadas como líneas (referencia visual del nomograma).
export const CURVAS_REFERENCIA = [
    FRONTERAS.bajoNormal,
    FRONTERAS.normalSobrepeso,
    FRONTERAS.sobrepesoObesidad,
];

// Punto de referencia de la gráfica original (sólo si no se recibe medición).
export const MEDICION_INICIAL = { semana: 28, imc: 23.4 };

// Bibliografía / fuente mostrada bajo la gráfica.
export const FUENTE =
    "Mardones F, Rosso P, et al. Comparison of three gestational weight guidelines underuse in Latin America. Am J Perinatol (Santiago-Chile) 2021; vol. 9: p. 6.";

// Nota bajo la gráfica.
export const AVISO_ILUSTRATIVO =
    "Curvas muestreadas del nomograma de referencia, semana a semana (10–42).";
