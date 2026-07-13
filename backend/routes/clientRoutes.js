// =============================================
// CLIENTROUTES.JS - ROUTES CLIENTS
// =============================================

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const { supabase } = require('../Config/database');

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
// 1. RÉCUPÉRER TOUS LES TRAJETS DISPONIBLES
// =============================================

router.get('/trajets', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('trajets')
            .select(`
                *,
                vehicules (
                    id,
                    marque,
                    modele,
                    immatriculation,
                    capacite,
                    cooperative,
                    photo_url
                )
            `)
            .eq('disponible', true)
            .gte('date_depart', new Date().toISOString().split('T')[0])
            .order('date_depart', { ascending: true })
            .order('heure_depart', { ascending: true });

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
// 2. RECHERCHER DES TRAJETS AVEC FILTRES
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
            .select(`
                *,
                vehicules (
                    id,
                    marque,
                    modele,
                    immatriculation,
                    capacite,
                    cooperative,
                    photo_url
                )
            `)
            .eq('disponible', true)
            .gte('date_depart', new Date().toISOString().split('T')[0]);

        // Filtres
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

// =============================================
// 3. RÉCUPÉRER UN TRAJET SPÉCIFIQUE
// =============================================

router.get('/trajets/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('trajets')
            .select(`
                *,
                vehicules (*),
                reservations (
                    id,
                    nombre_passagers,
                    statut,
                    siege_ids
                )
            `)
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

        // Calculer les places occupées
        const placesOccupees = data.reservations
            ?.filter(r => r.statut === 'confirmée')
            .reduce((sum, r) => sum + r.nombre_passagers, 0) || 0;

        res.json({
            success: true,
            data: {
                ...data,
                places_occupees: placesOccupees,
                places_restantes: data.places_totales - placesOccupees
            }
        });

    } catch (error) {
        console.error('Erreur récupération trajet:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

// =============================================
// 4. CRÉER UNE RÉSERVATION
// =============================================

router.post('/reserver', [
    body('trajet_id').notEmpty().withMessage('ID du trajet requis'),
    body('nombre_passagers').isInt({ min: 1 }).withMessage('Nombre de passagers invalide'),
    body('siege_ids').optional().isArray().withMessage('Format de sièges invalide')
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

        const { trajet_id, nombre_passagers, siege_ids } = req.body;
        const user_id = req.user?.id; // Récupéré par le middleware auth

        if (!user_id) {
            return res.status(401).json({
                success: false,
                error: 'Utilisateur non authentifié'
            });
        }

        // Vérifier si le trajet existe
        const { data: trajet, error: trajetError } = await supabase
            .from('trajets')
            .select('*')
            .eq('id', trajet_id)
            .eq('disponible', true)
            .single();

        if (trajetError || !trajet) {
            return res.status(404).json({
                success: false,
                error: 'Trajet non trouvé ou indisponible'
            });
        }

        // Vérifier la date
        const dateTrajet = new Date(trajet.date_depart);
        if (dateTrajet < new Date()) {
            return res.status(400).json({
                success: false,
                error: 'Ce trajet est déjà passé'
            });
        }

        // Vérifier les places disponibles
        if (trajet.places_disponibles < nombre_passagers) {
            return res.status(400).json({
                success: false,
                error: 'Places insuffisantes',
                places_disponibles: trajet.places_disponibles,
                places_demandees: nombre_passagers
            });
        }

        // Vérifier les réservations existantes
        const { data: existingReservations, error: existingError } = await supabase
            .from('reservations')
            .select('id')
            .eq('user_id', user_id)
            .eq('trajet_id', trajet_id)
            .eq('statut', 'confirmée');

        if (existingReservations && existingReservations.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Vous avez déjà réservé ce trajet'
            });
        }

        // Calculer le montant total
        const montant_total = trajet.prix * nombre_passagers;

        // Créer la réservation
        const { data: reservation, error: reservationError } = await supabase
            .from('reservations')
            .insert([{
                user_id,
                trajet_id,
                nombre_passagers,
                siege_ids: siege_ids || [],
                montant_total,
                statut: 'confirmée',
                date_reservation: new Date().toISOString()
            }])
            .select(`
                *,
                trajets (
                    lieu_depart,
                    lieu_arrivee,
                    date_depart,
                    heure_depart,
                    prix
                ),
                users (
                    nom,
                    prenom,
                    email,
                    telephone
                )
            `)
            .single();

        if (reservationError) {
            console.error('Erreur réservation:', reservationError);
            return res.status(500).json({
                success: false,
                error: 'Erreur lors de la réservation'
            });
        }

        // Mettre à jour les places disponibles
        const { error: updateError } = await supabase
            .from('trajets')
            .update({ 
                places_disponibles: trajet.places_disponibles - nombre_passagers,
                disponible: trajet.places_disponibles - nombre_passagers > 0,
                updated_at: new Date().toISOString()
            })
            .eq('id', trajet_id);

        if (updateError) {
            console.error('Erreur mise à jour places:', updateError);
        }

        console.log(`🎫 Réservation: ${reservation.id}`);

        res.status(201).json({
            success: true,
            message: 'Réservation confirmée avec succès',
            reservation: reservation,
            numero_reservation: `RES-${reservation.id.substring(0, 8).toUpperCase()}`
        });

    } catch (error) {
        console.error('Erreur création réservation:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la réservation'
        });
    }
});

// =============================================
// 5. RÉCUPÉRER L'HISTORIQUE DES RÉSERVATIONS
// =============================================

router.get('/historique', async (req, res) => {
    try {
        const user_id = req.user?.id;
        
        if (!user_id) {
            return res.status(401).json({
                success: false,
                error: 'Utilisateur non authentifié'
            });
        }

        const { statut, date_debut, date_fin, page = 1, limit = 10 } = req.query;

        let query = supabase
            .from('reservations')
            .select(`
                *,
                trajets (
                    id,
                    lieu_depart,
                    lieu_arrivee,
                    date_depart,
                    heure_depart,
                    prix,
                    region_depart,
                    region_arrivee,
                    vehicules (
                        marque,
                        modele,
                        immatriculation,
                        photo_url
                    )
                )
            `, { count: 'exact' })
            .eq('user_id', user_id);

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

        if (error) {
            console.error('Erreur historique:', error);
            return res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération de l\'historique'
            });
        }

        res.json({
            success: true,
            data: data || [],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count || 0,
                totalPages: count ? Math.ceil(count / parseInt(limit)) : 0
            }
        });

    } catch (error) {
        console.error('Erreur historique:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

// =============================================
// 6. ANNULER UNE RÉSERVATION
// =============================================

router.put('/reservations/:id/annuler', async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user?.id;

        if (!user_id) {
            return res.status(401).json({
                success: false,
                error: 'Utilisateur non authentifié'
            });
        }

        // Vérifier si la réservation existe
        const { data: reservation, error: findError } = await supabase
            .from('reservations')
            .select(`
                *,
                trajets (*)
            `)
            .eq('id', id)
            .eq('user_id', user_id)
            .single();

        if (findError || !reservation) {
            return res.status(404).json({
                success: false,
                error: 'Réservation non trouvée'
            });
        }

        // Vérifier si la réservation peut être annulée
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

        // Vérifier si le trajet n'est pas déjà passé
        const dateTrajet = new Date(reservation.trajets.date_depart);
        if (dateTrajet < new Date()) {
            return res.status(400).json({
                success: false,
                error: 'Impossible d\'annuler un trajet passé'
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
        await supabase
            .from('trajets')
            .update({
                places_disponibles: reservation.trajets.places_disponibles + reservation.nombre_passagers,
                disponible: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', reservation.trajet_id);

        console.log(`❌ Réservation annulée: ${id}`);

        res.json({
            success: true,
            message: 'Réservation annulée avec succès',
            reservation_id: id
        });

    } catch (error) {
        console.error('Erreur annulation:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

// =============================================
// 7. RÉCUPÉRER LES DESTINATIONS POPULAIRES
// =============================================

router.get('/destinations/populaires', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('trajets')
            .select(`
                lieu_arrivee,
                region_arrivee,
                reservations:reservations(count)
            `)
            .not('reservations', 'is', null)
            .order('reservations', { ascending: false })
            .limit(6);

        if (error) throw error;

        const destinations = data?.map(item => ({
            destination: item.lieu_arrivee,
            region: item.region_arrivee,
            reservations_count: item.reservations?.[0]?.count || 0
        })) || [];

        res.json({
            success: true,
            data: destinations
        });

    } catch (error) {
        console.error('Erreur destinations populaires:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

// =============================================
// 8. AJOUTER UN AVIS
// =============================================

router.post('/avis', [
    body('trajet_id').notEmpty().withMessage('ID du trajet requis'),
    body('note').isInt({ min: 1, max: 5 }).withMessage('La note doit être entre 1 et 5'),
    body('commentaire').optional().isString().withMessage('Commentaire invalide')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const user_id = req.user?.id;
        if (!user_id) {
            return res.status(401).json({
                success: false,
                error: 'Utilisateur non authentifié'
            });
        }

        const { trajet_id, note, commentaire } = req.body;

        // Vérifier que l'utilisateur a bien réservé ce trajet
        const { data: reservation, error: checkError } = await supabase
            .from('reservations')
            .select('id')
            .eq('user_id', user_id)
            .eq('trajet_id', trajet_id)
            .eq('statut', 'confirmée')
            .single();

        if (checkError || !reservation) {
            return res.status(400).json({
                success: false,
                error: 'Vous devez avoir réservé ce trajet pour laisser un avis'
            });
        }

        // Vérifier si l'utilisateur a déjà laissé un avis
        const { count: existingCount } = await supabase
            .from('avis')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user_id)
            .eq('trajet_id', trajet_id);

        if (existingCount > 0) {
            return res.status(400).json({
                success: false,
                error: 'Vous avez déjà laissé un avis pour ce trajet'
            });
        }

        // Créer l'avis
        const { data, error } = await supabase
            .from('avis')
            .insert([{
                user_id,
                trajet_id,
                note,
                commentaire: commentaire || null,
                created_at: new Date().toISOString()
            }])
            .select(`
                *,
                users (nom, prenom)
            `)
            .single();

        if (error) throw error;

        console.log(`⭐ Avis ajouté: ${user_id} - Trajet ${trajet_id} - Note ${note}/5`);

        res.status(201).json({
            success: true,
            message: 'Avis ajouté avec succès',
            data: data
        });

    } catch (error) {
        console.error('Erreur ajout avis:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

// =============================================
// 9. RÉCUPÉRER LES AVIS D'UN TRAJET
// =============================================

router.get('/avis/:trajet_id', async (req, res) => {
    try {
        const { trajet_id } = req.params;

        const { data, error } = await supabase
            .from('avis')
            .select(`
                *,
                users (nom, prenom)
            `)
            .eq('trajet_id', trajet_id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Calculer la note moyenne
        const notes = data?.map(a => a.note) || [];
        const moyenne = notes.length > 0 
            ? notes.reduce((sum, n) => sum + n, 0) / notes.length 
            : 0;

        res.json({
            success: true,
            data: data || [],
            stats: {
                total: notes.length,
                moyenne: Math.round(moyenne * 10) / 10,
                distribution: {
                    '5': notes.filter(n => n === 5).length,
                    '4': notes.filter(n => n === 4).length,
                    '3': notes.filter(n => n === 3).length,
                    '2': notes.filter(n => n === 2).length,
                    '1': notes.filter(n => n === 1).length
                }
            }
        });

    } catch (error) {
        console.error('Erreur récupération avis:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur serveur'
        });
    }
});

module.exports = router;
