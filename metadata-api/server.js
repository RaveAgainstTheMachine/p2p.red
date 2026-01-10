const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const redis = require('redis');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

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

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('✅ Redis connected'));

// Connect to Redis
(async () => {
  await redisClient.connect();
})();

// ============================================================================
// Middleware
// ============================================================================

// Trust proxy - we're behind Nginx
app.set('trust proxy', 1);

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://p2p.red',
  credentials: true,
}));
app.use(express.json());
app.use(morgan('combined'));

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

// ============================================================================
// API Endpoints
// ============================================================================

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
    
    console.log('📥 Received metadata creation request:', {
      peerId,
      fileName,
      fileSize,
      fileType,
      hasPin: !!pin,
      pin: pin ? '****' : undefined
    });
    
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
    
    // Hash PIN if provided (4 digits)
    let pinHash = null;
    if (pin) {
      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({
          error: 'PIN must be exactly 4 digits',
        });
      }
      pinHash = await bcrypt.hash(pin, 10);
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
    });
    
    await redisClient.setEx(
      getCacheKey(shortKey),
      expiryHours * 60 * 60,
      cacheData
    );
    
    console.log(`✅ Created short link: ${shortKey} for ${fileName} (${fileSize} bytes)`);
    
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

// Retrieve metadata (GET /api/metadata/:key?pin=1234)
app.get('/api/metadata/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { pin } = req.query;
    
    // Validation
    if (!key || key.length !== 16 || !/^[a-zA-Z0-9]{16}$/.test(key)) {
      return res.status(400).json({
        error: 'Invalid key format',
      });
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
        
        if (!pin) {
          return res.status(401).json({
            error: 'PIN required',
            requiresPin: true,
          });
        }
        
        const pinValid = await bcrypt.compare(pin, link.pin_hash);
        if (!pinValid) {
          // Increment failed attempts
          const currentAttempts = parseInt(attempts || '0') + 1;
          await redisClient.setEx(rateLimitKey, lockoutMinutes * 60, currentAttempts.toString());
          
          const remainingAttempts = maxAttempts - currentAttempts;
          return res.status(403).json({
            error: 'Invalid PIN',
            remainingAttempts: Math.max(0, remainingAttempts),
            message: remainingAttempts > 0 
              ? `Invalid PIN. ${remainingAttempts} attempts remaining.`
              : `Too many failed attempts. Try again in ${lockoutMinutes} minutes.`,
          });
        }
        
        // Clear rate limit on successful PIN
        await redisClient.del(rateLimitKey);
      }
      
      // Return cached data (PIN verified or not required)
      return res.json(data);
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
      if (!pin) {
        return res.status(401).json({
          error: 'PIN required',
          requiresPin: true,
        });
      }
      
      const pinValid = await bcrypt.compare(pin, link.pin_hash);
      if (!pinValid) {
        // Increment failed attempts
        const currentAttempts = parseInt(attempts || '0') + 1;
        await redisClient.setEx(rateLimitKey, lockoutMinutes * 60, currentAttempts.toString());
        
        const remainingAttempts = maxAttempts - currentAttempts;
        return res.status(403).json({
          error: 'Invalid PIN',
          remainingAttempts: Math.max(0, remainingAttempts),
          message: remainingAttempts > 0 
            ? `Invalid PIN. ${remainingAttempts} attempts remaining.`
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
