// =============================================
// CLIENTROUTES.JS - ROUTES CLIENTS
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
        message: '✅ Route client fonctionne !',
        timestamp: new Date().toISOString()
    });
});

// =============================================
// RÉCUPÉRER TOUS LES TRAJETS
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

// =============================================
// RECHERCHER DES TRAJETS
// =============================================

router.get('/recherche', async (req, res) => {
    try {
        const { 
            lieu_depart, 
            lieu_arrivee, 
            date_depart, 
            passagers,
            region,
            prix_min,
            prix_max
        } = req.query;

        let query = supabase
            .from('trajets')
            .select('*')
            .eq('disponible', true)
            .gte('date_depart', new Date().toISOString().split('T')[0]);

        if (lieu_depart) {
            query = query.ilike('lieu_depart', `%${lieu_depart}%`);
        }

        if (lieu_arrivee) {
            query = query.ilike('lieu_arrivee', `%${lieu_arrivee}%`);
        }

        if (region) {
            query = query.or(`region_depart.ilike.%${region}%,region_arrivee.ilike.%${region}%`);
        }

        if (date_depart) {
            query = query.eq('date_depart', date_depart);
        }

        if (prix_min) {
            query = query.gte('prix', parseFloat(prix_min));
        }

        if (prix_max) {
            query = query.lte('prix', parseFloat(prix_max));
        }

        if (passagers) {
            query = query.gte('places_disponibles', parseInt(passagers));
        }

        const { data, error } = await query
            .order('date_depart', { ascending: true })
            .order('prix', { ascending: true });

        if (error) {
            console.error('Erreur recherche:', error);
            return res.status(500).json({
                success: false,
                error: 'Erreur lors de la recherche'
            });
        }

        res.json({
            success: true,
            data: data || [],
            count: data?.length || 0
        });

    } catch (error) {
        console.error('Erreur recherche:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

module.exports = router;
