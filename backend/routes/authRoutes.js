// =============================================
// AUTHROUTES.JS - AUTHENTIFICATION COMPLÈTE
// =============================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

// ✅ IMPORTATION CORRECTE
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
// 1. INSCRIPTION (REGISTER)
// =============================================

router.post('/register', [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères'),
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
                error: 'Données invalides',
                details: errors.array()
            });
        }

        const { email, password, nom, prenom, telephone, role } = req.body;

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

        // Déterminer le rôle (si admin, vérifier qu'il n'y a pas déjà un admin)
        let userRole = role || 'client';
        if (userRole === 'admin') {
            // Vérifier s'il existe déjà un admin
            const { count, error: adminCheckError } = await supabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'admin');

            if (!adminCheckError && count > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Un administrateur existe déjà'
                });
            }
        }

        // Créer l'utilisateur
        const { data: user, error: createError } = await supabase
            .from('users')
            .insert([{
                email,
                password: hashedPassword,
                nom,
                prenom,
                telephone: telephone || null,
                role: userRole,
                status: 'actif',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select('id, email, nom, prenom, telephone, role, status, created_at')
            .single();

        if (createError) {
            console.error('Erreur création:', createError);
            return res.status(500).json({
                success: false,
                error: 'Erreur lors de la création du compte',
                details: createError.message
            });
        }

        console.log(`📝 [INSCRIPTION] Nouvel utilisateur: ${email} (${userRole})`);

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
                status: user.status,
                created_at: user.created_at
            }
        });

    } catch (error) {
        console.error('Erreur inscription:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'inscription',
            details: error.message
        });
    }
});

// =============================================
// 2. CONNEXION (LOGIN) - AVEC SUPPORT ADMIN
// =============================================

router.post('/login', [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').notEmpty().withMessage('Le mot de passe est obligatoire')
], async (req, res) => {
    try {
        // Vérification des erreurs de validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Données invalides',
                details: errors.array()
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
            console.log(`⚠️ [LOGIN] Tentative échouée: ${email} - Utilisateur non trouvé`);
            return res.status(401).json({
                success: false,
                error: 'Email ou mot de passe incorrect'
            });
        }

        // Vérifier le mot de passe
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            console.log(`⚠️ [LOGIN] Tentative échouée: ${email} - Mot de passe incorrect`);
            return res.status(401).json({
                success: false,
                error: 'Email ou mot de passe incorrect'
            });
        }

        // Vérifier le statut du compte
        if (user.status === 'suspendu') {
            return res.status(403).json({
                success: false,
                error: 'Compte suspendu',
                message: 'Votre compte a été suspendu. Veuillez contacter l\'administrateur.'
            });
        }

        if (user.status === 'inactif') {
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

        console.log(`🔐 [LOGIN] Connexion réussie: ${email} (${user.role})`);

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
            error: 'Erreur lors de la connexion',
            details: error.message
        });
    }
});

// =============================================
// 3. VÉRIFICATION DU TOKEN
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
// 4. RAFRAÎCHISSEMENT DU TOKEN
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
// 5. CHANGER LE MOT DE PASSE (AUTHENTIFIÉ)
// =============================================

router.put('/change-password', [
    body('currentPassword').notEmpty().withMessage('Le mot de passe actuel est obligatoire'),
    body('newPassword').isLength({ min: 6 }).withMessage('Le nouveau mot de passe doit contenir au moins 6 caractères')
], async (req, res) => {
    try {
        // Vérifier le token
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Non authentifié'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
        if (!decoded || !decoded.id) {
            return res.status(401).json({
                success: false,
                error: 'Token invalide'
            });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { currentPassword, newPassword } = req.body;

        // Récupérer l'utilisateur
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', decoded.id)
            .single();

        if (error || !user) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }

        // Vérifier le mot de passe actuel
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(400).json({
                success: false,
                error: 'Mot de passe actuel incorrect'
            });
        }

        // Hasher le nouveau mot de passe
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Mettre à jour le mot de passe
        await supabase
            .from('users')
            .update({
                password: hashedPassword,
                updated_at: new Date().toISOString()
            })
            .eq('id', decoded.id);

        console.log(`🔑 [CHANGE PASSWORD] ${user.email}`);

        res.json({
            success: true,
            message: 'Mot de passe changé avec succès'
        });

    } catch (error) {
        console.error('Erreur changement mot de passe:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors du changement de mot de passe'
        });
    }
});

// =============================================
// 6. MODIFIER LE PROFIL (AUTHENTIFIÉ)
// =============================================

router.put('/profile', [
    body('nom').optional().notEmpty().withMessage('Le nom ne peut pas être vide'),
    body('prenom').optional().notEmpty().withMessage('Le prénom ne peut pas être vide'),
    body('telephone').optional().isString().withMessage('Téléphone invalide')
], async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Non authentifié'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
        if (!decoded || !decoded.id) {
            return res.status(401).json({
                success: false,
                error: 'Token invalide'
            });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { nom, prenom, telephone } = req.body;

        const updateData = {};
        if (nom) updateData.nom = nom;
        if (prenom) updateData.prenom = prenom;
        if (telephone !== undefined) updateData.telephone = telephone;
        updateData.updated_at = new Date().toISOString();

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Aucune donnée à mettre à jour'
            });
        }

        const { data: user, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', decoded.id)
            .select('id, email, nom, prenom, telephone, role')
            .single();

        if (error) throw error;

        console.log(`👤 [PROFILE] ${user.email}`);

        res.json({
            success: true,
            message: 'Profil mis à jour avec succès',
            user: user
        });

    } catch (error) {
        console.error('Erreur mise à jour profil:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la mise à jour du profil'
        });
    }
});

// =============================================
// 7. RÉCUPÉRER LE PROFIL (AUTHENTIFIÉ)
// =============================================

router.get('/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Non authentifié'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
        if (!decoded || !decoded.id) {
            return res.status(401).json({
                success: false,
                error: 'Token invalide'
            });
        }

        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, nom, prenom, telephone, role, status, created_at, updated_at')
            .eq('id', decoded.id)
            .single();

        if (error || !user) {
            return res.status(404).json({
                success: false,
                error: 'Utilisateur non trouvé'
            });
        }

        // Statistiques de l'utilisateur
        const { count: reservationsCount, error: countError } = await supabase
            .from('reservations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', decoded.id);

        const { data: totalSpentData, error: spentError } = await supabase
            .from('reservations')
            .select('montant_total')
            .eq('user_id', decoded.id)
            .eq('statut', 'confirmée');

        const totalSpent = totalSpentData?.reduce((sum, r) => sum + (r.montant_total || 0), 0) || 0;

        res.json({
            success: true,
            user: user,
            stats: {
                reservations_count: reservationsCount || 0,
                total_spent: totalSpent
            }
        });

    } catch (error) {
        console.error('Erreur récupération profil:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération du profil'
        });
    }
});

// =============================================
// 8. DÉCONNEXION
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

        console.log('👋 [LOGOUT] Déconnexion réussie');

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

// =============================================
// 9. SUPPRIMER LE COMPTE (AUTHENTIFIÉ)
// =============================================

router.delete('/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Non authentifié'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
        if (!decoded || !decoded.id) {
            return res.status(401).json({
                success: false,
                error: 'Token invalide'
            });
        }

        // Vérifier si c'est un admin (ne pas supprimer le dernier admin)
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('role')
            .eq('id', decoded.id)
            .single();

        if (userError) throw userError;

        if (user.role === 'admin') {
            const { count, error: countError } = await supabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'admin');

            if (!countError && count <= 1) {
                return res.status(400).json({
                    success: false,
                    error: 'Impossible de supprimer le dernier administrateur'
                });
            }
        }

        // Supprimer l'utilisateur
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', decoded.id);

        if (error) throw error;

        console.log(`🗑️ [DELETE] Compte supprimé: ${decoded.email}`);

        res.json({
            success: true,
            message: 'Compte supprimé avec succès'
        });

    } catch (error) {
        console.error('Erreur suppression compte:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la suppression du compte'
        });
    }
});

module.exports = router;