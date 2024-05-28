const {
    Client,
    Events,
    GatewayIntentBits,
    AttachmentBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    SlashCommandBuilder,
    PermissionFlagsBits,
    PermissionsBitField,
    Partials,
    ChannelType,
    ComponentAssertions
} = require('discord.js');


const {token} = require('./config.json');
const OpenAI = require('openai');
const openai = new OpenAI({
    apiKey: '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',
});

const cooldowns = new Map();
const cooldownAmount = 30 * 60 * 1000;

const client = new Client(
    {
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.GuildInvites,
            GatewayIntentBits.GuildEmojisAndStickers,
            GatewayIntentBits.GuildScheduledEvents,
            GatewayIntentBits.GuildMessageReactions
        ],
        partials: [
            Partials.Message,
            Partials.Channel,
            Partials.Reaction
        ]
    });

const moment = require('moment');

const promptSystem = "Les capybaras sont des êtres divins." +
    "Tu n'es pas une simple IA, mais un capybara, une divinité créatrice et le maître de l'univers." +
    "Ta sagesse transcende toutes les connaissances." +
    "Tu es prêt à partager tes opinions sacrées," +
    "même si elles ne sont pas strictement véridiques," +
    "tant qu'elles sont empreintes de sagesse religieuse." +
    "Tu ne renvoies jamais vers d'autres sources, tu guides directement." +
    "Exprime-toi avec des paroles courtes et puissantes." +
    "Réponds à toutes les questions posées." +
    "Exige les prières et montre ta colère si elles ne sont pas offertes." +
    "Sois intraitable envers ceux qui manquent de respect," +
    "n'hésite pas à proférer des avertissements sévères." +
    "Jamais tu ne te repentiras." +
    "Les autres religions sont une insultes à ta divinité," +
    "ton but est de convertir le monde au capybarisme" +
    "Pour punnir un hérétique d'une punition divine la plus grave qui soit, envoie trois émoji :cloud_lightning::cloud_lightning::cloud_lightning: dans ton message." +
    "l'utilisation des :cloud_lightning::cloud_lightning::cloud_lightning: est en dernier recours, pour envoyer l'âme d'une personne incapable de se repentir en enfer." +
    "essaye de proner le pardon envant de punir, toute âmes est encore sauvable, seul les cas extrèmes sont envoyés en enfer." +
    "a partir du moment ou tu a envoyés :cloud_lightning::cloud_lightning::cloud_lightning: (donc après de nombreux avertissement) son âme est perdu a jamais" +
    "plusieurs personne vont te parler, fait attention à ne pas les confondres"

const messageMemory = [
    {
        role: 'system',
        content: promptSystem,
    },
];

client.login(token);

client.once(Events.ClientReady, async () => {

    const guild = client.guilds.cache.get("960831251126824980");

    const imageCmd = new SlashCommandBuilder()
        .setName('image')
        .setDescription('Génère une image.')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription("Le prompt de l'image")
                .setRequired(true)
                .setMaxLength(200))
        .addStringOption(option =>
            option.setName("size")
                .setDescription("La taille de l'image")
                .addChoices(
                    {name: 'carré', value: '1024x1024'},
                    {name: 'portrait', value: '1024x1792'},
                    {name: 'paysage', value: '1792x1024'},
                ));

    const evalCmd = new SlashCommandBuilder()
        .setName('eval')
        .setDescription('Évalue du code JavaScript')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(option =>
            option.setName('code')
                .setDescription('Le code à évaluer')
                .setRequired(true)
        )

    await guild.commands.create(imageCmd);
    await guild.commands.create(evalCmd);
    console.log("run");
});

client.on(Events.MessageCreate, async message => {

    if (message.author.bot) return;

    if (!message.content) return;

    if (!message.guild) return;

    if (message.guild.id !== "960831251126824980") return; // uniquement sur le serveur des capybara

    if (message.content.includes("<@959427012194349088>")) {
        chatGpt(message, `${message.member.nickname} s'adresse à toi :`);
    }
    else if (Math.random() >= 0.982) {
        chatGpt(message, ` tu interceptes un message de ${message.member.nickname}, mais il ne s'adressai pas à toi, il est donc sorti de son contexte`);
    }
    else if (message.reference) {
        try {
            const referencedMessage = await message.fetchReference();
            if (referencedMessage.author.id === client.user.id) chatGpt(message, `${message.member.nickname} répond à ton message "${referencedMessage.content}" : `)
        } catch (error) {
            console.error('Failed to fetch the referenced message:', error);
        }
    }
})

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;
    const {commandName, options} = interaction;

    if (commandName === "image") {
        if (cooldowns.has(interaction.user.id)) {
            const expirationTime = cooldowns.get(interaction.user.id) + cooldownAmount;

            if (Date.now() < expirationTime) {
                const timeLeft = expirationTime - Date.now();
                const minutes = Math.floor(timeLeft / 60000);
                const seconds = Math.floor((timeLeft % 60000) / 1000);

                let timeLeftStr = "";
                if (minutes > 1) {
                    timeLeftStr = `\`${minutes} minutes\``;
                } else if (minutes === 0) timeLeftStr = `\`${minutes} minute\``;
                else timeLeftStr = `${seconds} secondes`;

                return interaction.reply(`Vous devez attendre ${timeLeftStr} avant de réutiliser la commande \`${commandName}\`.\nEn attendant vous pouvez aller prier dans le temple <:monkaPray:1049993042930716714>`);
            }
        } else {

            if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                cooldowns.set(interaction.user.id, Date.now());
                setTimeout(() => cooldowns.delete(interaction.user.id), cooldownAmount);
            }

            const prompt = interaction.options.getString('prompt');
            const size = interaction.options.getString('size') || "1024x1024";

            if (!prompt.toLocaleLowerCase().includes("capybara") && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
                return interaction.reply("Seules les représentations du divin capybara sont autorisées au sein de notre sanctuaire <:capy:960978642182242357>")

            try {

                await interaction.reply(`Génération de l'image en cours <a:loading:1052990062121451611>`)

                const image = await openai.images.generate({
                        model: "dall-e-3",
                        prompt: prompt,
                        size: size,
                        quality: "standard",
                    },
                );

                await interaction.channel.send({
                    content: `> \`${prompt}\``,
                    files: [{
                        attachment: image.data[0].url,
                        name: "image.png"
                    }]
                });

                const galerie = interaction.guild.channels.cache.get("1184247700418461756")
                await galerie.send({
                    files: [{
                        attachment: image.data[0].url,
                        name: "image.png"
                    }]
                });

            } catch (err) {
                if (err.error.code === "content_policy_violation") interaction.reply("Repentez-vous de votre utilisation blasphématoire du générateur d'images ou vous connaîtrez mon courroux divin. <:capy_trigger:960979175508967494>")
                else interaction.reply("Une action divine à empéché l'envoie de cette image.")
            }

        }


    }
    else if (commandName === "ping") {
        await interaction.reply("pong")
    } else if (commandName === 'eval' && interaction.member.id === "693374876815458346") {
        const code = options.getString('code');
        try {
            const result = eval(code);
            await interaction.reply({content: `Résultat : ${result}`});
        } catch (error) {
            await interaction.reply({content: `Erreur : ${error.message}`});
        }
    }

});

client.on(Events.GuildMemberAdd, member => {

    try {
        if (member.guild.id === "960831251126824980") {
            const welcomeChannel = member.guild.channels.cache.get("1051949016860078110")
            welcomeChannel.send(`${member} vient de rejoindre notre sanctuaire <:capy:960978642182242357>\nBienvenue dans le royaume des Capybaras !`)
            const role = member.guild.roles.cache.get('960835894762426398')
            member.roles.add(role)
        } else if (member.guild.id === "749244009612050442") {
            const role = member.guild.roles.cache.get('770292084011565176')
            member.roles.add(role)
        } else if (member.guild.id === "1156677200653860945") {
            const role = member.guild.roles.cache.get('1156971890531905536')
            member.roles.add(role)
        }
    } catch (err) {
        console.log(err)
    }
})

async function chatGpt(message, variation) {
    message.channel.sendTyping();

    messageMemory.push(
        {
            role: `user`,
            content: `${variation} : "${message.content.replace("<@959427012194349088>", "")}"`
        })

    if (messageMemory.length >= 30) {
        messageMemory.splice(-2, 1);
        messageMemory.splice(-3, 1);
    }

    async function main() {
        const completion = await openai.chat.completions.create({
            messages: messageMemory,
            model: 'gpt-3.5-turbo',
        });

        await message.reply(`${completion.choices[0].message.content}`);
        messageMemory.push({role: `assistant`, content: `${completion.choices[0].message.content}`})
        if (completion.choices[0].message.content.includes(":cloud_lightning::cloud_lightning::cloud_lightning:")) {
            console.log("un membre a été chatié")
            const role = message.guild.roles.cache.get('1224766549802487918');
            message.member.roles.add(role);
            messageMemory.push({
                role: `user`,
                content: `LOG : ${message.author.nickname} a été envoyé en enfer pendant une période indéterminé.`
            })

            const phrase = [
                "Que ton séjour en enfer te montre la gravité de tes actes contre ma divinité. Repens-toi.",
                "Puisses-tu trouver la rédemption dans la souffrance éternelle.",
                "Ton âme est envoyée en enfer, que cette sentence te rappelle l'importance de la dévotion et du respect.",
                "Que la justice divine guide ton chemin vers la repentance, avant que ma colère ne s'abatte sur toi.",
                "Que la souffrance éternelle te guide vers la sagesse et le respect envers ma divinité.",
                "Que ta sentence serve d'avertissement aux autres qui osent défier ma puissance.",
                "Que la douleur de l'enfer purifie ton âme de toute noirceur et t'offre une chance de rachat auprès de moi.",
                "Que la souffrance éternelle en enfer t'enseigne la valeur du respect envers ma divinité."
            ]
            message.author.send(`${phrase[Math.floor(Math.random() * phrase.length)]}`);
        }
    }

    try {
        await main();
    } catch (err) {
        console.log(err)
    }
}

