import type { ReactElement } from 'react';
import type { ThemeStyle } from '@theme/core';
import type { ToolId } from '../tools/tools';

/**
 * Toolbar glyphs. Classic Urbe keeps the original municipal set. Neo Urbe (`cyber`) redraws
 * the shared tools as a dark chassis with one emissive mark. Battery, windbreak and corporate
 * HQ already use that language and stay shared. The qanat is redrawn here as a yard
 * and a gantry, so it does not keep the classic lightning box.
 */

const zoneIcon = (color: string, letter: string, dense: boolean): ReactElement => (
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" fill={color} opacity={dense ? 1 : 0.55} />
    {dense && (
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        fill="none"
        stroke="#fff"
        strokeWidth="1.5"
        strokeDasharray="3 2"
      />
    )}
    <text x="12" y="16.5" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
      {letter}
    </text>
  </>
);

const building = (roof: string, wall: string, extra?: ReactElement): ReactElement => (
  <>
    <rect x="5" y="9" width="14" height="11" fill={wall} />
    <path d="M3 10 L12 3 L21 10 Z" fill={roof} />
    {extra}
  </>
);

const CLASSIC: Record<ToolId, ReactElement> = {
  select: <path d="M5 3 L5 19 L9.5 15 L12.5 21 L15 20 L12 14 L18 14 Z" fill="#e8eef6" />,
  road: (
    <>
      <path d="M9 2 H15 L21 22 H3 Z" fill="#5a6270" stroke="#aab4c0" strokeWidth="1.2" />
      <path d="M12 4 V7 M12 10 V14 M12 17 V21" stroke="#f0d050" strokeWidth="1.8" />
    </>
  ),
  powerLine: (
    <>
      <path
        d="M12 2 L7 22 M12 2 L17 22 M8 9 H16 M9 15 H15"
        stroke="#c8ccd2"
        strokeWidth="1.8"
        fill="none"
      />
      <path d="M2 7 Q12 12 22 7" stroke="#f0c030" strokeWidth="1.4" fill="none" />
    </>
  ),
  pipe: (
    <>
      <rect x="2" y="9" width="20" height="6" rx="2" fill="#3090e0" />
      <rect x="6" y="7" width="3" height="10" rx="1" fill="#2070c0" />
      <rect x="15" y="7" width="3" height="10" rx="1" fill="#2070c0" />
    </>
  ),
  canal: (
    <>
      <path d="M3 12 H21" stroke="#c84ad8" strokeWidth="2.2" />
      <circle cx="4" cy="12" r="2.2" fill="#e8d0f0" />
      <circle cx="20" cy="12" r="2.2" fill="#e8d0f0" />
      <circle cx="12" cy="12" r="1.4" fill="#c84ad8" />
    </>
  ),
  zoneResLight: zoneIcon('#3fbf4f', 'R', false),
  zoneResDense: zoneIcon('#2f9f3f', 'R', true),
  zoneComLight: zoneIcon('#3f7fdf', 'C', false),
  zoneComDense: zoneIcon('#2f5fbf', 'C', true),
  zoneIndLight: zoneIcon('#e0b030', 'I', false),
  zoneIndDense: zoneIcon('#c09020', 'I', true),
  dezone: (
    <>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        fill="none"
        stroke="#94a3b8"
        strokeWidth="2"
        strokeDasharray="4 3"
      />
      <path d="M7 7 L17 17 M17 7 L7 17" stroke="#f87171" strokeWidth="2.4" />
    </>
  ),
  demolish: (
    <>
      <rect x="3" y="12" width="13" height="7" rx="1.5" fill="#e0a020" />
      <path d="M16 13 L21 9 L22 18 L16 18 Z" fill="#c08010" />
      <circle cx="6.5" cy="20" r="2" fill="#333" />
      <circle cx="12.5" cy="20" r="2" fill="#333" />
      <rect x="6" y="7" width="6" height="5" fill="#f0c040" />
    </>
  ),
  level: (
    <>
      <path d="M2 18 L8 10 L12 14 L16 8 L22 18 Z" fill="#7a9a50" />
      <path d="M2 19 H22" stroke="#f0d050" strokeWidth="2" />
    </>
  ),
  raise: (
    <>
      <path d="M2 20 L8 14 L12 17 L16 12 L22 20 Z" fill="#7a9a50" />
      <path d="M12 11 L12 3 M9 6 L12 3 L15 6" stroke="#f0d050" strokeWidth="2" fill="none" />
    </>
  ),
  lower: (
    <>
      <path d="M2 8 L8 14 L12 11 L16 16 L22 8 Z" fill="#7a9a50" />
      <path d="M12 13 L12 21 M9 18 L12 21 L15 18" stroke="#f0d050" strokeWidth="2" fill="none" />
    </>
  ),
  trees: (
    <>
      <path d="M8 3 L3 14 H13 Z" fill="#3f9f3f" />
      <rect x="7" y="14" width="2" height="5" fill="#6b4a2a" />
      <path d="M16 6 L11 17 H21 Z" fill="#2f7f2f" />
      <rect x="15" y="17" width="2" height="4" fill="#6b4a2a" />
    </>
  ),
  coalPlant: building('#555', '#8a8a8a', <rect x="14" y="2" width="3" height="8" fill="#666" />),
  gasPlant: building('#7a7a90', '#a0a0b8', <circle cx="12" cy="15" r="3" fill="#e0e0f0" />),
  windTurbine: (
    <>
      <path d="M12 10 L11 22 H13 Z" fill="#e8eef6" />
      <path d="M12 10 L12 2 M12 10 L5 14 M12 10 L19 14" stroke="#e8eef6" strokeWidth="2" />
    </>
  ),
  waterPump: building(
    '#2070c0',
    '#5aa0e0',
    <path d="M12 12 Q9 16 12 18 Q15 16 12 12 Z" fill="#fff" />,
  ),
  well: (
    <>
      <ellipse cx="12" cy="18" rx="7" ry="3" fill="#5aa0e0" />
      <rect x="7" y="10" width="10" height="8" fill="#3f88c8" />
      <ellipse cx="12" cy="10" rx="5" ry="2.2" fill="#8fc0e8" />
    </>
  ),
  policeStation: building(
    '#2040a0',
    '#6080c0',
    <path d="M12 11 L14 15 L12 18 L10 15 Z" fill="#f0d050" />,
  ),
  fireStation: building(
    '#b02020',
    '#e06050',
    <rect x="9" y="13" width="6" height="7" fill="#601010" />,
  ),
  school: building('#a06020', '#e0b070', <rect x="11.5" y="1" width="1" height="5" fill="#333" />),
  hospital: building(
    '#d0d0d0',
    '#f4f4f4',
    <path
      d="M10.5 11 H13.5 V13.5 H16 V16.5 H13.5 V19 H10.5 V16.5 H8 V13.5 H10.5 Z"
      fill="#d03030"
    />,
  ),
  park: (
    <>
      <rect x="2" y="13" width="20" height="8" rx="2" fill="#4caf50" />
      <circle cx="9" cy="10" r="5" fill="#2e7d32" />
      <rect x="8" y="13" width="2" height="5" fill="#6b4a2a" />
      <circle cx="17" cy="16" r="2" fill="#81d4fa" />
    </>
  ),
  marina: (
    <>
      <rect x="3" y="10" width="10" height="8" fill="#8a6a48" />
      <path d="M3 10 L8 5 L13 10 Z" fill="#6a4a30" />
      <rect x="14" y="16" width="8" height="3" fill="#c4a070" />
      <rect x="16" y="13" width="6" height="2" fill="#d4b080" />
    </>
  ),
  airport: (
    <>
      <rect x="3" y="16" width="18" height="4" rx="1" fill="#8a8a90" />
      <rect x="11" y="5" width="3" height="11" fill="#d0d4dc" />
      <path d="M6 11 H19 L14 14 H9 Z" fill="#e8eef4" />
    </>
  ),
  qanat: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="1.5" fill="#5a6270" />
      <path d="M13 3 L8 12 H12 L10 20 L17 10 H13 Z" fill="#f0c030" />
    </>
  ),
  cistern: (
    <>
      <rect x="4" y="6" width="16" height="14" rx="2" fill="#3a4a5a" stroke="#7fd0e8" />
      <path d="M13 8 L8 15 H11.5 L10.5 19 L16 12 H12.5 Z" fill="#7fd0e8" />
      <rect x="9" y="3" width="6" height="3" rx="1" fill="#7fd0e8" />
    </>
  ),
  windbreak: (
    <>
      <path
        d="M12 2 L21 6 V12 C21 17 17 20.5 12 22 C7 20.5 3 17 3 12 V6 Z"
        fill="#1a2a3a"
        stroke="#ff5ac8"
        strokeWidth="1.6"
      />
      <path d="M8 12 H16 M12 8 V16" stroke="#ff5ac8" strokeWidth="1.8" />
    </>
  ),
  arcade: (
    <>
      <rect x="3" y="14" width="18" height="7" rx="2" fill="#2a3440" />
      <circle cx="7" cy="17.5" r="1.2" fill="#7fd0e8" />
      <circle cx="17" cy="17.5" r="1.2" fill="#7fd0e8" />
      <path d="M6 8 H10 M14 8 H18 M8 8 V10 M16 8 V10" stroke="#c8ccd2" strokeWidth="1.6" />
      <rect x="9" y="6" width="6" height="4" rx="1" fill="#8fd8f0" />
    </>
  ),
  springHouse: (
    <>
      <rect x="2" y="10" width="20" height="9" rx="1" fill="#2a2036" />
      <path d="M4 13 H20 M4 16 H20" stroke="#ff5ac8" strokeWidth="1.4" />
      <rect x="6" y="6" width="5" height="4" rx="0.6" fill="#5a2458" />
    </>
  ),
  palm: (
    <>
      <rect x="8" y="5" width="8" height="14" rx="1.2" fill="#2a2036" stroke="#ff5ac8" strokeWidth="1.2" />
      <path d="M12 8 V16" stroke="#ff5ac8" strokeWidth="1.6" />
    </>
  ),
  caravanserai: (
    <>
      <rect x="5" y="4" width="14" height="17" fill="#2a2036" stroke="#ff5ac8" strokeWidth="1.2" />
      <path d="M8 8 H16 M8 12 H16 M8 16 H16" stroke="#7fd0e8" strokeWidth="1.4" />
      <path d="M12 2 V4" stroke="#ffb020" strokeWidth="2" />
    </>
  ),
};

const INK = '#1a2a3a';
const STEEL = '#2a3444';
const CYAN = '#7fd0e8';
const MAGENTA = '#ff5ac8';
const AMBER = '#ffb020';
const GREEN = '#22e6a0';
const VIOLET = '#9b7bff';

/** Dark tile plus a zone letter. Dense zoning adds a second frame so it stays distinct. */
const cyberZone = (color: string, letter: string, dense: boolean): ReactElement => (
  <>
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="3"
      fill={INK}
      stroke={color}
      strokeWidth={dense ? 1.8 : 1.15}
    />
    {dense && (
      <rect x="6.2" y="6.2" width="11.6" height="11.6" rx="1.5" fill="none" stroke={color} strokeWidth="1" />
    )}
    <text x="12" y="16.2" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>
      {letter}
    </text>
  </>
);

const CYBER: Partial<Record<ToolId, ReactElement>> = {
  select: (
    <path
      d="M5 3 L5 19 L9.5 15 L12.5 21 L15 20 L12 14 L18 14 Z"
      fill="#e6f7ff"
      stroke={CYAN}
      strokeWidth="0.8"
      strokeLinejoin="round"
    />
  ),
  road: (
    <>
      <path
        d="M8 3.5 H16 L20.5 20.5 H3.5 Z"
        fill={INK}
        stroke={CYAN}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M12 6 V8.6 M12 11 V13.6 M12 16 V18.6"
        stroke={AMBER}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </>
  ),
  powerLine: (
    <>
      <path d="M2.5 5.5 Q12 10.5 21.5 5.5" stroke={AMBER} strokeWidth="1.7" fill="none" />
      <circle cx="2.6" cy="5.5" r="1.15" fill={AMBER} />
      <circle cx="21.4" cy="5.5" r="1.15" fill={AMBER} />
      <path d="M10.6 8 H13.4 L15.2 20.5 H8.8 Z" fill={STEEL} />
      <rect x="6.5" y="11" width="11" height="1.7" rx="0.4" fill={CYAN} />
      <rect x="8" y="15" width="8" height="1.5" rx="0.4" fill={CYAN} />
    </>
  ),
  pipe: (
    <>
      <rect x="2" y="9" width="20" height="6" rx="3" fill={INK} stroke={CYAN} strokeWidth="1.35" />
      <rect x="5.5" y="6.5" width="3.2" height="11" rx="1.2" fill={STEEL} stroke={CYAN} strokeWidth="1.1" />
      <rect x="15.3" y="6.5" width="3.2" height="11" rx="1.2" fill={STEEL} stroke={CYAN} strokeWidth="1.1" />
      <rect x="9.4" y="11" width="5.2" height="2" rx="1" fill={CYAN} />
    </>
  ),
  zoneResLight: cyberZone(GREEN, 'R', false),
  zoneResDense: cyberZone(GREEN, 'R', true),
  zoneComLight: cyberZone(CYAN, 'C', false),
  zoneComDense: cyberZone(CYAN, 'C', true),
  zoneIndLight: cyberZone(AMBER, 'I', false),
  zoneIndDense: cyberZone(AMBER, 'I', true),
  dezone: (
    <>
      <rect
        x="3.2"
        y="3.2"
        width="17.6"
        height="17.6"
        rx="3"
        fill={INK}
        stroke="#5a6e82"
        strokeWidth="1.4"
        strokeDasharray="3 2"
      />
      <path d="M8 8 L16 16 M16 8 L8 16" stroke="#ff2d55" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  demolish: (
    <>
      <rect x="3" y="12" width="12.5" height="6" rx="1.4" fill={STEEL} stroke={AMBER} strokeWidth="1.2" />
      <path d="M15.5 12.6 L21.2 8.6 L22 17.6 L15.5 17.6 Z" fill={AMBER} />
      <circle cx="6.4" cy="19.6" r="1.9" fill="#121820" stroke={CYAN} strokeWidth="1.1" />
      <circle cx="12.2" cy="19.6" r="1.9" fill="#121820" stroke={CYAN} strokeWidth="1.1" />
      <rect x="5.6" y="7.4" width="5.2" height="4.4" rx="0.7" fill={CYAN} />
    </>
  ),
  level: (
    <>
      <path
        d="M2.5 16.5 L7.5 10 L11.5 13.2 L16 8 L21.5 16.5 Z"
        fill="#10241c"
        stroke={GREEN}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <rect x="3" y="18.2" width="18" height="2.2" rx="1" fill={AMBER} />
    </>
  ),
  raise: (
    <>
      <path
        d="M2.5 20.5 L7.5 15 L11.5 17.6 L16 13 L21.5 20.5 Z"
        fill="#10241c"
        stroke={GREEN}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M12 12 V4.2 M8.7 7.2 L12 3.8 L15.3 7.2"
        stroke={AMBER}
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  lower: (
    <>
      <path
        d="M2.5 7 L7.5 12.5 L11.5 9.8 L16 14.5 L21.5 7 Z"
        fill="#10241c"
        stroke={GREEN}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M12 15 V21 M8.7 18 L12 21.2 L15.3 18"
        stroke={AMBER}
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  trees: (
    <>
      <path
        d="M8 3.2 L3.2 13 H12.8 Z"
        fill="#0e2420"
        stroke={GREEN}
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      <rect x="6.8" y="13" width="2.4" height="5" rx="0.4" fill={STEEL} />
      <path
        d="M16.2 6.2 L11.2 16.2 H21.2 Z"
        fill="#10241c"
        stroke={GREEN}
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
      <rect x="15" y="16.2" width="2.4" height="4" rx="0.4" fill={STEEL} />
    </>
  ),
  qanat: (
    <>
      <rect x="2.2" y="11.5" width="8.4" height="9" rx="1.3" fill={STEEL} stroke={CYAN} strokeWidth="1.2" />
      <rect x="13.4" y="11.5" width="8.4" height="9" rx="1.3" fill={STEEL} stroke={CYAN} strokeWidth="1.2" />
      <path d="M6.4 11.5 V5.2 M17.6 11.5 V5.2" stroke="#d5dde6" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3.6 5.2 H20.4" stroke={AMBER} strokeWidth="1.9" strokeLinecap="round" />
      <path
        d="M8.2 7.4 Q12 10.6 15.8 7.4"
        stroke={CYAN}
        strokeWidth="1.35"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  coalPlant: (
    <>
      <rect x="2.5" y="11" width="14" height="9.5" rx="1.5" fill={STEEL} stroke={AMBER} strokeWidth="1.25" />
      <rect x="15.2" y="4.2" width="5" height="16.3" rx="1.2" fill={INK} stroke={CYAN} strokeWidth="1.15" />
      <rect x="5" y="14.2" width="8" height="2.8" rx="0.6" fill={AMBER} />
      <circle cx="17.7" cy="6.2" r="1.15" fill="#ff6a1f" />
    </>
  ),
  gasPlant: (
    <>
      <rect x="3" y="9" width="7" height="11.5" rx="3.5" fill={INK} stroke={CYAN} strokeWidth="1.3" />
      <rect x="13" y="5.5" width="7.2" height="15" rx="3.6" fill={INK} stroke={CYAN} strokeWidth="1.3" />
      <path d="M16.6 2.2 V4.6" stroke={AMBER} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16.6" cy="4.8" r="1.15" fill={AMBER} />
    </>
  ),
  windTurbine: (
    <>
      <rect x="11.15" y="12" width="1.7" height="9" rx="0.4" fill={STEEL} />
      <path
        d="M12 11 L12 2.8 M12 11 L4.6 15.6 M12 11 L19.4 15.6"
        stroke="#e6f7ff"
        strokeWidth="2.35"
        strokeLinecap="round"
      />
      <circle cx="12" cy="11" r="2.15" fill={INK} stroke={CYAN} strokeWidth="1.2" />
      <circle cx="12" cy="11" r="0.85" fill={GREEN} />
    </>
  ),
  waterPump: (
    <>
      <rect x="3" y="12.5" width="18" height="8.5" rx="2" fill={INK} stroke={CYAN} strokeWidth="1.3" />
      <path
        d="M12 2.4 C9.2 6.6 7.2 9 7.2 11.6 C7.2 14.4 9.3 16.4 12 16.4 C14.7 16.4 16.8 14.4 16.8 11.6 C16.8 9 14.8 6.6 12 2.4 Z"
        fill={CYAN}
      />
    </>
  ),
  well: (
    <>
      <path
        d="M7.2 9.2 V5.2 H16.8 V9.2"
        fill="none"
        stroke={CYAN}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <ellipse cx="12" cy="15" rx="8" ry="5" fill={INK} stroke={CYAN} strokeWidth="1.35" />
      <ellipse cx="12" cy="15" rx="3.5" ry="2" fill={CYAN} />
    </>
  ),
  policeStation: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" fill={INK} stroke={MAGENTA} strokeWidth="1.4" />
      <path
        d="M12 6 L13.7 10.1 L18 10.3 L14.5 13 L15.7 17.3 L12 15 L8.3 17.3 L9.5 13 L6 10.3 L10.3 10.1 Z"
        fill={MAGENTA}
      />
    </>
  ),
  fireStation: (
    <>
      <rect x="3" y="13.5" width="18" height="7.2" rx="1.5" fill="#2a1c22" stroke="#ff6a3a" strokeWidth="1.2" />
      <rect x="5.6" y="15.6" width="4.6" height="5.1" fill="#120c10" />
      <rect x="13.8" y="15.6" width="4.6" height="5.1" fill="#120c10" />
      <path
        d="M12 2.2 C12 2.2 7.6 7.4 7.6 11 C7.6 13.8 9.5 15.8 12 15.8 C14.5 15.8 16.4 13.8 16.4 11 C16.4 7.4 12 2.2 12 2.2 Z"
        fill="#ffd21f"
      />
      <path
        d="M12 8.4 C12 8.4 10.2 10.6 10.2 12 C10.2 13.3 11 14.2 12 14.2 C13 14.2 13.8 13.3 13.8 12 C13.8 10.6 12 8.4 12 8.4 Z"
        fill="#ff6a1f"
      />
    </>
  ),
  school: (
    <>
      <path
        d="M3 8 L12 11 L21 8 V17.2 L12 20.2 L3 17.2 Z"
        fill={INK}
        stroke={VIOLET}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M12 11 V20.2" stroke={VIOLET} strokeWidth="1.2" />
      <rect x="11" y="3" width="2" height="5.2" rx="0.4" fill={MAGENTA} />
    </>
  ),
  hospital: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" fill={INK} stroke={GREEN} strokeWidth="1.4" />
      <path d="M10 6 H14 V10 H18 V14 H14 V18 H10 V14 H6 V10 H10 Z" fill={GREEN} />
    </>
  ),
  park: (
    <>
      <rect x="3" y="14.5" width="18" height="6.2" rx="2" fill="#10241c" stroke={GREEN} strokeWidth="1.2" />
      <circle cx="9.5" cy="11.5" r="5.2" fill="#0e2420" stroke={GREEN} strokeWidth="1.25" />
      <rect x="8.4" y="14.2" width="2.2" height="4.2" fill={STEEL} />
      <circle cx="17.4" cy="17.2" r="1.7" fill={CYAN} />
    </>
  ),
  marina: (
    <>
      <path d="M3.5 14.5 H14.5 L12.6 18.6 H5.4 Z" fill={STEEL} stroke={AMBER} strokeWidth="1.15" />
      <path d="M9 14.5 V6.2" stroke="#e6f7ff" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9 7.2 L15.2 12.2 H9 Z" fill={CYAN} />
      <path d="M2.5 20.6 Q8 18.4 12 20.4 Q16.5 22.2 21.5 20.2" stroke={CYAN} strokeWidth="1.3" fill="none" />
    </>
  ),
  airport: (
    <>
      <path
        d="M12 2.2 L13.5 7.6 L19.2 9.4 V11.3 L13.6 10.6 L12.8 15.4 L15 16.6 V17.8 H9 V16.6 L11.2 15.4 L10.4 10.6 L4.8 11.3 V9.4 L10.5 7.6 Z"
        fill="#e6f7ff"
      />
      <rect x="4" y="19.4" width="16" height="2.2" rx="1" fill={INK} stroke={CYAN} strokeWidth="0.9" />
      <circle cx="7.2" cy="20.5" r="0.7" fill={GREEN} />
      <circle cx="12" cy="20.5" r="0.7" fill={AMBER} />
      <circle cx="16.8" cy="20.5" r="0.7" fill={GREEN} />
    </>
  ),
  arcade: (
    <>
      <rect x="3" y="14" width="18" height="6.6" rx="2" fill={INK} stroke={CYAN} strokeWidth="1.25" />
      <circle cx="7" cy="17.3" r="1.25" fill={GREEN} />
      <circle cx="17" cy="17.3" r="1.25" fill={GREEN} />
      <rect x="8.2" y="6.2" width="7.6" height="4.6" rx="1.3" fill={CYAN} />
      <path d="M3.2 8.4 H8.2 M15.8 8.4 H20.8" stroke="#e6f7ff" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="3.3" cy="8.4" r="1.35" fill="#d5dde6" />
      <circle cx="20.7" cy="8.4" r="1.35" fill="#d5dde6" />
    </>
  ),
};

export function ToolIcon({ id, style = 'classic' }: { id: ToolId; style?: ThemeStyle }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      {style === 'cyber' ? (CYBER[id] ?? CLASSIC[id]) : CLASSIC[id]}
    </svg>
  );
}
