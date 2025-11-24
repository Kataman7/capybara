const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const trialService = require('../services/trialService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('proces')
        .setDescription('Lancer le jugement divin d\'un procès'),

    async execute(interaction, context) {
        const { ai, db, settings } = context;

        // Vérifier s'il y a un procès prêt initié par cet utilisateur
        const guildTrials = trialService.getGuildTrials(interaction.guild.id);
        
        let targetTrial = null;
        let accusedId = null;
        
        for (const trial of guildTrials) {
            if (trial.accuser === interaction.user.id && trial.defense) {
                targetTrial = trial;
                accusedId = trial.accusedId;
                break;
            }
        }
        
        if (!targetTrial) {
            return interaction.reply({
                content: '❌ Tu n\'as aucun procès prêt à être jugé. Utilise `/accuser` d\'abord, et attends que l\'accusé se défende.',
                ephemeral: true
            });
        }

        await interaction.deferReply();

        // Récupérer les données écologiques des deux parties
        const accuserData = await db.getFaith(interaction.guild.id, targetTrial.accuser) || { ecology_points: 0, faith_level: 0 };
        const accusedData = await db.getFaith(interaction.guild.id, accusedId) || { ecology_points: 0, faith_level: 0 };

        // Préparer le prompt pour l'IA
        const trialPrompt = `Tu es le dieu Capybara, juge suprême et équitable. Un procès se déroule devant toi.

ACCUSATEUR : <@${targetTrial.accuser}>
- Points d'écologie : ${accuserData.ecology_points}
- Niveau de foi : ${accuserData.faith_level}

ACCUSÉ : <@${accusedId}>
- Points d'écologie : ${accusedData.ecology_points}
- Niveau de foi : ${accusedData.faith_level}

CRIME ALLÉGUÉ :
"${targetTrial.crime}"

DÉFENSE DE L'ACCUSÉ :
"${targetTrial.defense}"

Prends en compte les points d'écologie et la foi de chacun pour juger leur crédibilité et leur respect de la nature.

Tu dois juger ce procès avec sagesse. Analyse les arguments et détermine le verdict.

Retourne UNIQUEMENT un objet JSON avec :
- verdict: "accuser" (l'accusateur a raison), "accuse" (l'accusé est innocent, l'accusateur a tort), ou "draw" (les deux ont tort)
- recit: un récit dramatique du déroulé du procès en français (40-80 mots)
- jugement: une phrase dramatique de jugement final en français (20-30 mots)
- raison: courte explication de ta décision (10-20 mots)`;

        try {
            // Préparer le prompt système (gérer le cas où c'est un array)
            const systemPrompt = Array.isArray(settings.promptSystem) 
                ? settings.promptSystem.join('\n') 
                : (settings.promptSystem || 'Tu es le dieu Capybara, juge suprême.');

            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: trialPrompt }
            ];

            const completion = await ai.sendChat(messages, process.env.AI_MODEL || 'gpt-3.5-turbo');
            const raw = completion.choices[0].message.content;
            
            let cleanedRaw = raw.trim();
            if (cleanedRaw.startsWith('```')) {
                cleanedRaw = cleanedRaw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
            }

            let result;
            try {
                result = JSON.parse(cleanedRaw);
            } catch (err) {
                // Fallback en cas d'erreur de parsing
                result = {
                    verdict: 'draw',
                    recit: 'Le procès se déroule dans une confusion totale. Les arguments s\'entremêlent sans clarté.',
                    jugement: 'Le dieu Capybara ne peut trancher ce procès. Les deux parties sont jugées également responsables.',
                    raison: 'Verdict indéterminé par manque de clarté divine.'
                };
            }

            // Déterminer le perdant selon le verdict
            let loserId = null;
            let winnerText = '';
            
            if (result.verdict === 'accuser') {
                // L'accusateur a gagné, l'accusé perd
                loserId = accusedId;
                winnerText = `⚖️ **VERDICT : COUPABLE**\n\n<@${accusedId}> est reconnu coupable !`;
            } else if (result.verdict === 'accuse') {
                // L'accusé est innocent, l'accusateur perd
                loserId = targetTrial.accuser;
                winnerText = `⚖️ **VERDICT : INNOCENT**\n\n<@${accusedId}> est innocent ! <@${targetTrial.accuser}> est puni pour fausse accusation.`;
            } else {
                // Draw - les deux perdent
                winnerText = `⚖️ **VERDICT : DOUBLE PUNITION**\n\nLes deux parties sont reconnues coupables !`;
            }

            // Appliquer la pénalité de foi
            if (result.verdict === 'draw') {
                // Les deux perdent -1 foi
                await db.addFaith(interaction.guild.id, targetTrial.accuser, -1);
                await db.addFaith(interaction.guild.id, accusedId, -1);
            } else if (loserId) {
                // Un seul perd -1 foi
                await db.addFaith(interaction.guild.id, loserId, -1);
            }

            // Construire l'embed du verdict
            const verdictEmbed = new EmbedBuilder()
                .setColor(result.verdict === 'draw' ? 0xFF6B6B : (result.verdict === 'accuser' ? 0x4ECDC4 : 0x95E1D3))
                .setTitle('⚖️ JUGEMENT DIVIN DU CAPYBARA ⚖️')
                .setDescription(winnerText)
                .addFields(
                    { name: '📖 Déroulé du Procès', value: result.recit || 'Le procès se déroule devant le dieu Capybara.', inline: false },
                    { name: '📜 Jugement', value: result.jugement || 'Le verdict est rendu.', inline: false },
                    { name: '🔍 Raison', value: result.raison || 'Ainsi en a décidé le dieu Capybara.', inline: false }
                )
                .setFooter({ text: 'La foi du/des coupable(s) a été diminuée de 1 point.' })
                .setTimestamp();

            await interaction.editReply({ embeds: [verdictEmbed] });

            // Nettoyer le procès
            trialService.clearTrial(interaction.guild.id, accusedId);

        } catch (error) {
            console.error('Erreur lors du jugement du procès:', error);
            await interaction.editReply({
                content: '❌ Une erreur est survenue lors du jugement divin. Le dieu Capybara est troublé.'
            });
        }
    }
};
