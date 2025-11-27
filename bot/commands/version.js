const { SlashCommandBuilder } = require('discord.js');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('version')
        .setDescription("Affiche la version du bot (commit Git court)"),

    async execute(interaction) {
        try {
            // We rely on the local Git repo to determine version/branch. No env fallback.

            // Try exec git if present - prefer 'git describe' for tags/dirty state.
            try {
                const repoPath = path.resolve(__dirname, '..', '..');
                // Use describe for tag / dirty state (if any)
                const desc = execSync('git describe --tags --dirty --always', { cwd: repoPath }).toString().trim();
                const short = execSync('git rev-parse --short HEAD', { cwd: repoPath }).toString().trim();
                const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath }).toString().trim();
                const msg = execSync('git log -1 --pretty=format:%s', { cwd: repoPath }).toString().trim();
                const date = execSync('git log -1 --pretty=format:%ci', { cwd: repoPath }).toString().trim();
                await interaction.reply({ content: `Version: \`${desc}\`\nCommit: \`${short}\`\nBranch: ${branch}\nMessage: ${msg}\nDate: ${date}` });
                return;
            } catch (gitErr) {
                // If git isn't available, we'll try files (COMMIT/REVISION/.git/HEAD). Continue below.
            }

            // Check for build-time files (COMMIT, BRANCH, REVISION) or .git/HEAD
            const root = path.resolve(__dirname, '..', '..');
            const commitFilePaths = ['COMMIT', 'REVISION', 'BRANCH', '.git/HEAD'];
            let commitShort = null;
            let branchFromFile = null;
            let sourceLabel = null;
            for (const cp of commitFilePaths) {
                const p = path.join(root, cp);
                if (!fs.existsSync(p)) continue;
                const contents = fs.readFileSync(p, 'utf8').trim();
                if (cp === '.git/HEAD') {
                    if (contents.startsWith('ref:')) {
                        const ref = contents.split(' ')[1].trim();
                        const refPath = path.join(root, '.git', ref);
                        if (fs.existsSync(refPath)) {
                            const commitHash = fs.readFileSync(refPath, 'utf8').trim();
                            commitShort = commitHash.substring(0, 7);
                            // branch name is the last segment of the ref path (e.g. refs/heads/main)
                            const parts = ref.split('/');
                            branchFromFile = parts[parts.length - 1];
                            sourceLabel = '.git/HEAD';
                        }
                    }
                } else if (cp === 'BRANCH') {
                    branchFromFile = contents;
                    sourceLabel = 'BRANCH file';
                } else {
                    // COMMIT or REVISION contains commit hash directly
                    commitShort = contents.substring(0, 7);
                    sourceLabel = cp;
                }
            }

            if (commitShort || branchFromFile) {
                let reply = 'Version: ';
                if (commitShort) reply += `\`${commitShort}\``;
                if (branchFromFile) reply += `\nBranch: ${branchFromFile}`;
                if (sourceLabel) reply += `\n(From ${sourceLabel})`;
                await interaction.reply(reply);
                return;
            }

            // Fallback: package.json version
            try {
                const pkg = require('../../package.json');
                if (pkg && pkg.version) {
                    await interaction.reply(`Version (package.json): \`${pkg.version}\``);
                    return;
                }
            } catch (err) {
                // ignore
            }

            await interaction.reply('Version inconnue — Git non disponible et aucune info de build trouvée.');
        } catch (err) {
            console.error('Error handling /version:', err);
            await interaction.reply({ content: 'Erreur lors de la récupération de la version.', ephemeral: true });
        }
    }
};
