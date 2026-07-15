// =============================================
// SERVER.JS - VERSION SIMPLIFIÉE
// =============================================

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// =============================================
// ROUTES
// =============================================

// ✅ Routes auth
app.get('/api/auth/test', (req, res) => {
    res.json({
        success: true,
        message: '✅ Route auth fonctionne !',
        timestamp: new Date().toISOString()
    });
});

// ✅ Routes client
app.get('/api/client/test', (req, res) => {
    res.json({
        success: true,
        message: '✅ Route client fonctionne !',
        timestamp: new Date().toISOString()
    });
});

// ✅ Routes admin
app.get('/api/admin/test', (req, res) => {
    res.json({
        success: true,
        message: '✅ Route admin fonctionne !',
        timestamp: new Date().toISOString()
    });
});

// =============================================
// TESTS
// =============================================

app.get('/test', (req, res) => {
    res.json({
        success: true,
        message: '✅ Le serveur fonctionne !',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: '✅ OK',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        message: '🚀 API Ny Antsika Voyages',
        status: 'running',
        endpoints: {
            test: '/test',
            health: '/api/health',
            auth: '/api/auth/test',
            client: '/api/client/test',
            admin: '/api/admin/test'
        }
    });
});

// =============================================
// GESTION 404
// =============================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route non trouvée',
        path: req.originalUrl
    });
});

module.exports = app;
