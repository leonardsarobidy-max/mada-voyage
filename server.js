// =============================================
// SERVER.JS - VERSION COMPLÈTE AVEC ROUTES
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
// ROUTES AUTH (intégrées)
// =============================================

app.get('/api/auth/test', (req, res) => {
    res.json({
        success: true,
        message: '✅ Route auth fonctionne !',
        timestamp: new Date().toISOString()
    });
});

app.post('/api/auth/register', [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').isLength({ min: 6 }).withMessage('Mot de passe: min 6 caractères'),
    body('nom').notEmpty().withMessage('Le nom est obligatoire'),
    body('prenom').notEmpty().withMessage('Le prénom est obligatoire')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { email, password, nom, prenom, telephone } = req.body;

        // Vérifier si l'utilisateur existe
        const { data: existing, error: checkError } = await supabase
            .from('users')
            .select('id, email')
            .eq('email', email)
            .single();

        if (existing) {
            return res.status(400).json({
                success: false,
                error: 'Cet email est déjà utilisé'
            });
        }

        // Hasher le mot de passe
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Créer l'utilisateur
        const { data: user, error: createError } = await supabase
            .from('users')
            .insert([{
                email,
                password: hashedPassword,
                nom,
                prenom,
                telephone: telephone || null,
                role: 'client',
                status: 'actif',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select('id, email, nom, prenom, telephone, role, created_at')
            .single();

        if (createError) {
            console.error('Erreur création:', createError);
            return res.status(500).json({
                success: false,
                error: 'Erreur lors de l\'inscription'
            });
        }

        console.log(`📝 Nouvel utilisateur: ${email}`);

        res.status(201).json({
            success: true,
            message: 'Inscription réussie',
            user
        });

    } catch (error) {
        console.error('Erreur inscription:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'inscription'
        });
    }
});

app.post('/api/auth/login', [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').notEmpty().withMessage('Mot de passe requis')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { email, password } = req.body;

        // Récupérer l'utilisateur
        const { data: user, error: findError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (findError || !user) {
            return res.status(401).json({
                success: false,
                error: 'Email ou mot de passe incorrect'
            });
        }

        // Vérifier le mot de passe
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Email ou mot de passe incorrect'
            });
        }

        // Vérifier le statut
        if (user.status === 'suspendu' || user.status === 'inactif') {
            return res.status(403).json({
                success: false,
                error: 'Compte inactif'
            });
        }

        // Générer le token JWT
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET || 'default_secret',
            { expiresIn: '7d' }
        );

        const { password: _, ...userData } = user;

        console.log(`🔐 Connexion: ${email} (${user.role})`);

        res.json({
            success: true,
            message: 'Connexion réussie',
            token,
            user: userData
        });

    } catch (error) {
        console.error('Erreur connexion:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la connexion'
        });
    }
});

// =============================================
// ROUTES CLIENT (intégrées)
// =============================================

app.get('/api/client/test', (req, res) => {
    res.json({
        success: true,
        message: '✅ Route client fonctionne !',
        timestamp: new Date().toISOString()
    });
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
            return res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération des trajets'
            });
        }

        res.json({
            success: true,
            data: data || [],
            count: data?.length || 0
        });

    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

// =============================================
// ROUTES ADMIN (intégrées)
// =============================================

app.get('/api/admin/test', (req, res) => {
    res.json({
        success: true,
        message: '✅ Route admin fonctionne !',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/admin/stats', async (req, res) => {
    try {
        const { count: usersCount, error: usersError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        if (usersError) throw usersError;

        const { count: reservationsCount, error: reservationsError } = await supabase
            .from('reservations')
            .select('*', { count: 'exact', head: true });

        if (reservationsError) throw reservationsError;

        res.json({
            success: true,
            users: usersCount || 0,
            reservations: reservationsCount || 0
        });

    } catch (error) {
        console.error('Erreur stats:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des statistiques'
        });
    }
});

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
