// ============================================================
// Gráfica: "Clasificación nutricional según IMC y semanas de gestación"
// ------------------------------------------------------------
// Dibujo SVG autocontenido (React + CSS del proyecto). Los datos de
// ejes, zonas y curvas viven en ../data/imcEmbarazo.js.
//
// Interactividad:
//   * Inputs para la semana de gestación (10–42) y el IMC (17–33).
//   * El punto negro se mueve automáticamente con los valores.
//   * Al pasar el cursor o tocar el punto se muestran los valores.
//   * Validación de rangos.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import {
    EJES,
    ZONAS,
    FRONTERAS,
    CURVAS_REFERENCIA,
    FUENTE,
    AVISO_ILUSTRATIVO,
    MEDICION_INICIAL,
} from "../data/imcEmbarazo";

const VB = { w: 860, h: 560 };
const M = { top: 64, right: 26, bottom: 96, left: 66 };
const PLOT_W = VB.w - M.left - M.right;
const PLOT_H = VB.h - M.top - M.bottom;

const limitar = (v, min, max) => Math.min(Math.max(v, min), max);

// Escalas datos -> píxeles.
const escalaX = (sem) => M.left + ((sem - EJES.x.min) / (EJES.x.max - EJES.x.min)) * PLOT_W;
const escalaY = (imc) => M.top + ((EJES.y.max - imc) / (EJES.y.max - EJES.y.min)) * PLOT_H;

// Convierte [[sem, imc], ...] a coordenadas de píxel.
const aPixeles = (puntos) => puntos.map(([s, i]) => ({ x: escalaX(s), y: escalaY(i) }));

// Camino suavizado (Catmull-Rom -> Bézier cúbica) que empieza en un "M".
const caminoSuave = (pts) => {
    if (!pts.length) return "";
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] || pts[i + 1];
        const c1x = p1.x + (p2.x - p0.x) / 6;
        const c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6;
        const c2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return d;
};

// Banda cerrada entre una curva superior y otra inferior (ambas ascendentes).
const banda = (superior, inferior) => {
    const sup = caminoSuave(superior);
    const inf = caminoSuave([...inferior].reverse()).replace(/^M/, "L");
    return `${sup} ${inf} Z`;
};

// Línea horizontal constante a un IMC dado.
const lineaImc = (imc) => [
    [EJES.x.min, imc],
    [EJES.x.max, imc],
];

export default function GraficaIMCEmbarazo({ semanaInicial, imcInicial }) {
    const [semana, setSemana] = useState(semanaInicial ?? MEDICION_INICIAL.semana);
    const [imc, setImc] = useState(imcInicial ?? MEDICION_INICIAL.imc);

    useEffect(() => {
        if (semanaInicial != null) setSemana(semanaInicial);
    }, [semanaInicial]);
    useEffect(() => {
        if (imcInicial != null) setImc(imcInicial);
    }, [imcInicial]);

    const semanaNum = Number(semana);
    const imcNum = Number(imc);
    const semanaValida =
        semana !== "" && Number.isFinite(semanaNum) && semanaNum >= EJES.x.min && semanaNum <= EJES.x.max;
    const imcValido = imc !== "" && Number.isFinite(imcNum) && imcNum >= EJES.y.min && imcNum <= EJES.y.max;

    const semPlot = limitar(Number.isFinite(semanaNum) ? semanaNum : MEDICION_INICIAL.semana, EJES.x.min, EJES.x.max);
    const imcPlot = limitar(Number.isFinite(imcNum) ? imcNum : MEDICION_INICIAL.imc, EJES.y.min, EJES.y.max);
    const punto = { x: escalaX(semPlot), y: escalaY(imcPlot) };

    const geometria = useMemo(() => {
        const bajoNormal = aPixeles(FRONTERAS.bajoNormal);
        const normalSobrepeso = aPixeles(FRONTERAS.normalSobrepeso);
        const sobrepesoObesidad = aPixeles(FRONTERAS.sobrepesoObesidad);
        const piso = aPixeles(lineaImc(EJES.y.min));
        const techo = aPixeles(lineaImc(EJES.y.max));

        const zonas = [
            { zona: ZONAS[0], d: banda(bajoNormal, piso) },
            { zona: ZONAS[1], d: banda(normalSobrepeso, bajoNormal) },
            { zona: ZONAS[2], d: banda(sobrepesoObesidad, normalSobrepeso) },
            { zona: ZONAS[3], d: banda(techo, sobrepesoObesidad) },
        ];

        const verticales = [];
        for (let s = EJES.x.min; s <= EJES.x.max; s++) {
            verticales.push({ s, mayor: (s - EJES.x.min) % EJES.x.pasoEtiqueta === 0 });
        }
        const horizontales = [];
        for (let v = EJES.y.min; v <= EJES.y.max + 1e-9; v += EJES.y.pasoMenor) {
            const r = Math.round(v * 100) / 100;
            horizontales.push({ v: r, mayor: Math.abs(r - Math.round(r)) < 1e-9 });
        }

        const curvas = CURVAS_REFERENCIA.map((c) => caminoSuave(aPixeles(c)));
        return { zonas, verticales, horizontales, curvas };
    }, []);

    const etiquetasX = [];
    for (let s = EJES.x.min; s <= EJES.x.max; s += EJES.x.pasoEtiqueta) etiquetasX.push(s);
    const etiquetasY = [];
    for (let v = EJES.y.min; v <= EJES.y.max + 1e-9; v += EJES.y.pasoEtiqueta) etiquetasY.push(Math.round(v));

    // Flecha amarilla grande apuntando al punto (en la referencia viene desde
    // la derecha, casi horizontal).
    const flecha = useMemo(() => {
        const origen = {
            x: limitar(punto.x + 185, 16, VB.w - 16),
            y: limitar(punto.y + 8, M.top + 8, VB.h - 12),
        };
        const dx = punto.x - origen.x;
        const dy = punto.y - origen.y;
        const largo = Math.hypot(dx, dy) || 1;
        const ux = dx / largo;
        const uy = dy / largo;
        const punta = { x: punto.x - ux * 20, y: punto.y - uy * 20 };
        const headLen = 48;
        const headW = 48;
        const base = { x: punta.x - ux * headLen, y: punta.y - uy * headLen };
        const perp = { x: -uy, y: ux };
        return {
            origen,
            base,
            cabeza: [
                punta,
                { x: base.x + (perp.x * headW) / 2, y: base.y + (perp.y * headW) / 2 },
                { x: base.x - (perp.x * headW) / 2, y: base.y - (perp.y * headW) / 2 },
            ],
        };
    }, [punto.x, punto.y]);

    const [hover, setHover] = useState(false);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-4">
                <label className="flex flex-col gap-1 text-xs font-semibold text-[#424752]">
                    Semana de gestación ({EJES.x.min}–{EJES.x.max})
                    <input
                        type="number"
                        min={EJES.x.min}
                        max={EJES.x.max}
                        step="1"
                        value={semana}
                        onChange={(e) => setSemana(e.target.value)}
                        className={`w-32 rounded-md border px-2 py-1.5 text-sm font-normal text-[#191c1e] outline-none ${
                            semanaValida || semana === "" ? "border-[#c2c6d4]" : "border-[#e11d1d] bg-[#fff5f5]"
                        }`}
                    />
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-[#424752]">
                    IMC (kg/m²) ({EJES.y.min}–{EJES.y.max})
                    <input
                        type="number"
                        step={EJES.y.pasoMenor}
                        min={EJES.y.min}
                        max={EJES.y.max}
                        value={imc}
                        onChange={(e) => setImc(e.target.value === "" ? "" : Number(e.target.value))}
                        onBlur={() => {
                            if (imc !== "" && Number.isFinite(imcNum)) {
                                setImc(limitar(imcNum, EJES.y.min, EJES.y.max));
                            }
                        }}
                        className={`w-28 rounded-md border px-2 py-1.5 text-sm ${
                            imcValido || imc === "" ? "border-[#c2c6d4]" : "border-[#e11d1d] bg-[#fff5f5]"
                        }`}
                    />
                </label>
            </div>

            {(!semanaValida || !imcValido) && (
                <div className="text-xs font-semibold text-[#b91c1c] bg-[#ffdad6]/60 border border-[#e11d1d]/30 rounded px-3 py-2">
                    {!semanaValida && `La semana debe estar entre ${EJES.x.min} y ${EJES.x.max}. `}
                    {!imcValido && `El IMC debe estar entre ${EJES.y.min} y ${EJES.y.max}.`}
                </div>
            )}

            <svg
                viewBox={`0 0 ${VB.w} ${VB.h}`}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="Clasificación nutricional según IMC y semanas de gestación"
                className="w-full h-auto select-none"
            >
                <defs>
                    <clipPath id="imcPlotClip">
                        <rect x={M.left} y={M.top} width={PLOT_W} height={PLOT_H} />
                    </clipPath>
                    <filter id="imcSombra" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.25" />
                    </filter>
                </defs>

                <rect x="0" y="0" width={VB.w} height={VB.h} fill="#ffffff" />

                <text x={VB.w / 2} y="28" textAnchor="middle" fontSize="20" fontWeight="700" fill="#111111">
                    Clasificación nutricional según IMC y semanas de gestación
                </text>

                <g clipPath="url(#imcPlotClip)">
                    {geometria.zonas.map(({ zona, d }) => (
                        <path key={zona.id} d={d} fill={zona.color} fillOpacity="0.9" />
                    ))}
                </g>

                <g clipPath="url(#imcPlotClip)">
                    {geometria.verticales.map(({ s, mayor }) => (
                        <line
                            key={`v${s}`}
                            x1={escalaX(s)}
                            y1={M.top}
                            x2={escalaX(s)}
                            y2={VB.h - M.bottom}
                            stroke="#111"
                            strokeWidth={mayor ? 0.8 : 0.4}
                            strokeOpacity={mayor ? 0.35 : 0.16}
                        />
                    ))}
                    {geometria.horizontales.map(({ v, mayor }) => (
                        <line
                            key={`h${v}`}
                            x1={M.left}
                            y1={escalaY(v)}
                            x2={VB.w - M.right}
                            y2={escalaY(v)}
                            stroke="#111"
                            strokeWidth={mayor ? 0.8 : 0.4}
                            strokeOpacity={mayor ? 0.35 : 0.16}
                        />
                    ))}
                </g>

                <g clipPath="url(#imcPlotClip)">
                    {geometria.curvas.map((d, i) => (
                        <path key={i} d={d} fill="none" stroke="#111111" strokeWidth="2.4" strokeLinecap="round" />
                    ))}
                </g>

                <rect
                    x={M.left}
                    y={M.top}
                    width={PLOT_W}
                    height={PLOT_H}
                    fill="none"
                    stroke="#111111"
                    strokeWidth="1.6"
                />

                {etiquetasX.map((s) => (
                    <text key={`tx${s}`} x={escalaX(s)} y={VB.h - M.bottom + 20} textAnchor="middle" fontSize="12" fill="#111111">
                        {s}
                    </text>
                ))}
                <text
                    x={M.left + PLOT_W / 2}
                    y={VB.h - 16}
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="600"
                    fill="#111111"
                >
                    {EJES.x.etiqueta}
                </text>

                {etiquetasY.map((v) => (
                    <text key={`ty${v}`} x={M.left - 10} y={escalaY(v) + 4} textAnchor="end" fontSize="12" fill="#111111">
                        {v}
                    </text>
                ))}
                <text
                    x="18"
                    y={M.top + PLOT_H / 2}
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="600"
                    fill="#111111"
                    transform={`rotate(-90 18 ${M.top + PLOT_H / 2})`}
                >
                    {EJES.y.etiqueta}
                </text>

                {/* Flecha amarilla grande */}
                <g filter="url(#imcSombra)">
                    <line
                        x1={flecha.origen.x}
                        y1={flecha.origen.y}
                        x2={flecha.base.x}
                        y2={flecha.base.y}
                        stroke="#111111"
                        strokeWidth="16"
                        strokeLinecap="round"
                    />
                    <line
                        x1={flecha.origen.x}
                        y1={flecha.origen.y}
                        x2={flecha.base.x}
                        y2={flecha.base.y}
                        stroke="#f7f700"
                        strokeWidth="13"
                        strokeLinecap="round"
                    />
                    <polygon
                        points={flecha.cabeza.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="#f7f700"
                        stroke="#111111"
                        strokeWidth="2.5"
                    />
                </g>

                {/* Punto de medición */}
                <circle
                    cx={punto.x}
                    cy={punto.y}
                    r="6.5"
                    fill="#111111"
                    stroke="#ffffff"
                    strokeWidth="2"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHover(true)}
                    onMouseLeave={() => setHover(false)}
                    onTouchStart={() => setHover(true)}
                    onTouchEnd={() => setHover(false)}
                />

                {/* Tooltip de valores */}
                {hover && (
                    <g pointerEvents="none">
                        <rect
                            x={limitar(punto.x + 12, M.left, VB.w - M.right - 150)}
                            y={limitar(punto.y - 34, M.top, VB.h - M.bottom - 30)}
                            width="150"
                            height="28"
                            rx="6"
                            fill="#111111"
                            fillOpacity="0.9"
                        />
                        <text
                            x={limitar(punto.x + 12, M.left, VB.w - M.right - 150) + 75}
                            y={limitar(punto.y - 34, M.top, VB.h - M.bottom - 30) + 19}
                            textAnchor="middle"
                            fontSize="12"
                            fontWeight="600"
                            fill="#ffffff"
                        >
                            Semana {semPlot} · IMC {imcPlot.toFixed(1)}
                        </text>
                    </g>
                )}

                {/* Leyenda inferior derecha */}
                <g transform={`translate(${VB.w - M.right - 172}, ${VB.h - M.bottom - 98})`}>
                    <rect x="-10" y="-8" width="180" height="100" rx="6" fill="#ffffff" fillOpacity="0.92" stroke="#c2c6d4" />
                    {[...ZONAS].reverse().map((z, i) => (
                        <g key={z.id} transform={`translate(0, ${i * 22})`}>
                            <rect width="18" height="14" fill={z.color} stroke="#111" strokeWidth="0.8" />
                            <text x="26" y="12" fontSize="12" fill="#111111">
                                {z.nombre}
                            </text>
                        </g>
                    ))}
                </g>
            </svg>

            <div className="text-[11px] text-[#727783] -mt-1">
                <span className="font-semibold">Fuente:</span> {FUENTE}
            </div>
            <div className="text-[11px] text-[#424752] bg-[#f4f6f8] border border-[#c2c6d4] rounded px-3 py-2">
                {AVISO_ILUSTRATIVO}
            </div>
        </div>
    );
}
