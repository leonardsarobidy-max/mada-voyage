// =============================================
// SERVER.JS - NY ANTSIKA VOYAGES
// =============================================

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================
// IMPORT DES ROUTES
// =============================================

const authRoutes = require('./backend/routes/authRoutes');
const clientRoutes = require('./backend/routes/clientRoutes');
const adminRoutes = require('./backend/routes/adminRoutes');

// =============================================
// MIDDLEWARES
// =============================================

// ✅ CORS - Permettre toutes les origines
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.path}`);
    next();
});

// =============================================
// ROUTES API
// =============================================

app.use('/api/auth', authRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/admin', adminRoutes);

// =============================================
// ROUTE DE SANTÉ
// =============================================

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: '✅ OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        db_type: process.env.DB_TYPE || 'supabase',
        supabase_url: process.env.SUPABASE_URL ? 'Configuré' : 'Non configuré'
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
            health: '/api/health',
            trajets: '/api/client/trajets',
            auth: '/api/auth'
        }
    });
});

// =============================================
// GESTION DES ERREURS
// =============================================

app.use((req, res) => {
    console.log(`❌ 404: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        error: 'Route non trouvée',
        path: req.originalUrl
    });
});

app.use((err, req, res, next) => {
    console.error('❌ Erreur serveur:', err);
    res.status(500).json({
        success: false,
        error: 'Erreur serveur',
        message: err.message || 'Une erreur est survenue'
    });
});

// =============================================
// EXPORTATION POUR VERCEL
// =============================================

module.exports = app;