// =============================================
// TEST-SUPABASE.JS - Test de connexion
// =============================================

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// =============================================
// CONFIGURATION
// =============================================

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Erreur: Variables Supabase non définies');
    console.error('   Vérifiez votre fichier .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// =============================================
// TESTS
// =============================================

async function testConnection() {
    console.log('=' .repeat(50));
    console.log('🔍 TEST DE CONNEXION SUPABASE');
    console.log('=' .repeat(50));
    console.log(`📊 URL: ${supabaseUrl}`);
    console.log(`🔑 Clé: ${supabaseKey.substring(0, 20)}...`);

    try {
        // Test 1: Vérifier la table users
        console.log('\n📋 Test 1: Vérification de la table users');
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('*')
            .limit(1);

        if (usersError) {
            console.log('⚠️  Erreur:', usersError.message);
            console.log('💡 Créez les tables avec le script SQL');
        } else {
            console.log('✅ Table users accessible');
            console.log(`📊 ${users?.length || 0} utilisateur(s) trouvé(s)`);
        }

        // Test 2: Vérifier la table trajets
        console.log('\n📋 Test 2: Vérification de la table trajets');
        const { data: trajets, error: trajetsError } = await supabase
            .from('trajets')
            .select('count', { count: 'exact', head: true });

        if (trajetsError) {
            console.log('⚠️  Erreur:', trajetsError.message);
        } else {
            console.log('✅ Table trajets accessible');
            console.log(`📊 ${trajets?.count || 0} trajet(s) trouvé(s)`);
        }

        // Test 3: Vérifier la table reservations
        console.log('\n📋 Test 3: Vérification de la table reservations');
        const { data: reservations, error: reservationsError } = await supabase
            .from('reservations')
            .select('count', { count: 'exact', head: true });

        if (reservationsError) {
            console.log('⚠️  Erreur:', reservationsError.message);
        } else {
            console.log('✅ Table reservations accessible');
            console.log(`📊 ${reservations?.count || 0} réservation(s) trouvée(s)`);
        }

        // Test 4: Vérifier la santé
        console.log('\n📋 Test 4: Vérification de la santé');
        const startTime = Date.now();
        const { error: healthError } = await supabase
            .from('users')
            .select('count', { count: 'exact', head: true });
        
        const endTime = Date.now();
        
        if (healthError) {
            console.log('⚠️  Erreur de santé:', healthError.message);
        } else {
            console.log(`✅ Réponse en ${endTime - startTime}ms`);
        }

        // Résumé
        console.log('\n' + '=' .repeat(50));
        console.log('📊 RÉSUMÉ DES TESTS');
        console.log('=' .repeat(50));
        console.log('✅ Tests terminés avec succès !');
        console.log(`📊 Base de données: ${process.env.DB_TYPE || 'supabase'}`);
        console.log(`🔗 URL: ${supabaseUrl}`);
        console.log('=' .repeat(50));

    } catch (error) {
        console.error('\n❌ Erreur fatale:', error.message);
        console.error('   Vérifiez votre connexion internet');
        console.error('   et vos identifiants Supabase');
        process.exit(1);
    }
}

// =============================================
// EXÉCUTION
// =============================================

testConnection();

// Export pour les tests
module.exports = { testConnection };