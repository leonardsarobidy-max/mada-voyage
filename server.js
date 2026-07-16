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
// MIDDLEWARES
// =============================================

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

// ✅ Import des routes
const authRoutes = require('./backend/routes/authRoutes');
const clientRoutes = require('./backend/routes/clientRoutes');
const adminRoutes = require('./backend/routes/adminRoutes');

// ✅ Montage des routes API
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
// ✅ ROUTE D'ACCUEIL - SERT LA PAGE HTML
// =============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// =============================================
// ROUTES POUR LES PAGES HTML
// =============================================

app.get('/reservations.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'reservations.html'));
});

app.get('/admin-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'admin-dashboard.html'));
});

// =============================================
// ROUTE DE SECOURS - API INFO
// =============================================

app.get('/api', (req, res) => {
    res.json({
        message: '🚀 API Ny Antsika Voyages',
        status: 'running',
        endpoints: {
            test: '/test',
            health: '/api/health',
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

// =============================================
// EXPORTATION POUR VERCEL
// =============================================

module.exports = app;
