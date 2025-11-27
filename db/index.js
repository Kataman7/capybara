const { query, pool } = require('./core');
const userRepository = require('./repositories/userRepository');
const resourceRepository = require('./repositories/resourceRepository');
const leaderboardRepository = require('./repositories/leaderboardRepository');
const tradeRepository = require('./repositories/tradeRepository');
const blessingRepository = require('./repositories/blessingRepository');

module.exports = {
    query,
    pool,
    ...userRepository,
    ...resourceRepository,
    ...leaderboardRepository,
    ...tradeRepository,
    ...blessingRepository
};
