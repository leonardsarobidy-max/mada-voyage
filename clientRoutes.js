// =============================================
// CLIENTROUTES.JS - VERSION CORRIGÉE
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
        message: '✅ Route client/test fonctionne !',
        timestamp: new Date().toISOString()
    });
});

// =============================================
// 1. RÉCUPÉRER TOUS LES TRAJETS
// =============================================

router.get('/trajets', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('trajets')
            .select('*')
            .eq('disponible', true)
            .gte('date_depart', new Date().toISOString().split('T')[0])
            .order('date_depart', { ascending: true });

        if (error) {
            console.error('Erreur trajets:', error);
            return res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération des trajets'
            });
        }

        res.json({
            success: true,
            data: data || [],
            count: data?.length || 0
        });

    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

module.exports = router;