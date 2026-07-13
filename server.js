// =============================================
// SERVER.JS - À LA RACINE
// =============================================

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// =============================================
// IMPORT DES ROUTES - CHEMINS CORRECTS
// =============================================

// ✅ BON - depuis la racine, ./backend/ existe
const authRoutes = require('./backend/routes/authRoutes');
const clientRoutes = require('./backend/routes/clientRoutes');
const adminRoutes = require('./backend/routes/adminRoutes');

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
// ROUTES
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
        status: 'running'
    });
});

// =============================================
// EXPORTATION
// =============================================

module.exports = app;
