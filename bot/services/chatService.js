const { Events } = require('discord.js');

class ChatService {
    constructor(aiClient, dbClient, settings) {
        this.ai = aiClient;
        this.db = dbClient;
        this.settings = settings;
        this.messageMemories = new Map();
        
        // Pre-format prompt system
        this.systemPrompt = Array.isArray(settings.promptSystem) 
            ? settings.promptSystem.join('\n') 
            : settings.promptSystem;
    }

    getMemoryForUser(userId) {
        if (!this.messageMemories.has(userId)) {
            this.messageMemories.set(userId, [
                { role: 'system', content: this.systemPrompt }
            ]);
        }
        return this.messageMemories.get(userId);
    }

    async handleMessage(message, variation) {
        message.channel.sendTyping();

        const memory = this.getMemoryForUser(message.author.id);
        this.addToMemory(memory, 'user', `${variation} : "${message.content.replace("<@959427012194349088>", "")}"`);
        this.trimMemory(memory);

        try {
            const response = await this.generateResponse(memory);
            await this.processResponse(message, response, memory);
        } catch (err) {
            console.error('Error in ChatService:', err);
        }
    }

    addToMemory(memory, role, content) {
        memory.push({ role, content });
    }

    trimMemory(memory) {
        if (memory.length >= 30) {
            memory.splice(-2, 1);
            memory.splice(-3, 1);
        }
    }

    async generateResponse(memory) {
        const controlInstruction = {
            role: 'system',
            content: 'Return ONLY a JSON object with keys: message (string), faith_change (int, optional and must be one of -1, 0, 1), update (boolean, optional), punish (boolean, optional). The "faith_change" must be either -1 (decrease by one), 0 (leave the level unchanged) or 1 (increase by one)  do NOT return any other numbers. The "punish" flag should ONLY be set to true in the most extreme cases where the person\'s soul is beyond redemption - severe blasphemy or repeated unforgivable acts. Use this sparingly and only when absolutely necessary. If you cannot return a valid JSON object, return plain JSON with keys message and update=false.'
        };

        const completion = await this.ai.sendChat([controlInstruction, ...memory], process.env.AI_MODEL || 'gpt-3.5-turbo');
        const rawContent = completion.choices[0].message.content;
        
        return {
            raw: rawContent,
            parsed: this.parseResponse(rawContent)
        };
    }

    parseResponse(raw) {
        let cleaned = raw.trim();
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        }

        try {
            return JSON.parse(cleaned);
        } catch (err) {
            return { message: cleaned, faith_change: 0, update: false };
        }
    }

    async processResponse(message, { raw, parsed }, memory) {
        const replyText = parsed.message || 'Erreur : aucun message reçu du divin Capybara.';
        await message.reply(replyText);
        
        this.addToMemory(memory, 'assistant', raw);

        if (parsed.update) {
            await this.handleFaithUpdate(message, parsed.faith_change);
        }

        if (parsed.punish) {
            await this.handlePunishment(message);
        }
    }

    async handleFaithUpdate(message, faithChange) {
        if (typeof faithChange === 'undefined' || faithChange === 0) return;

        try {
            const cur = await this.db.getFaith(message.guild.id, message.author.id);
            const lastUpdate = new Date(cur?.updated_at || 0);
            const now = new Date();
            const cooldownMinutes = parseInt(process.env.FAITH_UPDATE_COOLDOWN_MINUTES || '60', 10);

            if ((now - lastUpdate) / 60000 >= cooldownMinutes) {
                await this.db.addFaith(message.guild.id, message.author.id, faithChange);
            }
        } catch (e) {
            console.error('Error updating faith:', e);
        }
    }

    async handlePunishment(message) {
        try {
            console.log('Punishment triggered by AI model');
            
            // Apply Role
            const roleId = this.settings.punishRoleId;
            if (roleId) {
                const role = message.guild.roles.cache.get(roleId);
                if (role) await message.member.roles.add(role);
            }

            // Send DM
            const phrases = this.settings.punishMessages;
            if (phrases && phrases.length > 0) {
                const phrase = phrases[Math.floor(Math.random() * phrases.length)];
                try {
                    await message.author.send(`${phrase}`);
                } catch (dmErr) {
                    console.warn(`Cannot DM user ${message.author.tag}: ${dmErr.message}`);
                }
            }

            // Log to memory
            const memory = this.getMemoryForUser(message.author.id);
            this.addToMemory(memory, 'user', `LOG : ${message.author.nickname} a été puni (punish=true).`);

        } catch (err) {
            console.error('Error applying punishment:', err);
        }
    }
}

module.exports = ChatService;
