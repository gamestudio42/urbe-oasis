import type { CSSProperties, ReactElement } from 'react';
import type { ToolGroup, ToolId } from '../tools/tools';
import './adobeIcons.css';

/** Original 32-unit Oasis pictograms. Theme tokens supply every color. */
type Accent = 'neutral' | 'water' | 'shade' | 'energy' | 'clay' | 'stone';
interface Glyph {
  accent: Accent;
  shape: ReactElement;
}
export type AdobeControlId =
  | 'water'
  | 'shade'
  | 'spring'
  | 'chronicle'
  | 'budget'
  | 'charts'
  | 'layers'
  | 'settings'
  | 'save'
  | 'import'
  | 'export'
  | 'play'
  | 'pause'
  | 'sound'
  | 'mute'
  | 'music'
  | 'lock'
  | 'close'
  | 'check'
  | 'warning'
  | 'musicOff'
  | 'fast'
  | 'fastest'
  | 'locate'
  | 'expand'
  | 'collapse';
type CategoryId =
  | 'categoryTransport'
  | 'categoryZones'
  | 'categoryUtilities'
  | 'categoryServices'
  | 'categoryTerrain';
export type AdobeIconId = ToolId | CategoryId | AdobeControlId;

const GLYPHS: Record<AdobeIconId, Glyph> = {
  select: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M7 4V26L13 20L18 28L22 26L17 18H26Z" className="oasis-icon-wash" />
        <path d="M7 4V26L13 20L18 28L22 26L17 18H26Z" />
      </>
    ),
  },
  road: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M10 4H22L28 28H4Z" className="oasis-icon-wash" />
        <path d="M10 4L4 28M22 4L28 28M16 6V10M16 15V19M16 24V28" />
      </>
    ),
  },
  marina: {
    accent: 'water',
    shape: (
      <>
        <path d="M4 19H23L20 25H8Z" className="oasis-icon-wash" />
        <path
          d="M4 19H23L20 25H8ZM14 19V5L24 15H14M3 28Q7 25 11 28Q15 31 19 28Q23 25 28 28"
          className="oasis-icon-accent"
        />
      </>
    ),
  },
  airport: {
    accent: 'neutral',
    shape: (
      <>
        <path
          d="M16 3L19 13L28 18V21L19 18V25L22 28H10L13 25V18L4 21V18L13 13Z"
          className="oasis-icon-wash"
        />
        <path d="M16 3L19 13L28 18V21L19 18V25L22 28H10L13 25V18L4 21V18L13 13Z" />
      </>
    ),
  },
  arcade: {
    accent: 'stone',
    shape: (
      <>
        <path
          d="M3 9H29V27H25V18A3 3 0 0 0 19 18V27H13V18A3 3 0 0 0 7 18V27H3Z"
          className="oasis-icon-wash"
        />
        <path d="M3 9H29M5 6H27M4 9V27H8V18A3 3 0 0 1 14 18V27H18V18A3 3 0 0 1 24 18V27H28V9M2 28H30" />
      </>
    ),
  },
  zoneResLight: {
    accent: 'clay',
    shape: (
      <>
        <path d="M6 11H26V27H6ZM10 7H22V11" className="oasis-icon-wash" />
        <path d="M6 11H26V27H6ZM10 7H22V11M13 27V19H19V27M9 15H11M21 15H23" />
      </>
    ),
  },
  zoneResDense: {
    accent: 'clay',
    shape: (
      <>
        <path d="M4 14H12V7H22V11H28V27H4Z" className="oasis-icon-wash" />
        <path d="M4 14H12V7H22V11H28V27H4ZM12 14V27M16 12H18M16 17H18M7 19H9M24 17H25M17 27V22H21V27" />
        <path d="M23 3V7M27 3V7" className="oasis-icon-accent" />
      </>
    ),
  },
  zoneComLight: {
    accent: 'water',
    shape: (
      <>
        <path d="M5 8H27L29 15H3Z" className="oasis-icon-wash" />
        <path
          d="M5 8H27L29 15H3ZM6 15V27H26V15M11 15V8M21 15V8M10 20H16V27M21 20H23"
          className="oasis-icon-accent"
        />
      </>
    ),
  },
  zoneComDense: {
    accent: 'water',
    shape: (
      <>
        <path d="M6 11V5H26V11M4 12H28V19H4ZM7 19V28H25V19M11 12V19M21 12V19M11 8H13M19 8H21M11 23H14M20 23H23M16 19V28" />
        <path d="M4 12H28V19H4Z" className="oasis-icon-wash" />
      </>
    ),
  },
  zoneIndLight: {
    accent: 'energy',
    shape: (
      <>
        <path d="M4 15L12 10V15L20 10V15H28V27H4Z" className="oasis-icon-wash" />
        <path d="M4 15L12 10V15L20 10V15H28V27H4ZM9 21H12M17 21H20M24 9V15" />
      </>
    ),
  },
  zoneIndDense: {
    accent: 'energy',
    shape: (
      <>
        <path d="M4 16L11 11V16L18 11V16H28V28H4Z" className="oasis-icon-wash" />
        <path d="M4 16L11 11V16L18 11V16H28V28H4ZM21 16V4H26V16M8 22H11M16 22H19M24 22H25" />
        <path d="M8 3V7M12 3V7" className="oasis-icon-accent" />
      </>
    ),
  },
  dezone: {
    accent: 'neutral',
    shape: (
      <>
        <rect x="5" y="5" width="22" height="22" rx="2" strokeDasharray="4 4" />
        <path d="M11 11L21 21M21 11L11 21" className="oasis-icon-accent" />
      </>
    ),
  },
  powerLine: {
    accent: 'energy',
    shape: (
      <>
        <path d="M16 4L8 28M16 4L24 28M11 18H21M9 26H23M9 11H23" />
        <path d="M3 8Q16 14 29 8M6 7V11M26 7V11" className="oasis-icon-accent" />
      </>
    ),
  },
  coalPlant: {
    accent: 'energy',
    shape: (
      <>
        <path d="M4 15H19V27H4ZM21 5H27V27H21Z" className="oasis-icon-wash" />
        <path d="M4 15H19V27H4ZM21 5H27V27H21ZM6 11H16M21 10H27" />
        <path d="M11 18L15 21L12 25L8 22Z" className="oasis-icon-accent" />
      </>
    ),
  },
  gasPlant: {
    accent: 'energy',
    shape: (
      <>
        <rect x="4" y="12" width="10" height="15" rx="4" className="oasis-icon-wash" />
        <rect x="4" y="12" width="10" height="15" rx="4" className="" />
        <path
          d="M14 23H21V13M17 13H25M21 4C20 8 17 9 18 12C19 15 24 14 24 11C24 8 22 7 21 4Z"
          className="oasis-icon-accent"
        />
        <path d="M3 28H28M7 17H11" />
      </>
    ),
  },
  windTurbine: {
    accent: 'energy',
    shape: (
      <>
        <path d="M16 14V28M12 28H20" />
        <path d="M16 12L16 3M16 12L6 18M16 12L26 18" className="oasis-icon-accent" />
        <circle cx="16" cy="12" r="2.5" className="" />
      </>
    ),
  },
  pipe: {
    accent: 'water',
    shape: (
      <>
        <path d="M3 12H29V21H3Z" className="oasis-icon-wash" />
        <path d="M3 12H29M3 21H29M8 9V24M24 9V24" className="oasis-icon-accent" />
        <path d="M13 16.5H19M17 14L20 16.5L17 19" />
      </>
    ),
  },
  canal: {
    accent: 'water',
    shape: (
      <>
        <path d="M11 4L8 28H24L21 4Z" className="oasis-icon-wash" />
        <path d="M7 4L3 28M25 4L29 28" />
        <path
          d="M11 10Q16 13 21 10M10 18Q16 21 22 18M9 26Q16 29 23 26"
          className="oasis-icon-accent"
        />
      </>
    ),
  },
  waterPump: {
    accent: 'water',
    shape: (
      <>
        <path d="M4 12H22V27H4ZM7 7H19V12" className="oasis-icon-wash" />
        <path d="M4 12H22V27H4ZM7 7H19V12M22 19H28V26" />
        <path
          d="M13 14C12 17 9 19 10 21C11 25 17 24 17 21C17 19 14 17 13 14Z"
          className="oasis-icon-accent"
        />
      </>
    ),
  },
  well: {
    accent: 'water',
    shape: (
      <>
        <path d="M12 28V13H20V28M9 28H23M9 13H23M16 13V7H25M7 7H16M22 13H27V19" />
        <path d="M26 22C24 25 24 27 26 28C28 27 28 25 26 22Z" className="oasis-icon-accent" />
      </>
    ),
  },
  qanat: {
    accent: 'water',
    shape: (
      <>
        <path d="M3 13L29 8" />
        <ellipse cx="7" cy="10" rx="3" ry="1.5" className="" />
        <ellipse cx="15" cy="8" rx="3" ry="1.5" className="" />
        <ellipse cx="23" cy="6" rx="3" ry="1.5" className="" />
        <path d="M7 15V22M15 13V21M23 12V20M4 25L28 22" className="oasis-icon-accent" />
        <path d="M4 28L28 25" className="oasis-icon-accent" />
      </>
    ),
  },
  cistern: {
    accent: 'water',
    shape: (
      <>
        <path d="M6 10V25C6 29 26 29 26 25V10" className="oasis-icon-wash" />
        <ellipse cx="16" cy="10" rx="10" ry="4" className="" />
        <path d="M6 10V25C6 29 26 29 26 25V10M12 6V3H20V6" />
        <path d="M7 20Q16 24 25 20M7 24Q16 28 25 24" className="oasis-icon-accent" />
      </>
    ),
  },
  springHouse: {
    accent: 'water',
    shape: (
      <>
        <path d="M5 12H27V25H5Z" className="oasis-icon-wash" />
        <path d="M5 25V12H27V25M8 12V9Q16 0 24 9V12M12 24V20A4 4 0 0 1 20 20V24" />
        <path d="M3 28Q8 25 13 28Q18 31 23 28Q26 26 29 28" className="oasis-icon-accent" />
      </>
    ),
  },
  palm: {
    accent: 'shade',
    shape: (
      <>
        <path d="M13 28Q18 20 16 11M10 28H20" />
        <path
          d="M16 11C10 4 4 6 3 13C7 10 11 10 16 11ZM16 11C20 4 27 5 29 12C24 10 21 10 16 11ZM16 11C12 7 11 3 17 3C21 3 20 8 16 11Z"
          className="oasis-icon-wash"
        />
        <path
          d="M16 11C10 4 4 6 3 13M16 11C20 4 27 5 29 12M16 11C12 7 11 3 17 3C21 3 20 8 16 11M16 11Q7 10 6 18M16 11Q24 10 26 18"
          className="oasis-icon-accent"
        />
      </>
    ),
  },
  policeStation: {
    accent: 'stone',
    shape: (
      <>
        <path d="M16 3L27 7V16Q27 24 16 29Q5 24 5 16V7Z" className="oasis-icon-wash" />
        <path d="M16 3L27 7V16Q27 24 16 29Q5 24 5 16V7Z" />
        <path
          d="M16 10L18 14L22 15L19 18L20 22L16 20L12 22L13 18L10 15L14 14Z"
          className="oasis-icon-accent"
        />
      </>
    ),
  },
  fireStation: {
    accent: 'clay',
    shape: (
      <>
        <path
          d="M17 4C18 10 24 12 24 19A8 8 0 0 1 8 19C8 15 11 12 13 10L14 16C18 13 18 9 17 4Z"
          className="oasis-icon-wash"
        />
        <path d="M17 4C18 10 24 12 24 19A8 8 0 0 1 8 19C8 15 11 12 13 10L14 16C18 13 18 9 17 4Z" />
        <path d="M16 18C12 22 12 25 16 26C20 25 20 22 16 18Z" className="oasis-icon-accent" />
      </>
    ),
  },
  school: {
    accent: 'stone',
    shape: (
      <>
        <path
          d="M16 9Q10 5 4 7V25Q10 23 16 27Q22 23 28 25V7Q22 5 16 9Z"
          className="oasis-icon-wash"
        />
        <path d="M16 9Q10 5 4 7V25Q10 23 16 27Q22 23 28 25V7Q22 5 16 9ZM16 9V27M8 12L12 13M8 17L12 18M20 13L24 12M20 18L24 17" />
      </>
    ),
  },
  hospital: {
    accent: 'stone',
    shape: (
      <>
        <path d="M12 4H20V12H28V20H20V28H12V20H4V12H12Z" className="oasis-icon-wash" />
        <path d="M12 4H20V12H28V20H20V28H12V20H4V12H12Z" />
      </>
    ),
  },
  park: {
    accent: 'shade',
    shape: (
      <>
        <g transform="translate(0 4) scale(.7)">
          <path d="M13 28Q18 20 16 11M10 28H20" />
          <path
            d="M16 11C10 4 4 6 3 13C7 10 11 10 16 11ZM16 11C20 4 27 5 29 12C24 10 21 10 16 11ZM16 11C12 7 11 3 17 3C21 3 20 8 16 11Z"
            className="oasis-icon-wash"
          />
          <path
            d="M16 11C10 4 4 6 3 13M16 11C20 4 27 5 29 12M16 11C12 7 11 3 17 3C21 3 20 8 16 11M16 11Q7 10 6 18M16 11Q24 10 26 18"
            className="oasis-icon-accent"
          />
        </g>
        <path d="M3 28H29M19 23V28M27 23V28M17 22H29M18 18H28" />
      </>
    ),
  },
  windbreak: {
    accent: 'stone',
    shape: (
      <>
        <rect x="18" y="6" width="10" height="22" rx="0" className="oasis-icon-wash" />
        <path d="M18 6H28V28H18ZM18 13H28M18 20H28M23 6V13M23 20V28" />
        <path d="M3 9H10Q15 9 15 5M3 16H13M3 23H9Q14 23 14 27" className="oasis-icon-accent" />
      </>
    ),
  },
  caravanserai: {
    accent: 'stone',
    shape: (
      <>
        <path d="M4 10H28V28H4ZM4 10V6H10V10M22 10V6H28V10" className="oasis-icon-wash" />
        <path d="M4 10H28V28H4ZM4 10V6H10V10M22 10V6H28V10M11 28V21A5 5 0 0 1 21 21V28M8 14H10M22 14H24M16 10V3H23L20 6H16" />
      </>
    ),
  },
  demolish: {
    accent: 'clay',
    shape: (
      <>
        <path d="M5 17H21V24H5ZM9 10H17V17M21 19L28 15V26H21" />
        <circle cx="9" cy="26" r="2" className="" />
        <circle cx="17" cy="26" r="2" className="" />
        <path d="M5 17H21V24H5Z" className="oasis-icon-wash" />
      </>
    ),
  },
  level: {
    accent: 'stone',
    shape: (
      <>
        <path d="M4 15L10 10L17 15L23 8L28 14M4 24H28" />
        <path d="M4 20H28" className="oasis-icon-accent" />
      </>
    ),
  },
  raise: {
    accent: 'stone',
    shape: (
      <>
        <path d="M3 27L9 21L15 25L22 19L29 27Z" className="oasis-icon-wash" />
        <path d="M3 27L9 21L15 25L22 19L29 27" />
        <path d="M16 19V4M11 9L16 4L21 9" className="oasis-icon-accent" />
      </>
    ),
  },
  lower: {
    accent: 'stone',
    shape: (
      <>
        <path d="M3 5L9 11L15 7L22 13L29 5Z" className="oasis-icon-wash" />
        <path d="M3 5L9 11L15 7L22 13L29 5" />
        <path d="M16 15V28M11 23L16 28L21 23" className="oasis-icon-accent" />
      </>
    ),
  },
  trees: {
    accent: 'shade',
    shape: (
      <>
        <g transform="translate(-1 2) scale(.75)">
          <path d="M13 28Q18 20 16 11M10 28H20" />
          <path
            d="M16 11C10 4 4 6 3 13C7 10 11 10 16 11ZM16 11C20 4 27 5 29 12C24 10 21 10 16 11ZM16 11C12 7 11 3 17 3C21 3 20 8 16 11Z"
            className="oasis-icon-wash"
          />
          <path
            d="M16 11C10 4 4 6 3 13M16 11C20 4 27 5 29 12M16 11C12 7 11 3 17 3C21 3 20 8 16 11M16 11Q7 10 6 18M16 11Q24 10 26 18"
            className="oasis-icon-accent"
          />
        </g>
        <path
          d="M23 28Q26 21 24 16M24 16Q18 10 17 18M24 16Q27 10 30 17M24 16Q23 11 26 10"
          className="oasis-icon-accent"
        />
      </>
    ),
  },
  categoryTransport: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M10 4L5 28M22 4L27 28M16 5V9M16 14V18M16 23V27" />
      </>
    ),
  },
  categoryZones: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M4 5H14V15H4ZM18 5H28V15H18ZM4 19H14V29H4ZM18 19H28V29H18Z" />
      </>
    ),
  },
  categoryUtilities: {
    accent: 'water',
    shape: (
      <>
        <path d="M11 3L4 15H10L7 26L17 12H11Z" />
        <path
          d="M23 12C20 16 18 19 18 22A5 5 0 0 0 28 22C28 19 25 16 23 12Z"
          className="oasis-icon-accent"
        />
      </>
    ),
  },
  categoryServices: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M4 12L16 5L28 12ZM6 27H26M4 29H28M8 13V24M16 13V24M24 13V24" />
      </>
    ),
  },
  categoryTerrain: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M3 26L12 10L18 18L22 12L29 26ZM9 15L12 17L15 15" />
      </>
    ),
  },
  water: {
    accent: 'water',
    shape: (
      <>
        <path
          d="M16 4C13 9 9 13 9 17A7 7 0 0 0 23 17C23 13 19 9 16 4Z"
          className="oasis-icon-wash"
        />
        <path d="M16 4C13 9 9 13 9 17A7 7 0 0 0 23 17C23 13 19 9 16 4Z" />
        <path d="M12 20Q13 23 16 23" className="oasis-icon-accent" />
      </>
    ),
  },
  shade: {
    accent: 'shade',
    shape: (
      <>
        <path d="M4 15Q16 0 28 15ZM16 15V27M9 28H23" />
        <path d="M7 21H11M21 21H25M6 25H10M22 25H26" className="oasis-icon-accent" />
      </>
    ),
  },
  spring: {
    accent: 'water',
    shape: (
      <>
        <ellipse cx="16" cy="25" rx="12" ry="4" className="" />
        <path
          d="M16 23V8M16 14Q7 7 5 15M16 14Q25 7 27 15M16 8Q15 3 11 4M16 8Q17 3 21 4"
          className="oasis-icon-accent"
        />
      </>
    ),
  },
  chronicle: {
    accent: 'stone',
    shape: (
      <>
        <rect x="6" y="4" width="21" height="24" rx="2" className="" />
        <path d="M11 4V28M3 9H8M3 16H8M3 23H8M16 10H22M16 16H22M16 22H20" />
      </>
    ),
  },
  budget: {
    accent: 'stone',
    shape: (
      <>
        <ellipse cx="16" cy="8" rx="11" ry="4" className="" />
        <path d="M5 8V24C5 29 27 29 27 24V8M5 16C5 21 27 21 27 16" />
      </>
    ),
  },
  charts: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M4 4V28H29M9 23V17M17 23V11M25 23V5" />
      </>
    ),
  },
  layers: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M16 3L29 10L16 17L3 10ZM4 17L16 24L28 17M4 23L16 30L28 23" />
      </>
    ),
  },
  settings: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M4 8H28M4 16H28M4 24H28" />
        <rect x="9" y="5" width="4" height="6" rx="1" className="oasis-icon-panel" />
        <rect x="20" y="13" width="4" height="6" rx="1" className="oasis-icon-panel" />
        <rect x="7" y="21" width="4" height="6" rx="1" className="oasis-icon-panel" />
      </>
    ),
  },
  save: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M5 4H24L28 8V28H4V4ZM10 4V13H23V4M10 28V20H22V28" />
      </>
    ),
  },
  import: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M4 21V28H28V21M16 3V21M10 15L16 21L22 15" />
      </>
    ),
  },
  export: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M4 21V28H28V21M16 21V3M10 9L16 3L22 9" />
      </>
    ),
  },
  play: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M9 4L27 16L9 28Z" className="oasis-icon-wash" />
        <path d="M9 4L27 16L9 28Z" />
      </>
    ),
  },
  pause: {
    accent: 'neutral',
    shape: (
      <>
        <rect x="7" y="5" width="6" height="22" rx="1" className="" />
        <rect x="19" y="5" width="6" height="22" rx="1" className="" />
      </>
    ),
  },
  sound: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M4 12H9L16 6V26L9 20H4ZM21 11Q26 16 21 21M25 6Q34 16 25 26" />
      </>
    ),
  },
  mute: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M4 12H9L16 6V26L9 20H4ZM22 12L29 20M29 12L22 20" />
      </>
    ),
  },
  music: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M12 24V6L27 3V20M12 11L27 8" />
        <ellipse cx="8" cy="25" rx="4" ry="3" className="" />
        <ellipse cx="23" cy="21" rx="4" ry="3" className="" />
      </>
    ),
  },
  lock: {
    accent: 'neutral',
    shape: (
      <>
        <rect x="6" y="14" width="20" height="14" rx="2" className="" />
        <path d="M10 14V9A6 6 0 0 1 22 9V14M16 20V23" />
      </>
    ),
  },
  close: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M8 8L24 24M24 8L8 24" />
      </>
    ),
  },
  check: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M6 16L13 23L27 8" />
      </>
    ),
  },
  warning: {
    accent: 'energy',
    shape: (
      <>
        <path d="M16 3L30 28H2ZM16 11V19" />
        <circle cx="16" cy="24" r="0.9" className="oasis-icon-ink" />
      </>
    ),
  },
  musicOff: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M12 24V6L27 3V20M12 11L27 8" />
        <ellipse cx="8" cy="25" rx="4" ry="3" className="" />
        <ellipse cx="23" cy="21" rx="4" ry="3" className="" />
        <path d="M4 28L28 4" />
      </>
    ),
  },
  fast: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M3 6L15 16L3 26ZM17 6L29 16L17 26Z" />
      </>
    ),
  },
  fastest: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M3 7L11 16L3 25ZM13 7L21 16L13 25ZM23 7L30 16L23 25Z" />
      </>
    ),
  },
  locate: {
    accent: 'neutral',
    shape: (
      <>
        <circle cx="16" cy="16" r="9" />
        <circle cx="16" cy="16" r="3" />
        <path d="M16 2V6M16 26V30M2 16H6M26 16H30" />
      </>
    ),
  },
  expand: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M8 12L16 20L24 12" />
      </>
    ),
  },
  collapse: {
    accent: 'neutral',
    shape: (
      <>
        <path d="M8 20L16 12L24 20" />
      </>
    ),
  },
};

const ADOBE_CATEGORIES: Record<ToolGroup, ToolId | CategoryId> = {
  inspect: 'select',
  transport: 'categoryTransport',
  zones: 'categoryZones',
  utilities: 'categoryUtilities',
  services: 'categoryServices',
  terrain: 'categoryTerrain',
};

export function AdobeCategoryIcon({ id }: { id: ToolGroup }) {
  return <AdobeIcon id={ADOBE_CATEGORIES[id]} size={28} />;
}

/** Decorative SVG: the surrounding control supplies its localized accessible name. */
export function AdobeIcon({
  id,
  size = 24,
  className = '',
}: {
  id: AdobeIconId;
  size?: number;
  className?: string;
}) {
  const glyph = GLYPHS[id];
  return (
    <svg
      className={`oasis-icon ${className}`}
      data-icon-id={id}
      data-icon-style="adobe"
      style={
        { '--oasis-icon-accent': `var(--icon-${glyph.accent}, currentColor)` } as CSSProperties
      }
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {glyph.shape}
    </svg>
  );
}
