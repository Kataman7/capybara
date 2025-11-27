const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const INVOCATION_COOLDOWN_MS = 4 * 60 * 60 * 1000;
const invocationCooldowns = new Map();
const lobby = [];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invocation')
        .setDescription('Rejoindre l\'invocation (nécessite 3 joueurs, cooldown 4h)'),

    async execute(interaction, context) {
        const { db, ai } = context;
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // 1. Check Cooldown
        const lastInvocation = invocationCooldowns.get(userId);
        const now = Date.now();
        if (lastInvocation && (now - lastInvocation) < INVOCATION_COOLDOWN_MS) {
            const remaining = INVOCATION_COOLDOWN_MS - (now - lastInvocation);
            const hours = Math.floor(remaining / (60 * 60 * 1000));
            const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
            return interaction.reply({
                content: `⏳ Tu dois attendre encore ${hours}h ${minutes}m avant de pouvoir invoquer à nouveau.`,
                ephemeral: true
            });
        }

        // 2. Check Lobby
        if (lobby.find(p => p.userId === userId)) {
            return interaction.reply({
                content: 'Tu es déjà dans la file d\'attente pour l\'invocation !',
                ephemeral: true
            });
        }

        // 3. Add to Lobby
        // We store the interaction to potentially update it, but mostly we need the user info.
        // We can't really use the original interaction for the main event flow because it might expire (15 mins max).
        // We will send a new message to the channel when the invocation starts.
        lobby.push({
            userId,
            username: interaction.user.username,
            guildId,
            member: interaction.member
        });

        const currentCount = lobby.length;

        if (currentCount < 3) {
            return interaction.reply({
                content: `🕯️ Tu as rejoint le cercle d'invocation. (${currentCount}/3 joueurs)\nEn attente d'autres âmes courageuses...`
            });
        }

        // 4. Start Invocation (Lobby Full)
        // Extract players and clear lobby immediately to allow others to queue (though they will wait for next batch)
        const players = [...lobby];
        lobby.length = 0; // Clear global lobby

        // Set cooldowns immediately
        players.forEach(p => invocationCooldowns.set(p.userId, Date.now()));

        await interaction.reply({ content: `⚡ **L'invocation commence !** Les 3 âmes sont réunies : ${players.map(p => p.username).join(', ')}.` });

        try {
            await runInvocation(interaction.channel, players, context);
        } catch (error) {
            console.error('Error during invocation:', error);
            interaction.followUp({ content: 'Une perturbation mystique a interrompu le rituel (Erreur interne).' }).catch(() => { });
        }
    }
};

async function runInvocation(channel, players, context) {
    const { ai, db } = context;

    // 1. Generate Scenario
    const themes = [
        "Un danger écologique ou absurde menace le groupe.",
        "Une créature divine ou cosmique pose un dilemme moral ou écologique.",
        "Un événement naturel ou surnaturel bouleverse l'ordre du monde.",
        "Un rituel capybara doit être accompli pour sauver quelque chose.",
        "Un esprit ou animal demande une offrande ou une action inattendue.",
        "Une transformation étrange affecte les joueurs ou leur environnement.",
        "Un tribunal divin juge les actions passées des joueurs.",
        "Un défi de survie ou d'ingéniosité dans un monde déformé.",
        "Une invasion d'objets ou créatures absurdes perturbe la paix.",
        "Un capybara mystique propose un pacte ou une énigme."
    ];

    const selectedTheme = themes[Math.floor(Math.random() * themes.length)];

    const scenarioPrompt = [
        { role: 'system', content: 'Tu es l\'Oracle du Grand Capybara. Ta voix résonne comme le tonnerre, mais tes paroles sont empreintes d\'une sagesse absurde. Tu mélanges prophétie apocalyptique et conseils de jardinage. Ton but est de mettre les joueurs face à un danger imminent et ridicule.' },
        {
            role: 'user', content: `Génère une mise en situation courte (max 300 caractères) pour un rituel d'invocation impliquant 3 joueurs.
        
Thème imposé : "${selectedTheme}"

Le scénario doit être intense, surprenant et se terminer par une situation critique qui demande une réaction immédiate des joueurs. Ne donne pas la solution, pose juste le décor dramatique.` }
    ];

    let scenarioText = "Une entité mystérieuse apparaît...";
    try {
        const response = await ai.sendChat(scenarioPrompt);
        scenarioText = response.choices[0].message.content;
    } catch (e) {
        console.error("AI Error (Scenario):", e);
    }

    // 2. Send Scenario & Ask for Actions
    const embed = new EmbedBuilder()
        .setTitle('🔮 Rituel d\'Invocation')
        .setDescription(`**Scénario :**\n${scenarioText}\n\n**Joueurs :** ${players.map(p => p.username).join(', ')}\n\nVous avez 2 minutes pour décider de votre action !`)
        .setColor(0x9B59B6);

    const actionButtonId = `invocation_action_${Date.now()}`;
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(actionButtonId)
                .setLabel('Décrire mon action')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✨')
        );

    const message = await channel.send({ embeds: [embed], components: [row] });

    // 3. Collect Actions via Modal
    const playerActions = new Map(); // userId -> action text

    const collector = message.createMessageComponentCollector({
        filter: i => i.customId === actionButtonId && players.some(p => p.userId === i.user.id),
        time: 120000
    });

    collector.on('collect', async i => {
        if (playerActions.has(i.user.id)) {
            return i.reply({ content: 'Tu as déjà choisi ton destin !', ephemeral: true });
        }

        const modalId = `invocation_modal_${i.user.id}_${Date.now()}`;
        const modal = new ModalBuilder()
            .setCustomId(modalId)
            .setTitle('Ton Action');

        const actionInput = new TextInputBuilder()
            .setCustomId('action_input')
            .setLabel("Que fais-tu ?")
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(200)
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(actionInput);
        modal.addComponents(firstActionRow);

        await i.showModal(modal);

        // Wait for modal submit
        try {
            const submitted = await i.awaitModalSubmit({ time: 60000, filter: s => s.customId === modalId });
            const action = submitted.fields.getTextInputValue('action_input');

            playerActions.set(i.user.id, action);
            await submitted.reply({ content: 'Action enregistrée !', ephemeral: true });

            // If all players have acted, stop collector
            if (playerActions.size === players.length) {
                collector.stop('all_acted');
            }
        } catch (err) {
            // Modal timeout or error
        }
    });

    collector.on('end', async () => {
        // Disable button
        const disabledRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(actionButtonId)
                    .setLabel('Rituel en cours...')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
        await message.edit({ components: [disabledRow] });

        // Check if we have enough actions (at least 1)
        if (playerActions.size === 0) {
            return channel.send("Personne n'a osé bouger... L'invocation s'est dissipée.");
        }

        // 4. Resolve
        const actionsDescription = players.map((p, index) => {
            const action = playerActions.get(p.userId) || "Est resté tétanisé de peur.";
            return `Joueur ${index + 1} (${p.username}): ${action}`;
        }).join('\n');

        const resolutionPrompt = [
            { role: 'system', content: 'Tu es le Destin incarné sous la forme d\'un rongeur géant divin. Tu juges les âmes non pas sur leur pureté, mais sur leur panache, leur créativité et leur absurdité. Sois cruel avec les ennuyeux, et généreux avec les fous. Ton style est épique et théâtral.' },
            {
                role: 'user', content: `
Voici la situation critique de départ : "${scenarioText}"

Voici les actions tentées par les 3 mortels :
${actionsDescription}

Tâche :
1. Raconte la résolution de cette crise en 150 mots maximum. Décris comment les actions se combinent (ou échouent lamentablement). Sois drôle et inattendu.
2. Désigne le vainqueur (celui dont l'action a été la plus décisive, drôle ou "Capybara-compatible").

Format JSON attendu :
{
  "story": "...",
  "winner_index": 0
}
` }
        ];

        let story = "Le chaos règne...";
        let winnerIndex = 0;

        try {
            const response = await ai.sendChat(resolutionPrompt);
            let content = response.choices[0].message.content;
            // Clean up markdown code blocks if present
            content = content.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(content);
            story = result.story;
            winnerIndex = result.winner_index;
            if (typeof winnerIndex !== 'number' || winnerIndex < 0 || winnerIndex >= players.length) {
                winnerIndex = Math.floor(Math.random() * players.length);
            }
        } catch (e) {
            console.error("AI Error (Resolution):", e);
            story = "Les énergies étaient trop instables. Une explosion magique a tout soufflé, mais un survivant émerge des décombres.";
            winnerIndex = Math.floor(Math.random() * players.length);
        }

        const winner = players[winnerIndex];

        // 5. Apply Rewards
        // Winner: +1 Faith, +10 Ecology, Watermelons (Faith * 2000)
        let rewardText = "";
        try {
            // Get current faith to calculate watermelons
            const winnerFaithData = await db.getFaith(winner.guildId, winner.userId) || { faith_level: 0 };
            const currentFaith = winnerFaithData.faith_level || 0;

            // Calculate watermelon reward
            // "plusieurs milliers * la foi du gagnant"
            // If faith is 0 or negative, give a base amount (e.g. 1000) so it's not 0 or negative reward.
            const multiplier = Math.max(1, currentFaith);
            const watermelonReward = multiplier * 2000;

            await db.addFaith(winner.guildId, winner.userId, 1);
            await db.addEcologyPoints(winner.guildId, winner.userId, 10);
            await db.addWatermelon(winner.guildId, winner.userId, watermelonReward, true); // force=true to bypass clamp

            rewardText = `\n\n🏆 **Gagnant : ${winner.username}**\n` +
                `✨ +1 Foi\n` +
                `🌱 +10 Écologie\n` +
                `🍉 +${new Intl.NumberFormat('fr-FR').format(watermelonReward)} Watermelons`;

        } catch (err) {
            console.error("Error applying rewards:", err);
            rewardText = "\n\n(Erreur lors de la distribution des récompenses divines)";
        }

        // 6. Final Embed
        const resultEmbed = new EmbedBuilder()
            .setTitle('📜 Résultat de l\'Invocation')
            .setDescription(`**L'histoire :**\n${story}${rewardText}`)
            .setColor(0xF1C40F)
            .setFooter({ text: 'Les participants doivent se reposer 4h.' });

        await channel.send({ embeds: [resultEmbed] });
    });
}
