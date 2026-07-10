// =============================================
// SERVER.JS - NY ANTIKA VOYAGES
// Point d'entrée principal du serveur
// =============================================

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// =============================================
// IMPORT DES ROUTES
// =============================================

const authRoutes = require('./backend/routes/authRoutes');
const clientRoutes = require('./backend/routes/clientRoutes');
const adminRoutes = require('./backend/routes/adminRoutes');

// =============================================
// INITIALISATION
// =============================================

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================
// MIDDLEWARES
// =============================================

// ✅ CORS Configuration - CORRIGÉE POUR VERCEL
app.use(cors({
    origin: function(origin, callback) {
        // Permettre les requêtes sans origin (ex: mobile apps)
        if (!origin) return callback(null, true);
        
        // Liste des origines autorisées
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5500',
            'http://127.0.0.1:5500',
            'https://frontend-phi-ashen-15.vercel.app',     // ✅ VOTRE URL VERCEL
            'https://mada-voyage.vercel.app',
            'https://mada-voyage-frontend.vercel.app',
            'https://mada-voyage-backend.onrender.com',
            process.env.FRONTEND_URL
        ].filter(Boolean);
        
        // Vérifier si l'origine est autorisée
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            console.log(`⚠️ CORS bloqué pour: ${origin}`);
            callback(new Error('CORS non autorisé'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// JSON Parser
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
// ROUTES STATIQUES - FRONTEND
// =============================================

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Routes HTML
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
// ROUTE DE SANTÉ - OBLIGATOIRE POUR RENDER
// =============================================

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: '✅ OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        db_type: process.env.DB_TYPE || 'supabase',
        supabase_url: process.env.SUPABASE_URL ? 'Configuré' : 'Non configuré',
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// =============================================
// ROUTE DE TEST POUR VÉRIFIER LE CORS
// =============================================

app.get('/test-cors', (req, res) => {
    res.json({
        success: true,
        message: 'CORS fonctionne !',
        timestamp: new Date().toISOString()
    });
});

// =============================================
// GESTION DES ERREURS
// =============================================

// 404 - Route non trouvée
app.use((req, res) => {
    console.log(`❌ 404: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        error: 'Route non trouvée',
        message: `La route ${req.originalUrl} n'existe pas`
    });
});

// 500 - Erreur serveur
app.use((err, req, res, next) => {
    console.error('❌ Erreur serveur:', err);
    res.status(500).json({
        success: false,
        error: 'Erreur serveur',
        message: err.message || 'Une erreur est survenue'
    });
});

// =============================================
// DÉMARRAGE DU SERVEUR
// =============================================

app.listen(PORT, () => {
    console.log('=' .repeat(60));
    console.log('🚀 NY ANTSIKA VOYAGES - SERVEUR');
    console.log('=' .repeat(60));
    console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
    console.log(`📊 Environnement: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  Base de données: ${process.env.DB_TYPE || 'supabase'}`);
    console.log(`🔗 API: http://localhost:${PORT}/api`);
    console.log(`🌐 Frontend: http://localhost:${PORT}`);
    console.log('=' .repeat(60));
});

module.exports = app;
