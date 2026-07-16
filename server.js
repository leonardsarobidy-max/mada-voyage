// =============================================
// SERVER.JS - VERSION ULTIME (Sans imports)
// =============================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const app = express();

// =============================================
// CONNEXION SUPABASE
// =============================================

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables Supabase manquantes');
}

const supabase = createClient(supabaseUrl, supabaseKey);
console.log('✅ Supabase connecté');

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

// =============================================
// ROUTES AUTH (TOUTES INTÉGRÉES)
// =============================================

app.get('/api/auth/test', (req, res) => {
    res.json({
        success: true,
        message: '✅ Route auth fonctionne !'
    });
});

app.post('/api/auth/register', [
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('nom').notEmpty(),
    body('prenom').notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { email, password, nom, prenom, telephone } = req.body;

        const { data: existing } = await supabase
            .from('users')
            .select('id, email')
            .eq('email', email)
            .single();

        if (existing) {
            return res.status(400).json({ success: false, error: 'Email déjà utilisé' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const { data: user, error } = await supabase
            .from('users')
            .insert([{
                email,
                password: hashedPassword,
                nom,
                prenom,
                telephone: telephone || null,
                role: 'client',
                status: 'actif',
                created_at: new Date().toISOString()
            }])
            .select('id, email, nom, prenom, telephone, role, created_at')
            .single();

        if (error) {
            return res.status(500).json({ success: false, error: 'Erreur inscription' });
        }

        res.status(201).json({ success: true, message: 'Inscription réussie', user });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/auth/login', [
    body('email').isEmail(),
    body('password').notEmpty()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { email, password } = req.body;

        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (!user) {
            return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET || 'default_secret',
            { expiresIn: '7d' }
        );

        const { password: _, ...userData } = user;
        res.json({ success: true, message: 'Connexion réussie', token, user: userData });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =============================================
// ROUTES CLIENT
// =============================================

app.get('/api/client/test', (req, res) => {
    res.json({ success: true, message: '✅ Route client fonctionne !' });
});

app.get('/api/client/trajets', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('trajets')
            .select('*')
            .eq('disponible', true)
            .gte('date_depart', new Date().toISOString().split('T')[0])
            .order('date_depart', { ascending: true });

        if (error) {
            return res.status(500).json({ success: false, error: 'Erreur récupération trajets' });
        }

        res.json({ success: true, data: data || [], count: data?.length || 0 });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =============================================
// ROUTES ADMIN
// =============================================

app.get('/api/admin/test', (req, res) => {
    res.json({ success: true, message: '✅ Route admin fonctionne !' });
});

app.get('/api/admin/stats', async (req, res) => {
    try {
        const { count: usersCount } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        const { count: reservationsCount } = await supabase
            .from('reservations')
            .select('*', { count: 'exact', head: true });

        res.json({
            success: true,
            users: usersCount || 0,
            reservations: reservationsCount || 0
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// =============================================
// ROUTES DE TEST
// =============================================

app.get('/test', (req, res) => {
    res.json({ success: true, message: '✅ Le serveur fonctionne !' });
});

app.get('/api/health', (req, res) => {
    res.json({ success: true, status: '✅ OK' });
});

// =============================================
// FRONTEND (Pages HTML)
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
    console.error('❌ Erreur:', err);
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
