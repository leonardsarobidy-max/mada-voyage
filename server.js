// =============================================
// SERVER.JS - VERSION MINIMALISTE DE TEST
// =============================================

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// =============================================
// ROUTE DE TEST UNIQUE
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
        status: 'running'
    });
});

module.exports = app;
