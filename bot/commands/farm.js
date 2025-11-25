const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const { getProducers, getLevel } = require('../../productionChain');

const clampDelta = (value) => {
    const parsed = parseInt(value ?? 0, 10) || 0;
    if (parsed > 15) return 15;
    if (parsed < -15) return -15;
    return parsed;
};

const formatNumber = (num) => {
    return new Intl.NumberFormat('fr-FR').format(num || 0);
};

const createShuffledChoices = (choices = []) => {
    const jitterRange = 2; // keep outcomes close while hiding the obviously "best" option
    return choices
        .map((choice, idx) => {
            const base = parseInt(choice?.base_delta ?? 0, 10) || 0;
            const jitter = Math.floor(Math.random() * (jitterRange * 2 + 1)) - jitterRange; // [-2, 2]
            return {
                text: (choice?.text || 'Choix mystérieux').toString(),
                consequence: (choice?.consequence || 'Conséquence inconnue').toString(),
                base_delta: base,
                effective_delta: clampDelta(base + jitter),
                ecology_delta: parseInt(choice?.ecology_delta ?? 0, 10) || 0,
                displayIndex: idx,
                blessing: choice?.blessing || null
            };
        })
        .sort(() => Math.random() - 0.5);
};

// Cooldowns temporaires (pendant le choix) et définitifs (après le choix)
const pendingFarms = new Map(); // Mini-cooldown pendant qu'on attend la réponse

module.exports = {
    data: new SlashCommandBuilder()
        .setName('farm')
        .setDescription('Farmer des watermelons (cooldown variable)'),

    async execute(interaction, context) {
        const { db, scenarioService, watermelonCooldowns, WATERMELON_COOLDOWN_MS } = context;
        const key = `${interaction.guild.id}:${interaction.user.id}`;
        
        // Vérifier le vrai cooldown (après un choix fait)
        const last = watermelonCooldowns.get(key);
        const now = Date.now();
        if (last && (now - last) < WATERMELON_COOLDOWN_MS) {
            const remaining = WATERMELON_COOLDOWN_MS - (now - last);
            const mins = Math.ceil(remaining / 60000);
            return interaction.reply({ content: `Tu dois attendre encore ${mins} minutes avant de farmer à nouveau.`, ephemeral: true });
        }

        // Vérifier si un farm est déjà en cours (mini-cooldown)
        if (pendingFarms.has(key)) {
            return interaction.reply({ content: 'Tu as déjà un farm en cours ! Réponds d\'abord au choix précédent.', ephemeral: true });
        }

        await interaction.deferReply();
        
        // Marquer qu'un farm est en cours
        pendingFarms.set(key, now);

        try {
            const scenario = await scenarioService.generateScenario();
            const payload = scenario.payload;
            const arrangedChoices = createShuffledChoices(payload.choices);

            const embed = new EmbedBuilder()
                .setTitle(scenario.type.embedTitle)
                .setDescription(payload.scenario)
                .addFields(
                    { name: 'Choix A', value: arrangedChoices[0]?.text || '...', inline: true },
                    { name: 'Choix B', value: arrangedChoices[1]?.text || '...', inline: true }
                );

            const aId = `watermelon_choice:${interaction.guild.id}:${interaction.user.id}:0:${Date.now()}`;
            const bId = `watermelon_choice:${interaction.guild.id}:${interaction.user.id}:1:${Date.now()}`;
            const buttons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(aId).setLabel('Choix A').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(bId).setLabel('Choix B').setStyle(ButtonStyle.Secondary)
            );

            const message = await interaction.editReply({ embeds: [embed], components: [buttons] });
            const collector = message.createMessageComponentCollector({ time: 2 * 60 * 1000 });

            collector.on('collect', async componentInteraction => {
                if (componentInteraction.user.id !== interaction.user.id) {
                    return componentInteraction.reply({ content: 'Ce bouton n\'est pas pour toi.', ephemeral: true });
                }

                await componentInteraction.deferUpdate();
                const parts = componentInteraction.customId.split(':');
                const choiceIdx = parseInt(parts[3], 10);
                const choice = arrangedChoices[choiceIdx];
                if (!choice) {
                    return componentInteraction.followUp({ content: 'Choix invalide.', ephemeral: true });
                }

                const curFaith = await db.getFaith(interaction.guild.id, interaction.user.id) || { faith_level: 0, blessing_multiplier: 1, blessing_charges: 0 };
                const faith = curFaith.faith_level || 0;
                const activeBlessingMultiplier = parseFloat(curFaith.blessing_multiplier) || 1;
                const activeBlessingCharges = parseInt(curFaith.blessing_charges, 10) || 0;
                const luck = Math.max(0.4, Math.min(0.65, 0.5 + (faith / 100)));
                const roll = Math.random();

                let finalDelta = choice.effective_delta;
                if (choice.effective_delta !== 0) {
                    const variance = Math.floor(Math.abs(choice.effective_delta) * 0.2);
                    const delta = Math.floor(Math.random() * (variance + 1));
                    finalDelta = roll <= luck
                        ? choice.effective_delta + delta
                        : choice.effective_delta - delta;
                }

                finalDelta = clampDelta(finalDelta);

                let productionText = '';
                let blessingText = '';
                let scoreGained = 0;
                
                // Calculer le score AVANT toute modification
                const productionBefore = await db.getProduction(interaction.guild.id, interaction.user.id);
                const scoreBefore = db.calculateProductionScore(productionBefore);
                
                // Ajouter les watermelons du farm
                const after = await db.addWatermelon(interaction.guild.id, interaction.user.id, finalDelta);

                // Appliquer le delta écologique
                let ecologyText = '';
                if (choice.ecology_delta !== 0) {
                    const updatedFaith = await db.addEcologyPoints(interaction.guild.id, interaction.user.id, choice.ecology_delta);
                    const ecoIcon = choice.ecology_delta > 0 ? '🌱' : '🏭';
                    ecologyText = `\n${ecoIcon} **Écologie ** : ${updatedFaith.ecology_points} pts`;
                }

                if (finalDelta > 0) {
                    // Appliquer la production
                    await db.applyProduction(interaction.guild.id, interaction.user.id);
                    const productionAfter = await db.getProduction(interaction.guild.id, interaction.user.id);
                    const scoreAfter = db.calculateProductionScore(productionAfter);
                    scoreGained = scoreAfter - scoreBefore;

                    // Afficher le multiplicateur actif
                    if (activeBlessingCharges > 0 && activeBlessingMultiplier > 1) {
                        blessingText = `\n✨ **Bénédiction active x${activeBlessingMultiplier.toFixed(2)}** (${activeBlessingCharges} utilisation(s) restante(s))`;
                    }

                    const productionChanges = [];
                    for (const level of getProducers()) {
                        const produced = (productionAfter[level.produces.resource] || 0) - (productionBefore[level.produces.resource] || 0);
                        if (produced > 0) {
                            const producerLevel = getLevel(level.id);
                            const producedLevel = getLevel(level.produces.resource);
                            productionChanges.push(`${producerLevel.emoji} → +${produced} ${producedLevel.emoji}`);
                        }
                    }

                    if (productionChanges.length > 0) {
                        productionText = '\n\n**🏭 Production appliquée:**' + blessingText + '\n' + productionChanges.join('\n');
                    }
                } else if (finalDelta < 0) {
                    // Perte : le score gagné est négatif
                    scoreGained = finalDelta;
                }

                let grantedBlessingText = '';
                if (choice.blessing) {
                    const granted = await db.grantBlessing(
                        interaction.guild.id,
                        interaction.user.id,
                        choice.blessing.multiplier,
                        choice.blessing.charges
                    );
                    grantedBlessingText = `\n🔮 ${choice.blessing.message || 'Une bénédiction future a été accordée.'} (x${granted.blessing_multiplier.toFixed(2)} / ${granted.blessing_charges} utilisation(s))`;
                }

                const resultEmbed = new EmbedBuilder()
                    .setTitle(scenario.type.resultTitle)
                    .setDescription((choice.consequence || '') + ecologyText + productionText + grantedBlessingText)
                    .addFields(
                        { name: 'Gagné/perdu', value: `${finalDelta >= 0 ? '+' : ''}${finalDelta} 🍉`, inline: true },
                        { name: 'Score gagné', value: `${scoreGained >= 0 ? '+' : ''}${formatNumber(scoreGained)} pts`, inline: true }
                    );

                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(aId).setLabel('Choix A').setStyle(ButtonStyle.Primary).setDisabled(true),
                    new ButtonBuilder().setCustomId(bId).setLabel('Choix B').setStyle(ButtonStyle.Secondary).setDisabled(true)
                );

                await message.edit({ embeds: [embed], components: [disabledRow] });
                await componentInteraction.followUp({ embeds: [resultEmbed] });
                
                // Appliquer le vrai cooldown maintenant qu'un choix a été fait
                watermelonCooldowns.set(key, Date.now());
                pendingFarms.delete(key);
                
                collector.stop('done');
            });

            collector.on('end', async (_collected, reason) => {
                // Toujours supprimer le pending farm
                pendingFarms.delete(key);
                
                if (reason !== 'done') {
                    // Pas de cooldown si timeout - le joueur n'a pas fait de choix
                    try {
                        await interaction.followUp({ content: 'Temps écoulé — action abandonnée. Tu peux réessayer !', ephemeral: true });
                    } catch (err) {
                        console.error('Failed to send timeout notice:', err.message);
                    }
                }
            });
        } catch (err) {
            console.error('Error in farm flow:', err);
            pendingFarms.delete(key);
            try {
                await interaction.editReply({ content: 'Erreur pendant la tentative de farm (erreur serveur).' });
            } catch (_err) {
                await interaction.followUp({ content: 'Erreur pendant la tentative de farm (erreur serveur).', ephemeral: true });
            }
        }
    }
};
