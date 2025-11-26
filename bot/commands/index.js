const EvalCommand = require('./eval');
const ProfilCommand = require('./profil');
const FarmCommand = require('./farm');
const LeaderboardCommand = require('./leaderboard');
const BuyCommand = require('./buy');
const ItemsCommand = require('./items');
const AccuserCommand = require('./accuser');
const DefendreCommand = require('./defendre');
const ProcesCommand = require('./proces');
const SlotCommand = require('./slot');

const commands = [
    EvalCommand,
    ProfilCommand,
    FarmCommand,
    LeaderboardCommand,
    BuyCommand,
    ItemsCommand,
    AccuserCommand,
    DefendreCommand,
    ProcesCommand,
    SlotCommand
];

const commandMap = new Map(commands.map(cmd => [cmd.data.name, cmd]));

async function syncGuildCommands(guild) {
    const existingCommands = await guild.commands.fetch();
    for (const [id, command] of existingCommands) {
        await guild.commands.delete(id);
        console.log(`Deleted command: ${command.name}`);
    }

    for (const command of commands) {
        await guild.commands.create(command.data);
        console.log(`Registered command: ${command.data.name}`);
    }
}

async function handleInteraction(interaction, context) {
    if (!interaction.isChatInputCommand()) return;
    const command = commandMap.get(interaction.commandName);
    if (!command) return;

    await command.execute(interaction, context);
}

module.exports = {
    syncGuildCommands,
    handleInteraction
};
