import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { jobsRouter } from './routes/jobs.js';
import { applicationsRouter } from './routes/applications.js';
import { aiRouter } from './routes/ai.js';
import { authRouter } from './routes/auth.js';
import { notificationsRouter } from './routes/notifications.js';
import { adminRouter } from './routes/admin.js';
import { usersRouter } from './routes/users.js';
import { lifecycleEngine } from './services/lifecycleEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5005;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/notifications', notificationsRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/jobs', jobsRouter);
app.use('/api/v1/applications', applicationsRouter);
app.use('/api/v1/ai', aiRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'WorkLoco Backend & Spatial Radar Engine',
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Serve Frontend Client Static Assets
const webClientPath = path.resolve(__dirname, '../../web_client');
app.use(express.static(webClientPath));

// Fallback to index.html for Single Page App routing (exclude APIs and static file extensions)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || path.extname(req.path)) {
    return next();
  }
  res.sendFile(path.join(webClientPath, 'index.html'));
});

// Start background auto-expiry lifecycle engine
lifecycleEngine.start(10000); // Check every 10 seconds for real-time responsiveness

app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 WorkLoco Engine running on http://localhost:${PORT}`);
  console.log(`📍 Spatial Radar: http://localhost:${PORT}/api/v1/jobs/nearby`);
  console.log(`💻 Web Client UI: http://localhost:${PORT}`);
  console.log('====================================================');
});
