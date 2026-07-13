/**
 * =============================================
 * MIDDLEWARE AUTHENTIFICATION JWT
 * Vérifie la validité du token et l'existence de l'utilisateur
 * =============================================
 */

const jwt = require('jsonwebtoken');
const supabase = require('../config/database');

/**
 * Middleware principal d'authentification
 * Vérifie le token JWT et ajoute les informations utilisateur à req.user
 */
module.exports = async (req, res, next) => {
    try {
        // 1. Récupérer le token du header Authorization
        const authHeader = req.header('Authorization');
        
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                error: 'Token manquant',
                message: 'Vous devez fournir un token d\'authentification'
            });
        }

        // Vérifier le format du header
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Format de token invalide',
                message: 'Le token doit être au format Bearer'
            });
        }

        const token = authHeader.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Token vide',
                message: 'Le token ne peut pas être vide'
            });
        }

        // 2. Vérifier et décoder le token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: 'Token expiré',
                    message: 'Votre session a expiré, veuillez vous reconnecter',
                    expired_at: error.expiredAt
                });
            }
            
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({
                    success: false,
                    error: 'Token invalide',
                    message: 'Le token fourni est invalide'
                });
            }

            return res.status(401).json({
                success: false,
                error: 'Erreur de vérification du token',
                message: error.message
            });
        }

        // 3. Vérifier que le token contient les informations nécessaires
        if (!decoded.id || !decoded.email) {
            return res.status(401).json({
                success: false,
                error: 'Token incomplet',
                message: 'Le token ne contient pas toutes les informations requises'
            });
        }

        // 4. Vérifier que l'utilisateur existe toujours dans la base de données
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, email, nom, prenom, role, telephone, created_at')
            .eq('id', decoded.id)
            .single();

        if (userError || !user) {
            return res.status(401).json({
                success: false,
                error: 'Utilisateur non trouvé',
                message: 'L\'utilisateur associé à ce token n\'existe plus'
            });
        }

        // 5. Vérifier que l'email correspond
        if (user.email !== decoded.email) {
            return res.status(401).json({
                success: false,
                error: 'Email mismatch',
                message: 'L\'email du token ne correspond pas à l\'utilisateur'
            });
        }

        // 6. Ajouter les informations utilisateur à req.user
        req.user = {
            id: user.id,
            email: user.email,
            nom: user.nom,
            prenom: user.prenom,
            role: user.role,
            telephone: user.telephone,
            created_at: user.created_at
        };

        // 7. Ajouter le token pour un éventuel rafraîchissement
        req.token = token;
        req.token_decoded = decoded;

        // 8. Journaliser l'accès (optionnel)
        // console.log(`🔐 [AUTH] ${user.email} - ${req.method} ${req.originalUrl}`);

        next();
    } catch (error) {
        console.error('Erreur dans auth middleware:', error);
        return res.status(500).json({
            success: false,
            error: 'Erreur serveur',
            message: 'Une erreur est survenue lors de l\'authentification'
        });
    }
};

/**
 * Version avec vérification supplémentaire du rôle
 * Pour les routes qui nécessitent un rôle spécifique
 */
module.exports.withRole = (requiredRole) => {
    return async (req, res, next) => {
        try {
            // D'abord, exécuter l'authentification de base
            await module.exports(req, res, async (err) => {
                if (err) return next(err);

                // Vérifier le rôle
                if (!req.user) {
                    return res.status(401).json({
                        success: false,
                        error: 'Non authentifié'
                    });
                }

                if (req.user.role !== requiredRole) {
                    return res.status(403).json({
                        success: false,
                        error: 'Accès refusé',
                        message: `Ce rôle (${requiredRole}) est requis`,
                        your_role: req.user.role
                    });
                }

                next();
            });
        } catch (error) {
            console.error('Erreur dans auth.withRole:', error);
            return res.status(500).json({
                success: false,
                error: 'Erreur serveur'
            });
        }
    };
};

/**
 * Version avec vérification des permissions
 * Pour une gestion plus fine des droits
 */
module.exports.withPermissions = (requiredPermissions = []) => {
    return async (req, res, next) => {
        try {
            // Authentification de base
            await module.exports(req, res, async (err) => {
                if (err) return next(err);

                if (!req.user) {
                    return res.status(401).json({
                        success: false,
                        error: 'Non authentifié'
                    });
                }

                // Si l'utilisateur est admin, il a toutes les permissions
                if (req.user.role === 'admin') {
                    return next();
                }

                // Récupérer les permissions de l'utilisateur
                const { data: permissions, error: permError } = await supabase
                    .from('user_permissions')
                    .select('permission')
                    .eq('user_id', req.user.id);

                if (permError) {
                    console.error('Erreur récupération permissions:', permError);
                    return res.status(500).json({
                        success: false,
                        error: 'Erreur lors de la vérification des permissions'
                    });
                }

                const userPermissions = permissions?.map(p => p.permission) || [];

                // Vérifier si l'utilisateur a toutes les permissions requises
                const hasAllPermissions = requiredPermissions.every(
                    perm => userPermissions.includes(perm)
                );

                if (!hasAllPermissions) {
                    return res.status(403).json({
                        success: false,
                        error: 'Permissions insuffisantes',
                        required: requiredPermissions,
                        has: userPermissions
                    });
                }

                next();
            });
        } catch (error) {
            console.error('Erreur dans auth.withPermissions:', error);
            return res.status(500).json({
                success: false,
                error: 'Erreur serveur'
            });
        }
    };
};

/**
 * Version avec vérification du compte actif
 */
module.exports.withActiveCheck = async (req, res, next) => {
    try {
        await module.exports(req, res, async (err) => {
            if (err) return next(err);

            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Non authentifié'
                });
            }

            // Vérifier si le compte est actif
            const { data: user, error } = await supabase
                .from('users')
                .select('status')
                .eq('id', req.user.id)
                .single();

            if (error) {
                console.error('Erreur vérification statut:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Erreur lors de la vérification du compte'
                });
            }

            if (user.status === 'inactif' || user.status === 'suspendu') {
                return res.status(403).json({
                    success: false,
                    error: 'Compte inactif',
                    message: 'Votre compte est inactif. Veuillez contacter l\'administrateur.',
                    status: user.status
                });
            }

            next();
        });
    } catch (error) {
        console.error('Erreur dans auth.withActiveCheck:', error);
        return res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
};

/**
 * Version avec vérification du token dans la base de données (blacklist)
 */
module.exports.withBlacklistCheck = async (req, res, next) => {
    try {
        await module.exports(req, res, async (err) => {
            if (err) return next(err);

            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Non authentifié'
                });
            }

            // Vérifier si le token est dans la liste noire
            const { data: blacklisted, error } = await supabase
                .from('token_blacklist')
                .select('id')
                .eq('token', req.token)
                .single();

            if (blacklisted) {
                return res.status(401).json({
                    success: false,
                    error: 'Token révoqué',
                    message: 'Ce token a été révoqué. Veuillez vous reconnecter.'
                });
            }

            next();
        });
    } catch (error) {
        console.error('Erreur dans auth.withBlacklistCheck:', error);
        return res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
};

/**
 * Version avec rafraîchissement automatique du token
 */
module.exports.withAutoRefresh = async (req, res, next) => {
    try {
        await module.exports(req, res, async (err) => {
            if (err) {
                // Si l'erreur est "Token expiré", on peut essayer de rafraîchir
                if (err.message && err.message.includes('expiré')) {
                    try {
                        // Récupérer le token expiré
                        const oldToken = req.header('Authorization')?.replace('Bearer ', '');
                        if (!oldToken) return next(err);

                        // Décoder le token sans vérifier l'expiration
                        const decoded = jwt.decode(oldToken);
                        if (!decoded || !decoded.id) return next(err);

                        // Vérifier si l'utilisateur existe toujours
                        const { data: user } = await supabase
                            .from('users')
                            .select('id, email, role')
                            .eq('id', decoded.id)
                            .single();

                        if (!user) return next(err);

                        // Générer un nouveau token
                        const newToken = jwt.sign(
                            { 
                                id: user.id, 
                                email: user.email, 
                                role: user.role 
                            },
                            process.env.JWT_SECRET || 'supersecretkey',
                            { expiresIn: '7d' }
                        );

                        // Ajouter le nouveau token à la réponse
                        res.setHeader('X-New-Token', newToken);
                        
                        // Mettre à jour req.user
                        req.user = user;
                        req.token = newToken;

                        return next();
                    } catch (refreshError) {
                        console.error('Erreur rafraîchissement token:', refreshError);
                        return next(err);
                    }
                }
                return next(err);
            }
            next();
        });
    } catch (error) {
        console.error('Erreur dans auth.withAutoRefresh:', error);
        return res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
};

/**
 * Fonction utilitaire pour générer un token
 */
module.exports.generateToken = (user) => {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email, 
            role: user.role 
        },
        process.env.JWT_SECRET || 'supersecretkey',
        { expiresIn: '7d' }
    );
};

/**
 * Fonction utilitaire pour vérifier un token
 */
module.exports.verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
    } catch (error) {
        return null;
    }
};

/**
 * Fonction utilitaire pour décoder un token (sans vérification)
 */
module.exports.decodeToken = (token) => {
    return jwt.decode(token);
};

/**
 * Fonction pour ajouter un token à la liste noire (logout)
 */
module.exports.blacklistToken = async (token, userId) => {
    try {
        const { error } = await supabase
            .from('token_blacklist')
            .insert([{
                token: token,
                user_id: userId,
                revoked_at: new Date().toISOString()
            }]);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Erreur blacklist token:', error);
        return false;
    }
};

/**
 * Middleware pour le logout
 */
module.exports.logout = async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (token && req.user) {
            await module.exports.blacklistToken(token, req.user.id);
            console.log(`👋 [AUTH] Déconnexion: ${req.user.email}`);
        }

        res.json({
            success: true,
            message: 'Déconnexion réussie'
        });
    } catch (error) {
        console.error('Erreur logout:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la déconnexion'
        });
    }
};