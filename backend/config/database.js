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

// ✅ VOS CLÉS (si les variables d'environnement ne fonctionnent pas)
// const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6bG9vc3hwdnJwY3V5Zm1rYXZiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1NTY5ODAsImV4cCI6MjA5OTEzMjk4MH0.qV1PYucsE8RDdpV2zZ_aKgf7F1tf4buklb5cogoWhi0';
// const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6bG9vc3hwdnJwY3V5Zm1rYXZiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzU1Njk4MCwiZXhwIjoyMDk5MTMyOTgwfQ.mE-WH6utf2WzunP8bNXsCiL44x13qMNY0T_oZrXf454';

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

// Client public (avec RLS)
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

// Client admin (sans RLS)
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
// EXPORTATION
// =============================================

module.exports = {
    supabase,
    supabaseAdmin,
    supabaseUrl,
    supabaseAnonKey
};
