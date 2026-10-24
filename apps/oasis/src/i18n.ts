import { setCatalogOverride, type Locale, type Strings } from '@oasis/web/i18n';

/**
 * Urbe Oasis copy. The five catalogs stay the Urbe wording for roads, zones and budget.
 * This override replaces the title, the menu pitch and the tools that only exist here.
 */

const SURVIVAL_EN = {
  title: 'LIFE IN THE OASIS',
  water: 'Water coverage',
  shade: 'Shade coverage',
  reserves: 'Stored water',
  focusSpring: 'Find the spring',
  supplyDemand: 'Supply / demand',
  noDemand: 'No consumers',
  noCistern: 'No cistern',
  cisterns: 'Cisterns',
  parched: 'Water-stressed districts',
};

const CHRONICLE_EN = {
  title: 'OASIS CHRONICLE',
  history: 'Recent events',
  close: 'Collapse report',
  locate: 'Show on map',
  lots: 'Lots in this report',
  empty: 'The desert is quiet. Events will be recorded here.',
  storm: {
    title: 'Sand over the city',
    body: 'A storm struck this service and temporarily interrupted its operation. Powered windbreaks reduce the risk of future impacts.',
  },
  blocked: {
    title: 'The windbreak held',
    body: 'The storm was repelled at this location. Keep the windbreak powered to protect nearby services.',
  },
  spring: {
    title: 'The spring has moved',
    body: 'The spring changed location. Review nearby spring houses: their shade output depends on access to water, power and the spring.',
  },
  trade: {
    title: 'Caravans have arrived',
    body: 'Caravans purchased serviced lots and paid the treasury. This report points to one of the traded lots.',
  },
  leave: {
    title: 'A caravan has withdrawn',
    body: 'A caravan abandoned a dry, unshaded lot. Review water and shade coverage before expanding.',
  },
  stress: {
    title: 'Water under pressure',
    body: 'A water network reached its stress threshold. Inspect supply and storage before adding more demand.',
  },
  collapse: {
    title: 'The qanat went offline',
    body: 'Overload interrupted a qanat in this district. Review the water network, expand supply and connect powered cisterns.',
  },
};

const POLICY_EN = {
  title: 'Water management',
  normal: 'Normal supply',
  rationing: 'Rationing active',
  description:
    'Conserve water during shortages. Demand falls by up to 25% per lot; commercial and industrial tax revenue falls by 20% for a full month of rationing. Residential taxes stay unchanged.',
  demand: 'Demand with current buildings',
  standard: 'Normal',
  restricted: 'Rationed',
  cost: 'Business tax reduction accrued this month',
  timing:
    'Networks respond on the next daily update while time is running. The tax reduction is proportional to time used and remains due after switching off. Rationing cannot reconnect a broken pipe.',
  enable: 'Start rationing',
  disable: 'Restore normal supply',
  close: 'Close water management',
};

type Copy = {
  terrains: Strings['inspector']['terrains'];
  policy: typeof POLICY_EN;
  hubIdle: string;
  chronicle: typeof CHRONICLE_EN;
  survival: typeof SURVIVAL_EN;
  tutorial: { title: string; steps: { title: string; text: string }[] };
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
  terrains: ['Water', 'Sand', 'Desert ground', 'Dirt', 'Rock'],
  policy: POLICY_EN,
  hubIdle: 'Not operating',
  chronicle: CHRONICLE_EN,
  survival: SURVIVAL_EN,
  tutorial: {
    title: 'Found an oasis',
    steps: [
      {
        title: 'A city around a moving spring',
        text: 'The city starts paused. Right-drag to pan and scroll to zoom. Find the spring above: it strengthens nearby spring houses, but does not fill your pipes. Your first goal is a home with power, water and shade.',
      },
      {
        title: 'Connect to the outside world',
        text: 'Draw a road from near the spring to any map edge. The minimap helps you navigate. This connection brings regional workers and jobs.',
      },
      {
        title: 'Make room for the first families',
        text: 'Zone a small residential strip beside the road, leaving space for utilities. Start small: every new district will need water and shade.',
      },
      {
        title: 'Give residents somewhere to work',
        text: 'Add a small industrial or commercial zone beside the road. Keep industry away from homes so pollution does not undermine your settlement.',
      },
      {
        title: 'Power the settlement',
        text: 'Place a gas plant and connect it to your residential lots with power lines. Adjacent zones carry power. Let time run until the homes have power.',
      },
      {
        title: 'Bring water through the sand',
        text: 'Place a qanat, connect it to power, then draw pipes from it to your residential lots. The water button above opens coverage. Let time run until a residential lot receives water.',
      },
      {
        title: 'Build a shaded refuge',
        text: 'Place a Palm from the utility tools and connect it to a watered residential lot with a canal. Canals carry shade; pipes carry water. Natural vegetation is not a shade utility.',
      },
      {
        title: 'Welcome the first residents',
        text: 'Let time run until people arrive. If growth stalls, inspect a residential lot for its missing service or road access. The water and shade buttons reveal network coverage.',
      },
      {
        title: 'Keep water for a dry spell',
        text: 'Place a cistern on the same pipe network as the qanat and connect it to power. It stores spare supply automatically. Keep time running until the reserve starts charging; increase water supply if demand uses it all.',
      },
      {
        title: 'Your oasis is taking shape',
        text: 'Watch the budget before expanding. The spring moves over time; powered, watered spring houses work best nearby. Build windbreaks as services grow, and add a caravanserai when you can afford it.',
      },
    ],
  },
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
  qanatHint: 'Brings water where there is no river. Needs power.',
  cisternHint: 'Stores spare water and feeds the district when the pipes run short.',
  windbreakHint: 'Slows a sandstorm. Covers a 6-tile radius. Needs power.',
  arcadeHint: 'A covered street. Eases traffic nearby. Needs a road.',
  caravanseraiHint: 'Caravans meet here. They buy shaded or watered lots and pay the treasury.',
  springHouseHint: 'Full shade near the spring, with water. A dry hall only trickles.',
  palmHint: 'A small shade tree. No power and no water.',
  shadeMap: 'Shade',
};

const PT: Copy = {
  terrains: ['Água', 'Areia', 'Solo desértico', 'Terra', 'Rocha'],
  policy: {
    title: 'Gestão da água',
    normal: 'Abastecimento normal',
    rationing: 'Racionamento ativo',
    description:
      'Poupe água durante a escassez. O consumo cai até 25% por lote; a arrecadação comercial e industrial cai 20% por mês inteiro de racionamento. Os impostos residenciais não mudam.',
    demand: 'Consumo dos edifícios atuais',
    standard: 'Normal',
    restricted: 'Racionado',
    cost: 'Redução de impostos empresariais acumulada no mês',
    timing:
      'As redes respondem na próxima atualização diária com o tempo em andamento. A redução de impostos é proporcional ao tempo de uso e continua devida após desativar. Racionar não reconecta um cano rompido.',
    enable: 'Iniciar racionamento',
    disable: 'Restaurar abastecimento normal',
    close: 'Fechar gestão da água',
  },
  hubIdle: 'Sem operação',
  chronicle: {
    title: 'CRÔNICA DO OÁSIS',
    history: 'Acontecimentos recentes',
    close: 'Recolher relato',
    locate: 'Ver no mapa',
    lots: 'Lotes neste relato',
    empty: 'O deserto está tranquilo. Os acontecimentos aparecerão aqui.',
    storm: {
      title: 'Areia sobre a cidade',
      body: 'Uma tempestade atingiu este serviço e interrompeu sua operação temporariamente. Quebra-ventos com energia reduzem o risco de novos impactos.',
    },
    blocked: {
      title: 'O quebra-vento resistiu',
      body: 'A tempestade foi repelida neste local. Mantenha o quebra-vento energizado para proteger os serviços próximos.',
    },
    spring: {
      title: 'A nascente mudou de lugar',
      body: 'A nascente se deslocou. Revise as casas da nascente próximas: a produção de sombra depende do acesso à água, energia e nascente.',
    },
    trade: {
      title: 'As caravanas chegaram',
      body: 'Caravanas compraram lotes atendidos e pagaram ao caixa da cidade. Este relato aponta para um dos lotes negociados.',
    },
    leave: {
      title: 'Uma caravana partiu',
      body: 'Uma caravana abandonou um lote seco e sem sombra. Revise a cobertura de água e sombra antes de expandir.',
    },
    stress: {
      title: 'Água sob pressão',
      body: 'Uma rede de água atingiu seu limite de estresse. Confira a oferta e as reservas antes de aumentar o consumo.',
    },
    collapse: {
      title: 'O qanat parou',
      body: 'A sobrecarga interrompeu um qanat neste bairro. Revise a rede de água, amplie a oferta e conecte cisternas com energia.',
    },
  },
  survival: {
    title: 'VIDA NO OÁSIS',
    water: 'Cobertura de água',
    shade: 'Cobertura de sombra',
    reserves: 'Água armazenada',
    focusSpring: 'Encontrar nascente',
    supplyDemand: 'Oferta / consumo',
    noDemand: 'Sem consumidores',
    noCistern: 'Sem cisterna',
    cisterns: 'Cisternas',
    parched: 'Bairros sob estresse hídrico',
  },
  tutorial: {
    title: 'Fundar um oásis',
    steps: [
      {
        title: 'Uma cidade ao redor da nascente',
        text: 'A cidade começa pausada. Arraste com o botão direito para mover a câmera e use a roda para o zoom. Localize a nascente pelo botão acima: ela fortalece as casas da nascente próximas, mas não abastece tubulações. Sua primeira meta é uma moradia com energia, água e sombra.',
      },
      {
        title: 'Abra um caminho para o mundo',
        text: 'Trace uma estrada de perto da nascente até qualquer borda do mapa. Use o minimapa para se orientar. Essa ligação traz trabalhadores e empregos da região.',
      },
      {
        title: 'Prepare a chegada das famílias',
        text: 'Marque uma pequena faixa residencial ao lado da estrada, deixando espaço para as instalações. Comece pequeno: cada novo bairro precisará de água e sombra.',
      },
      {
        title: 'Crie os primeiros empregos',
        text: 'Marque uma pequena zona industrial ou comercial junto à estrada. Afaste a indústria das moradias para que a poluição não prejudique o assentamento.',
      },
      {
        title: 'Leve energia às moradias',
        text: 'Construa uma usina a gás e ligue-a aos lotes residenciais com linhas de energia. Zonas vizinhas transmitem energia. Deixe o tempo correr até que as moradias sejam atendidas.',
      },
      {
        title: 'Traga água através da areia',
        text: 'Construa um qanat, conecte-o à energia e trace tubulações até os lotes residenciais. O botão de água acima mostra a cobertura. Deixe o tempo correr até um lote residencial receber água.',
      },
      {
        title: 'Crie um refúgio sombreado',
        text: 'Construa uma Palmeira das ferramentas de infraestrutura e ligue-a por um canal a um lote residencial com água. Canais conduzem sombra; tubulações conduzem água. A vegetação natural não é uma instalação de sombra.',
      },
      {
        title: 'Receba os primeiros moradores',
        text: 'Deixe o tempo correr até a chegada dos moradores. Se a cidade não crescer, inspecione um lote residencial para descobrir o serviço ou acesso que falta. Os botões de água e sombra mostram a cobertura das redes.',
      },
      {
        title: 'Guarde água para a estiagem',
        text: 'Construa uma cisterna na rede de tubulações do qanat e ligue-a à energia. Ela guarda automaticamente a oferta que sobra. Deixe o tempo correr até começar a carregar; amplie o abastecimento se o consumo usar toda a oferta.',
      },
      {
        title: 'Seu oásis está tomando forma',
        text: 'Acompanhe o orçamento antes de expandir. A nascente muda de lugar; casas da nascente com energia e água funcionam melhor perto dela. Proteja os serviços com quebra-ventos e construa um caravançará quando houver recursos.',
      },
    ],
  },
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
  canalHint:
    'Arraste para traçar um canal. Ele conduz sombra. Os lotes ao longo dele passam do nível 2.',
  qanatHint: 'Traz água onde não há rio. Precisa de energia.',
  cisternHint: 'Guarda água sobrando e solta quando o bairro seca.',
  windbreakHint: 'Segura a tempestade de areia. Cobre um raio de 6 lotes. Precisa de energia.',
  arcadeHint: 'Uma rua coberta. Alivia o trânsito por perto. Precisa de estrada.',
  caravanseraiHint:
    'As caravanas se encontram aqui. Compram lotes sombreados ou irrigados e pagam o caixa.',
  springHouseHint: 'Sombra plena perto da nascente, com água. Uma casa seca só goteja.',
  palmHint: 'Uma palmeira pequena. Não precisa de energia nem de água.',
  shadeMap: 'Sombra',
};

const ES: Copy = {
  terrains: ['Agua', 'Arena', 'Suelo desértico', 'Tierra', 'Roca'],
  policy: {
    title: 'Gestión del agua',
    normal: 'Suministro normal',
    rationing: 'Racionamiento activo',
    description:
      'Ahorra agua durante la escasez. El consumo baja hasta un 25% por lote; la recaudación comercial e industrial baja un 20% por mes completo de racionamiento. Los impuestos residenciales no cambian.',
    demand: 'Consumo de los edificios actuales',
    standard: 'Normal',
    restricted: 'Racionado',
    cost: 'Reducción de impuestos empresariales acumulada este mes',
    timing:
      'Las redes responden en la próxima actualización diaria con el tiempo en marcha. La reducción fiscal es proporcional al tiempo de uso y sigue pendiente al desactivar. Racionar no reconecta una tubería rota.',
    enable: 'Iniciar racionamiento',
    disable: 'Restaurar suministro normal',
    close: 'Cerrar gestión del agua',
  },
  hubIdle: 'Sin actividad',
  chronicle: {
    title: 'CRÓNICA DEL OASIS',
    history: 'Sucesos recientes',
    close: 'Contraer relato',
    locate: 'Ver en el mapa',
    lots: 'Parcelas en este relato',
    empty: 'El desierto está tranquilo. Los sucesos aparecerán aquí.',
    storm: {
      title: 'Arena sobre la ciudad',
      body: 'Una tormenta alcanzó este servicio e interrumpió temporalmente su operación. Los cortavientos con energía reducen el riesgo de nuevos impactos.',
    },
    blocked: {
      title: 'El cortavientos resistió',
      body: 'La tormenta fue repelida aquí. Mantén el cortavientos con energía para proteger los servicios cercanos.',
    },
    spring: {
      title: 'El manantial se ha movido',
      body: 'El manantial cambió de lugar. Revisa sus casas cercanas: la sombra depende del acceso al agua, la energía y el manantial.',
    },
    trade: {
      title: 'Llegaron las caravanas',
      body: 'Las caravanas compraron parcelas atendidas y pagaron a la tesorería. El relato señala una de las parcelas negociadas.',
    },
    leave: {
      title: 'Una caravana se retiró',
      body: 'Una caravana abandonó una parcela seca y sin sombra. Revisa la cobertura antes de expandir.',
    },
    stress: {
      title: 'Agua bajo presión',
      body: 'Una red de agua alcanzó su umbral de estrés. Revisa el suministro y las reservas antes de aumentar la demanda.',
    },
    collapse: {
      title: 'El qanat se detuvo',
      body: 'La sobrecarga interrumpió un qanat en este distrito. Revisa la red, amplía el suministro y conecta cisternas con energía.',
    },
  },
  survival: {
    title: 'VIDA EN EL OASIS',
    water: 'Cobertura de agua',
    shade: 'Cobertura de sombra',
    reserves: 'Agua almacenada',
    focusSpring: 'Buscar el manantial',
    supplyDemand: 'Oferta / consumo',
    noDemand: 'Sin consumidores',
    noCistern: 'Sin cisterna',
    cisterns: 'Cisternas',
    parched: 'Barrios con estrés hídrico',
  },
  tutorial: {
    title: 'Fundar un oasis',
    steps: [
      {
        title: 'Una ciudad junto al manantial',
        text: 'La ciudad empieza en pausa. Arrastra con el botón derecho y usa la rueda para ampliar. Localiza el manantial con el botón superior: refuerza las casas del manantial cercanas, pero no llena las tuberías. Tu primera meta es una vivienda con energía, agua y sombra.',
      },
      {
        title: 'Conecta con el mundo',
        text: 'Traza una carretera desde cerca del manantial hasta cualquier borde del mapa. Usa el minimapa para orientarte. La conexión aporta trabajadores y empleos de la región.',
      },
      {
        title: 'Prepara las primeras viviendas',
        text: 'Marca una pequeña zona residencial junto a la carretera y deja espacio para los servicios. Empieza con poco: cada nuevo barrio necesita agua y sombra.',
      },
      {
        title: 'Crea los primeros empleos',
        text: 'Añade una pequeña zona industrial o comercial junto a la carretera. Aleja la industria de las viviendas para reducir el impacto de la contaminación.',
      },
      {
        title: 'Lleva energía a las viviendas',
        text: 'Construye una central de gas y conéctala a los lotes residenciales con líneas eléctricas. Las zonas contiguas transmiten energía. Deja correr el tiempo hasta que reciban suministro.',
      },
      {
        title: 'Trae agua por la arena',
        text: 'Construye un qanat, conéctalo a la electricidad y traza tuberías hasta las viviendas. El botón de agua muestra la cobertura. Deja correr el tiempo hasta abastecer un lote residencial.',
      },
      {
        title: 'Crea un refugio con sombra',
        text: 'Construye una Palmera de las herramientas de infraestructura y conéctala por un canal a una vivienda con agua. Los canales llevan sombra; las tuberías, agua. La vegetación natural no suministra sombra a la red.',
      },
      {
        title: 'Recibe a los primeros habitantes',
        text: 'Deja correr el tiempo hasta que lleguen habitantes. Si no crece la ciudad, inspecciona un lote para descubrir el servicio o acceso que falta. Los botones de agua y sombra muestran las redes.',
      },
      {
        title: 'Guarda agua para la sequía',
        text: 'Construye una cisterna en la red de tuberías del qanat y conéctala a la electricidad. Almacena la oferta sobrante automáticamente. Deja correr el tiempo hasta que empiece a llenarse; aumenta el suministro si el consumo lo agota.',
      },
      {
        title: 'Tu oasis toma forma',
        text: 'Revisa el presupuesto antes de expandirte. El manantial se mueve; sus casas con energía y agua funcionan mejor cerca de él. Protege los servicios con cortavientos y añade un caravasar cuando puedas pagarlo.',
      },
    ],
  },
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
  canalHint:
    'Arrastra para trazar un canal. Lleva sombra. Los lotes a lo largo pueden pasar del nivel 2.',
  qanatHint: 'Trae agua donde no hay río. Necesita energía.',
  cisternHint: 'Guarda agua de sobra y la suelta cuando el barrio se seca.',
  windbreakHint: 'Frena una tormenta de arena. Cubre un radio de 6 lotes. Necesita energía.',
  arcadeHint: 'Una calle cubierta. Alivia el tráfico cercano. Necesita una carretera.',
  caravanseraiHint:
    'Las caravanas se reúnen aquí. Compran lotes con sombra o agua y pagan la caja.',
  springHouseHint: 'Sombra plena cerca del manantial, con agua. Una casa seca solo gotea.',
  palmHint: 'Una palmera pequeña. No necesita energía ni agua.',
  shadeMap: 'Sombra',
};

const FR: Copy = {
  terrains: ['Eau', 'Sable', 'Sol désertique', 'Terre', 'Roche'],
  policy: {
    title: 'Gestion de l’eau',
    normal: 'Distribution normale',
    rationing: 'Rationnement actif',
    description:
      'Économisez l’eau en période de pénurie. La consommation baisse jusqu’à 25% par lot ; les recettes fiscales commerciales et industrielles baissent de 20% pour un mois entier de rationnement. Les impôts résidentiels restent inchangés.',
    demand: 'Consommation des bâtiments actuels',
    standard: 'Normale',
    restricted: 'Rationnée',
    cost: 'Baisse des impôts des entreprises cumulée ce mois-ci',
    timing:
      'Les réseaux réagissent à la prochaine mise à jour quotidienne lorsque le temps avance. La baisse fiscale est proportionnelle à la durée et reste due après désactivation. Le rationnement ne répare pas une conduite rompue.',
    enable: 'Activer le rationnement',
    disable: 'Rétablir la distribution normale',
    close: 'Fermer la gestion de l’eau',
  },
  hubIdle: 'À l’arrêt',
  chronicle: {
    title: 'CHRONIQUE DE L’OASIS',
    history: 'Événements récents',
    close: 'Réduire le récit',
    locate: 'Voir sur la carte',
    lots: 'Parcelles dans ce récit',
    empty: 'Le désert est calme. Les événements seront consignés ici.',
    storm: {
      title: 'Du sable sur la ville',
      body: 'Une tempête a frappé ce service et interrompu temporairement son activité. Les brise-vent alimentés réduisent le risque de nouveaux impacts.',
    },
    blocked: {
      title: 'Le brise-vent a tenu',
      body: 'La tempête a été repoussée ici. Maintenez le brise-vent alimenté pour protéger les services voisins.',
    },
    spring: {
      title: 'La source s’est déplacée',
      body: 'La source a changé de place. Vérifiez ses maisons voisines : leur ombre dépend de l’accès à l’eau, au courant et à la source.',
    },
    trade: {
      title: 'Les caravanes sont arrivées',
      body: 'Les caravanes ont acheté des parcelles desservies et payé la ville. Ce récit indique l’une des parcelles échangées.',
    },
    leave: {
      title: 'Une caravane est partie',
      body: 'Une caravane a abandonné une parcelle sèche et sans ombre. Vérifiez la couverture avant de vous étendre.',
    },
    stress: {
      title: 'L’eau sous pression',
      body: 'Un réseau d’eau a atteint son seuil de tension. Vérifiez l’offre et les réserves avant d’accroître la demande.',
    },
    collapse: {
      title: 'Le qanat s’est arrêté',
      body: 'Une surcharge a interrompu un qanat dans ce quartier. Vérifiez le réseau, augmentez l’offre et raccordez des citernes alimentées.',
    },
  },
  survival: {
    title: 'LA VIE DANS L’OASIS',
    water: 'Couverture en eau',
    shade: 'Couverture d’ombre',
    reserves: 'Eau stockée',
    focusSpring: 'Trouver la source',
    supplyDemand: 'Offre / demande',
    noDemand: 'Aucun consommateur',
    noCistern: 'Aucune citerne',
    cisterns: 'Citernes',
    parched: 'Quartiers en stress hydrique',
  },
  tutorial: {
    title: 'Fonder une oasis',
    steps: [
      {
        title: 'Une ville autour de la source',
        text: 'La ville commence en pause. Faites glisser avec le bouton droit et zoomez avec la molette. Le bouton du haut localise la source : elle renforce les maisons de la source proches, mais ne remplit pas les tuyaux. Visez un logement avec électricité, eau et ombre.',
      },
      {
        title: 'Relier la ville au monde',
        text: 'Tracez une route depuis les environs de la source jusqu’à un bord de la carte. La minicarte vous aide à vous orienter. Cette liaison apporte travailleurs et emplois régionaux.',
      },
      {
        title: 'Préparer les premiers logements',
        text: 'Tracez une petite zone résidentielle près de la route et gardez de la place pour les équipements. Commencez petit : chaque quartier aura besoin d’eau et d’ombre.',
      },
      {
        title: 'Créer les premiers emplois',
        text: 'Ajoutez une petite zone industrielle ou commerciale près de la route. Éloignez l’industrie des logements pour limiter la pollution.',
      },
      {
        title: 'Alimenter les logements',
        text: 'Construisez une centrale au gaz et reliez-la aux parcelles résidentielles par des lignes électriques. Les zones voisines transmettent le courant. Laissez le temps avancer jusqu’à leur alimentation.',
      },
      {
        title: 'Amener l’eau à travers le sable',
        text: 'Construisez un qanat, raccordez-le au courant et posez des tuyaux jusqu’aux logements. Le bouton d’eau affiche la couverture. Laissez le temps avancer jusqu’à l’alimentation d’une parcelle résidentielle.',
      },
      {
        title: 'Créer un refuge ombragé',
        text: 'Construisez un Palmier des outils d’infrastructure et reliez-le par un canal à une parcelle résidentielle arrosée. Les canaux portent l’ombre ; les tuyaux, l’eau. La végétation naturelle n’alimente pas le réseau d’ombre.',
      },
      {
        title: 'Accueillir les premiers habitants',
        text: 'Laissez le temps avancer jusqu’à leur arrivée. Si la ville stagne, inspectez une parcelle pour trouver le service ou l’accès manquant. Les boutons d’eau et d’ombre affichent les réseaux.',
      },
      {
        title: 'Stocker pour la sécheresse',
        text: 'Construisez une citerne sur le réseau du qanat et raccordez-la au courant. Elle stocke automatiquement l’excédent. Laissez le temps avancer jusqu’au début du remplissage ; augmentez l’offre si la demande absorbe tout.',
      },
      {
        title: 'Votre oasis prend forme',
        text: 'Surveillez le budget avant de vous étendre. La source se déplace ; ses maisons alimentées en eau et en courant fonctionnent mieux à proximité. Protégez les services avec des brise-vent et ajoutez un caravansérail quand vos moyens le permettent.',
      },
    ],
  },
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
  canalHint:
    'Glissez pour tracer un canal. Il porte l’ombre. Les parcelles le long peuvent dépasser le niveau 2.',
  qanatHint: 'Amène l’eau là où il n’y a pas de rivière. Demande du courant.',
  cisternHint: 'Stocke l’eau en trop et la rend quand le quartier s’assèche.',
  windbreakHint: 'Ralentit une tempête de sable. Couvre un rayon de 6 cases. Demande du courant.',
  arcadeHint: 'Une rue couverte. Allège le trafic alentour. Demande une route.',
  caravanseraiHint:
    'Les caravanes s’y retrouvent. Elles achètent les lots ombragés ou arrosés et paient la caisse.',
  springHouseHint:
    'Ombre pleine près de la source, avec de l’eau. Une maison sèche ne fait que goutter.',
  palmHint: 'Un petit palmier. Ni courant, ni eau.',
  shadeMap: 'Ombre',
};

const DE: Copy = {
  terrains: ['Wasser', 'Sand', 'Wüstenboden', 'Erde', 'Fels'],
  policy: {
    title: 'Wasserverwaltung',
    normal: 'Normale Versorgung',
    rationing: 'Rationierung aktiv',
    description:
      'Spare Wasser bei Knappheit. Der Verbrauch sinkt pro Grundstück um bis zu 25%; die Gewerbe- und Industriesteuereinnahmen sinken bei einem vollen Monat Rationierung um 20%. Wohnsteuern bleiben unverändert.',
    demand: 'Verbrauch der aktuellen Gebäude',
    standard: 'Normal',
    restricted: 'Rationiert',
    cost: 'Aufgelaufener Gewerbesteuerabschlag in diesem Monat',
    timing:
      'Die Netze reagieren beim nächsten täglichen Update bei laufender Zeit. Der Steuerabschlag gilt anteilig für die Nutzungsdauer und bleibt nach dem Abschalten fällig. Rationierung verbindet keine unterbrochene Leitung.',
    enable: 'Rationierung starten',
    disable: 'Normale Versorgung wiederherstellen',
    close: 'Wasserverwaltung schließen',
  },
  hubIdle: 'Nicht in Betrieb',
  chronicle: {
    title: 'CHRONIK DER OASE',
    history: 'Letzte Ereignisse',
    close: 'Bericht einklappen',
    locate: 'Auf der Karte zeigen',
    lots: 'Grundstücke im Bericht',
    empty: 'Die Wüste ist ruhig. Ereignisse werden hier festgehalten.',
    storm: {
      title: 'Sand über der Stadt',
      body: 'Ein Sturm traf diesen Dienst und unterbrach vorübergehend seinen Betrieb. Windschutzanlagen mit Strom senken das Risiko weiterer Schäden.',
    },
    blocked: {
      title: 'Der Windschutz hielt stand',
      body: 'Der Sturm wurde hier abgewehrt. Versorge den Windschutz weiter mit Strom, um nahe Dienste zu schützen.',
    },
    spring: {
      title: 'Die Quelle ist gewandert',
      body: 'Die Quelle hat ihren Standort geändert. Prüfe nahe Quellhäuser: Ihr Schatten hängt von Wasser, Strom und der Quelle ab.',
    },
    trade: {
      title: 'Karawanen sind angekommen',
      body: 'Karawanen kauften versorgte Grundstücke und zahlten an die Stadt. Der Bericht zeigt eines der gehandelten Grundstücke.',
    },
    leave: {
      title: 'Eine Karawane zog weiter',
      body: 'Eine Karawane gab ein trockenes, schattenloses Grundstück auf. Prüfe die Versorgung vor der Erweiterung.',
    },
    stress: {
      title: 'Wasser unter Druck',
      body: 'Ein Wassernetz erreichte seine Belastungsgrenze. Prüfe Angebot und Speicher, bevor die Nachfrage steigt.',
    },
    collapse: {
      title: 'Der Qanat fiel aus',
      body: 'Überlastung unterbrach einen Qanat in diesem Viertel. Prüfe das Netz, erhöhe das Angebot und verbinde Zisternen mit Strom.',
    },
  },
  survival: {
    title: 'LEBEN IN DER OASE',
    water: 'Wasserversorgung',
    shade: 'Schattenversorgung',
    reserves: 'Wasservorrat',
    focusSpring: 'Quelle finden',
    supplyDemand: 'Angebot / Bedarf',
    noDemand: 'Keine Verbraucher',
    noCistern: 'Keine Zisterne',
    cisterns: 'Zisternen',
    parched: 'Viertel mit Wasserstress',
  },
  tutorial: {
    title: 'Eine Oase gründen',
    steps: [
      {
        title: 'Eine Stadt um die Quelle',
        text: 'Die Stadt beginnt pausiert. Ziehe mit der rechten Maustaste und zoome mit dem Mausrad. Die Schaltfläche oben zeigt die Quelle: Sie stärkt nahe Quellhäuser, füllt aber keine Rohre. Dein erstes Ziel ist ein Zuhause mit Strom, Wasser und Schatten.',
      },
      {
        title: 'Die Außenwelt erreichen',
        text: 'Baue eine Straße von der Nähe der Quelle bis zu einem Kartenrand. Nutze die Minikarte zur Orientierung. Die Verbindung bringt Arbeitskräfte und Arbeitsplätze aus der Region.',
      },
      {
        title: 'Die ersten Wohnungen planen',
        text: 'Weise einen kleinen Wohnstreifen neben der Straße aus und lasse Platz für Versorgung. Beginne klein: Jedes neue Viertel braucht Wasser und Schatten.',
      },
      {
        title: 'Arbeitsplätze schaffen',
        text: 'Weise eine kleine Industrie- oder Gewerbezone an der Straße aus. Halte die Industrie von Wohnungen fern, damit die Verschmutzung die Siedlung nicht belastet.',
      },
      {
        title: 'Wohnungen mit Strom versorgen',
        text: 'Baue ein Gaskraftwerk und verbinde es über Stromleitungen mit den Wohngrundstücken. Benachbarte Zonen leiten Strom weiter. Lass die Zeit bis zur Versorgung laufen.',
      },
      {
        title: 'Wasser durch den Sand führen',
        text: 'Baue einen Qanat, versorge ihn mit Strom und lege Rohre zu den Wohnungen. Die Wasserschaltfläche zeigt die Abdeckung. Lass die Zeit laufen, bis ein Wohngrundstück Wasser erhält.',
      },
      {
        title: 'Einen schattigen Zufluchtsort bauen',
        text: 'Baue eine Palme aus den Versorgungswerkzeugen und verbinde sie per Kanal mit einem bewässerten Wohngrundstück. Kanäle leiten Schatten, Rohre Wasser. Natürliche Vegetation versorgt das Schattennetz nicht.',
      },
      {
        title: 'Die ersten Einwohner begrüßen',
        text: 'Lass die Zeit bis zu ihrer Ankunft laufen. Bei Stillstand untersuche ein Grundstück auf fehlende Versorgung oder Straßenanbindung. Die Wasser- und Schattenschaltflächen zeigen die Netze.',
      },
      {
        title: 'Wasser für Trockenzeiten speichern',
        text: 'Baue eine Zisterne im Rohrnetz des Qanats und verbinde sie mit dem Stromnetz. Sie speichert überschüssiges Wasser automatisch. Lass die Zeit bis zum Befüllen laufen und erhöhe das Angebot, falls der Bedarf alles verbraucht.',
      },
      {
        title: 'Deine Oase nimmt Gestalt an',
        text: 'Prüfe vor dem Ausbau das Budget. Die Quelle wandert; Quellhäuser mit Strom und Wasser arbeiten in ihrer Nähe am besten. Schütze Dienste mit Windschutz und baue eine Karawanserei, sobald du sie dir leisten kannst.',
      },
    ],
  },
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
  canalHint:
    'Ziehen, um einen Kanal zu zeichnen. Er trägt Schatten. Grundstücke daran wachsen über Stufe 2.',
  qanatHint: 'Bringt Wasser, wo kein Fluss ist. Braucht Strom.',
  cisternHint: 'Speichert übriges Wasser und gibt es ab, wenn das Viertel trocknet.',
  windbreakHint: 'Bremst einen Sandsturm. Deckt einen Radius von 6 Feldern. Braucht Strom.',
  arcadeHint: 'Eine überdachte Straße. Entlastet den Verkehr daneben. Braucht eine Straße.',
  caravanseraiHint:
    'Karawanen treffen sich hier. Sie kaufen schattige oder bewässerte Grundstücke und zahlen die Kasse.',
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
    tutorial: copy.tutorial,
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
    inspector: { terrains: copy.terrains, hub: { idle: copy.hubIdle } },
    overlays: { data: copy.shadeMap },
  });
}

/** Vocabulary used by the oasis shell, resolved per locale. */
export function oasisCopy(locale: Locale): Copy {
  return COPY[locale] ?? EN;
}

const GUIDE_EN = {
  title: 'Your next steps',
  expand: 'Expand guide',
  collapse: 'Collapse guide',
  details: 'How it works',
  pending: 'In progress',
  ready: 'Currently met',
  review: 'Review founding',
  note: 'Optional goals based on your city now. They can change as the city changes.',
  waiting: 'Let time run to update services and welcome residents.',
  steps: [
    'Start with a small neighborhood. Your first home needs a road, power, water and shade.',
    'Connect your neighborhood to any map edge with a road.',
    'Zone a short residential strip beside the road.',
    'Zone a small workplace beside the road. Leave room between industry and homes.',
    'Build a gas plant, then connect homes with power lines.',
    'Build a powered qanat, then connect homes with pipes.',
    'Place an infrastructure Palm. Connect it by canal to a watered home.',
    'Run the city until your first residents arrive. Inspect a home if it stays empty.',
    'Connect a cistern to both pipes and power. Let surplus water fill it.',
    'Your settlement is ready. Open the next steps to build a more resilient oasis.',
  ],
  goals: {
    residents: 'Welcome 100 residents',
    reserves: 'Fill reserves to 50%',
    budget: 'Close a month without an operating deficit',
    protection: 'Protect a service with a windbreak',
    trade: 'Receive your first caravan payment',
  },
  goalHints: {
    residents: 'Expand homes and jobs while keeping utilities connected.',
    reserves: 'Powered cisterns store surplus water from their connected network.',
    budget: 'Requires residents and a completed monthly report. Construction is separate.',
    protection: 'Build and power a windbreak near an operating service.',
    trade: 'A powered caravanserai enables purchases of vacant watered or shaded lots.',
  },
};

const GUIDE_COPY: Record<Locale, typeof GUIDE_EN> = {
  en: GUIDE_EN,
  'pt-BR': {
    title: 'Próximos passos',
    expand: 'Expandir guia',
    collapse: 'Recolher guia',
    details: 'Como funciona',
    pending: 'Em andamento',
    ready: 'Atendido agora',
    review: 'Rever fundação',
    note: 'Metas opcionais baseadas na situação atual. Elas podem mudar com a cidade.',
    waiting: 'Deixe o tempo correr para atualizar os serviços e receber moradores.',
    steps: [
      'Comece com um bairro pequeno. A primeira moradia precisa de estrada, energia, água e sombra.',
      'Ligue seu bairro a qualquer borda do mapa com uma estrada.',
      'Marque uma pequena faixa residencial junto à estrada.',
      'Marque uma pequena zona de empregos junto à estrada. Separe a indústria das moradias.',
      'Construa uma usina a gás e conecte as moradias com linhas de energia.',
      'Construa um qanat com energia e conecte as moradias com tubulações.',
      'Construa uma Palmeira de infraestrutura. Ligue-a por canal a uma moradia com água.',
      'Deixe o tempo correr até chegarem moradores. Inspecione uma moradia se ela continuar vazia.',
      'Ligue uma cisterna às tubulações e à energia. Deixe a água excedente enchê-la.',
      'Seu assentamento está pronto. Abra os próximos passos para tornar o oásis mais resistente.',
    ],
    goals: {
      residents: 'Receber 100 moradores',
      reserves: 'Encher as reservas até 50%',
      budget: 'Fechar um mês sem déficit operacional',
      protection: 'Proteger um serviço com quebra-vento',
      trade: 'Receber o primeiro pagamento de caravana',
    },
    goalHints: {
      residents: 'Amplie moradias e empregos mantendo as redes conectadas.',
      reserves: 'Cisternas com energia guardam o excedente da rede de água conectada.',
      budget: 'Requer moradores e um relatório mensal fechado. Obras são contabilizadas à parte.',
      protection: 'Construa e energize um quebra-vento perto de um serviço em operação.',
      trade: 'Um caravançará com energia permite a compra de lotes vagos com água ou sombra.',
    },
  },
  es: {
    title: 'Próximos pasos',
    expand: 'Ampliar guía',
    collapse: 'Plegar guía',
    details: 'Cómo funciona',
    pending: 'En curso',
    ready: 'Cumplido ahora',
    review: 'Repasar la fundación',
    note: 'Metas opcionales según el estado actual. Pueden cambiar con la ciudad.',
    waiting: 'Deja correr el tiempo para actualizar servicios y recibir habitantes.',
    steps: [
      'Empieza con un barrio pequeño. La primera vivienda necesita carretera, energía, agua y sombra.',
      'Conecta el barrio con cualquier borde del mapa mediante una carretera.',
      'Traza una pequeña franja residencial junto a la carretera.',
      'Traza una pequeña zona de empleo junto a la carretera. Separa la industria de las viviendas.',
      'Construye una central de gas y conecta las viviendas con líneas eléctricas.',
      'Construye un qanat con energía y conecta las viviendas con tuberías.',
      'Coloca una Palmera de infraestructura. Conéctala por canal a una vivienda con agua.',
      'Deja pasar el tiempo hasta que lleguen habitantes. Inspecciona una vivienda si sigue vacía.',
      'Conecta una cisterna al agua y a la energía. Deja que el excedente la llene.',
      'El asentamiento está listo. Abre los próximos pasos para fortalecer el oasis.',
    ],
    goals: {
      residents: 'Recibir a 100 habitantes',
      reserves: 'Llenar las reservas al 50 %',
      budget: 'Cerrar un mes sin déficit operativo',
      protection: 'Proteger un servicio con cortavientos',
      trade: 'Recibir el primer pago de una caravana',
    },
    goalHints: {
      residents: 'Amplía viviendas y empleos manteniendo conectadas las redes.',
      reserves: 'Las cisternas con energía guardan el excedente de la red de agua conectada.',
      budget: 'Requiere habitantes y un informe mensual cerrado. Las obras se contabilizan aparte.',
      protection: 'Construye y alimenta un cortavientos cerca de un servicio operativo.',
      trade: 'Un caravasar con energía permite comprar lotes vacíos con agua o sombra.',
    },
  },
  fr: {
    title: 'Prochaines étapes',
    expand: 'Développer le guide',
    collapse: 'Réduire le guide',
    details: 'Comment ça marche',
    pending: 'En cours',
    ready: 'Rempli actuellement',
    review: 'Revoir la fondation',
    note: 'Objectifs facultatifs selon l’état actuel. Ils peuvent évoluer avec la ville.',
    waiting: 'Laissez le temps avancer pour actualiser les services et accueillir des habitants.',
    steps: [
      'Commencez par un petit quartier. Le premier logement a besoin de route, énergie, eau et ombre.',
      'Reliez le quartier à un bord de la carte avec une route.',
      'Tracez une petite bande résidentielle le long de la route.',
      'Tracez une petite zone d’emploi près de la route. Éloignez l’industrie des logements.',
      'Construisez une centrale à gaz et reliez les logements avec des lignes électriques.',
      'Construisez un qanat alimenté en énergie, puis reliez les logements avec des conduites.',
      'Placez un Palmier d’infrastructure. Reliez-le par canal à un logement alimenté en eau.',
      'Laissez arriver les habitants. Inspectez un logement s’il reste vide.',
      'Reliez une citerne à l’eau et à l’énergie. Laissez le surplus la remplir.',
      'Votre établissement est prêt. Consultez les prochaines étapes pour renforcer l’oasis.',
    ],
    goals: {
      residents: 'Accueillir 100 habitants',
      reserves: 'Remplir les réserves à 50 %',
      budget: 'Clore un mois sans déficit d’exploitation',
      protection: 'Protéger un service avec un brise-vent',
      trade: 'Recevoir un premier paiement de caravane',
    },
    goalHints: {
      residents: 'Développez logements et emplois en maintenant les réseaux connectés.',
      reserves: 'Les citernes alimentées stockent le surplus du réseau d’eau connecté.',
      budget: 'Nécessite des habitants et un bilan mensuel clos. Les travaux sont comptés à part.',
      protection: 'Construisez et alimentez un brise-vent près d’un service en fonctionnement.',
      trade: 'Un caravansérail alimenté permet l’achat de terrains vacants avec eau ou ombre.',
    },
  },
  de: {
    title: 'Nächste Schritte',
    expand: 'Anleitung ausklappen',
    collapse: 'Anleitung einklappen',
    details: 'So funktioniert es',
    pending: 'In Arbeit',
    ready: 'Aktuell erfüllt',
    review: 'Gründung erneut ansehen',
    note: 'Optionale Ziele anhand des aktuellen Zustands. Sie können sich mit der Stadt ändern.',
    waiting: 'Lass die Zeit laufen, damit Netze aktualisiert werden und Bewohner ankommen.',
    steps: [
      'Beginne mit einem kleinen Viertel. Das erste Haus braucht Straße, Strom, Wasser und Schatten.',
      'Verbinde das Viertel durch eine Straße mit einem beliebigen Kartenrand.',
      'Weise einen kleinen Wohnstreifen neben der Straße aus.',
      'Weise eine kleine Arbeitszone neben der Straße aus. Halte Industrie von Wohnungen fern.',
      'Baue ein Gaskraftwerk und verbinde die Wohnungen mit Stromleitungen.',
      'Baue einen mit Strom versorgten Qanat und verbinde die Wohnungen mit Rohren.',
      'Baue eine Infrastruktur-Palme. Verbinde sie per Kanal mit einem bewässerten Wohngebiet.',
      'Lass Bewohner einziehen. Untersuche ein Haus, wenn es leer bleibt.',
      'Verbinde eine Zisterne mit Wasser und Strom. Lass überschüssiges Wasser einfließen.',
      'Deine Siedlung steht. Öffne die nächsten Schritte, um die Oase widerstandsfähiger zu machen.',
    ],
    goals: {
      residents: '100 Bewohner aufnehmen',
      reserves: 'Reserven auf 50 % füllen',
      budget: 'Einen Monat ohne Betriebsdefizit abschließen',
      protection: 'Einen Dienst mit Windschutz schützen',
      trade: 'Die erste Karawanenzahlung erhalten',
    },
    goalHints: {
      residents: 'Erweitere Wohnungen und Arbeitsplätze bei verbundenen Versorgungsnetzen.',
      reserves: 'Zisternen mit Strom speichern den Überschuss ihres verbundenen Wassernetzes.',
      budget: 'Erfordert Bewohner und einen Monatsabschluss. Baukosten werden getrennt erfasst.',
      protection: 'Baue einen Windschutz nahe einem aktiven Dienst und versorge ihn mit Strom.',
      trade:
        'Eine Karawanserei mit Strom ermöglicht den Kauf leerer Grundstücke mit Wasser oder Schatten.',
    },
  },
};

export function oasisGuideCopy(locale: Locale): typeof GUIDE_EN {
  return GUIDE_COPY[locale];
}

const CONSTRUCTION_EN = {
  ready: 'Ready to apply',
  partial: 'Valid lots only',
  blocked: 'Cannot apply here',
  noChange: 'No changes',
  estimate: 'Estimated cost',
  affected: 'Affected lots',
  existing: 'Already present',
  excluded: 'Blocked lots',
  release: 'Release to apply · Esc to cancel',
  place: 'Click to place · Esc to cancel',
  drag: 'Drag to plan · Release to apply',
  adjust: 'Adjust the location or cancel with Esc.',
  pending: 'Applying…',
  applied: 'Applied',
  refused: 'Not applied',
  failed: 'Confirmation unavailable',
  spent: 'Charged',
  skipped: 'Skipped lots',
  checkMap: 'Check the map before trying again.',
};
const CONSTRUCTION_COPY: Record<Locale, typeof CONSTRUCTION_EN> = {
  en: CONSTRUCTION_EN,
  'pt-BR': {
    ready: 'Pronto para aplicar',
    partial: 'Somente lotes válidos',
    blocked: 'Não é possível aplicar aqui',
    noChange: 'Sem alterações',
    estimate: 'Custo estimado',
    affected: 'Lotes afetados',
    existing: 'Já existentes',
    excluded: 'Lotes bloqueados',
    release: 'Solte para aplicar · Esc cancela',
    place: 'Clique para construir · Esc cancela',
    drag: 'Arraste para planejar · Solte para aplicar',
    adjust: 'Ajuste o local ou cancele com Esc.',
    pending: 'Aplicando…',
    applied: 'Aplicado',
    refused: 'Não aplicado',
    failed: 'Confirmação indisponível',
    spent: 'Cobrado',
    skipped: 'Lotes ignorados',
    checkMap: 'Confira o mapa antes de tentar novamente.',
  },
  es: {
    ready: 'Listo para aplicar',
    partial: 'Solo parcelas válidas',
    blocked: 'No se puede aplicar aquí',
    noChange: 'Sin cambios',
    estimate: 'Coste estimado',
    affected: 'Parcelas afectadas',
    existing: 'Ya existentes',
    excluded: 'Parcelas bloqueadas',
    release: 'Suelta para aplicar · Esc cancela',
    place: 'Haz clic para construir · Esc cancela',
    drag: 'Arrastra para planificar · Suelta para aplicar',
    adjust: 'Ajusta la ubicación o cancela con Esc.',
    pending: 'Aplicando…',
    applied: 'Aplicado',
    refused: 'No aplicado',
    failed: 'Confirmación no disponible',
    spent: 'Cobrado',
    skipped: 'Parcelas omitidas',
    checkMap: 'Revisa el mapa antes de volver a intentarlo.',
  },
  fr: {
    ready: 'Prêt à appliquer',
    partial: 'Terrains valides seulement',
    blocked: 'Impossible ici',
    noChange: 'Aucun changement',
    estimate: 'Coût estimé',
    affected: 'Terrains affectés',
    existing: 'Déjà présents',
    excluded: 'Terrains bloqués',
    release: 'Relâcher pour appliquer · Échap annule',
    place: 'Cliquer pour construire · Échap annule',
    drag: 'Glisser pour planifier · Relâcher pour appliquer',
    adjust: 'Changez l’emplacement ou annulez avec Échap.',
    pending: 'Application…',
    applied: 'Appliqué',
    refused: 'Non appliqué',
    failed: 'Confirmation indisponible',
    spent: 'Débité',
    skipped: 'Terrains ignorés',
    checkMap: 'Vérifiez la carte avant de réessayer.',
  },
  de: {
    ready: 'Bereit zum Anwenden',
    partial: 'Nur gültige Grundstücke',
    blocked: 'Hier nicht möglich',
    noChange: 'Keine Änderungen',
    estimate: 'Geschätzte Kosten',
    affected: 'Betroffene Grundstücke',
    existing: 'Bereits vorhanden',
    excluded: 'Blockierte Grundstücke',
    release: 'Loslassen zum Anwenden · Esc bricht ab',
    place: 'Klicken zum Bauen · Esc bricht ab',
    drag: 'Ziehen zum Planen · Loslassen zum Anwenden',
    adjust: 'Standort ändern oder mit Esc abbrechen.',
    pending: 'Wird angewendet…',
    applied: 'Angewendet',
    refused: 'Nicht angewendet',
    failed: 'Bestätigung nicht verfügbar',
    spent: 'Abgebucht',
    skipped: 'Übersprungene Grundstücke',
    checkMap: 'Prüfe die Karte, bevor du es erneut versuchst.',
  },
};
export function oasisConstructionCopy(locale: Locale): typeof CONSTRUCTION_EN {
  return CONSTRUCTION_COPY[locale];
}
