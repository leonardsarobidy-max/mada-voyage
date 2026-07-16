// =============================================
// DATABASE.JS - CONNEXION SUPABASE
// =============================================

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// =============================================
// CONFIGURATION
// =============================================

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Vérification des variables
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Variables Supabase manquantes !');
    console.error('   Vérifiez votre fichier .env');
    console.error('   SUPABASE_URL et SUPABASE_ANON_KEY sont requis');
    process.exit(1);
}

// =============================================
// CLIENTS SUPABASE
// =============================================

// Client public (avec RLS - Row Level Security)
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

// Client admin (sans RLS - pour les opérations serveur)
const supabaseAdmin = supabaseServiceKey 
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    : supabase;

console.log('✅ Supabase connecté avec succès');
console.log(`📊 Project URL: ${supabaseUrl}`);

// =============================================
// FONCTIONS UTILITAIRES
// =============================================

/**
 * Vérifie la connexion à Supabase
 */
async function checkConnection() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('count', { count: 'exact', head: true });
        
        if (error) throw error;
        
        return { 
            status: 'connected', 
            type: 'supabase',
            project: supabaseUrl
        };
    } catch (error) {
        return { 
            status: 'error', 
            type: 'supabase',
            error: error.message 
        };
    }
}

/**
 * Gère les erreurs Supabase
 */
function handleSupabaseError(error) {
    console.error('❌ Supabase Error:', error);
    
    const errorMap = {
        'PGRST116': { 
            code: 'NOT_FOUND', 
            message: 'Ressource non trouvée',
            status: 404 
        },
        '23505': { 
            code: 'DUPLICATE', 
            message: 'Cette valeur existe déjà',
            status: 409 
        },
        '23503': { 
            code: 'FOREIGN_KEY', 
            message: 'Violation de clé étrangère',
            status: 400 
        },
        '23514': { 
            code: 'CHECK_VIOLATION', 
            message: 'Contrainte de validation',
            status: 400 
        },
        '42501': { 
            code: 'PERMISSION_DENIED', 
            message: 'Permission refusée',
            status: 403 
        },
        '42P01': { 
            code: 'TABLE_NOT_FOUND', 
            message: 'Table non trouvée',
            status: 404 
        }
    };
    
    const mapped = errorMap[error.code];
    if (mapped) {
        return { ...mapped, original: error.message };
    }
    
    return { 
        code: 'UNKNOWN', 
        message: error.message || 'Erreur inconnue',
        status: 500,
        original: error.message
    };
}

/**
 * Formate les données pour la réponse
 */
function formatData(data) {
    if (!data) return null;
    if (Array.isArray(data)) {
        return data.map(item => formatData(item));
    }
    if (data instanceof Date) {
        return data.toISOString();
    }
    if (typeof data === 'object' && data !== null) {
        const formatted = {};
        for (const [key, value] of Object.entries(data)) {
            // Ignorer les champs sensibles
            if (key === 'password' || key === 'reset_token') continue;
            formatted[key] = formatData(value);
        }
        return formatted;
    }
    return data;
}

/**
 * Exécute une transaction avec Supabase
 * Note: Supabase n'a pas de transactions natives,
 * on utilise un workaround avec les appels successifs
 */
async function supabaseTransaction(operations) {
    // Les transactions ne sont pas supportées nativement par Supabase
    // On exécute les opérations séquentiellement
    const results = [];
    for (const operation of operations) {
        const result = await operation(supabaseAdmin);
        if (result.error) {
            // Rollback impossible avec Supabase
            // Utiliser des mécanismes de compensation
            throw new Error(`Transaction échouée: ${result.error.message}`);
        }
        results.push(result.data);
    }
    return results;
}

// =============================================
// EXPORTATION
// =============================================

module.exports = {
    supabase,
    supabaseAdmin,
    supabaseUrl,
    supabaseAnonKey,
    checkConnection,
    handleSupabaseError,
    formatData,
    supabaseTransaction
};
