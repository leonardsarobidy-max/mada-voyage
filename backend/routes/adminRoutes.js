// =============================================
// ADMINROUTES.JS - ROUTES ADMIN
// =============================================

const express = require('express');
const router = express.Router();

const { supabase } = require('../config/database');

// =============================================
// ROUTE DE TEST
// =============================================

router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: '✅ Route admin fonctionne !',
        timestamp: new Date().toISOString()
    });
});

// =============================================
// STATISTIQUES DASHBOARD
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

        // Réservations du mois
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { count: monthlyCount, error: monthlyError } = await supabase
            .from('reservations')
            .select('*', { count: 'exact', head: true })
            .gte('date_reservation', startOfMonth.toISOString());

        if (monthlyError) throw monthlyError;

        // Chiffre d'affaires total
        const { data: revenueData, error: revenueError } = await supabase
            .from('reservations')
            .select('montant_total')
            .eq('statut', 'confirmée');

        if (revenueError) throw revenueError;

        const totalRevenue = revenueData?.reduce((sum, r) => sum + (r.montant_total || 0), 0) || 0;

        // Trajets disponibles
        const { count: trajetsCount, error: trajetsError } = await supabase
            .from('trajets')
            .select('*', { count: 'exact', head: true })
            .eq('disponible', true)
            .gte('date_depart', new Date().toISOString().split('T')[0]);

        if (trajetsError) throw trajetsError;

        // Réservations en attente
        const { count: pendingCount, error: pendingError } = await supabase
            .from('reservations')
            .select('*', { count: 'exact', head: true })
            .eq('statut', 'en_attente');

        if (pendingError) throw pendingError;

        res.json({
            success: true,
            users: usersCount || 0,
            reservations: reservationsCount || 0,
            monthlyReservations: monthlyCount || 0,
            revenue: totalRevenue,
            trajetsDisponibles: trajetsCount || 0,
            reservationsEnAttente: pendingCount || 0
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
