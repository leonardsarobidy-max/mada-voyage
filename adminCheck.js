// =============================================
// ADMINCHECK.JS - MIDDLEWARE ADMIN
// =============================================

const { supabase } = require('../config/database');

/**
 * Middleware pour vérifier si l'utilisateur est administrateur
 * Doit être utilisé APRÈS le middleware d'authentification (auth)
 */
module.exports = async (req, res, next) => {
    try {
        // 1. Vérifier si l'utilisateur est authentifié
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Non authentifié',
                message: 'Vous devez être connecté pour accéder à cette ressource'
            });
        }

        // 2. Vérifier le rôle dans le token
        if (req.user.role === 'admin') {
            return next();
        }

        // 3. Vérification supplémentaire dans la base de données
        const { data: user, error } = await supabase
            .from('users')
            .select('id, email, role, nom, prenom')
            .eq('id', req.user.id)
            .single();

        if (error || !user) {
            return res.status(401).json({
                success: false,
                error: 'Utilisateur non trouvé',
                message: 'L\'utilisateur n\'existe plus dans la base de données'
            });
        }

        // 4. Vérifier le rôle dans la base de données
        if (user.role === 'admin') {
            req.user.role = 'admin';
            return next();
        }

        // 5. L'utilisateur n'est pas admin
        return res.status(403).json({
            success: false,
            error: 'Accès refusé',
            message: 'Vous devez être administrateur pour accéder à cette ressource',
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            },
            required_role: 'admin'
        });

    } catch (error) {
        console.error('Erreur dans adminCheck:', error);
        return res.status(500).json({
            success: false,
            error: 'Erreur serveur',
            message: 'Une erreur est survenue lors de la vérification des droits admin'
        });
    }
};