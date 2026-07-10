// =============================================
// ADMINROUTES.JS - ROUTES ADMINISTRATEUR
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
// 1. STATISTIQUES DASHBOARD - COMPLÈTES
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

        // Coopératives
        const { count: cooperativesCount, error: cooperativesError } = await supabase
            .from('cooperatives')
            .select('*', { count: 'exact', head: true });

        if (cooperativesError) throw cooperativesError;

        // Réservations par statut
        const { data: statusStats, error: statusError } = await supabase
            .from('reservations')
            .select('statut, count')
            .group('statut');

        if (statusError) throw statusError;

        res.json({
            success: true,
            users: usersCount || 0,
            reservations: reservationsCount || 0,
            monthlyReservations: monthlyCount || 0,
            revenue: totalRevenue,
            trajetsDisponibles: trajetsCount || 0,
            reservationsEnAttente: pendingCount || 0,
            vehiculesDisponibles: vehiculesCount || 0,
            cooperatives: cooperativesCount || 0,
            statusStats: statusStats || []
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
// 2. GESTION DES TRAJETS
// =============================================

// 2.1 Récupérer tous les trajets
router.get('/trajets', async (req, res) => {
    try {
        const { search, statut, date_debut, date_fin, page = 1, limit = 20 } = req.query;

        let query = supabase
            .from('trajets')
            .select('*', { count: 'exact' });

        // Filtres
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

        // Pagination
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

// 2.2 Créer un trajet
router.post('/trajets', [
    body('lieu_depart').notEmpty().withMessage('Lieu de départ requis'),
    body('lieu_arrivee').notEmpty().withMessage('Lieu d\'arrivée requis'),
    body('date_depart').notEmpty().withMessage('Date de départ requise'),
    body('prix').isNumeric().withMessage('Prix invalide'),
    body('places_totales').isInt({ min: 1 }).withMessage('Places totales invalides')
], async (req, res) => {
    try {
        // Validation
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

        const placesDispo = places_disponibles || places_totales || 15;

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
                places_totales: parseInt(places_totales) || 15,
                places_disponibles: parseInt(placesDispo),
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

// 2.3 Récupérer un trajet spécifique
router.get('/trajets/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('trajets')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    success: false,
                    error: 'Trajet non trouvé'
                });
            }
            throw error;
        }

        res.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('Erreur récupération trajet:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 2.4 Mettre à jour un trajet
router.put('/trajets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Vérifier si le trajet existe
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

        // Champs autorisés
        const allowedFields = [
            'lieu_depart', 'lieu_arrivee', 'region_depart', 'region_arrivee',
            'date_depart', 'heure_depart', 'heure_arrivee', 'prix',
            'places_disponibles', 'places_totales', 'vehicule_id',
            'description', 'disponible'
        ];

        const updateData = {};
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                updateData[field] = updates[field];
            }
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Aucune donnée à mettre à jour'
            });
        }

        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('trajets')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Trajet mis à jour avec succès',
            data: data
        });

    } catch (error) {
        console.error('Erreur mise à jour trajet:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 2.5 Supprimer un trajet
router.delete('/trajets/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Vérifier si le trajet existe
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

        // Vérifier s'il y a des réservations
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

// =============================================
// 3. GESTION DES RÉSERVATIONS
// =============================================

// 3.1 Récupérer toutes les réservations
router.get('/reservations', async (req, res) => {
    try {
        const { statut, date_debut, date_fin, page = 1, limit = 20 } = req.query;

        let query = supabase
            .from('reservations')
            .select(`
                *,
                users:user_id (id, nom, prenom, email, telephone),
                trajets:trajet_id (id, lieu_depart, lieu_arrivee, date_depart, prix)
            `, { count: 'exact' });

        if (statut) {
            query = query.eq('statut', statut);
        }

        if (date_debut) {
            query = query.gte('date_reservation', date_debut);
        }

        if (date_fin) {
            query = query.lte('date_reservation', date_fin);
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);
        query = query
            .order('date_reservation', { ascending: false })
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
        console.error('Erreur récupération réservations:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 3.2 Annuler une réservation (admin)
router.put('/reservations/:id/annuler', async (req, res) => {
    try {
        const { id } = req.params;
        const { motif } = req.body;

        // Vérifier si la réservation existe
        const { data: reservation, error: findError } = await supabase
            .from('reservations')
            .select('*, trajets:trajet_id (id, places_disponibles)')
            .eq('id', id)
            .single();

        if (findError) {
            return res.status(404).json({
                success: false,
                error: 'Réservation non trouvée'
            });
        }

        if (reservation.statut === 'annulée') {
            return res.status(400).json({
                success: false,
                error: 'Cette réservation est déjà annulée'
            });
        }

        if (reservation.statut === 'terminée') {
            return res.status(400).json({
                success: false,
                error: 'Impossible d\'annuler une réservation terminée'
            });
        }

        // Annuler la réservation
        const { error: updateError } = await supabase
            .from('reservations')
            .update({
                statut: 'annulée',
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (updateError) throw updateError;

        // Remettre les places disponibles
        if (reservation.trajets) {
            await supabase
                .from('trajets')
                .update({
                    places_disponibles: reservation.trajets.places_disponibles + reservation.nombre_passagers,
                    updated_at: new Date().toISOString()
                })
                .eq('id', reservation.trajet_id);
        }

        console.log(`❌ Réservation ${id} annulée par admin - Motif: ${motif || 'Non spécifié'}`);

        res.json({
            success: true,
            message: 'Réservation annulée avec succès'
        });

    } catch (error) {
        console.error('Erreur annulation réservation:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =============================================
// 4. GESTION DES VÉHICULES
// =============================================

// 4.1 Récupérer tous les véhicules
router.get('/vehicules', async (req, res) => {
    try {
        const { statut, search } = req.query;

        let query = supabase
            .from('vehicules')
            .select('*');

        if (statut) {
            query = query.eq('statut', statut);
        }

        if (search) {
            query = query.or(`marque.ilike.%${search}%,modele.ilike.%${search}%,immatriculation.ilike.%${search}%`);
        }

        const { data, error } = await query
            .order('marque', { ascending: true });

        if (error) throw error;

        res.json({
            success: true,
            data: data || []
        });

    } catch (error) {
        console.error('Erreur récupération véhicules:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 4.2 Créer un véhicule
router.post('/vehicules', [
    body('marque').notEmpty().withMessage('Marque requise'),
    body('modele').notEmpty().withMessage('Modèle requis'),
    body('capacite').isInt({ min: 1 }).withMessage('Capacité invalide'),
    body('immatriculation').notEmpty().withMessage('Immatriculation requise')
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
            marque,
            modele,
            capacite,
            immatriculation,
            cooperative,
            photo_url,
            statut = 'disponible'
        } = req.body;

        // Vérifier l'immatriculation unique
        const { data: existing, error: checkError } = await supabase
            .from('vehicules')
            .select('id')
            .eq('immatriculation', immatriculation)
            .single();

        if (existing) {
            return res.status(400).json({
                success: false,
                error: 'Cette immatriculation est déjà utilisée'
            });
        }

        const { data, error } = await supabase
            .from('vehicules')
            .insert([{
                marque,
                modele,
                capacite: parseInt(capacite),
                immatriculation,
                cooperative: cooperative || null,
                photo_url: photo_url || null,
                statut: statut || 'disponible',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: 'Véhicule ajouté avec succès',
            data: data
        });

    } catch (error) {
        console.error('Erreur création véhicule:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 4.3 Supprimer un véhicule
router.delete('/vehicules/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Vérifier si le véhicule est utilisé
        const { count, error: countError } = await supabase
            .from('trajets')
            .select('*', { count: 'exact', head: true })
            .eq('vehicule_id', id);

        if (countError) throw countError;

        if (count > 0) {
            return res.status(400).json({
                success: false,
                error: 'Ce véhicule est utilisé dans des trajets',
                trajets_count: count
            });
        }

        const { error } = await supabase
            .from('vehicules')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Véhicule supprimé avec succès'
        });

    } catch (error) {
        console.error('Erreur suppression véhicule:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =============================================
// 5. GESTION DES COOPÉRATIVES
// =============================================

// 5.1 Récupérer toutes les coopératives
router.get('/cooperatives', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('cooperatives')
            .select('*')
            .order('nom', { ascending: true });

        if (error) throw error;

        res.json({
            success: true,
            data: data || []
        });

    } catch (error) {
        console.error('Erreur récupération coopératives:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 5.2 Créer une coopérative
router.post('/cooperatives', [
    body('nom').notEmpty().withMessage('Nom requis')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { nom, adresse, telephone, email, site_web, logo_url } = req.body;

        const { data, error } = await supabase
            .from('cooperatives')
            .insert([{
                nom,
                adresse: adresse || null,
                telephone: telephone || null,
                email: email || null,
                site_web: site_web || null,
                logo_url: logo_url || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: 'Coopérative créée avec succès',
            data: data
        });

    } catch (error) {
        console.error('Erreur création coopérative:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 5.3 Supprimer une coopérative
router.delete('/cooperatives/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Vérifier si des véhicules utilisent cette coopérative
        const { count, error: countError } = await supabase
            .from('vehicules')
            .select('*', { count: 'exact', head: true })
            .eq('cooperative', id);

        if (countError) throw countError;

        if (count > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cette coopérative est utilisée par des véhicules',
                vehicules_count: count
            });
        }

        const { error } = await supabase
            .from('cooperatives')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Coopérative supprimée avec succès'
        });

    } catch (error) {
        console.error('Erreur suppression coopérative:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =============================================
// 6. EXPORTATION
// =============================================

// 6.1 Exporter les réservations (CSV)
router.get('/export/reservations', async (req, res) => {
    try {
        const { date_debut, date_fin } = req.query;

        let query = supabase
            .from('reservations')
            .select(`
                id,
                date_reservation,
                nombre_passagers,
                montant_total,
                statut,
                users:user_id (nom, prenom, email),
                trajets:trajet_id (lieu_depart, lieu_arrivee, date_depart)
            `);

        if (date_debut) {
            query = query.gte('date_reservation', date_debut);
        }

        if (date_fin) {
            query = query.lte('date_reservation', date_fin);
        }

        const { data, error } = await query
            .order('date_reservation', { ascending: false });

        if (error) throw error;

        // Format CSV
        const headers = ['ID', 'Date', 'Client', 'Trajet', 'Passagers', 'Montant', 'Statut'];
        const rows = (data || []).map(r => [
            r.id,
            new Date(r.date_reservation).toLocaleDateString('fr-FR'),
            `${r.users?.prenom || ''} ${r.users?.nom || ''}`.trim() || 'N/A',
            `${r.trajets?.lieu_depart || ''} → ${r.trajets?.lieu_arrivee || ''}`,
            r.nombre_passagers || 0,
            r.montant_total || 0,
            r.statut || 'N/A'
        ]);

        const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=reservations_${new Date().toISOString().split('T')[0]}.csv`);
        res.send('\uFEFF' + csv); // BOM pour Excel

    } catch (error) {
        console.error('Erreur export CSV:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
