// =============================================
// AUTHROUTES.JS - ROUTES D'AUTHENTIFICATION
// =============================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const { supabase } = require('../Config/database');

// =============================================
// ROUTE DE TEST
// =============================================

router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: '✅ Route auth fonctionne !',
        timestamp: new Date().toISOString()
    });
});

// =============================================
// INSCRIPTION
// =============================================

router.post('/register', [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').isLength({ min: 6 }).withMessage('Mot de passe: min 6 caractères'),
    body('nom').notEmpty().withMessage('Le nom est obligatoire'),
    body('prenom').notEmpty().withMessage('Le prénom est obligatoire'),
    body('telephone').optional().isString().withMessage('Téléphone invalide')
], async (req, res) => {
    try {
        // Vérification des erreurs de validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { email, password, nom, prenom, telephone } = req.body;

        // Vérifier si l'utilisateur existe déjà
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
            user: {
                id: user.id,
                email: user.email,
                nom: user.nom,
                prenom: user.prenom,
                telephone: user.telephone,
                role: user.role,
                created_at: user.created_at
            }
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
// CONNEXION
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
                error: 'Compte inactif',
                message: 'Votre compte est inactif. Veuillez contacter l\'administrateur.'
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

        // Retourner les données (sans le mot de passe)
        const { password: _, ...userData } = user;

        console.log(`🔐 Connexion: ${email} (${user.role})`);

        res.json({
            success: true,
            message: 'Connexion réussie',
            token,
            user: userData,
            expires_in: '7d'
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
// VÉRIFICATION DU TOKEN
// =============================================

router.get('/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                valid: false,
                error: 'Token manquant'
            });
        }

        // Vérifier le token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
        
        if (!decoded || !decoded.id) {
            return res.status(401).json({
                success: false,
                valid: false,
                error: 'Token invalide'
            });
        }

        // Vérifier l'utilisateur
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, nom, prenom, role, status')
            .eq('id', decoded.id)
            .single();

        if (error || !user) {
            return res.status(401).json({
                success: false,
                valid: false,
                error: 'Utilisateur non trouvé'
            });
        }

        if (user.status === 'suspendu' || user.status === 'inactif') {
            return res.status(403).json({
                success: false,
                valid: false,
                error: 'Compte inactif'
            });
        }

        res.json({
            success: true,
            valid: true,
            user: {
                id: user.id,
                email: user.email,
                nom: user.nom,
                prenom: user.prenom,
                role: user.role
            }
        });

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                valid: false,
                error: 'Token expiré'
            });
        }
        
        console.error('Erreur vérification:', error);
        res.status(500).json({
            success: false,
            valid: false,
            error: 'Erreur lors de la vérification'
        });
    }
});

// =============================================
// RAFRAÎCHISSEMENT DU TOKEN
// =============================================

router.post('/refresh-token', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token requis'
            });
        }

        // Vérifier l'ancien token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
        
        if (!decoded || !decoded.id) {
            return res.status(401).json({
                success: false,
                error: 'Token invalide'
            });
        }

        // Vérifier l'utilisateur
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, role')
            .eq('id', decoded.id)
            .single();

        if (error || !user) {
            return res.status(401).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }

        // Générer un nouveau token
        const newToken = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET || 'default_secret',
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token: newToken,
            expires_in: '7d'
        });

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expiré'
            });
        }
        
        console.error('Erreur refresh:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors du rafraîchissement'
        });
    }
});

// =============================================
// DÉCONNEXION
// =============================================

router.post('/logout', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (token) {
            try {
                const decoded = jwt.decode(token);
                if (decoded && decoded.id) {
                    await supabase
                        .from('token_blacklist')
                        .insert([{
                            token: token,
                            user_id: decoded.id,
                            revoked_at: new Date().toISOString()
                        }]);
                }
            } catch (error) {
                console.error('Erreur blacklist:', error);
            }
        }

        console.log('👋 Déconnexion réussie');

        res.json({
            success: true,
            message: 'Déconnexion réussie'
        });

    } catch (error) {
        console.error('Erreur déconnexion:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la déconnexion'
        });
    }
});

module.exports = router;
