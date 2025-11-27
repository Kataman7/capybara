require('dotenv').config();

// Try to use mysql2/promise for modern auth and async/await; fall back to legacy `mysql` if not present.
let mysql2;
let mysqlLegacy;
let pool;
let usingMysql2 = false;

try {
  mysql2 = require('mysql2/promise');
  usingMysql2 = true;
} catch (err) {
  try {
    mysqlLegacy = require('mysql');
    usingMysql2 = false;
  } catch (err2) {
    console.error('No mysql2 or mysql module installed. Please install one of them.');
    process.exit(1);
  }
}

const poolConfig = {
  connectionLimit: 10,
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || process.env.DB_ROOT_PASS || '',
  database: process.env.DB_NAME || 'capybara_db',
};

if (usingMysql2) {
  pool = mysql2.createPool(poolConfig);
} else {
  pool = mysqlLegacy.createPool(poolConfig);
}

async function query(sql, params = []) {
  if (usingMysql2) {
    const [results] = await pool.execute(sql, params);
    return results;
  }

  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

module.exports = {
    query,
    pool
};
