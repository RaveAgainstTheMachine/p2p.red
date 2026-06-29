const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const redis = require('redis');
const bcrypt = require('bcryptjs');
const net = require('net');
const fs = require('fs');
const dotenv = require('dotenv');
const { isValidShortKey } = require('./utils/shortKey');

const metadataEnvFile = process.env.METADATA_ENV_FILE || '/run/secrets/metadata.env';
if (fs.existsSync(metadataEnvFile)) {
  dotenv.config({ path: metadataEnvFile });
} else {
  dotenv.config();
}

const app = express();
const PORT = process.env.PORT || 3001;
const TURN_TTL_SECONDS = parseInt(process.env.TURN_TTL_SECONDS, 10) || 3600;
const STATUS_TIMEOUT_MS = parseInt(process.env.STATUS_TIMEOUT_MS, 10) || 3000;
const BODY_SIZE_LIMIT = process.env.BODY_SIZE_LIMIT || '100kb';
const isProduction = process.env.NODE_ENV === 'production';
const logRequestsEnv = (process.env.METADATA_API_LOG_REQUESTS || '').trim().toLowerCase();
const logRequests = isProduction
  ? ['1', 'true', 'on', 'yes'].includes(logRequestsEnv)
  : logRequestsEnv
    ? !['0', 'false', 'off', 'no'].includes(logRequestsEnv)
    : true;
const telemetryIngestEnv = (process.env.TELEMETRY_INGEST_ENABLED || '').trim().toLowerCase();
let telemetryIngestEnabled = telemetryIngestEnv
  ? !['0', 'false', 'off', 'no'].includes(telemetryIngestEnv)
  : true;
const OPENBAO_ADDR = (process.env.OPENBAO_ADDR || 'https://<bao-domain>').replace(/\/$/, '');
const OPENBAO_USERPASS_PATH = process.env.OPENBAO_USERPASS_PATH || '/v1/auth/userpass/login';
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || '';
const ADMIN_JWT_TTL_SECONDS = parseInt(process.env.ADMIN_JWT_TTL_SECONDS || '3600', 10);
const ADMIN_COOKIE_NAME = process.env.ADMIN_COOKIE_NAME || 'p2p_admin_session';
const ADMIN_COOKIE_DOMAIN = process.env.ADMIN_COOKIE_DOMAIN || '.p2p.red';
const TELEMETRY_RETENTION_DAYS = parseInt(process.env.TELEMETRY_RETENTION_DAYS || '7', 10);
const TELEMETRY_DAILY_LIMIT = parseInt(process.env.TELEMETRY_DAILY_LIMIT || '10000', 10);

// ============================================================================
// Database & Cache Configuration
// ============================================================================

// PostgreSQL connection pool
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'p2p_metadata',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
  max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS) || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis client
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
  },
  password: process.env.REDIS_PASSWORD || undefined,
  database: process.env.REDIS_DB || 0,
});

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const checkHttp = async (url, options) => {
  try {
    const response = await fetchWithTimeout(url, options);
    return response.ok;
  } catch (error) {
    return false;
  }
};

const PASSPHRASE_PREFIX = 'passphrase:';

const hashPassphrase = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

const checkTcp = (host, port) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: STATUS_TIMEOUT_MS }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('✅ Redis connected'));

const sanitizeTelemetryString = (value, maxLength = 240) => {
  if (!value) return '';
  const raw = String(value);
  const trimmed = raw.slice(0, maxLength);
  return trimmed
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
    .replace(/(#|share\/)[A-Za-z0-9]{16,}/g, '[redacted-key]')
    .replace(/(pin=)[^&\s]+/gi, '$1[redacted]')
    .replace(/peerId[:=]\s*[A-Za-z0-9_-]+/gi, 'peerId=[redacted]');
};

const buildTelemetryPayload = (body) => {
  if (!body || typeof body !== 'object') return null;

  const payload = {
    eventType: sanitizeTelemetryString(body.eventType, 40),
    role: sanitizeTelemetryString(body.role, 24),
    sessionId: sanitizeTelemetryString(body.sessionId, 80),
    buildVersion: sanitizeTelemetryString(body.buildVersion, 80),
    buildVariant: sanitizeTelemetryString(body.buildVariant, 40),
    errorCode: sanitizeTelemetryString(body.errorCode, 80),
    errorMessage: sanitizeTelemetryString(body.errorMessage, 400),
    connectionType: sanitizeTelemetryString(body.connectionType, 20),
    stage: sanitizeTelemetryString(body.stage, 60),
    browser: sanitizeTelemetryString(body.browser, 60),
    os: sanitizeTelemetryString(body.os, 60),
    timestamp: sanitizeTelemetryString(body.timestamp, 40)
  };

  if (!payload.eventType) return null;
  payload.receivedAt = new Date().toISOString();
  return payload;
};

// Connect to Redis & Initialize Database
(async () => {
  try {
    await redisClient.connect();
    
    // Lazy migration for feedback table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        rating INTEGER,
        email VARCHAR(255),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC)');
    console.log('✅ Feedback table verified');
  } catch (error) {
    console.error('Initialization error:', error);
  }
})();

// ============================================================================
// Helper Functions
// ============================================================================

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const generateShareHTML = (metadata) => {
  const safeFileName = escapeHtml(metadata.fileName || 'File');
  const description = `File size: ${formatFileSize(metadata.fileSize)} • Link expires in 24h • Secure P2P transfer`;
  const safeDescription = escapeHtml(description);
  const shortKey = encodeURIComponent(metadata.shortKey || '');
  const url = `https://p2p.red/#${shortKey}`;
  const title = `Download: ${safeFileName}`;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${safeDescription}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:site_name" content="p2p.red">
  
  <!-- Twitter -->
  <meta property="twitter:card" content="summary">
  <meta property="twitter:url" content="${url}">
  <meta property="twitter:title" content="${title}">
  <meta property="twitter:description" content="${safeDescription}">
  
  <meta http-equiv="refresh" content="0;url=${url}">
</head>
<body>
  <p>Redirecting to download page...</p>
  <p>If not redirected, <a href="${url}">click here</a>.</p>
</body>
</html>`;
};

// ============================================================================
// Middleware
// ============================================================================

// Trust proxy - we're behind Nginx
app.set('trust proxy', 1);

app.use(helmet());
app.use(compression());
const corsOriginEnv = (process.env.CORS_ORIGIN || 'https://p2p.red').trim();
const corsOrigin = (() => {
  if (corsOriginEnv === 'dev' || corsOriginEnv === '*') {
    return true;
  }
  if (corsOriginEnv.includes(',')) {
    return corsOriginEnv.split(',').map((origin) => origin.trim()).filter(Boolean);
  }
  return corsOriginEnv;
})();

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
morgan.token('url', (req) => {
  const url = req.originalUrl || req.url || '';
  return url.replace(/([?&]pin=)[^&]+/gi, '$1[redacted]');
});

app.use(express.json({ limit: BODY_SIZE_LIMIT }));
app.use(express.urlencoded({ limit: BODY_SIZE_LIMIT, extended: false }));
let requestLoggingEnabled = logRequests;
app.use(
  morgan('combined', {
    skip: () => !requestLoggingEnabled,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// ============================================================================
// Utility Functions
// ============================================================================

// Generate Base62 short key (16 characters)
function generateShortKey() {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const crypto = require('crypto');
  const bytes = crypto.randomBytes(12);
  let key = '';
  
  for (let i = 0; i < 16; i++) {
    const index = bytes[i % 12] % 62;
    key += chars[index];
  }
  
  return key;
}

// Cache key helper
function getCacheKey(shortKey) {
  return `link:${shortKey}`;
}



const resolveRangeDays = (range) => {
  if (!range) return 7;
  const trimmed = String(range).trim().toLowerCase();
  if (trimmed.endsWith('d')) {
    const days = parseInt(trimmed.replace('d', ''), 10);
    return Number.isFinite(days) ? Math.min(Math.max(days, 1), 30) : 7;
  }
  const days = parseInt(trimmed, 10);
  return Number.isFinite(days) ? Math.min(Math.max(days, 1), 30) : 7;
};

const formatDateKey = (date) => date.toISOString().slice(0, 10).replace(/-/g, '');

const getDatesBetween = (startDate, endDate) => {
  const dates = [];
  const current = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
  while (current <= end) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
};

const parseDateInput = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const buildStatusPayload = async () => {
  const isDev = (process.env.NODE_ENV || 'development') !== 'production';
  const webUrl = process.env.WEB_STATUS_URL || (isDev ? 'https://<dev-domain>' : 'https://p2p.red');
  const signalHost = process.env.SIGNAL_STATUS_HOST || (isDev ? '<dev-signal-domain>' : '<signal-domain>');
  const signalUrl = process.env.SIGNAL_STATUS_URL || `https://${signalHost}/peerjs/id`;
  const analyticsUrl = process.env.ANALYTICS_STATUS_URL || 'https://plausible.p2p.red/js/script.js';
  const openBaoUrl = process.env.OPENBAO_STATUS_URL || 'https://<bao-domain>/v1/sys/health';
  const turnHost = process.env.TURN_STATUS_HOST || (isDev ? '<dev-turn-domain>' : '<turn1-domain>');
  const turnPort = parseInt(process.env.TURN_STATUS_PORT || '3478', 10);

  const [webOk, signalOk, analyticsOk, openBaoOk, turnOk] = await Promise.all([
    checkHttp(webUrl, { method: 'HEAD' }),
    checkHttp(signalUrl, { method: 'GET' }),
    checkHttp(analyticsUrl, { method: 'HEAD' }),
    checkHttp(openBaoUrl, { method: 'GET' }),
    checkTcp(turnHost, turnPort),
  ]);

  let databaseOk = false;
  let cacheOk = false;
  try {
    await pool.query('SELECT 1');
    databaseOk = true;
  } catch (error) {
    databaseOk = false;
  }

  try {
    await redisClient.ping();
    cacheOk = true;
  } catch (error) {
    cacheOk = false;
  }

  const apiStatus = databaseOk && cacheOk ? 'online' : 'degraded';
  const databaseStatus = databaseOk && cacheOk ? 'online' : databaseOk || cacheOk ? 'degraded' : 'offline';

  const services = {
    web: webOk ? 'online' : 'offline',
    signal: signalOk ? 'online' : 'offline',
    api: apiStatus,
    databases: databaseStatus,
    analytics: analyticsOk ? 'online' : 'offline',
    turn: turnOk ? 'online' : 'offline',
    secrets: openBaoOk ? 'online' : 'offline',
  };

  const statusValues = Object.values(services);
  const hasOnline = statusValues.includes('online');
  const hasOffline = statusValues.includes('offline');
  const overall = hasOnline && hasOffline ? 'degraded' : hasOnline ? 'online' : 'offline';

  return {
    status: overall,
    checkedAt: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    services,
    details: {
      databases: {
        postgres: databaseOk ? 'online' : 'offline',
        redis: cacheOk ? 'online' : 'offline',
      },
    },
  };
};

function buildTurnCredentials() {
  if (!process.env.TURN_SECRET) {
    throw new Error('TURN secret not configured');
  }

  const expiry = Math.floor(Date.now() / 1000) + TURN_TTL_SECONDS;
  const username = `${expiry}:p2p`;
  const credential = crypto
    .createHmac('sha1', process.env.TURN_SECRET)
    .update(username)
    .digest('base64');

  return { username, credential, ttl: TURN_TTL_SECONDS };
}

// ============================================================================
// API Endpoints
// ============================================================================

// TURN REST credentials (short-lived)
app.get('/api/turn-credentials', (req, res) => {
  try {
    const credentials = buildTurnCredentials();
    res.json(credentials);
  } catch (error) {
    console.error('Error generating TURN credentials:', error);
    res.status(503).json({ error: 'TURN credentials unavailable' });
  }
});

app.get('/api/status', async (req, res) => {
  try {
    const payload = await buildStatusPayload();
    res.json(payload);
  } catch (error) {
    console.error('Status check failed:', error);
    res.status(500).json({ error: 'Status unavailable' });
  }
});

app.post('/api/telemetry/transfer', async (req, res) => {
  try {
    if (!telemetryIngestEnabled) {
      return res.status(503).json({ error: 'Telemetry ingest disabled' });
    }
    const payload = buildTelemetryPayload(req.body);
    if (!payload) {
      return res.status(400).json({ error: 'Invalid telemetry payload' });
    }

    const dayKey = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countKey = `telemetry:transfer:count:${dayKey}`;
    const listKey = `telemetry:transfer:${dayKey}`;

    const count = await redisClient.incr(countKey);
    if (count === 1) {
      await redisClient.expire(countKey, 60 * 60 * 48);
    }
    if (count > TELEMETRY_DAILY_LIMIT) {
      return res.status(429).json({ error: 'Daily telemetry limit reached' });
    }

    await redisClient.lPush(listKey, JSON.stringify(payload));
    await redisClient.lTrim(listKey, 0, TELEMETRY_DAILY_LIMIT - 1);
    await redisClient.expire(listKey, TELEMETRY_RETENTION_DAYS * 86400);

    return res.json({ status: 'ok' });
  } catch (error) {
    console.error('Telemetry ingest error:', error);
    return res.status(500).json({ error: 'Telemetry ingest failed' });
  }
});

app.post('/api/feedback', async (req, res) => {
  const { content, rating, email, metadata } = req.body || {};
  
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'Feedback content is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO feedback (content, rating, email, metadata) VALUES ($1, $2, $3, $4) RETURNING id',
      [
        content.slice(0, 10000), // Limit size
        Number.isInteger(rating) ? Math.min(Math.max(rating, 1), 5) : null,
        email ? String(email).slice(0, 255) : null,
        metadata && typeof metadata === 'object' ? metadata : {}
      ]
    );
    
    res.json({ id: result.rows[0].id, status: 'ok' });
  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    // Check PostgreSQL
    await pool.query('SELECT 1');
    
    // Check Redis
    await redisClient.ping();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        postgres: 'connected',
        redis: 'connected',
      },
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

// Create short link (POST /api/metadata)
app.post('/api/metadata', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { peerId, fileName, fileSize, fileType, pin } = req.body;
    
    // Metadata creation - no user-identifiable logging
    
    // Validation
    if (!peerId || !fileName || fileSize === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: peerId, fileName, fileSize',
      });
    }
    
    if (typeof fileSize !== 'number' || fileSize < 0) {
      return res.status(400).json({
        error: 'Invalid fileSize: must be a positive number',
      });
    }
    
    // Generate unique short key
    let shortKey;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      shortKey = generateShortKey();
      
      // Check if key exists in database
      const checkResult = await client.query(
        'SELECT short_key FROM short_links WHERE short_key = $1',
        [shortKey]
      );
      
      if (checkResult.rows.length === 0) {
        break; // Key is unique
      }
      
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      return res.status(500).json({
        error: 'Failed to generate unique short key',
      });
    }
    
    // Calculate expiration
    const expiryHours = parseInt(process.env.LINK_EXPIRY_HOURS) || 24;
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    
    // Hash PIN/passphrase if provided (4 digits or custom passphrase <= 128 chars)
    let pinHash = null;
    let pinType = null;
    if (pin !== undefined && pin !== null && String(pin).length > 0) {
      const pinValue = String(pin);
      const isFourDigitPin = /^\d{4}$/.test(pinValue);
      if (!isFourDigitPin && pinValue.length > 128) {
        return res.status(400).json({
          error: 'Passphrase must be 128 characters or fewer',
        });
      }
      if (!isFourDigitPin && pinValue.length === 0) {
        return res.status(400).json({
          error: 'PIN or passphrase cannot be empty',
        });
      }
      if (isFourDigitPin) {
        pinHash = await bcrypt.hash(pinValue, 10);
        pinType = 'pin';
      } else {
        const passphraseHash = await bcrypt.hash(hashPassphrase(pinValue), 10);
        pinHash = `${PASSPHRASE_PREFIX}${passphraseHash}`;
        pinType = 'passphrase';
      }
    }
    
    // Insert into database
    await client.query(
      `INSERT INTO short_links 
       (short_key, peer_id, file_name, file_size, file_type, pin_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [shortKey, peerId, fileName, fileSize, fileType || 'application/octet-stream', pinHash, expiresAt]
    );
    
    // Cache in Redis with TTL
    const cacheData = JSON.stringify({
      peerId,
      fileName,
      fileSize,
      fileType: fileType || 'application/octet-stream',
      hasPin: !!pinHash,
      pinType: pinType || null,
    });
    
    await redisClient.setEx(
      getCacheKey(shortKey),
      expiryHours * 60 * 60,
      cacheData
    );
    
    // Link created successfully - no user-identifiable logging
    
    res.status(201).json({
      key: shortKey,
      expiresAt: expiresAt.toISOString(),
    });
    
  } catch (error) {
    console.error('Error creating short link:', error);
    res.status(500).json({
      error: 'Failed to create short link',
    });
  } finally {
    client.release();
  }
});

// Rich preview endpoint (GET /share/:key)
app.get('/share/:key', async (req, res) => {
  try {
    const { key } = req.params;
    
    // Validation
    if (!key || key.length !== 16 || !/^[a-zA-Z0-9]{16}$/.test(key)) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta http-equiv="refresh" content="0; url=https://p2p.red/#${key}">
          </head>
          <body>
            <p>Redirecting to P2P File Share...</p>
          </body>
        </html>
      `);
    }
    
    // Get metadata (no PIN needed for public preview)
    const result = await pool.query(
      `SELECT peer_id, file_name, file_size, file_type, expires_at, has_pin 
       FROM short_links 
       WHERE short_key = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
      [key]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta http-equiv="refresh" content="0; url=https://p2p.red/#${key}">
          </head>
          <body>
            <p>Link not found or expired. Redirecting to P2P File Share...</p>
          </body>
        </html>
      `);
    }
    
    const metadata = result.rows[0];
    const safeFileName = escapeHtml(metadata.file_name);
    const safeFileType = escapeHtml(metadata.file_type);
    
    // Helper function to format file size
    function formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Generate HTML with rich meta tags
    const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeFileName} - P2P File Share</title>
    <meta name="description" content="An ${safeFileType} file (${formatFileSize(metadata.file_size)}) shared securely with end-to-end encryption. True peer-to-peer transfer, no server storage." />
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://p2p.red/#${key}" />
    <meta property="og:title" content="${safeFileName} - Shared via P2P" />
    <meta property="og:description" content="An ${safeFileType} file (${formatFileSize(metadata.file_size)}) shared securely with end-to-end encryption. Download directly from sender." />
    <meta property="og:site_name" content="p2p.red" />
    <meta property="og:image" content="https://p2p.red/logo.svg" />
    <meta property="og:image:width" content="400" />
    <meta property="og:image:height" content="400" />
    <meta property="og:image:type" content="image/svg+xml" />
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="https://p2p.red/#${key}" />
    <meta name="twitter:title" content="${safeFileName} - Shared via P2P" />
    <meta name="twitter:description" content="An ${safeFileType} file (${formatFileSize(metadata.file_size)}) shared securely with end-to-end encryption." />
    <meta name="twitter:image" content="https://p2p.red/logo.svg" />
    <meta name="twitter:image:alt" content="P2P File Share Logo" />
    
    <!-- Redirect to main app after 1 second -->
    <meta http-equiv="refresh" content="1; url=https://p2p.red/#${key}" />
    
  </head>
  <body>
    <div class="container">
      <div class="icon">📁</div>
      <h1>${safeFileName}</h1>
      <div class="file-info">
        ${safeFileType} file • ${formatFileSize(metadata.file_size)}
      </div>
      <div class="file-info">
        Shared securely with P2P encryption
      </div>
      <div class="redirect">
        Redirecting to download page...
      </div>
    </div>
    
  </body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
    
  } catch (error) {
    console.error('❌ Rich preview error:', error.message);
    
    // Fallback to redirect if metadata not found
    const fallbackHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta http-equiv="refresh" content="0; url=https://p2p.red/#${req.params.key}" />
  </head>
  <body>
    <p>Redirecting to P2P File Share...</p>
  </body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(fallbackHtml);
  }
});

// Retrieve metadata (GET /api/metadata/:key?pin=1234)
app.get('/api/metadata/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const pin = req.get('x-p2p-pin') || req.query.pin;
    const { html } = req.query; // Check for html parameter
    
    // Validation
    if (!isValidShortKey(key)) {
      return res.status(400).json({
        error: 'Invalid key format',
      });
    }
    
    // If html parameter is present, serve rich preview HTML
    if (html === 'true') {
      try {
        // Get metadata (no PIN needed for public preview)
        const result = await pool.query(
          `SELECT peer_id, file_name, file_size, file_type, expires_at, pin_hash 
           FROM short_links 
           WHERE short_key = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
          [key]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).send(`
            <!DOCTYPE html>
            <html>
              <head>
                <meta http-equiv="refresh" content="0; url=https://p2p.red/#${key}">
              </head>
              <body>
                <p>Link not found or expired. Redirecting to P2P File Share...</p>
              </body>
            </html>
          `);
        }
        
        const metadata = result.rows[0];
        const safeFileName = escapeHtml(metadata.file_name);
        const safeFileType = escapeHtml(metadata.file_type);
        
        // Helper function to format file size
        function formatFileSize(bytes) {
          if (bytes === 0) return '0 Bytes';
          const k = 1024;
          const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        // Generate HTML with rich meta tags
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeFileName} - P2P File Share</title>
    <meta name="description" content="An ${safeFileType} file (${formatFileSize(metadata.file_size)}) shared securely with end-to-end encryption. True peer-to-peer transfer, no server storage." />
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://p2p.red/#${key}" />
    <meta property="og:title" content="${safeFileName} - Shared via P2P" />
    <meta property="og:description" content="An ${safeFileType} file (${formatFileSize(metadata.file_size)}) shared securely with end-to-end encryption. Download directly from sender." />
    <meta property="og:site_name" content="p2p.red" />
    <meta property="og:image" content="https://p2p.red/logo.svg" />
    <meta property="og:image:width" content="400" />
    <meta property="og:image:height" content="400" />
    <meta property="og:image:type" content="image/svg+xml" />
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="https://p2p.red/#${key}" />
    <meta name="twitter:title" content="${safeFileName} - Shared via P2P" />
    <meta name="twitter:description" content="An ${safeFileType} file (${formatFileSize(metadata.file_size)}) shared securely with end-to-end encryption." />
    <meta name="twitter:image" content="https://p2p.red/logo.svg" />
    <meta name="twitter:image:alt" content="P2P File Share Logo" />
    
    <!-- Redirect to main app after 1 second -->
    <meta http-equiv="refresh" content="1; url=https://p2p.red/#${key}" />
  </head>
  <body>
    <div class="container">
      <div class="icon">📁</div>
      <h1>${safeFileName}</h1>
      <div class="file-info">
        ${safeFileType} file • ${formatFileSize(metadata.file_size)}
      </div>
      <div class="file-info">
        Shared securely with P2P encryption
      </div>
      <div class="redirect">
        Redirecting to download page...
      </div>
    </div>
    
  </body>
</html>`;
        
        res.setHeader('Content-Type', 'text/html');
        return res.send(htmlContent);
        
      } catch (error) {
        console.error('❌ Rich preview error:', error.message);
        
        // Fallback to redirect if metadata not found
        const fallbackHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta http-equiv="refresh" content="0; url=https://p2p.red/#${key}" />
  </head>
  <body>
    <p>Redirecting to P2P File Share...</p>
  </body>
</html>`;
        
        res.setHeader('Content-Type', 'text/html');
        return res.send(fallbackHtml);
      }
    }
    
    // Check rate limiting for PIN attempts
    const rateLimitKey = `pin_attempts:${key}`;
    const attempts = await redisClient.get(rateLimitKey);
    const maxAttempts = 5;
    const lockoutMinutes = 15;
    
    if (attempts && parseInt(attempts) >= maxAttempts) {
      const ttl = await redisClient.ttl(rateLimitKey);
      return res.status(429).json({
        error: 'Too many PIN attempts',
        retryAfter: ttl,
        message: `Too many failed attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`,
      });
    }
    
    // Try cache first - but still need to check PIN from database
    const cacheKey = getCacheKey(key);
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      console.log(`📦 Cache hit for key: ${key}`);
      const data = JSON.parse(cached);
      let resolvedPinType = data.pinType || null;
      
      // If cache indicates PIN required, we must verify it
      if (data.hasPin) {
        // Need to query database for pin_hash to verify
        const result = await pool.query(
          `SELECT pin_hash FROM short_links WHERE short_key = $1`,
          [key]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({
            error: 'Link not found or expired',
          });
        }
        
        const link = result.rows[0];
        resolvedPinType = resolvedPinType || (link.pin_hash?.startsWith(PASSPHRASE_PREFIX) ? 'passphrase' : link.pin_hash ? 'pin' : null);
        
        const pinValue = pin !== undefined && pin !== null ? String(pin) : '';
        if (!pinValue) {
          return res.status(401).json({
            error: 'PIN or passphrase required',
            requiresPin: true,
            pinType: resolvedPinType,
          });
        }

        const pinHash = link.pin_hash || '';
        const pinValid = pinHash.startsWith(PASSPHRASE_PREFIX)
          ? await bcrypt.compare(hashPassphrase(pinValue), pinHash.slice(PASSPHRASE_PREFIX.length))
          : await bcrypt.compare(pinValue, pinHash);
        if (!pinValid) {
          // Increment failed attempts
          const currentAttempts = parseInt(attempts || '0') + 1;
          await redisClient.setEx(rateLimitKey, lockoutMinutes * 60, currentAttempts.toString());
          
          const remainingAttempts = maxAttempts - currentAttempts;
          return res.status(403).json({
            error: 'Invalid PIN or passphrase',
            remainingAttempts: Math.max(0, remainingAttempts),
            message: remainingAttempts > 0 
              ? `Invalid PIN or passphrase. ${remainingAttempts} attempts remaining.`
              : `Too many failed attempts. Try again in ${lockoutMinutes} minutes.`,
          });
        }
        
        // Clear rate limit on successful PIN
        await redisClient.del(rateLimitKey);
      }
      
      // Return cached data (PIN verified or not required)
      return res.json({ ...data, pinType: resolvedPinType });
    }
    
    // Cache miss - query database
    console.log(`💾 Cache miss for key: ${key}, querying database`);
    const result = await pool.query(
      `SELECT peer_id, file_name, file_size, file_type, pin_hash, expires_at
       FROM short_links
       WHERE short_key = $1`,
      [key]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Link not found or expired',
      });
    }
    
    const link = result.rows[0];
    
    // Check PIN if required
    if (link.pin_hash) {
      const pinValue = pin !== undefined && pin !== null ? String(pin) : '';
      if (!pinValue) {
        return res.status(401).json({
          error: 'PIN or passphrase required',
          requiresPin: true,
          pinType,
        });
      }

      const pinHash = link.pin_hash || '';
      const pinValid = pinHash.startsWith(PASSPHRASE_PREFIX)
        ? await bcrypt.compare(hashPassphrase(pinValue), pinHash.slice(PASSPHRASE_PREFIX.length))
        : await bcrypt.compare(pinValue, pinHash);
      if (!pinValid) {
        // Increment failed attempts
        const currentAttempts = parseInt(attempts || '0') + 1;
        await redisClient.setEx(rateLimitKey, lockoutMinutes * 60, currentAttempts.toString());
        
        const remainingAttempts = maxAttempts - currentAttempts;
        return res.status(403).json({
          error: 'Invalid PIN or passphrase',
          remainingAttempts: Math.max(0, remainingAttempts),
          message: remainingAttempts > 0 
            ? `Invalid PIN or passphrase. ${remainingAttempts} attempts remaining.`
            : `Too many failed attempts. Try again in ${lockoutMinutes} minutes.`,
        });
      }
      
      // Clear rate limit on successful PIN
      await redisClient.del(rateLimitKey);
    }
    
    // Check expiration
    if (new Date(link.expires_at) < new Date()) {
      // Delete expired link
      await pool.query('DELETE FROM short_links WHERE short_key = $1', [key]);
      return res.status(410).json({
        error: 'Link expired',
      });
    }
    
    // Update access count
    await pool.query(
      `UPDATE short_links 
       SET access_count = access_count + 1, last_accessed_at = NOW()
       WHERE short_key = $1`,
      [key]
    );
    
    // Prepare response
    const metadata = {
      peerId: link.peer_id,
      fileName: link.file_name,
      fileSize: parseInt(link.file_size),
      fileType: link.file_type,
      hasPin: !!link.pin_hash,
      pinType,
      expiresAt: link.expires_at.toISOString(),
    };
    
    // Update cache
    const ttl = Math.floor((new Date(link.expires_at) - new Date()) / 1000);
    if (ttl > 0) {
      await redisClient.setEx(cacheKey, ttl, JSON.stringify(metadata));
    }
    
    console.log(`📥 Retrieved metadata for key: ${key}`);
    res.json(metadata);
    
  } catch (error) {
    console.error('Error retrieving metadata:', error);
    res.status(500).json({
      error: 'Failed to retrieve metadata',
    });
  }
});

// Share link preview endpoint (for social media crawlers)
app.get('/share/:key', async (req, res) => {
  const { key } = req.params;
  
  try {
    const cacheKey = `link:${key}`;
    const cached = await redisClient.get(cacheKey);
    
    let metadata;
    if (cached) {
      metadata = JSON.parse(cached);
    } else {
      const result = await pool.query(
        'SELECT * FROM short_links WHERE short_key = $1 AND expires_at > NOW()',
        [key]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).send('Link not found or expired');
      }
      
      const link = result.rows[0];
      metadata = {
        peerId: link.peer_id,
        fileName: link.file_name,
        fileSize: parseInt(link.file_size),
        fileType: link.file_type,
        hasPin: !!link.pin_hash,
      };
    }
    
    metadata.shortKey = key;
    const html = generateShareHTML(metadata);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
    
  } catch (error) {
    console.error('Error generating share preview:', error);
    res.status(500).send('Error loading share link');
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    // Check redis connection
    await redisClient.ping();
    
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'up',
        cache: 'up'
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({ 
      status: 'unhealthy',
      error: error.message 
    });
  }
});

// Statistics endpoint (optional)
app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_links,
        COUNT(*) FILTER (WHERE expires_at > NOW()) as active_links,
        SUM(access_count) as total_accesses,
        AVG(file_size) as avg_file_size
      FROM short_links
    `);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ============================================================================
// Cleanup Job
// ============================================================================

// Clean up expired links periodically
const cleanupInterval = parseInt(process.env.CLEANUP_INTERVAL_MINUTES) || 60;

setInterval(async () => {
  try {
    const result = await pool.query(
      'DELETE FROM short_links WHERE expires_at < NOW()'
    );
    
    if (result.rowCount > 0) {
      console.log(`🧹 Cleaned up ${result.rowCount} expired links`);
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}, cleanupInterval * 60 * 1000);

// ============================================================================
// Server Startup
// ============================================================================

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await pool.end();
  await redisClient.quit();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Metadata API server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Link expiry: ${process.env.LINK_EXPIRY_HOURS || 24} hours`);
  console.log(`🧹 Cleanup interval: ${cleanupInterval} minutes`);
});
