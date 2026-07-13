// =============================================
// SERVER.JS - AVEC ROUTE /api
// =============================================

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// =============================================
// ROUTES
// =============================================

const authRoutes = require('./Backend/Itinéraires/authRoutes');
const clientRoutes = require('./Backend/Itinéraires/clientRoutes');
const adminRoutes = require('./Backend/Itinéraires/adminRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/admin', adminRoutes);

// =============================================
// ✅ AJOUTER CETTE ROUTE POUR /api
// =============================================

app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: '✅ API Ny Antsika Voyages',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            auth: '/api/auth',
            client: '/api/client',
            admin: '/api/admin',
            auth_test: '/api/auth/test',
            client_test: '/api/client/test',
            admin_test: '/api/admin/test'
        }
    });
});

// =============================================
// ROUTE D'ACCUEIL
// =============================================

app.get('/', (req, res) => {
    res.json({
        message: '🚀 API Ny Antsika Voyages',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            api: '/api',
            auth: '/api/auth',
            client: '/api/client',
            admin: '/api/admin'
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

// =============================================
// GESTION 500
// =============================================

app.use((err, req, res, next) => {
    console.error('❌ Erreur serveur:', err);
    res.status(500).json({
        success: false,
        error: 'Erreur serveur',
        message: err.message || 'Une erreur est survenue'
    });
});

module.exports = app;
