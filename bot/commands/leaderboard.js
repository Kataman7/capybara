const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription("Affiche le classement des watermelons et votre rang"),

    async execute(interaction, { db }) {
        try {
            const rows = await db.getProductionLeaderboard(interaction.guild.id, 10);
            if (!rows || rows.length === 0) {
                return interaction.reply({ content: 'Personne n\'a encore de production.', ephemeral: true });
            }

            const extended = await db.getProductionLeaderboard(interaction.guild.id, 1000);
            const userRankIndex = extended.findIndex(r => r.discord_id === interaction.user.id);
            const userRank = userRankIndex >= 0 ? userRankIndex + 1 : 0;
            const userScore = userRankIndex >= 0 ? extended[userRankIndex].total_score : 0;

            const lines = await Promise.all(rows.map(async (row, idx) => {
                let memberName = row.discord_id;
                try {
                    const member = await interaction.guild.members.fetch(row.discord_id);
                    memberName = member.displayName || member.user.username;
                } catch (err) {
                    // ignore missing member
                }
                const faithData = await db.getFaith(interaction.guild.id, row.discord_id) || { faith_level: 0, label: db.LEVELS['0'] };
                const highlightStart = row.discord_id === interaction.user.id ? '**→ ' : '';
                const highlightEnd = row.discord_id === interaction.user.id ? ' ←**' : '';
                return `${highlightStart}${idx + 1}. ${memberName} — ${formatNumber(row.total_score)} pts | ${faithData.label} (${faithData.faith_level})${highlightEnd}`;
            }));

            const embed = new EmbedBuilder()
                .setTitle('🏆 Top Production Totale')
                .setDescription(lines.join('\n'))
                .setFooter({
                    text: userRank > 0
                        ? `Votre rang : #${userRank} (${formatNumber(userScore)} pts)`
                        : 'Vous n\'êtes pas encore classé'
                });

            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            console.error('Error while fetching leaderboard:', err);
            await interaction.reply({ content: 'Impossible de récupérer le leaderboard (erreur serveur).', ephemeral: true });
        }
    }
};

function formatNumber(num) {
    return new Intl.NumberFormat('fr-FR').format(num || 0);
}
