// =============================================
// SERVER.JS - VERSION MINIMALE POUR VERCEL
// =============================================

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

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
// IMPORT DES ROUTES
// =============================================

const authRoutes = require('./Backend/Itinéraires/authRoutes');
const clientRoutes = require('./Backend/Itinéraires/clientRoutes');
const adminRoutes = require('./Backend/Itinéraires/adminRoutes');

// =============================================
// ROUTES API
// =============================================

app.use('/api/auth', authRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/admin', adminRoutes);

// =============================================
// ROUTE D'ACCUEIL - SIMPLE
// =============================================

app.get('/', (req, res) => {
    res.json({
        message: '🚀 API Ny Antsika Voyages',
        status: 'running'
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
// EXPORTATION
// =============================================

module.exports = app;
