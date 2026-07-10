/**
 * =============================================
 * RESERVATIONS.JS - Gestion complète des réservations
 * =============================================
 */

// ✅ URL CORRECTE DU BACKEND SUR RENDER
const API_URL = 'https://mada-voyage-backend.onrender.com/api';

let currentUser = null;
let currentToken = null;
let selectedTrajet = null;
let selectedSieges = [];

// ============================================================
// 1. INITIALISATION
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    // Vérifier l'authentification
    checkAuth();
    
    // Initialiser les événements
    setupEventListeners();
    
    // Charger les trajets
    loadTrajets();
    
    // Vérifier si un trajet est sélectionné dans l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const trajetId = urlParams.get('trajet_id');
    if (trajetId) {
        loadTrajetDetails(trajetId);
    }
});

// ============================================================
// 2. AUTHENTIFICATION
// ============================================================

function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        currentToken = token;
        currentUser = JSON.parse(user);
        updateUIForLoggedInUser();
        return true;
    }
    return false;
}

function updateUIForLoggedInUser() {
    const authLinks = document.getElementById('authLinks');
    const userInfo = document.getElementById('userInfo');
    const userNameText = document.getElementById('userNameText');
    
    if (currentUser) {
        if (authLinks) authLinks.classList.add('d-none');
        if (userInfo) {
            userInfo.classList.remove('d-none');
            if (userNameText) {
                userNameText.textContent = `${currentUser.prenom} ${currentUser.nom}`;
            }
        }
        // Mettre à jour le bouton de réservation
        const reserveBtn = document.getElementById('reserveBtn');
        if (reserveBtn) {
            reserveBtn.disabled = false;
            reserveBtn.innerHTML = '<i class="bi bi-check-circle me-2"></i> Réserver maintenant';
        }
    } else {
        if (authLinks) authLinks.classList.remove('d-none');
        if (userInfo) userInfo.classList.add('d-none');
        const reserveBtn = document.getElementById('reserveBtn');
        if (reserveBtn) {
            reserveBtn.disabled = true;
            reserveBtn.innerHTML = '<i class="bi bi-lock me-2"></i> Connectez-vous pour réserver';
        }
    }
}

// ============================================================
// 3. ÉVÉNEMENTS
// ============================================================

function setupEventListeners() {
    // Formulaire de recherche
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            searchTrajets();
        });
    }
    
    // Bouton de réservation
    const reserveBtn = document.getElementById('reserveBtn');
    if (reserveBtn) {
        reserveBtn.addEventListener('click', function() {
            if (!currentUser) {
                showLoginModal();
                return;
            }
            openReservationModal();
        });
    }
    
    // Confirmation de réservation
    const confirmBtn = document.getElementById('confirmReservationBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmReservation);
    }
    
    // Changement du nombre de passagers
    const passagersInput = document.getElementById('reservationPassagers');
    if (passagersInput) {
        passagersInput.addEventListener('change', updatePrice);
        passagersInput.addEventListener('input', updatePrice);
    }
    
    // Sélection des sièges
    const siegeContainer = document.getElementById('siegeContainer');
    if (siegeContainer) {
        siegeContainer.addEventListener('click', function(e) {
            const siege = e.target.closest('.siege');
            if (siege) {
                toggleSiegeSelection(siege);
            }
        });
    }
    
    // Modal fermeture
    const reservationModal = document.getElementById('reservationModal');
    if (reservationModal) {
        reservationModal.addEventListener('hidden.bs.modal', function() {
            resetReservationForm();
        });
    }
    
    // Déconnexion
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// ============================================================
// 4. RECHERCHE DE TRAJETS
// ============================================================

async function searchTrajets() {
    const lieuDepart = document.getElementById('lieuDepart').value.trim();
    const lieuArrivee = document.getElementById('lieuArrivee').value.trim();
    const dateDepart = document.getElementById('dateDepart').value;
    const passagers = document.getElementById('passagers').value || 1;
    
    const params = new URLSearchParams();
    if (lieuDepart) params.append('lieu_depart', lieuDepart);
    if (lieuArrivee) params.append('lieu_arrivee', lieuArrivee);
    if (dateDepart) params.append('date_depart', dateDepart);
    if (passagers) params.append('passagers', passagers);
    
    try {
        const response = await fetch(`${API_URL}/client/recherche?${params}`);
        const trajets = await response.json();
        displayTrajets(trajets);
    } catch (error) {
        console.error('Erreur recherche:', error);
        showToast('Erreur lors de la recherche', 'error');
    }
}

function displayTrajets(trajets) {
    const container = document.getElementById('trajetsResults');
    if (!container) return;
    
    if (!trajets || trajets.length === 0) {
        container.innerHTML = `
            <div class="empty-state py-5">
                <i class="bi bi-search display-1 text-muted"></i>
                <h5 class="mt-3">Aucun trajet trouvé</h5>
                <p class="text-muted">Essayez de modifier vos critères de recherche</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <span class="fw-bold">${trajets.length} trajet(s) trouvé(s)</span>
            <span class="text-muted small">Cliquez sur un trajet pour réserver</span>
        </div>
        <div class="row g-3">
            ${trajets.map(t => `
                <div class="col-md-6 col-lg-4">
                    <div class="card trajet-card h-100" onclick="selectTrajet('${t.id}')">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start">
                                <h5 class="card-title">
                                    <i class="bi bi-geo-alt text-warning"></i>
                                    ${t.lieu_depart} → ${t.lieu_arrivee}
                                </h5>
                                <span class="badge ${t.places_disponibles > 5 ? 'bg-success' : 'bg-warning'}">
                                    ${t.places_disponibles} places
                                </span>
                            </div>
                            <div class="mt-2">
                                <p class="mb-1">
                                    <i class="bi bi-calendar3 text-primary me-2"></i>
                                    ${new Date(t.date_depart).toLocaleDateString('fr-FR')}
                                </p>
                                <p class="mb-1">
                                    <i class="bi bi-clock text-primary me-2"></i>
                                    ${t.heure_depart}
                                </p>
                                ${t.region ? `
                                    <p class="mb-1">
                                        <i class="bi bi-pin-map text-primary me-2"></i>
                                        ${t.region}
                                    </p>
                                ` : ''}
                                <p class="mb-0">
                                    <i class="bi bi-truck text-primary me-2"></i>
                                    ${t.vehicules?.marque || 'Véhicule'} ${t.vehicules?.modele || ''}
                                </p>
                            </div>
                            <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                                <span class="price">
                                    ${t.prix.toLocaleString()} <small>Ar</small>
                                </span>
                                <button class="btn btn-sm btn-warning" onclick="event.stopPropagation(); selectTrajet('${t.id}')">
                                    <i class="bi bi-ticket me-1"></i> Réserver
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// ============================================================
// 5. SÉLECTION D'UN TRAJET
// ============================================================

async function selectTrajet(trajetId) {
    try {
        await loadTrajetDetails(trajetId);
        
        // Scroll vers les détails
        const detailsSection = document.getElementById('trajetDetails');
        if (detailsSection) {
            detailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        // Mettre à jour l'URL
        const url = new URL(window.location);
        url.searchParams.set('trajet_id', trajetId);
        window.history.pushState({}, '', url);
        
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Erreur lors du chargement du trajet', 'error');
    }
}

async function loadTrajetDetails(trajetId) {
    try {
        const response = await fetch(`${API_URL}/client/trajets/${trajetId}`);
        if (!response.ok) throw new Error('Trajet non trouvé');
        
        selectedTrajet = await response.json();
        displayTrajetDetails(selectedTrajet);
        
    } catch (error) {
        console.error('Erreur:', error);
        showToast('Erreur lors du chargement des détails', 'error');
    }
}

function displayTrajetDetails(trajet) {
    const container = document.getElementById('trajetDetails');
    if (!container) return;
    
    const isAvailable = trajet.places_disponibles > 0 && trajet.disponible;
    const date = new Date(trajet.date_depart);
    const isPast = date < new Date();
    
    container.innerHTML = `
        <div class="card shadow-sm">
            <div class="card-body p-4">
                <div class="row">
                    <div class="col-md-8">
                        <div class="d-flex align-items-center gap-3 mb-3">
                            <h4 class="mb-0">
                                <i class="bi bi-geo-alt text-warning"></i>
                                ${trajet.lieu_depart}
                            </h4>
                            <i class="bi bi-arrow-right fs-4 text-muted"></i>
                            <h4 class="mb-0">
                                ${trajet.lieu_arrivee}
                                <i class="bi bi-geo-alt text-warning ms-1"></i>
                            </h4>
                        </div>
                        
                        <div class="row g-3 mt-2">
                            <div class="col-md-6">
                                <div class="info-item">
                                    <i class="bi bi-calendar3 text-primary"></i>
                                    <span class="fw-bold">Date:</span>
                                    ${date.toLocaleDateString('fr-FR', { 
                                        weekday: 'long', 
                                        day: 'numeric', 
                                        month: 'long', 
                                        year: 'numeric' 
                                    })}
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="info-item">
                                    <i class="bi bi-clock text-primary"></i>
                                    <span class="fw-bold">Heure:</span>
                                    ${trajet.heure_depart}
                                    ${trajet.heure_arrivee ? `→ ${trajet.heure_arrivee}` : ''}
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="info-item">
                                    <i class="bi bi-people text-primary"></i>
                                    <span class="fw-bold">Places disponibles:</span>
                                    <span class="${trajet.places_disponibles < 5 ? 'text-warning' : 'text-success'}">
                                        ${trajet.places_disponibles} / ${trajet.places_totales}
                                    </span>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="info-item">
                                    <i class="bi bi-truck text-primary"></i>
                                    <span class="fw-bold">Véhicule:</span>
                                    ${trajet.vehicules?.marque || 'N/A'} 
                                    ${trajet.vehicules?.modele || ''}
                                    (${trajet.vehicules?.capacite || 0} places)
                                </div>
                            </div>
                            ${trajet.region ? `
                                <div class="col-md-6">
                                    <div class="info-item">
                                        <i class="bi bi-pin-map text-primary"></i>
                                        <span class="fw-bold">Région:</span>
                                        ${trajet.region}
                                    </div>
                                </div>
                            ` : ''}
                            ${trajet.vehicules?.cooperative ? `
                                <div class="col-md-6">
                                    <div class="info-item">
                                        <i class="bi bi-building text-primary"></i>
                                        <span class="fw-bold">Coopérative:</span>
                                        ${trajet.vehicules.cooperative}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        
                        ${trajet.description ? `
                            <div class="mt-3 p-3 bg-light rounded">
                                <p class="mb-0">${trajet.description}</p>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="col-md-4">
                        <div class="p-3 bg-light rounded h-100 d-flex flex-column justify-content-center text-center">
                            <div class="price-display">
                                <span class="display-4 fw-bold text-primary">${trajet.prix.toLocaleString()}</span>
                                <span class="text-muted">Ar</span>
                            </div>
                            <p class="text-muted mb-2">par passager</p>
                            
                            ${isPast ? `
                                <div class="alert alert-warning mb-0">
                                    <i class="bi bi-clock-history me-2"></i>
                                    Ce trajet est déjà passé
                                </div>
                            ` : !isAvailable ? `
                                <div class="alert alert-danger mb-0">
                                    <i class="bi bi-x-circle me-2"></i>
                                    Complet ou indisponible
                                </div>
                            ` : `
                                <button class="btn btn-warning btn-lg w-100" id="reserveBtn" 
                                        ${!currentUser ? 'disabled' : ''}>
                                    <i class="bi bi-check-circle me-2"></i>
                                    ${currentUser ? 'Réserver maintenant' : 'Connectez-vous pour réserver'}
                                </button>
                                ${!currentUser ? `
                                    <small class="text-muted d-block mt-2">
                                        <a href="#" onclick="showLoginModal()">Se connecter</a>
                                    </small>
                                ` : ''}
                            `}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Réattacher l'événement du bouton de réservation
    const reserveBtn = document.getElementById('reserveBtn');
    if (reserveBtn) {
        reserveBtn.addEventListener('click', function() {
            if (!currentUser) {
                showLoginModal();
                return;
            }
            openReservationModal();
        });
    }
}

// ============================================================
// 6. MODAL DE RÉSERVATION
// ============================================================

function openReservationModal() {
    if (!selectedTrajet) {
        showToast('Veuillez sélectionner un trajet', 'warning');
        return;
    }
    
    if (selectedTrajet.places_disponibles <= 0) {
        showToast('Ce trajet est complet', 'error');
        return;
    }
    
    // Remplir les détails de la réservation
    document.getElementById('reservationTrajetInfo').innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <div>
                <h6 class="mb-1">
                    <i class="bi bi-geo-alt text-warning"></i>
                    ${selectedTrajet.lieu_depart} → ${selectedTrajet.lieu_arrivee}
                </h6>
                <p class="mb-0 text-muted small">
                    <i class="bi bi-calendar3 me-1"></i>
                    ${new Date(selectedTrajet.date_depart).toLocaleDateString('fr-FR')}
                    <span class="mx-2">|</span>
                    <i class="bi bi-clock me-1"></i>
                    ${selectedTrajet.heure_depart}
                </p>
            </div>
            <div class="text-end">
                <span class="badge bg-success">${selectedTrajet.places_disponibles} places</span>
            </div>
        </div>
    `;
    
    // Réinitialiser le nombre de passagers
    const passagersInput = document.getElementById('reservationPassagers');
    if (passagersInput) {
        passagersInput.value = 1;
        passagersInput.max = Math.min(selectedTrajet.places_disponibles, 10);
    }
    
    // Générer les sièges
    generateSieges();
    
    // Mettre à jour le prix
    updatePrice();
    
    // Ouvrir le modal
    const modal = new bootstrap.Modal(document.getElementById('reservationModal'));
    modal.show();
}

function generateSieges() {
    const container = document.getElementById('siegeContainer');
    if (!container) return;
    
    const totalSieges = Math.min(selectedTrajet.places_totales || 20, 30);
    const occupiedSieges = selectedTrajet.places_totales - selectedTrajet.places_disponibles;
    
    // Simuler des sièges occupés (pour la démonstration)
    const occupiedSet = new Set();
    while (occupiedSet.size < occupiedSieges) {
        occupiedSet.add(Math.floor(Math.random() * totalSieges) + 1);
    }
    
    container.innerHTML = `
        <div class="siege-grid">
            <div class="siege-grid-header">
                <span>Écran</span>
            </div>
            <div class="siege-grid-body">
                ${Array.from({ length: totalSieges }, (_, i) => {
                    const num = i + 1;
                    const isOccupied = occupiedSet.has(num);
                    const isSelected = selectedSieges.includes(num);
                    return `
                        <div class="siege ${isOccupied ? 'occupied' : isSelected ? 'selected' : 'available'}"
                             data-siege="${num}"
                             ${isOccupied ? 'style="cursor:not-allowed;"' : ''}>
                            ${num}
                            ${isOccupied ? '<i class="bi bi-x-circle"></i>' : ''}
                            ${isSelected ? '<i class="bi bi-check-circle-fill"></i>' : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        <div class="siege-legend mt-3">
            <span><span class="siege-legend-color available"></span> Disponible</span>
            <span><span class="siege-legend-color selected"></span> Sélectionné</span>
            <span><span class="siege-legend-color occupied"></span> Occupé</span>
        </div>
    `;
    
    // Réattacher les événements
    container.querySelectorAll('.siege.available').forEach(s => {
        s.addEventListener('click', function() {
            toggleSiegeSelection(this);
        });
    });
}

function toggleSiegeSelection(siegeElement) {
    if (!siegeElement || siegeElement.classList.contains('occupied')) return;
    
    const num = parseInt(siegeElement.dataset.siege);
    const index = selectedSieges.indexOf(num);
    
    if (index > -1) {
        selectedSieges.splice(index, 1);
        siegeElement.classList.remove('selected');
        siegeElement.innerHTML = num;
    } else {
        // Vérifier la limite de passagers
        const passagers = parseInt(document.getElementById('reservationPassagers').value) || 1;
        if (selectedSieges.length >= passagers) {
            showToast(`Vous ne pouvez sélectionner que ${passagers} siège(s)`, 'warning');
            return;
        }
        selectedSieges.push(num);
        siegeElement.classList.add('selected');
        siegeElement.innerHTML = `${num} <i class="bi bi-check-circle-fill"></i>`;
    }
    
    updatePrice();
}

function updatePrice() {
    const passagers = parseInt(document.getElementById('reservationPassagers').value) || 1;
    const prixUnitaire = selectedTrajet?.prix || 0;
    const total = passagers * prixUnitaire;
    const siegeCount = selectedSieges.length;
    
    document.getElementById('reservationTotal').textContent = total.toLocaleString() + ' Ar';
    document.getElementById('reservationPassagersCount').textContent = passagers;
    document.getElementById('reservationSiegesCount').textContent = siegeCount > 0 ? siegeCount : 'Aucun';
}

// ============================================================
// 7. CONFIRMATION DE RÉSERVATION
// ============================================================

async function confirmReservation() {
    if (!currentUser) {
        showToast('Veuillez vous connecter', 'warning');
        return;
    }
    
    if (!selectedTrajet) {
        showToast('Aucun trajet sélectionné', 'error');
        return;
    }
    
    const nombrePassagers = parseInt(document.getElementById('reservationPassagers').value) || 1;
    
    // Valider
    if (nombrePassagers < 1) {
        showToast('Nombre de passagers invalide', 'warning');
        return;
    }
    
    if (nombrePassagers > selectedTrajet.places_disponibles) {
        showToast(`Seulement ${selectedTrajet.places_disponibles} places disponibles`, 'warning');
        return;
    }
    
    // Confirmation
    if (!confirm(`Confirmer la réservation de ${nombrePassagers} passager(s) pour ${selectedTrajet.lieu_depart} → ${selectedTrajet.lieu_arrivee} ?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/client/reserver`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({
                trajet_id: selectedTrajet.id,
                nombre_passagers: nombrePassagers,
                siege_ids: selectedSieges
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Erreur lors de la réservation');
        }
        
        // Fermer le modal
        bootstrap.Modal.getInstance(document.getElementById('reservationModal')).hide();
        
        // Afficher le succès
        showSuccessModal(result);
        
        // Recharger les données
        loadTrajets();
        loadTrajetDetails(selectedTrajet.id);
        
        // Réinitialiser
        selectedSieges = [];
        
    } catch (error) {
        console.error('Erreur réservation:', error);
        showToast(error.message, 'error');
    }
}

function showSuccessModal(result) {
    const modal = document.getElementById('successModal');
    if (!modal) return;
    
    document.getElementById('successReservationId').textContent = result.reservation?.id?.substring(0, 8) || 'N/A';
    document.getElementById('successTrajet').textContent = 
        `${selectedTrajet.lieu_depart} → ${selectedTrajet.lieu_arrivee}`;
    document.getElementById('successDate').textContent = 
        new Date(selectedTrajet.date_depart).toLocaleDateString('fr-FR');
    document.getElementById('successPassagers').textContent = 
        document.getElementById('reservationPassagers').value || 1;
    document.getElementById('successTotal').textContent = 
        document.getElementById('reservationTotal').textContent || '0 Ar';
    
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

function resetReservationForm() {
    selectedSieges = [];
    document.getElementById('reservationPassagers').value = 1;
    document.getElementById('reservationTotal').textContent = '0 Ar';
}

// ============================================================
// 8. CHARGEMENT DES TRAJETS (initial)
// ============================================================

async function loadTrajets() {
    try {
        const response = await fetch(`${API_URL}/client/trajets`);
        const trajets = await response.json();
        displayTrajets(trajets);
    } catch (error) {
        console.error('Erreur chargement trajets:', error);
        showToast('Erreur lors du chargement des trajets', 'error');
    }
}

// ============================================================
// 9. MODALES D'AUTHENTIFICATION
// ============================================================

function showLoginModal() {
    const modal = new bootstrap.Modal(document.getElementById('loginModal'));
    modal.show();
}

// Login form
document.getElementById('loginForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Erreur de connexion');
        }
        
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        
        currentToken = result.token;
        currentUser = result.user;
        
        bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
        document.getElementById('loginForm').reset();
        
        updateUIForLoggedInUser();
        showToast('Connexion réussie !', 'success');
        
        // Recharger les trajets
        loadTrajets();
        if (selectedTrajet) {
            loadTrajetDetails(selectedTrajet.id);
        }
        
    } catch (error) {
        document.getElementById('loginError').textContent = error.message;
    }
});

// Register form
document.getElementById('registerForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const data = {
        nom: document.getElementById('regNom').value.trim(),
        prenom: document.getElementById('regPrenom').value.trim(),
        email: document.getElementById('regEmail').value.trim(),
        telephone: document.getElementById('regTelephone').value.trim(),
        password: document.getElementById('regPassword').value
    };
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Erreur d\'inscription');
        }
        
        bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide();
        document.getElementById('registerForm').reset();
        
        showToast('Inscription réussie ! Connectez-vous.', 'success');
        
        // Ouvrir la connexion
        const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
        loginModal.show();
        
    } catch (error) {
        document.getElementById('registerError').textContent = error.message;
    }
});

// ============================================================
// 10. TOAST NOTIFICATIONS
// ============================================================

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast-custom ${type}`;
    
    const icons = {
        success: 'bi-check-circle-fill text-success',
        error: 'bi-x-circle-fill text-danger',
        warning: 'bi-exclamation-triangle-fill text-warning',
        info: 'bi-info-circle-fill text-info'
    };
    
    toast.innerHTML = `
        <div class="d-flex align-items-center gap-3">
            <i class="bi ${icons[type] || icons.info} fs-4"></i>
            <span>${message}</span>
            <button class="btn-close ms-auto" onclick="this.parentElement.parentElement.remove()"></button>
        </div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// ============================================================
// 11. DÉCONNEXION
// ============================================================

function logout() {
    if (!confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) return;
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    currentToken = null;
    
    updateUIForLoggedInUser();
    loadTrajets();
    if (selectedTrajet) {
        loadTrajetDetails(selectedTrajet.id);
    }
    
    showToast('Déconnexion réussie', 'info');
}
