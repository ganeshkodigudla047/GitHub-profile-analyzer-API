# 🐙 GitHub Profile Analyzer API

A production-ready full-stack application that analyzes GitHub profiles, calculates developer insights, stores results in MySQL, and serves them through a professional REST API with a modern admin dashboard.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)
![Express](https://img.shields.io/badge/Express-4.x-black?logo=express)
![MySQL](https://img.shields.io/badge/MySQL-8.0-blue?logo=mysql)
![License](https://img.shields.io/badge/License-MIT-purple)

---

## ✨ Features

- 🔍 **GitHub Profile Analysis** — Fetches profile + all repositories from GitHub API
- 📊 **Insight Calculations** — Stars, forks, languages, account age, profile score
- 🏆 **Leaderboard** — Top profiles by followers, repos, stars, and score
- 📈 **Charts & Analytics** — Language distribution, followers, score charts (Chart.js)
- 🔄 **Refresh Analysis** — Re-analyze profiles with updated data
- 🗑️ **CRUD Operations** — View, delete, search, and filter profiles
- 📄 **PDF Export** — Download individual profile reports
- 📊 **CSV Export** — Export all profiles or leaderboard
- 📚 **Swagger Docs** — Interactive API documentation at `/api-docs`
- 🌓 **Dark/Light Theme** — Persistent theme toggle
- 📱 **Responsive UI** — Works on desktop, tablet, and mobile
- ⚡ **Rate Limit Monitor** — Real-time GitHub API rate limit display
- 📋 **Activity Feed** — Live log of all analysis actions
- 🔒 **Security** — Helmet, CORS, rate limiting, SQL injection protection

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express.js |
| Database | MySQL 8.0 (mysql2) |
| Frontend | HTML5, CSS3, Vanilla JS, Chart.js |
| GitHub API | Axios |
| Docs | Swagger UI (OpenAPI 3.0) |
| Logging | Winston |
| Security | Helmet, CORS, express-rate-limit |
| Export | PDFKit, json2csv |
| Deploy | Render, Docker |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8.0
- A GitHub account (optional: [Personal Access Token](https://github.com/settings/tokens) for higher rate limits)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/github-profile-analyzer.git
cd github-profile-analyzer

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your MySQL credentials and optional GitHub token

# 4. Set up the database
npm run db:setup

# 5. Start the server
npm run dev        # Development (with nodemon)
npm start          # Production
```

---

## ⚙️ Environment Variables

Create a `.env` file from `.env.example`:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=github_analyzer

# Optional - increases GitHub rate limit from 60 to 5000 req/hr
GITHUB_TOKEN=ghp_your_token_here
```

---

## 🗄️ Database Setup

Run the migration script to create all tables:

```bash
npm run db:setup
```

This creates:
- `github_profiles` — Main profiles table
- `activity_log` — Action history
- `language_stats` — Language distribution cache

Or manually run `database/schema.sql` in your MySQL client.

---

## 📡 API Reference

Base URL: `http://localhost:3000/api`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/analyze/:username` | Analyze a GitHub profile |
| `PUT` | `/analyze/:username` | Refresh existing profile |
| `GET` | `/profiles` | Get all profiles (paginated) |
| `GET` | `/profiles/search?q=` | Search profiles |
| `GET` | `/profiles/:id` | Get profile by ID |
| `DELETE` | `/profiles/:id` | Delete a profile |
| `GET` | `/profiles/:id/export/pdf` | Export profile as PDF |
| `GET` | `/profiles/export/csv` | Export all profiles as CSV |
| `GET` | `/stats` | Platform statistics |
| `GET` | `/leaderboard` | Top profiles leaderboard |
| `GET` | `/leaderboard/export/csv` | Export leaderboard as CSV |
| `GET` | `/rate-limit` | GitHub API rate limit status |
| `GET` | `/recent` | Recent activity feed |

### Query Parameters for `/profiles`

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Per page (default: 10, max: 100) |
| `q` | string | Search by username or name |
| `language` | string | Filter by most used language |
| `sortBy` | string | `followers`, `total_stars`, `public_repos`, `profile_score`, `analyzed_at` |
| `order` | string | `ASC` or `DESC` |
| `minFollowers` | number | Minimum followers filter |
| `maxFollowers` | number | Maximum followers filter |

---

## 🏆 Profile Score Formula

```
Score = (Followers × 2) + (Public Repos × 5) + (Total Stars × 3)
```

---

## 📁 Project Structure

```
github-profile-analyzer/
├── app.js                  # Main application entry point
├── config/
│   └── db.js               # MySQL connection pool
├── controllers/
│   └── githubController.js # Request/response handlers
├── services/
│   └── githubService.js    # GitHub API integration & calculations
├── models/
│   └── profileModel.js     # Database operations
├── routes/
│   └── githubRoutes.js     # API route definitions
├── middleware/
│   └── errorHandler.js     # Global error handling
├── utils/
│   └── logger.js           # Winston logger
├── database/
│   ├── schema.sql          # Database schema
│   └── migrate.js          # Migration script
├── swagger/
│   └── swagger.json        # OpenAPI 3.0 spec
├── public/
│   ├── index.html          # Dashboard
│   ├── profile.html        # Profile detail page
│   ├── css/style.css       # Stylesheet
│   └── js/
│       ├── dashboard.js    # Dashboard logic
│       └── profile.js      # Profile page logic
├── logs/                   # Auto-created log files
├── .env.example            # Environment template
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Docker Compose setup
├── render.yaml             # Render deployment config
└── README.md
```

---

## 🐳 Docker Deployment

```bash
# Build and run with Docker Compose (includes MySQL)
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop
docker-compose down
```

---

## ☁️ Deploy to Render

1. Push your code to GitHub
2. Create a new **Web Service** on [Render](https://render.com)
3. Connect your GitHub repository
4. Set Build Command: `npm install`
5. Set Start Command: `npm start`
6. Add Environment Variables (all from `.env`)
7. Create a MySQL database (Railway, PlanetScale, or Render's own DB)
8. Deploy!

The `render.yaml` file automates this configuration.

---

## 📊 Dashboard URLs

| Page | URL |
|------|-----|
| Dashboard | `http://localhost:3000` |
| Profile Detail | `http://localhost:3000/profile?id=1` |
| API Docs (Swagger) | `http://localhost:3000/api-docs` |
| Health Check | `http://localhost:3000/health` |

---

## 🔒 Security Features

- **Helmet** — Sets secure HTTP headers
- **CORS** — Configurable allowed origins
- **Rate Limiting** — 100 req/15min globally, 10 analyze req/min
- **Input Validation** — Username format validation
- **Parameterized Queries** — SQL injection prevention
- **Environment Variables** — No hardcoded secrets

---

## 📝 Logs

Logs are stored in the `logs/` directory:
- `logs/app.log` — All application logs
- `logs/error.log` — Error-only logs

---

## 👤 Author

Built with ❤️ as a production-ready demonstration project.

---

## 📄 License

MIT License — free to use and modify.
