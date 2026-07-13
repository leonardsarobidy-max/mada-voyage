// =============================================
// SERVER.JS - NY ANTSIKA VOYAGES
// =============================================

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================
// IMPORT DES ROUTES - CHEMINS CORRECTS
// =============================================

const authRoutes = require('./../backend/Itinéraires/authRoutes');
const clientRoutes = require('./../backend/Itinéraires/clientRoutes');
const adminRoutes = require('./../backend/Itinéraires/adminRoutes');

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

app.use('/api/auth', authRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/admin', adminRoutes);

// =============================================
// ROUTE DE TEST - POUR VÉRIFIER QUE LE SERVEUR TOURNE
// =============================================

app.get('/test', (req, res) => {
    res.json({
        success: true,
        message: '✅ Le serveur fonctionne !',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// =============================================
// ROUTE DE SANTÉ - OBLIGATOIRE POUR VERCEL
// =============================================

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: '✅ OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        supabase_url: process.env.SUPABASE_URL ? '✅ Configuré' : '❌ Non configuré',
        uptime: process.uptime()
    });
});

// =============================================
// ROUTE D'ACCUEIL
// =============================================

app.get('/', (req, res) => {
    res.json({
        message: '🚀 Ny Antsika Voyages API',
        version: '1.0.0',
        status: 'running',
        environment: process.env.NODE_ENV || 'development',
        endpoints: {
            test: '/test',
            health: '/api/health',
            auth: '/api/auth',
            client: '/api/client',
            admin: '/api/admin'
        },
        frontend: 'https://frontend-phi-ashen-15.vercel.app'
    });
});

// =============================================
// GESTION 404 - ROUTE NON TROUVÉE
// =============================================

app.use((req, res) => {
    console.log(`❌ 404: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        error: 'Route non trouvée',
        path: req.originalUrl,
        message: `La route ${req.originalUrl} n'existe pas`
    });
});

// =============================================
// GESTION 500 - ERREUR SERVEUR
// =============================================

app.use((err, req, res, next) => {
    console.error('❌ Erreur serveur:', err);
    res.status(500).json({
        success: false,
        error: 'Erreur serveur',
        message: err.message || 'Une erreur est survenue',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// =============================================
// EXPORTATION POUR VERCEL
// =============================================

module.exports = app;
