// =============================================
// AUTHROUTES.JS - VERSION CORRIGÉE
// =============================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

// ✅ IMPORTATION CORRECTE - Utilisez { supabase }
const { supabase } = require('../config/database');

// =============================================
// ROUTE DE TEST - POUR VÉRIFIER QUE LE ROUTEUR FONCTIONNE
// =============================================

router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: '✅ Route auth/test fonctionne !',
        timestamp: new Date().toISOString()
    });
});

// =============================================
// 1. INSCRIPTION
// =============================================

router.post('/register', [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').isLength({ min: 6 }).withMessage('Mot de passe: min 6 caractères'),
    body('nom').notEmpty().withMessage('Le nom est obligatoire'),
    body('prenom').notEmpty().withMessage('Le prénom est obligatoire')
], async (req, res) => {
    try {
        // Validation
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

        if (checkError && checkError.code !== 'PGRST116') {
            console.error('Erreur vérification:', checkError);
            return res.status(500).json({
                success: false,
                error: 'Erreur lors de la vérification'
            });
        }

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

// =============================================
// 2. CONNEXION
// =============================================

router.post('/login', [
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

        // Mettre à jour la date de connexion
        await supabase
            .from('users')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', user.id);

        // Retourner les données
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

module.exports = router;