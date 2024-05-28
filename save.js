const {EmbedBuilder, ChannelType, SlashCommandBuilder} = require("discord.js");
client.guilds.fetch("960831251126824980")
    .then(guild => {
        setInterval(() => {
            //console.log(guild)
            checkUsersInVoiceChannels(guild);
            //console.log("ok")
        }, 60000 * 2);
    })


else if (commandName === "rank") {

    connection.query(`SELECT level, xp FROM user
        WHERE userID = '${interaction.user.id}' AND guildID = '${interaction.guild.id}'`,

        function (error, results, fields) {
            if (error) {
                interaction.reply("Impossible de vous retrouver dans ma base de donnée.")
                throw error;
            }
            if (results[0]) {

                let level = results[0].level;
                let xp = results[0].xp;
                let nbCaseValide = Math.round(level * 10 / (100 + level * 5));

                let bar = "";

                for (let i = 0; i < 10; i++ || xp != 0) {
                    if (i <= nbCaseValide && xp != 0) {
                        if (i == 0) bar += "<:gauche_plein:810464434090672148>"
                        else if (i == 9) bar += "<:droite_plein:810464407821090816>"
                        else bar += "<:centre_plein:810464421029085215>"
                    }
                    else {
                        if (i == 0) bar += "<:gauche_vide:810464389190254602>"
                        else if (i == 9) bar += "<:droite_vide:810464360899543091>"
                        else bar += "<:centre_vide:810464378343915571>"
                    }
                }

                const embed = new EmbedBuilder()
                    .setColor("#7785cc")
                    .setTitle(`${interaction.member.nickname}`)
                    // .setDescription(`${xp} / ${100 + level * 5}\n${bar}`)
                    .addFields(
                        { name: `Niveau ${level}`, value: '\n' },
                        { name: `${xp} / ${100 + level * 5}`, value: `${bar}`, inline: false },
                    )
                    .setThumbnail(interaction.user.avatarURL())

                interaction.reply({ embeds: [embed] })
            }
        });
}
else if (commandName === 'leaderboard') {
    // Récupérer tous les membres du serveur à partir de l'API Discord
    interaction.guild.members.fetch().then(() => {
        connection.query(
            `SELECT userID, level, xp
                FROM user
                WHERE guildID = '${interaction.guild.id}'
                ORDER BY level DESC, xp DESC`,

            function (error, results, fields) {

                if (error) throw error;

                if (results[0] != null) {

                    function score(index) {
                        if (index == 0) return ":first_place:"
                        else if (index == 1) return ":second_place:"
                        else if (index == 2) return ":third_place:"
                        else return "\u200b\u200b" + (index + 1) + ".";
                    }

                    let top = "**CLASSEMENT DU SERVEUR**\n\n"
                    results.forEach((user, index) => {
                        const member = interaction.guild.members.cache.get(user.userID);
                        if (user.level + user.xp !== 0) top += `${score(index)} **${member.user}** : niveau __**${user.level}**__ (\`${user.xp}xp\`) \n`
                    })

                    const embed = new EmbedBuilder()
                        .setDescription(top)

                    interaction.reply({ embeds: [embed] })
                } else interaction.reply("Aucun membre de ce serveur n'est enregistré.")
            });
    });
}


process.on('uncaughtException', (error) => {
    console.error('Erreur non capturée:', error);
    const channel = client.channels.cache.get("960840139343532063");
    if (channel) {
        //channel.send(`Une erreur est survenue : ${error.message || error}`);
        console.log(error.message || error);
    }
});

function checkUsersInVoiceChannels(guild) {
    const voiceChannels = guild.channels.cache.filter(channel => channel.type == ChannelType.GuildVoice);
    voiceChannels.forEach(voiceChannel => {
        voiceChannel.members.forEach(member => {
            if (voiceChannel.members.size >= 1 && !member.voice.selfMute && !member.user.bot) {
                //console.log(`${member.user.tag} est dans le salon vocal "${voiceChannel.name}".`);
                //console.log(member.user.id)
                addXp(member, guild);
                addStats(member, guild, "vocal", 2);
            }
        });
    });
}

function addXp(member, guild) {
    //console.log("addxp")
    connection.query(`SELECT level, xp
                      FROM user
                      WHERE userID = '${member.id}'
                        AND guildID = '${guild.id}'`, function (error, results, fields) {
        if (error) throw error;
        else if (results[0] != null) {

            let level = results[0].level;
            let xp = results[0].xp;

            xp += Math.floor(Math.random() * 5) + 1;

            if (xp > 100 + level * 5) {
                xp = 0;
                level++;
            }

            connection.query(`
                        UPDATE user
                        SET level = '${level}',
                            xp = '${xp}'
                        WHERE userID = ${member.id}
                          AND guildID = ${guild.id};`,
                function (error, results, fields) {
                    if (error) throw error;
                });

        } else {
            connection.query(`INSERT INTO user
                              VALUES (${member.id}, ${guild.id}, 0, 0)`, function (error, results, fields) {
                if (error) throw error;
            });
        }
    });
}

function addStats(member, guild, type, amount) {
    connection.query(`
                INSERT INTO ${type} (userID, guildID, nombre, date)
                VALUES ('${member.id}', '${guild.id}', ${amount}, CURRENT_DATE)
                ON DUPLICATE KEY UPDATE nombre = nombre + ${amount};`,
        function (error, results, fields) {
            if (error) throw error;
        });
}

function guildStats(guild, type) {
    connection.query(`

        SELECT date, SUM(nombre) as total
        FROM vocal
        WHERE guildID = '${guild.id}'
          AND date >= '${moment().subtract(30, 'days')}'
        GROUP BY date
        ORDER BY date ASC

    `, function (error, results, fields) {
        if (error) throw error;
        if (results[0]) {
            console.log(results)
        }
    });
}



client.on('messageReactionAdd', async (reaction, user) => {

    if (user.id !== '693374876815458346') return;

    if (reaction.emoji.id !== "1184860008161235055") return;

    const message = reaction.message;
    const guild = reaction.message.guild;
    const channel = message.channel;
    const author = message.author;

    if (message.author.id !== '693374876815458346') return;

    // Utilisez une expression régulière pour extraire le code du bloc de code JS
    const codeBlockRegex = /```js\n([\s\S]+?)\n```/;
    const codeMatch = message.content.match(codeBlockRegex);
    if (!codeMatch) return;
    const code = codeMatch[1];

    try {
        const result = eval(code);
        message.channel.send(`Résultat : ${result}`);
    } catch (error) {
        message.channel.send(`Erreur : ${error.message}`);
    }
});


const mysql = require('mysql');
const connection = mysql.createConnection({
    host: 'mysql1.par1.adky.net',
    user: 'u17261_Iz6lqu0wPL',
    password: 'cfgt+aTMtg4yS1!twupXXc2@',
    database: 's17261_database',
    port: 3306
});
connection.connect();


setInterval(() => {

    // Vérifiez si la connexion est toujours active
    if (connection.state === 'disconnected') {
        console.error('La connexion à la base de données a été perdue');

        // Réessayez de vous connecter à la base de données
        connection.connect((err) => {
            if (err) {
                console.error('Erreur de connexion à la base de données : ' + err.stack);
                return;
            }

            console.log('Reconnecté à la base de données avec l\'ID ' + connection.threadId);
        });
    }
}, 60000 * 1); // Vérifiez l'état de la connexion toutes les 10 secondes


const rankCmd = new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Voir votre rang')

const leaderboardCmd = new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Voir le classement du serveur.')