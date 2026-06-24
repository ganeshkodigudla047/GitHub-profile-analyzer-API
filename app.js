/**
 * GitHub Profile Analyzer API
 * Main application entry point
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const path = require('path');

const logger = require('./utils/logger');
const { testConnection } = require('./config/db');
const githubRoutes = require('./routes/githubRoutes');
const { notFoundHandler, globalErrorHandler } = require('./middleware/errorHandler');
const swaggerDocument = require('./swagger/swagger.json');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy - required for Railway, Render, and other cloud platforms
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'http:'],
      connectSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS - allow all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── General Middleware ───────────────────────────────────────────────────────
app.use(compression()); // Gzip responses
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// HTTP request logging
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
  skip: (req) => req.url === '/health' || req.url === '/api/health',
}));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: (req) => req.path === '/health',
});

const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { success: false, message: 'Too many analysis requests. Please wait a minute.' },
});

app.use('/api', apiLimiter);
app.use('/api/analyze', analyzeLimiter);

// ─── Static Files (Dashboard UI) ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
}));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api', githubRoutes);

// ─── Swagger API Documentation ────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customSiteTitle: 'GitHub Profile Analyzer API',
  customCss: `
    .swagger-ui .topbar { background-color: #1a1a2e; }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
    .swagger-ui .info .title { color: #6c63ff; }
  `,
}));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    app: process.env.APP_NAME || 'GitHub Profile Analyzer',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
  });
});

// Serve dashboard pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'public', 'profile.html')));
app.get('/docs', (req, res) => res.redirect('/api-docs'));

// ─── Error Handlers ───────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

// ─── Auto Migration ───────────────────────────────────────────────────────────
async function runMigrations() {
  const { pool } = require('./config/db');
  try {
    await pool.execute(`CREATE TABLE IF NOT EXISTS github_profiles (
      id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(100) NOT NULL UNIQUE,
      name VARCHAR(255), bio TEXT, followers INT DEFAULT 0, following INT DEFAULT 0,
      public_repos INT DEFAULT 0, total_stars INT DEFAULT 0, total_forks INT DEFAULT 0,
      most_used_language VARCHAR(100), total_repo_size BIGINT DEFAULT 0,
      average_repo_size DECIMAL(10,2) DEFAULT 0, oldest_repo VARCHAR(255),
      newest_repo VARCHAR(255), account_age_days INT DEFAULT 0,
      avatar_url VARCHAR(500), profile_url VARCHAR(500), profile_score INT DEFAULT 0,
      created_at DATETIME, updated_at DATETIME,
      analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await pool.execute(`CREATE TABLE IF NOT EXISTS activity_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      action ENUM('analyzed','refreshed','deleted','exported') NOT NULL,
      username VARCHAR(100) NOT NULL, details TEXT, ip_address VARCHAR(45),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await pool.execute(`CREATE TABLE IF NOT EXISTS language_stats (
      id INT AUTO_INCREMENT PRIMARY KEY, language VARCHAR(100) NOT NULL UNIQUE,
      usage_count INT DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    logger.info('✅ Database tables ready');
  } catch (err) {
    logger.error('Migration error:', err.message);
    throw err;
  }
}

// ─── Start Server ─────────────────────────────────────────────────────────────
async function startServer() {
  try {
    // Test DB connection before accepting traffic
    await testConnection();

    // Auto-run migrations on startup (creates tables if they don't exist)
    await runMigrations();

    app.listen(PORT, () => {
      logger.info('═══════════════════════════════════════════');
      logger.info(`🚀 ${process.env.APP_NAME || 'GitHub Profile Analyzer'} running`);
      logger.info(`🌐 Server:    http://localhost:${PORT}`);
      logger.info(`📊 Dashboard: http://localhost:${PORT}`);
      logger.info(`📚 API Docs:  http://localhost:${PORT}/api-docs`);
      logger.info(`❤️  Health:   http://localhost:${PORT}/health`);
      logger.info(`🌍 Env:       ${process.env.NODE_ENV || 'development'}`);
      logger.info('═══════════════════════════════════════════');
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();

module.exports = app;
