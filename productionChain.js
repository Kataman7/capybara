// Configuration de la chaîne de production
// Chaque niveau produit le niveau précédent

const PRODUCTION_CHAIN = [
  {
    id: 'watermelon_count',
    name: 'Watermelon',
    emoji: '🍉',
    cost: null, // Base resource, no cost
    produces: null
  },
  {
    id: 'presse_melon',
    name: 'Presse-Melon',
    emoji: '🔧',
    cost: { resource: 'watermelon_count', amount: 10 },
    produces: { resource: 'watermelon_count', amount: 2 }
  },
  {
    id: 'jardin_melonifique',
    name: 'Jardin Mélonifique',
    emoji: '🌱',
    cost: { resource: 'presse_melon', amount: 10 },
    produces: { resource: 'presse_melon', amount: 2 }
  },
  {
    id: 'multiplicateur_agricolyte',
    name: 'Multiplicateur Agricolyte',
    emoji: '⚙️',
    cost: { resource: 'jardin_melonifique', amount: 15 },
    produces: { resource: 'jardin_melonifique', amount: 2 }
  },
  {
    id: 'serre_auto_multipliee',
    name: 'Serre Auto-Multipliée',
    emoji: '🏗️',
    cost: { resource: 'multiplicateur_agricolyte', amount: 15 },
    produces: { resource: 'multiplicateur_agricolyte', amount: 2 }
  },
  {
    id: 'usine_hydro_melonique',
    name: 'Usine Hydro-Mélonique',
    emoji: '🏭',
    cost: { resource: 'serre_auto_multipliee', amount: 20 },
    produces: { resource: 'serre_auto_multipliee', amount: 2 }
  },
  {
    id: 'complexe_agricolo_energetique',
    name: 'Complexe Agricolo-Énergétique',
    emoji: '⚡',
    cost: { resource: 'usine_hydro_melonique', amount: 25 },
    produces: { resource: 'usine_hydro_melonique', amount: 2 }
  },
  {
    id: 'megastructure_melonospherique',
    name: 'Mégastructure Mélonosphérique',
    emoji: '🌐',
    cost: { resource: 'complexe_agricolo_energetique', amount: 30 },
    produces: { resource: 'complexe_agricolo_energetique', amount: 2 }
  },
  {
    id: 'terraformeur_fruito_spherique',
    name: 'Terraformeur Fruito-Sphérique',
    emoji: '🪐',
    cost: { resource: 'megastructure_melonospherique', amount: 35 },
    produces: { resource: 'megastructure_melonospherique', amount: 2 }
  },
  {
    id: 'architecte_quantique_melon',
    name: 'Architecte Quantique du Melon',
    emoji: '🔮',
    cost: { resource: 'terraformeur_fruito_spherique', amount: 40 },
    produces: { resource: 'terraformeur_fruito_spherique', amount: 2 }
  },
  {
    id: 'matrice_originelle_fruits',
    name: 'Matrice Originelle des Fruits Ultimes',
    emoji: '✨',
    cost: { resource: 'architecte_quantique_melon', amount: 45 },
    produces: { resource: 'architecte_quantique_melon', amount: 2 }
  },
  {
    id: 'coeur_cosmique_watermelon',
    name: 'Cœur Cosmique du Watermelon',
    emoji: '💫',
    cost: { resource: 'matrice_originelle_fruits', amount: 50 },
    produces: { resource: 'matrice_originelle_fruits', amount: 2 }
  }
];

// Helper pour obtenir un niveau par ID
function getLevel(id) {
  return PRODUCTION_CHAIN.find(l => l.id === id);
}

// Helper pour obtenir tous les niveaux qui produisent (sauf watermelon)
function getProducers() {
  return PRODUCTION_CHAIN.filter(l => l.produces !== null);
}

module.exports = {
  PRODUCTION_CHAIN,
  getLevel,
  getProducers
};
