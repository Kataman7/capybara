const { SlashCommandBuilder } = require('discord.js');
const trialService = require('../services/trialService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('defendre')
        .setDescription('Défendre contre une accusation')
        .addStringOption(option =>
            option
                .setName('defense')
                .setDescription('Ta défense contre l\'accusation')
                .setRequired(true)
                .setMaxLength(500)
        ),

    async execute(interaction) {
        const defense = interaction.options.getString('defense');

        const result = trialService.defend(
            interaction.guild.id,
            interaction.user.id,
            defense
        );

        if (!result.success) {
            return interaction.reply({
                content: `❌ ${result.reason}`,
                ephemeral: true
            });
        }

        const trial = trialService.getTrial(interaction.guild.id, interaction.user.id);

        await interaction.reply({
            content: `🛡️ **DÉFENSE ENREGISTRÉE**\n\n${interaction.user} a présenté sa défense :\n\n*"${defense}"*\n\nLe procès est maintenant prêt. <@${trial.accuser}> peut lancer le jugement avec \`/proces\` !`
        });
    }
};
