const { SlashCommandBuilder } = require('discord.js');
const trialService = require('../services/trialService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('accuser')
        .setDescription('Accuser un utilisateur d\'un crime devant le dieu Capybara')
        .addUserOption(option =>
            option
                .setName('utilisateur')
                .setDescription('L\'utilisateur à accuser')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('crime')
                .setDescription('Description du crime commis')
                .setRequired(true)
                .setMaxLength(500)
        ),

    async execute(interaction) {
        const accused = interaction.options.getUser('utilisateur');
        const crime = interaction.options.getString('crime');

        // Vérifier qu'on ne s'accuse pas soi-même
        if (accused.id === interaction.user.id) {
            return interaction.reply({
                content: 'Tu ne peux pas t\'accuser toi-même devant le dieu Capybara.',
                ephemeral: true
            });
        }

        // Vérifier qu'on n'accuse pas le bot
        if (accused.bot) {
            return interaction.reply({
                content: 'Tu ne peux pas accuser le dieu Capybara ou ses serviteurs divins.',
                ephemeral: true
            });
        }

        const result = trialService.accuse(
            interaction.guild.id,
            interaction.user.id,
            accused.id,
            crime
        );

        if (!result.success) {
            return interaction.reply({
                content: `❌ ${result.reason}`,
                ephemeral: true
            });
        }

        await interaction.reply({
            content: `⚖️ **ACCUSATION DEVANT LE DIEU CAPYBARA**\n\n${interaction.user} accuse ${accused} du crime suivant :\n\n*"${crime}"*\n\n${accused}, utilise \`/defendre\` pour présenter ta défense avant que le procès ne commence !`
        });
    }
};
