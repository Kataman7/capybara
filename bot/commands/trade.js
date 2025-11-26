const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const CoinGecko = require('coingecko-api');
const cg = new CoinGecko();

// Configuration
const CRYPTO_ID = process.env.CRYPTO_ID || 'pepe';
const CRYPTO_NAME = CRYPTO_ID.toUpperCase();

// Cache simple pour éviter de spammer l'API (rate limits)
let lastPrice = 0;
let lastPriceTime = 0;
// Configurable via .env (ms). Set to 0 to disable caching completely.
const PRICE_CACHE_MS = Number(process.env.CRYPTO_PRICE_CACHE_MS ?? 60000);

async function getCryptoPrice(force = false) {
    const now = Date.now();
    if (!force && PRICE_CACHE_MS > 0 && lastPrice > 0 && (now - lastPriceTime) < PRICE_CACHE_MS) {
        return lastPrice;
    }

    try {
        const data = await cg.simple.price({
            ids: [CRYPTO_ID],
            vs_currencies: ['eur']
        });
        
        if (data.success && data.data[CRYPTO_ID] && data.data[CRYPTO_ID].eur) {
            lastPrice = data.data[CRYPTO_ID].eur;
            lastPriceTime = now;
            return lastPrice;
        }
    } catch (err) {
        console.error('Erreur CoinGecko:', err);
    }
    
    return lastPrice; // Retourne l'ancien prix si erreur, ou 0
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trade')
        .setDescription(`📈 Capy Bourse - Investis tes watermelons sur le cours du ${CRYPTO_NAME}`),

    async execute(interaction, { db }) {
        await interaction.deferReply();

        const price = await getCryptoPrice();
        if (!price || price <= 0) {
            return interaction.editReply(`❌ Impossible de récupérer le cours du ${CRYPTO_NAME} pour le moment. Réessaie plus tard.`);
        }

        const investment = await db.getInvestment(interaction.guild.id, interaction.user.id);
        const userResources = await db.getProduction(interaction.guild.id, interaction.user.id);
        const currentWatermelons = userResources.watermelon_count || 0;

        // Si le joueur a déjà un investissement
        if (investment) {
            const investedAmount = investment.invested_amount;
            const entryPrice = parseFloat(investment.entry_price);
            
            if (!entryPrice || entryPrice <= 0) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Erreur')
                    .setDescription('Valeur d\'entrée invalide pour cet investissement.')
                    .setColor(0xFF0000);
                await interaction.editReply({ embeds: [errorEmbed], components: [] });
                return;
            }

            // Calcul de la valeur actuelle
            const ratio = price / entryPrice;
            const currentValue = Math.floor(investedAmount * ratio);
            const profit = currentValue - investedAmount;
            const profitPercent = ((ratio - 1) * 100).toFixed(2);
            
            const isProfit = profit >= 0;
            const color = isProfit ? 0x00FF00 : 0xFF0000;
            const emoji = isProfit ? '📈' : '📉';

            const embed = new EmbedBuilder()
                .setTitle(`📈 Capy Bourse - Ton Investissement (${CRYPTO_NAME})`)
                .setDescription(`Tu as investi sur le ${CRYPTO_NAME} !`)
                .addFields(
                    { name: '💰 Investissement initial', value: `${investedAmount} 🍉`, inline: true },
                    { name: '🏷️ Prix d\'entrée', value: `${entryPrice.toFixed(10)} €`, inline: true },
                    { name: '💲 Prix actuel', value: `${price.toFixed(10)} €`, inline: true },
                    { name: '📊 Valeur actuelle', value: `**${currentValue} 🍉**`, inline: false },
                    { name: `${emoji} Profit/Perte`, value: `${profit > 0 ? '+' : ''}${profit} 🍉 (${profitPercent}%)`, inline: false }
                )
                .setColor(color)
                .setFooter({ text: `Le cours du ${CRYPTO_NAME} varie en temps réel !` });

            const withdrawBtn = new ButtonBuilder()
                .setCustomId('trade_withdraw')
                .setLabel('Retirer tout et encaisser')
                .setStyle(isProfit ? ButtonStyle.Success : ButtonStyle.Danger)
                .setEmoji('💸');

            const refreshBtn = new ButtonBuilder()
                .setCustomId('trade_refresh')
                .setLabel('Actualiser')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔄');

            const row = new ActionRowBuilder().addComponents(withdrawBtn, refreshBtn);

            const message = await interaction.editReply({ embeds: [embed], components: [row] });

            // Collector pour le bouton
            const collector = message.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: 'Ce n\'est pas ton investissement !', ephemeral: true });
                }

                if (i.customId === 'trade_refresh') {
                    await i.deferUpdate();
                    const newPrice = await getCryptoPrice(true); // Force refresh
                    if (!newPrice || newPrice <= 0) {
                        return i.followUp({ content: `❌ Impossible de récupérer le cours du ${CRYPTO_NAME} pour le moment. Réessaye plus tard.`, ephemeral: true });
                    }
                    
                    // Recalculer
                    const newRatio = newPrice / entryPrice;
                    const newCurrentValue = Math.floor(investedAmount * newRatio);
                    const newProfit = newCurrentValue - investedAmount;
                    const newProfitPercent = ((newRatio - 1) * 100).toFixed(2);
                    const newIsProfit = newProfit >= 0;
                    const newEmoji = newIsProfit ? '📈' : '📉';

                    const newEmbed = EmbedBuilder.from(embed)
                        .setFields(
                            { name: '💰 Investissement initial', value: `${investedAmount} 🍉`, inline: true },
                            { name: '🏷️ Prix d\'entrée', value: `${entryPrice.toFixed(10)} €`, inline: true },
                            { name: '💲 Prix actuel', value: `${newPrice.toFixed(10)} €`, inline: true },
                            { name: '📊 Valeur actuelle', value: `**${newCurrentValue} 🍉**`, inline: false },
                            { name: `${newEmoji} Profit/Perte`, value: `${newProfit > 0 ? '+' : ''}${newProfit} 🍉 (${newProfitPercent}%)`, inline: false }
                        )
                        .setColor(newIsProfit ? 0x00FF00 : 0xFF0000);
                    
                    await i.editReply({ embeds: [newEmbed] });
                }

                if (i.customId === 'trade_withdraw') {
                    await i.deferUpdate();
                    
                    // Prix au moment du clic (force refresh)
                    const finalPrice = await getCryptoPrice(true);
                    if (!finalPrice || finalPrice <= 0) {
                        return i.followUp({ content: `❌ Impossible de récupérer le cours du ${CRYPTO_NAME} pour le moment. Réessaye plus tard.`, ephemeral: true });
                    }
                    const finalRatio = finalPrice / entryPrice;
                    const finalValue = Math.floor(investedAmount * finalRatio);
                    const finalProfit = finalValue - investedAmount;

                    // Supprimer l'investissement
                    await db.removeInvestment(interaction.guild.id, interaction.user.id);
                    
                    // Ajouter les watermelons
                    await db.addWatermelon(interaction.guild.id, interaction.user.id, finalValue, true);

                    const resultEmbed = new EmbedBuilder()
                        .setTitle('💸 Retrait effectué')
                        .setDescription(`Tu as retiré ton investissement de la Capy Bourse.`)
                        .addFields(
                            { name: 'Investi', value: `${investedAmount} 🍉`, inline: true },
                            { name: 'Récupéré', value: `${finalValue} 🍉`, inline: true },
                            { name: 'Résultat', value: `${finalProfit > 0 ? '+' : ''}${finalProfit} 🍉`, inline: true },
                            { name: 'Cours final', value: `${finalPrice.toFixed(10)} €`, inline: true }
                        )
                        .setColor(finalProfit >= 0 ? 0x00FF00 : 0xFF0000);

                    await i.editReply({ embeds: [resultEmbed], components: [] });
                    collector.stop();
                }
            });

            collector.on('end', async () => {
                try {
                    const disabledRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('trade_withdraw').setLabel('Retirer tout et encaisser').setStyle(ButtonStyle.Danger).setEmoji('💸').setDisabled(true),
                        new ButtonBuilder().setCustomId('trade_refresh').setLabel('Actualiser').setStyle(ButtonStyle.Secondary).setEmoji('🔄').setDisabled(true)
                    );
                    await message.edit({ components: [disabledRow] }).catch(() => {});
                } catch (err) {
                    // ignore
                }
            });

        } else {
            // Pas d'investissement
            const embed = new EmbedBuilder()
                .setTitle(`📈 Capy Bourse - Investir (${CRYPTO_NAME})`)
                .setDescription(`Le cours du ${CRYPTO_NAME} est actuellement de **${price.toFixed(10)} €**.\nTu peux investir tes watermelons pour parier sur la hausse !`)
                .addFields(
                    { name: '🍉 Tes Watermelons', value: `${currentWatermelons}`, inline: true },
                    { name: '💲 Prix actuel', value: `${price.toFixed(10)} €`, inline: true }
                )
                .setColor(0x0099FF)
                .setFooter({ text: 'Attention : Tu peux perdre des watermelons si le cours chute !' });

            const investBtn = new ButtonBuilder()
                .setCustomId('trade_invest')
                .setLabel(`Investir tout (${currentWatermelons} 🍉)`)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🚀')
                .setDisabled(currentWatermelons <= 0);

            const refreshBtn = new ButtonBuilder()
                .setCustomId('trade_refresh')
                .setLabel('Actualiser')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔄');

            const row = new ActionRowBuilder().addComponents(investBtn, refreshBtn);

            const message = await interaction.editReply({ embeds: [embed], components: [row] });

            const collector = message.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: 'Pas touche !', ephemeral: true });
                }

                if (i.customId === 'trade_refresh') {
                    await i.deferUpdate();
                    const newPrice = await getCryptoPrice(true); // Force refresh
                    if (!newPrice || newPrice <= 0) {
                        return i.followUp({ content: `❌ Impossible de récupérer le cours du ${CRYPTO_NAME} pour le moment. Réessaye plus tard.`, ephemeral: true });
                    }
                    
                    const newEmbed = EmbedBuilder.from(embed)
                        .setDescription(`Le cours du ${CRYPTO_NAME} est actuellement de **${newPrice.toFixed(10)} €**.\nTu peux investir tes watermelons pour parier sur la hausse !`)
                        .setFields(
                            { name: '🍉 Tes Watermelons', value: `${currentWatermelons}`, inline: true },
                            { name: '💲 Prix actuel', value: `${newPrice.toFixed(10)} €`, inline: true }
                        );
                    
                    await i.editReply({ embeds: [newEmbed] });
                }

                if (i.customId === 'trade_invest') {
                    await i.deferUpdate();

                    // Vérifier qu'il a toujours les sous
                    const freshResources = await db.getProduction(interaction.guild.id, interaction.user.id);
                    const amountToInvest = freshResources.watermelon_count || 0;

                    if (amountToInvest <= 0) {
                        return i.followUp({ content: 'Tu n\'as pas de watermelons à investir !', ephemeral: true });
                    }

                    // Prix au moment du clic (force refresh)
                    const investPrice = await getCryptoPrice(true);
                    if (!investPrice || investPrice <= 0) {
                        return i.followUp({ content: `❌ Impossible de récupérer le cours du ${CRYPTO_NAME} pour le moment. Réessaye plus tard.`, ephemeral: true });
                    }

                    // Retirer les watermelons
                    await db.addWatermelon(interaction.guild.id, interaction.user.id, -amountToInvest, true);

                    // Créer l'investissement
                    await db.createInvestment(interaction.guild.id, interaction.user.id, amountToInvest, investPrice);

                    const successEmbed = new EmbedBuilder()
                        .setTitle('🚀 Investissement validé !')
                        .setDescription(`Tu as placé **${amountToInvest} 🍉** sur le ${CRYPTO_NAME} à **${investPrice.toFixed(10)} €**.`)
                        .setColor(0x00FF00)
                        .setFooter({ text: 'Utilise /trade pour suivre tes gains.' });

                    await i.editReply({ embeds: [successEmbed], components: [] });
                    collector.stop();
                }
            });
            collector.on('end', async () => {
                try {
                    const disableRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('trade_invest').setLabel(`Investir tout (${currentWatermelons} 🍉)`).setStyle(ButtonStyle.Primary).setEmoji('🚀').setDisabled(true),
                        new ButtonBuilder().setCustomId('trade_refresh').setLabel('Actualiser').setStyle(ButtonStyle.Secondary).setEmoji('🔄').setDisabled(true)
                    );
                    await message.edit({ components: [disableRow] }).catch(() => {});
                } catch (err) {
                    // ignore
                }
            });
        }
    }
};
