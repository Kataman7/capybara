const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const OWNER_ID = '693374876815458346';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('eval')
        .setDescription('Évalue du code JavaScript')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(option => option.setName('code').setDescription('Le code à évaluer').setRequired(true)),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: 'Tu n\'as pas le droit d\'utiliser cette commande.', ephemeral: true });
        }

        const code = interaction.options.getString('code');
        try {
            // eslint-disable-next-line no-eval
            const result = eval(code);
            await interaction.reply({ content: `Résultat : ${result}` });
        } catch (error) {
            await interaction.reply({ content: `Erreur : ${error.message}` });
        }
    }
};
