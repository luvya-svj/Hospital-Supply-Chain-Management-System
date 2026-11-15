const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Helper to get raw unquoted DATABASE_URL without dotenv comment truncation
function getDatabaseUrl() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('DATABASE_URL=')) {
          let val = trimmed.substring('DATABASE_URL='.length).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
          }
          return val;
        }
      }
    }
  } catch (err) {
    // fallback to process.env
  }
  return process.env.DATABASE_URL;
}

function parseDbConfig(connStr) {
  if (!connStr) {
    throw new Error('DATABASE_URL is not defined.');
  }
  const match = connStr.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:/]+)(?::(\d+))?\/(.+)$/);
  if (match) {
    return {
      user: decodeURIComponent(match[1]),
      password: decodeURIComponent(match[2]),
      host: match[3],
      port: match[4] ? parseInt(match[4], 10) : 5432,
      database: match[5].split('?')[0]
    };
  }
  return { connectionString: connStr };
}

const rawUrl = getDatabaseUrl();
const poolConfig = parseDbConfig(rawUrl);

// Keep pool small for serverless and local (max: 5)
poolConfig.max = 5;

// Use SSL when NODE_ENV is production or DATABASE_URL contains sslmode=require
const useSsl = process.env.NODE_ENV === 'production' || (rawUrl && rawUrl.includes('sslmode=require'));
if (useSsl) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  getDatabaseUrl
};
