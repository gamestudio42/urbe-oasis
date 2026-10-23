import { setCatalogOverride, type Locale } from '@oasis/web/i18n';

/**
 * Urbe Oasis copy. The five catalogs stay the Urbe wording for roads, zones and budget.
 * This override replaces the title, the menu pitch and the tools that only exist here.
 */

type Copy = {
  pageTitle: string;
  subtitle: string;
  defaultCityName: string;
  canal: string;
  qanat: string;
  cistern: string;
  windbreak: string;
  arcade: string;
  caravanserai: string;
  springHouse: string;
  palm: string;
  canalHint: string;
  qanatHint: string;
  cisternHint: string;
  windbreakHint: string;
  arcadeHint: string;
  caravanseraiHint: string;
  springHouseHint: string;
  palmHint: string;
  shadeMap: string;
};

const EN: Copy = {
  pageTitle: 'Urbe Oasis — shade, water and the spring',
  subtitle: 'Shade, canals and a spring that will not stay put.',
  defaultCityName: 'Oasis',
  canal: 'Canal',
  qanat: 'Qanat',
  cistern: 'Cistern',
  windbreak: 'Windbreak',
  arcade: 'Arcade',
  caravanserai: 'Caravanserai',
  springHouse: 'Spring house',
  palm: 'Palm',
  canalHint: 'Drag to draw a canal. It carries shade. Lots along it can grow past level 2.',
  qanatHint: 'Brings water where there is no river. Needs power. Shade keeps it from drying.',
  cisternHint: 'Stores spare water and feeds the district when the pipes run short.',
  windbreakHint: 'Slows a sandstorm. Covers a 6-tile radius. Needs power.',
  arcadeHint: 'A covered street. Eases traffic nearby. Needs a road.',
  caravanseraiHint: 'Caravans meet here. They buy shaded or watered lots and pay the treasury.',
  springHouseHint: 'Full shade near the spring, with water. A dry hall only trickles.',
  palmHint: 'A small shade tree. No power and no water.',
  shadeMap: 'Shade',
};

const PT: Copy = {
  pageTitle: 'Urbe Oásis — sombra, água e a nascente',
  subtitle: 'Sombra, canais e uma nascente que não fica no lugar.',
  defaultCityName: 'Oásis',
  canal: 'Canal',
  qanat: 'Qanat',
  cistern: 'Cisterna',
  windbreak: 'Quebra-vento',
  arcade: 'Arcada',
  caravanserai: 'Caravançará',
  springHouse: 'Casa da nascente',
  palm: 'Palmeira',
  canalHint: 'Arraste para traçar um canal. Ele conduz sombra. Os lotes ao longo dele passam do nível 2.',
  qanatHint: 'Traz água onde não há rio. Precisa de energia. A sombra impede que seque.',
  cisternHint: 'Guarda água sobrando e solta quando o bairro seca.',
  windbreakHint: 'Segura a tempestade de areia. Cobre um raio de 6 lotes. Precisa de energia.',
  arcadeHint: 'Uma rua coberta. Alivia o trânsito por perto. Precisa de estrada.',
  caravanseraiHint: 'As caravanas se encontram aqui. Compram lotes sombreados ou irrigados e pagam o caixa.',
  springHouseHint: 'Sombra plena perto da nascente, com água. Uma casa seca só goteja.',
  palmHint: 'Uma palmeira pequena. Não precisa de energia nem de água.',
  shadeMap: 'Sombra',
};

const ES: Copy = {
  pageTitle: 'Urbe Oasis — sombra, agua y el manantial',
  subtitle: 'Sombra, canales y un manantial que no se queda quieto.',
  defaultCityName: 'Oasis',
  canal: 'Canal',
  qanat: 'Qanat',
  cistern: 'Cisterna',
  windbreak: 'Cortaviento',
  arcade: 'Arcada',
  caravanserai: 'Caravasar',
  springHouse: 'Casa del manantial',
  palm: 'Palmera',
  canalHint: 'Arrastra para trazar un canal. Lleva sombra. Los lotes a lo largo pueden pasar del nivel 2.',
  qanatHint: 'Trae agua donde no hay río. Necesita energía. La sombra evita que se seque.',
  cisternHint: 'Guarda agua de sobra y la suelta cuando el barrio se seca.',
  windbreakHint: 'Frena una tormenta de arena. Cubre un radio de 6 lotes. Necesita energía.',
  arcadeHint: 'Una calle cubierta. Alivia el tráfico cercano. Necesita una carretera.',
  caravanseraiHint: 'Las caravanas se reúnen aquí. Compran lotes con sombra o agua y pagan la caja.',
  springHouseHint: 'Sombra plena cerca del manantial, con agua. Una casa seca solo gotea.',
  palmHint: 'Una palmera pequeña. No necesita energía ni agua.',
  shadeMap: 'Sombra',
};

const FR: Copy = {
  pageTitle: 'Urbe Oasis — ombre, eau et la source',
  subtitle: 'Ombre, canaux et une source qui ne reste pas en place.',
  defaultCityName: 'Oasis',
  canal: 'Canal',
  qanat: 'Qanat',
  cistern: 'Citerne',
  windbreak: 'Brise-vent',
  arcade: 'Arcade',
  caravanserai: 'Caravansérail',
  springHouse: 'Maison de la source',
  palm: 'Palmier',
  canalHint: 'Glissez pour tracer un canal. Il porte l’ombre. Les parcelles le long peuvent dépasser le niveau 2.',
  qanatHint: 'Amène l’eau là où il n’y a pas de rivière. Demande du courant. L’ombre l’empêche de sécher.',
  cisternHint: 'Stocke l’eau en trop et la rend quand le quartier s’assèche.',
  windbreakHint: 'Ralentit une tempête de sable. Couvre un rayon de 6 cases. Demande du courant.',
  arcadeHint: 'Une rue couverte. Allège le trafic alentour. Demande une route.',
  caravanseraiHint: 'Les caravanes s’y retrouvent. Elles achètent les lots ombragés ou arrosés et paient la caisse.',
  springHouseHint: 'Ombre pleine près de la source, avec de l’eau. Une maison sèche ne fait que goutter.',
  palmHint: 'Un petit palmier. Ni courant, ni eau.',
  shadeMap: 'Ombre',
};

const DE: Copy = {
  pageTitle: 'Urbe Oasis — Schatten, Wasser und die Quelle',
  subtitle: 'Schatten, Kanäle und eine Quelle, die nicht liegen bleibt.',
  defaultCityName: 'Oase',
  canal: 'Kanal',
  qanat: 'Qanat',
  cistern: 'Zisterne',
  windbreak: 'Windschutz',
  arcade: 'Arkade',
  caravanserai: 'Karawanserei',
  springHouse: 'Quellhaus',
  palm: 'Palme',
  canalHint: 'Ziehen, um einen Kanal zu zeichnen. Er trägt Schatten. Grundstücke daran wachsen über Stufe 2.',
  qanatHint: 'Bringt Wasser, wo kein Fluss ist. Braucht Strom. Schatten hält ihn feucht.',
  cisternHint: 'Speichert übriges Wasser und gibt es ab, wenn das Viertel trocknet.',
  windbreakHint: 'Bremst einen Sandsturm. Deckt einen Radius von 6 Feldern. Braucht Strom.',
  arcadeHint: 'Eine überdachte Straße. Entlastet den Verkehr daneben. Braucht eine Straße.',
  caravanseraiHint: 'Karawanen treffen sich hier. Sie kaufen schattige oder bewässerte Grundstücke und zahlen die Kasse.',
  springHouseHint: 'Voller Schatten nahe der Quelle, mit Wasser. Ein trockenes Haus tropft nur.',
  palmHint: 'Eine kleine Palme. Weder Strom noch Wasser.',
  shadeMap: 'Schatten',
};

const COPY: Record<Locale, Copy> = {
  en: EN,
  'pt-BR': PT,
  es: ES,
  fr: FR,
  de: DE,
};

/** Applies the oasis copy on top of the Urbe catalog for one locale. */
export function applyOasisCopy(locale: Locale): void {
  const copy = COPY[locale] ?? EN;
  setCatalogOverride(locale, {
    brand: 'URBE OASIS',
    pageTitle: copy.pageTitle,
    menu: {
      subtitle: copy.subtitle,
      defaultCityName: copy.defaultCityName,
    },
    tools: {
      canal: copy.canal,
      qanat: copy.qanat,
      cistern: copy.cistern,
      windbreak: copy.windbreak,
      arcade: copy.arcade,
      caravanserai: copy.caravanserai,
      springHouse: copy.springHouse,
      palm: copy.palm,
    },
    buildings: {
      qanat: copy.qanat,
      cistern: copy.cistern,
      windbreak: copy.windbreak,
      arcade: copy.arcade,
      caravanserai: copy.caravanserai,
      springHouse: copy.springHouse,
      palm: copy.palm,
    },
    toolHints: {
      canal: copy.canalHint,
      qanat: copy.qanatHint,
      cistern: copy.cisternHint,
      windbreak: copy.windbreakHint,
      arcade: copy.arcadeHint,
      caravanserai: copy.caravanseraiHint,
      springHouse: copy.springHouseHint,
      palm: copy.palmHint,
    },
    overlays: { data: copy.shadeMap },
  });
}

/** Vocabulary used by the oasis shell, resolved per locale. */
export function oasisCopy(locale: Locale): Copy {
  return COPY[locale] ?? EN;
}
