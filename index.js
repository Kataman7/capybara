const {
    Client,
    Events,
    GatewayIntentBits,
    AttachmentBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');

const {token} = require('./config.json');
const OpenAI = require('openai');
const openai = new OpenAI({
    apiKey: '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',
});

const {PasteClient, Publicity, ExpireDate} = require("pastebin-api");
const pastebin = new PasteClient("TSFzLlUDD3TOpImA1GezhamoeB1RdSzk");

const client = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]});

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
    "ton but est de convertir le monde au capybarisme"

const messageMemory = [
    {
        role: 'system',
        content: promptSystem
    },
];


client.once(Events.ClientReady, async () => {

    const imageCmd = new SlashCommandBuilder()
        .setName('image')
        .setDescription('Génère une image.')
        .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
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
        .addStringOption(option =>
            option.setName('code')
                .setDescription('Le code à évaluer')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)

    const guild = client.guilds.cache.get("960831251126824980");
    await guild.commands.create(imageCmd);
    await guild.commands.create(evalCmd);

    console.log("run")
});

client.login(token);

client.on(Events.MessageCreate, async message => {

    if (message.author.bot) return;

    if (!message.content) return;

    if (!message.guild && !message.guild.id != "960831251126824980") return;

    if (message.content.includes("<@959427012194349088>")) {

        /*
        if (message.attachments.size > 0) {

            try {
                const firstAttachment = message.attachments.first();
                console.log(firstAttachment.url)
                const url = firstAttachment.url.replace(/\.jpg.*$/, '.jpg')
                console.log(url);

                messageMemory.push({role: `user`, content: `${message.content}`})

                const response = await openai.chat.completions.create({
                    model: "gpt-4-vision-preview",
                    max_tokens: 100,
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: promptSystem },
                                { type: "text", text: `USER ${message.author.displayName} : ${message.content}` },
                                {
                                    type: "image_url",
                                    image_url: {
                                        "url": url,
                                        "detail": "low",
                                    },
                                },
                            ],
                        },
                    ],
                });

                console.log(response.choices[0].message.content)
                messageMemory.push({role: `assistant`, content: `${response.choices[0].message.content}`})
                message.channel.send(response.choices[0].message.content)
            }
            catch (err) {
                console.log(err);
            }

        }
        else {*/

        message.channel.sendTyping();

        messageMemory.push({role: `user`, content: `USER ${message.author.displayName} : ${message.content}`})

        if (messageMemory.length >= 30) {
            messageMemory.splice(-2, 1);
            messageMemory.splice(-3, 1);
        }

        async function main() {
            const completion = await openai.chat.completions.create({
                messages: messageMemory,
                model: 'gpt-3.5-turbo',
            });

            message.reply(`${completion.choices[0].message.content}`);
            messageMemory.push({role: `assistant`, content: `${completion.choices[0].message.content}`})
        }

        try {
            main();
        } catch (err) {
            console.log(err)
        }

        console.log(messageMemory);

        //}
    }

    if (message.content == "image") {
        if (message.attachments.size > 0) {

            const firstAttachment = message.attachments.first();
            console.log(firstAttachment.url)
            const url = firstAttachment.url.replace(/\.jpg.*$/, '.jpg')
            console.log(url);


            const response = await openai.chat.completions.create({
                model: "gpt-4-vision-preview",
                messages: [
                    {
                        role: "user",
                        content: [
                            {type: "text", text: "description de l'image"},
                            {
                                type: "image_url",
                                image_url: {
                                    "url": url,
                                    "detail": "low",
                                },
                            },
                        ],
                    },
                ],
            });

            console.log(response.choices[0].message.content)
            message.channel.send(response.choices[0].message.content)

        } else {
            console.log("No attachments");
        }
    }
    if (message.content == "test") {

        const link = "https://oaidalleapiprodscus.blob.core.windows.net/private/org-nUpOuAWEuIQQWwErGIYgGoW3/user-bXfd7ZeKGPgjxzYyq1n9qJzP/img-BkBiuVDJu0ZEMXXRT07wshI7.png?st=2023-12-11T07%3A10%3A12Z&se=2023-12-11T09%3A10%3A12Z&sp=r&sv=2021-08-06&sr=b&rscd=inline&rsct=image/png&skoid=6aaadede-4fb3-4698-a8f6-684d7786b067&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2023-12-10T23%3A15%3A44Z&ske=2023-12-11T23%3A15%3A44Z&sks=b&skv=2021-08-06&sig=Mhiyi0G9eWqmUwoE%2B%2Bzc8RdU0WIi5%2BPH2MRCMj67WUI%3D"
        // const attachment = new AttachmentBuilder(link, { name: 'image.png' });
        message.channel.send({
            files: [{
                attachment: link,
                name: "image.png"
            }]
        });

    }
})

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;
    const {commandName, options} = interaction;

    if (commandName == "image") {

        const prompt = interaction.options.getString('prompt');
        const size = interaction.options.getString('size') || "1024x1024";

        try {

            await interaction.reply(`Génération de l'image en cours <a:loading:1052990062121451611>`)

            const image = await openai.images.generate({
                    model: "dall-e-3",
                    prompt: prompt,
                    size: size,
                    quality: "standard",
                },
            );

            console.log(image.data)

            await interaction.channel.send(`> \`${prompt}\``)
            await interaction.channel.send({
                files: [{
                    attachment: image.data[0].url,
                    name: "image.png"
                }]
            });

            const galerie = interaction.guild.channels.cache.get("1184247700418461756")
            await galerie.send(`> \`${prompt}\``)
            await galerie.send({
                files: [{
                    attachment: image.data[0].url,
                    name: "image.png"
                }]
            });

        } catch (err) {
            console.log(err)
            if (err.error.code == "content_policy_violation") interaction.channel.send("Repentez-vous de votre utilisation blasphématoire du générateur d'images ou vous connaîtrez mon courroux divin. <:capy_trigger:960979175508967494>")
        }

    }
    if (commandName == "ping") {
        await interaction.channel.send("pong")
    }
    if (commandName === 'eval' && interaction.member.id === "693374876815458346") {
        const code = options.getString('code');

        try {
            const result = eval(code);
            await interaction.reply({ content: `Résultat : ${result}`});
        } catch (error) {
            await interaction.reply({ content: `Erreur : ${error.message}`});
        }
    }
});

client.on(Events.GuildMemberAdd, member => {

    try {
        if (member.guild.id == "960831251126824980") {
            const welcomeChannel = member.guild.channels.cache.get("1051949016860078110")
            welcomeChannel.send(`${member} vient de rejoindre notre sanctuaire <:capy:960978642182242357>\nBienvenue dans le royaume des Capybaras !`)

            const role = member.guild.roles.cache.get('960835894762426398')
            member.roles.add(role)
        } else if (member.guild.id == "749244009612050442") {
            const role = member.guild.roles.cache.get('770292084011565176')
            member.roles.add(role)
        } else if (member.guild.id == "1156677200653860945") {
            const role = member.guild.roles.cache.get('1156971890531905536')
            member.roles.add(role)
        }
    } catch (err) {
        console.log(err)
    }
})