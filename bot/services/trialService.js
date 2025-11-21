// Service pour gérer les accusations et procès
class TrialService {
    constructor() {
        // Map: guildId -> Map(accusedUserId -> { accuser, crime, defense })
        this.pendingTrials = new Map();
    }

    // Créer une accusation
    accuse(guildId, accuserId, accusedId, crime) {
        if (!this.pendingTrials.has(guildId)) {
            this.pendingTrials.set(guildId, new Map());
        }

        const guildTrials = this.pendingTrials.get(guildId);
        
        // Vérifier si l'accusé a déjà une affaire en cours
        if (guildTrials.has(accusedId)) {
            return { success: false, reason: 'Cette personne a déjà une accusation en cours.' };
        }

        guildTrials.set(accusedId, {
            accuser: accuserId,
            crime,
            defense: null,
            timestamp: Date.now()
        });

        return { success: true };
    }

    // Ajouter une défense
    defend(guildId, userId, defense) {
        if (!this.pendingTrials.has(guildId)) {
            return { success: false, reason: 'Aucune accusation trouvée.' };
        }

        const guildTrials = this.pendingTrials.get(guildId);
        const trial = guildTrials.get(userId);

        if (!trial) {
            return { success: false, reason: 'Vous n\'avez pas d\'accusation en cours.' };
        }

        if (trial.defense) {
            return { success: false, reason: 'Vous avez déjà fourni votre défense.' };
        }

        trial.defense = defense;
        return { success: true };
    }

    // Récupérer un procès
    getTrial(guildId, userId) {
        if (!this.pendingTrials.has(guildId)) {
            return null;
        }

        return this.pendingTrials.get(guildId).get(userId) || null;
    }

    // Vérifier si un procès est prêt
    isTrialReady(guildId, userId) {
        const trial = this.getTrial(guildId, userId);
        return trial && trial.defense !== null;
    }

    // Supprimer un procès
    clearTrial(guildId, userId) {
        if (!this.pendingTrials.has(guildId)) {
            return;
        }

        this.pendingTrials.get(guildId).delete(userId);
    }

    // Obtenir toutes les affaires en cours pour une guilde
    getGuildTrials(guildId) {
        if (!this.pendingTrials.has(guildId)) {
            return [];
        }

        const guildTrials = this.pendingTrials.get(guildId);
        const trials = [];

        for (const [accusedId, trial] of guildTrials.entries()) {
            trials.push({
                accusedId,
                ...trial
            });
        }

        return trials;
    }
}

module.exports = new TrialService();
