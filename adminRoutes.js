// =============================================
// ADMINROUTES.JS - VERSION CORRIGÉE
// =============================================

const express = require('express');
const router = express.Router();

// ✅ IMPORTATION CORRECTE
const { supabase } = require('../config/database');

// =============================================
// ROUTE DE TEST
// =============================================

router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: '✅ Route admin/test fonctionne !',
        timestamp: new Date().toISOString()
    });
});

// =============================================
// 1. STATISTIQUES DASHBOARD
// =============================================

router.get('/stats', async (req, res) => {
    try {
        // Total utilisateurs
        const { count: usersCount, error: usersError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        if (usersError) throw usersError;

        // Total réservations
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

module.exports = router;