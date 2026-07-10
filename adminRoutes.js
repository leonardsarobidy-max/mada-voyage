// =============================================
// ADMINROUTES.JS - VERSION CORRIGÉE (SANS GROUP)
// =============================================

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

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
// 1. STATISTIQUES DASHBOARD - VERSION SIMPLIFIÉE
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

        // Véhicules disponibles
        const { count: vehiculesCount, error: vehiculesError } = await supabase
            .from('vehicules')
            .select('*', { count: 'exact', head: true })
            .eq('statut', 'disponible');

        if (vehiculesError) throw vehiculesError;

        res.json({
            success: true,
            users: usersCount || 0,
            reservations: reservationsCount || 0,
            monthlyReservations: monthlyCount || 0,
            revenue: totalRevenue,
            trajetsDisponibles: trajetsCount || 0,
            reservationsEnAttente: pendingCount || 0,
            vehiculesDisponibles: vehiculesCount || 0
        });

    } catch (error) {
        console.error('Erreur stats:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des statistiques',
            details: error.message
        });
    }
});

// =============================================
// 2. RÉCUPÉRER TOUS LES TRAJETS
// =============================================

router.get('/trajets', async (req, res) => {
    try {
        const { search, statut, date_debut, date_fin, page = 1, limit = 20 } = req.query;

        let query = supabase
            .from('trajets')
            .select('*', { count: 'exact' });

        if (search) {
            query = query.or(`lieu_depart.ilike.%${search}%,lieu_arrivee.ilike.%${search}%`);
        }

        if (statut !== undefined && statut !== '') {
            query = query.eq('disponible', statut === 'true');
        }

        if (date_debut) {
            query = query.gte('date_depart', date_debut);
        }

        if (date_fin) {
            query = query.lte('date_depart', date_fin);
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);
        query = query
            .order('date_depart', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        res.json({
            success: true,
            data: data || [],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Erreur récupération trajets:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =============================================
// 3. CRÉER UN TRAJET
// =============================================

router.post('/trajets', [
    body('lieu_depart').notEmpty().withMessage('Lieu de départ requis'),
    body('lieu_arrivee').notEmpty().withMessage('Lieu d\'arrivée requis'),
    body('date_depart').notEmpty().withMessage('Date de départ requise'),
    body('prix').isNumeric().withMessage('Prix invalide')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const {
            lieu_depart,
            lieu_arrivee,
            region_depart,
            region_arrivee,
            date_depart,
            heure_depart,
            heure_arrivee,
            prix,
            places_totales,
            places_disponibles,
            vehicule_id,
            description
        } = req.body;

        const placesTotal = parseInt(places_totales) || 15;
        const placesDispo = parseInt(places_disponibles) || placesTotal;

        const { data, error } = await supabase
            .from('trajets')
            .insert([{
                lieu_depart,
                lieu_arrivee,
                region_depart: region_depart || null,
                region_arrivee: region_arrivee || null,
                date_depart,
                heure_depart: heure_depart || '08:00:00',
                heure_arrivee: heure_arrivee || null,
                prix: parseFloat(prix),
                places_totales: placesTotal,
                places_disponibles: placesDispo,
                vehicule_id: vehicule_id || null,
                description: description || null,
                disponible: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: 'Trajet créé avec succès',
            data: data
        });

    } catch (error) {
        console.error('Erreur création trajet:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =============================================
// 4. SUPPRIMER UN TRAJET
// =============================================

router.delete('/trajets/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data: existing, error: checkError } = await supabase
            .from('trajets')
            .select('id')
            .eq('id', id)
            .single();

        if (checkError) {
            return res.status(404).json({
                success: false,
                error: 'Trajet non trouvé'
            });
        }

        const { count, error: countError } = await supabase
            .from('reservations')
            .select('*', { count: 'exact', head: true })
            .eq('trajet_id', id);

        if (countError) throw countError;

        if (count > 0) {
            return res.status(400).json({
                success: false,
                error: 'Impossible de supprimer: ce trajet a des réservations',
                reservations_count: count
            });
        }

        const { error } = await supabase
            .from('trajets')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Trajet supprimé avec succès'
        });

    } catch (error) {
        console.error('Erreur suppression trajet:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
