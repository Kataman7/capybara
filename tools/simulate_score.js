const { PRODUCTION_CHAIN } = require('../productionChain');

// Copy of tuning constants from resourceRepository (keep in sync)
const ALPHA = 0.65; // production concavity
const GLOBAL_SCORE_SCALE = 1.0;
const GAMMA = 0.45; // score softening exponent

function computeScore(resources) {
  let score = resources.watermelon_count || 0;
  let runningMultiplier = 1;
  for (let i = 1; i < PRODUCTION_CHAIN.length; i++) {
    const level = PRODUCTION_CHAIN[i];
    const costAmount = (level.cost && level.cost.amount) ? level.cost.amount : 1;
    runningMultiplier *= costAmount;
    const count = resources[level.id] || 0;
    if (!count || count <= 0) continue;
    const softened = Math.pow(runningMultiplier, GAMMA);
    score += count * softened * GLOBAL_SCORE_SCALE;
  }
  return Math.round(score);
}

function makeResources(counts) {
  const r = {};
  for (const lvl of PRODUCTION_CHAIN) r[lvl.id] = 0;
  r.watermelon_count = 0;
  for (const k of Object.keys(counts)) {
    r[k] = counts[k];
  }
  return r;
}

function printScenario(name, counts) {
  const res = makeResources(counts);
  const score = computeScore(res);
  console.log(name.padEnd(30), '=>', score.toLocaleString('fr-FR'));
}

// Scenario 1: one of each level (1 up the chain)
const counts1 = {};
for (let i = 1; i < PRODUCTION_CHAIN.length; i++) counts1[PRODUCTION_CHAIN[i].id] = 1;
printScenario('One of each level', counts1);

// Scenario 2: exponential counts (powers of two)
const counts2 = {};
let v = 1;
for (let i = 1; i < PRODUCTION_CHAIN.length; i++) {
  counts2[PRODUCTION_CHAIN[i].id] = v;
  v *= 2;
}
printScenario('Powers of two', counts2);

// Scenario 3: concentrated high-tier (100 of highest)
const counts3 = {};
counts3[PRODUCTION_CHAIN[PRODUCTION_CHAIN.length - 1].id] = 100;
printScenario('100 of top level', counts3);

// Scenario 4: mid-tier farm (1000 of mid level)
const midIdx = Math.floor(PRODUCTION_CHAIN.length / 2);
const counts4 = {};
counts4[PRODUCTION_CHAIN[midIdx].id] = 1000;
printScenario('1000 of mid level', counts4);

// Scenario 5: hypothetical huge (to see scaling)
const counts5 = {};
counts5[PRODUCTION_CHAIN[PRODUCTION_CHAIN.length - 1].id] = 100000;
printScenario('100k of top level', counts5);

console.log('\nAdjust GLOBAL_SCORE_SCALE in resourceRepository.js to calibrate first-reset target (~10M).');

