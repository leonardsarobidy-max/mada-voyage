// =============================================
// SERVER.JS - NY ANTSIKA VOYAGES
// Version avec imports des routes séparées
// =============================================

const express = require('express');
const cors = require('cors');
const path = require('path');
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
app.use(express.urlencoded({ extended: true }));

// Logger
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.path}`);
    next();
});

// =============================================
// ✅ IMPORT DES ROUTES (fichiers séparés)
// =============================================

const authRoutes = require('./backend/routes/authRoutes');
const clientRoutes = require('./backend/routes/clientRoutes');
const adminRoutes = require('./backend/routes/adminRoutes');

// =============================================
// ✅ MONTAGE DES ROUTES
// =============================================

app.use('/api/auth', authRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/admin', adminRoutes);

// =============================================
// ROUTES DE TEST
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
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        supabase_url: process.env.SUPABASE_URL ? '✅ Configuré' : '❌ Non configuré'
    });
});

// =============================================
// ROUTE D'ACCUEIL (Frontend)
// =============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/reservations.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'reservations.html'));
});

app.get('/admin-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'admin-dashboard.html'));
});

// =============================================
// GESTION 404
// =============================================

app.use((req, res) => {
    console.log(`❌ 404: ${req.method} ${req.originalUrl}`);
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
