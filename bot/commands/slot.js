const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const { PRODUCTION_CHAIN } = require('../../productionChain');

// Cooldown de 5 minutes
const SLOT_COOLDOWN_MS = 5 * 60 * 1000;
const slotCooldowns = new Map();

// Probabilités de base pour chaque niveau (du plus commun au plus rare)
const BASE_SLOT_WEIGHTS = [
    { id: 'watermelon_count', weight: 50 },       // 🍉 commun
    { id: 'presse_melon', weight: 30 },           // 🔧
    { id: 'jardin_melonifique', weight: 18 },     // 🌱
    { id: 'multiplicateur_agricolyte', weight: 8 }, // ⚙️
    { id: 'serre_auto_multipliee', weight: 4 },   // 🏗️
    { id: 'usine_hydro_melonique', weight: 2 },   // 🏭
    { id: 'complexe_agricolo_energetique', weight: 0.8 }, // ⚡
    { id: 'megastructure_melonospherique', weight: 0.3 }, // 🌐
    { id: 'terraformeur_fruito_spherique', weight: 0.1 }, // 🪐
    { id: 'architecte_quantique_melon', weight: 0.03 },   // 🔮
    { id: 'matrice_originelle_fruits', weight: 0.008 },   // ✨
    { id: 'coeur_cosmique_watermelon', weight: 0.002 }    // 💫 ultra rare
];

// Calculer les poids ajustés selon foi et écologie
// Foi: -5 à 20 → bonus de 0.7x à 1.5x sur les items rares
// Écologie: bonus additionnel basé sur les points (chaque 10 pts = +5% de chance sur les rares)
function getAdjustedWeights(faithLevel, ecologyPoints) {
    // Normaliser la foi : -5 → 0.7, 0 → 1.0, 20 → 1.5
    const faithBonus = 1 + ((faithLevel + 5) / 25) * 0.5; // 0.7 à 1.5
    
    // Bonus écologie : chaque 10 points = +5% (max +50%)
    const ecoBonus = 1 + Math.min(0.5, (ecologyPoints / 10) * 0.05);
    
    const totalBonus = faithBonus * ecoBonus;
    
    return BASE_SLOT_WEIGHTS.map((item, index) => {
        // Les items rares (index > 5) bénéficient plus du bonus
        if (index <= 1) {
            // Watermelon et Presse-Melon : légèrement réduits si bon bonus
            return { ...item, weight: item.weight / (totalBonus * 0.3 + 0.7) };
        } else if (index <= 5) {
            // Items moyens : bonus modéré
            return { ...item, weight: item.weight * (totalBonus * 0.5 + 0.5) };
        } else {
            // Items rares : bonus complet
            return { ...item, weight: item.weight * totalBonus };
        }
    });
}

// Obtenir un item aléatoire basé sur les poids ajustés
function getRandomItem(faithLevel, ecologyPoints) {
    const adjustedWeights = getAdjustedWeights(faithLevel, ecologyPoints);
    const totalWeight = adjustedWeights.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const item of adjustedWeights) {
        random -= item.weight;
        if (random <= 0) {
            return {
                item: PRODUCTION_CHAIN.find(p => p.id === item.id),
                adjustedWeights
            };
        }
    }
    return { 
        item: PRODUCTION_CHAIN[0], 
        adjustedWeights 
    };
}

// Obtenir un emoji aléatoire pour l'animation
function getRandomEmoji() {
    const randomIndex = Math.floor(Math.random() * PRODUCTION_CHAIN.length);
    return PRODUCTION_CHAIN[randomIndex].emoji;
}

// Générer une frame d'animation
function generateFrame(slot1, slot2, slot3) {
    return `🎰  ${slot1}  │  ${slot2}  │  ${slot3}  🎰`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slot')
        .setDescription('🎰 Machine à sous - Tente ta chance toutes les 5 minutes !'),

    async execute(interaction, { db }) {
        const key = `${interaction.guild.id}:${interaction.user.id}`;
        const now = Date.now();
        const last = slotCooldowns.get(key);
        
        if (last && (now - last) < SLOT_COOLDOWN_MS) {
            const remaining = SLOT_COOLDOWN_MS - (now - last);
            const mins = Math.floor(remaining / 60000);
            const secs = Math.ceil((remaining % 60000) / 1000);
            return interaction.reply({ 
                content: `🎰 Tu dois attendre encore ${mins}m ${secs}s avant de rejouer !`, 
                ephemeral: true 
            });
        }

        await interaction.deferReply();
        slotCooldowns.set(key, now);

        // Récupérer les stats du joueur
        const faithData = await db.getFaith(interaction.guild.id, interaction.user.id) || { faith_level: 0, ecology_points: 0 };
        const faithLevel = faithData.faith_level || 0;
        const ecologyPoints = faithData.ecology_points || 0;

        // Déterminer le résultat final avec bonus
        const { item: result, adjustedWeights } = getRandomItem(faithLevel, ecologyPoints);
        const resultEmoji = result.emoji;

        // Animation : 5 frames
        const frames = [];
        for (let i = 0; i < 5; i++) {
            if (i < 2) {
                // Tout défile
                frames.push([getRandomEmoji(), getRandomEmoji(), getRandomEmoji()]);
            } else if (i === 2) {
                // Premier slot se fixe
                frames.push([resultEmoji, getRandomEmoji(), getRandomEmoji()]);
            } else if (i === 3) {
                // Deuxième slot se fixe
                frames.push([resultEmoji, resultEmoji, getRandomEmoji()]);
            } else {
                // Tout est fixé
                frames.push([resultEmoji, resultEmoji, resultEmoji]);
            }
        }

        // Afficher l'animation
        const spinEmbed = new EmbedBuilder()
            .setTitle('🎰 Machine à Sous du Capybara')
            .setDescription(generateFrame('❓', '❓', '❓'))
            .setColor(0xFFD700);

        const message = await interaction.editReply({ embeds: [spinEmbed] });

        // Jouer l'animation
        for (let i = 0; i < frames.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 600));
            const [s1, s2, s3] = frames[i];
            spinEmbed.setDescription(generateFrame(s1, s2, s3));
            await message.edit({ embeds: [spinEmbed] });
        }

        // Pause dramatique
        await new Promise(resolve => setTimeout(resolve, 800));

        // Ajouter la ressource gagnée
        if (result.id === 'watermelon_count') {
            // Pour les watermelons, on en donne entre 1 et 5
            const amount = Math.floor(Math.random() * 5) + 1;
            await db.addWatermelon(interaction.guild.id, interaction.user.id, amount);
            
            // Calculer le bonus affiché
            const faithBonus = 1 + ((faithLevel + 5) / 25) * 0.5;
            const ecoBonus = 1 + Math.min(0.5, (ecologyPoints / 10) * 0.05);
            const totalBonus = ((faithBonus * ecoBonus - 1) * 100).toFixed(0);
            
            const finalEmbed = new EmbedBuilder()
                .setTitle('🎰 Machine à Sous du Capybara')
                .setDescription(generateFrame(resultEmoji, resultEmoji, resultEmoji))
                .addFields(
                    { name: '🎉 Résultat', value: `Tu as gagné **${amount}x ${result.emoji} ${result.name}** !` },
                    { name: '📈 Bonus chance', value: `Foi ${faithLevel} + Éco ${ecologyPoints} = **+${totalBonus}%** sur les rares`, inline: true }
                )
                .setColor(0x00FF00);
            
            await message.edit({ embeds: [finalEmbed] });
        } else {
            // Pour les autres ressources, on donne 1
            await db.updateResource(interaction.guild.id, interaction.user.id, result.id, 
                (await db.getProduction(interaction.guild.id, interaction.user.id))[result.id] + 1);
            
            // Calculer la rareté avec les poids ajustés
            const weightInfo = adjustedWeights.find(w => w.id === result.id);
            const totalWeight = adjustedWeights.reduce((sum, item) => sum + item.weight, 0);
            const probability = ((weightInfo.weight / totalWeight) * 100).toFixed(2);
            
            // Calculer le bonus affiché
            const faithBonus = 1 + ((faithLevel + 5) / 25) * 0.5;
            const ecoBonus = 1 + Math.min(0.5, (ecologyPoints / 10) * 0.05);
            const totalBonus = ((faithBonus * ecoBonus - 1) * 100).toFixed(0);
            
            let rarityText = '';
            if (probability < 0.1) rarityText = '💎 **LÉGENDAIRE** 💎';
            else if (probability < 0.5) rarityText = '✨ **ÉPIQUE** ✨';
            else if (probability < 2) rarityText = '🟣 **RARE**';
            else if (probability < 10) rarityText = '🔵 **PEU COMMUN**';
            else rarityText = '🟢 **COMMUN**';

            const finalEmbed = new EmbedBuilder()
                .setTitle('🎰 Machine à Sous du Capybara')
                .setDescription(generateFrame(resultEmoji, resultEmoji, resultEmoji))
                .addFields(
                    { name: '🎉 Résultat', value: `Tu as gagné **1x ${result.emoji} ${result.name}** !` },
                    { name: '📊 Rareté', value: `${rarityText} (${probability}%)`, inline: true },
                    { name: '📈 Bonus chance', value: `Foi ${faithLevel} + Éco ${ecologyPoints} = **+${totalBonus}%**`, inline: true }
                )
                .setColor(probability < 0.5 ? 0xFF00FF : (probability < 2 ? 0x9B59B6 : 0x00FF00));
            
            await message.edit({ embeds: [finalEmbed] });
        }
    }
};
