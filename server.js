// =============================================
// SERVER.JS - CHEMINS AVEC MAJUSCULES
// =============================================

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// =============================================
// IMPORT DES ROUTES - CHEMINS AVEC MAJUSCULES
// =============================================

// ✅ Backend (B majuscule) / Itinéraires (I majuscule)
const authRoutes = require('./Backend/Itinéraires/authRoutes');
const clientRoutes = require('./Backend/Itinéraires/clientRoutes');
const adminRoutes = require('./Backend/Itinéraires/adminRoutes');

// =============================================
// MIDDLEWARES
// =============================================

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// =============================================
// ROUTES API
// =============================================

app.use('/api/auth', authRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/admin', adminRoutes);

// =============================================
// ROUTE DE TEST
// =============================================

app.get('/test', (req, res) => {
    res.json({
        success: true,
        message: '✅ Le serveur fonctionne !',
        timestamp: new Date().toISOString()
    });
});

// =============================================
// ROUTE DE SANTÉ
// =============================================

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: '✅ OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        supabase_url: process.env.SUPABASE_URL ? '✅ Configuré' : '❌ Non configuré'
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
            test: '/test',
            health: '/api/health'
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

// =============================================
// EXPORTATION POUR VERCEL
// =============================================

module.exports = app;
