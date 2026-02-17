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
const TradeCommand = require('./trade');
const VersionCommand = require('./version');
const InvocationCommand = require('./invocation');
const ResetCommand = require('./reset');
const LootCommand = require('./loot');
const LootboxCommand = require('./lootbox');
const KeysCommand = require('./keys');

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
    SlotCommand,
    TradeCommand,
    LootCommand,
    LootboxCommand,
    VersionCommand,
    InvocationCommand,
    ResetCommand,
    KeysCommand
];

const commandMap = new Map(commands.map(cmd => [cmd.data.name, cmd]));

async function syncGuildCommands(guild) {
    let existingCommands = [];
    try {
        existingCommands = await guild.commands.fetch();
    } catch (err) {
        console.error('Failed to fetch existing guild commands:', err);
        existingCommands = [];
    }

    for (const [id, command] of existingCommands) {
        try {
            await guild.commands.delete(id);
            console.log(`Deleted command: ${command.name}`);
        } catch (err) {
            console.error(`Failed to delete command ${command.name} (${id}):`, err);
        }
    }

    for (const command of commands) {
        try {
            await guild.commands.create(command.data);
            console.log(`Registered command: ${command.data.name}`);
        } catch (err) {
            console.error(`Failed to register command ${command.data.name}:`, err);
            // continue registering other commands
        }
    }
}

async function syncGlobalCommands(application) {
    // application is client.application
    let existingCommands = [];
    try {
        existingCommands = await application.commands.fetch();
    } catch (err) {
        console.error('Failed to fetch existing global commands:', err);
        existingCommands = [];
    }

    for (const [id, command] of existingCommands) {
        try {
            await application.commands.delete(id);
            console.log(`Deleted global command: ${command.name}`);
        } catch (err) {
            console.error(`Failed to delete global command ${command.name} (${id}):`, err);
        }
    }

    for (const command of commands) {
        try {
            await application.commands.create(command.data.toJSON ? command.data.toJSON() : command.data);
            console.log(`Registered global command: ${command.data.name}`);
        } catch (err) {
            console.error(`Failed to register global command ${command.data.name}:`, err);
        }
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
