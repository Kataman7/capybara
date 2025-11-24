const DEFAULT_SCENARIO = {
    scenario: 'Un capybara mystérieux observe ton champ de pastèques depuis la rivière...',
    choices: [
        { text: 'Lui offrir une pastèque', consequence: 'Le capybara bénit ton champ avec gratitude', base_delta: 3 },
        { text: 'Continuer à arroser sans rien faire', consequence: 'Le capybara repart, indifférent', base_delta: 1 }
    ]
};

function clampMultiplier(value) {
    const parsed = parseFloat(value ?? 1) || 1;
    if (parsed < 1) return 1;
    if (parsed > 5) return 5;
    return parsed;
}

function clampDelta(value) {
    const parsed = parseInt(value ?? 0, 10);
    if (Number.isNaN(parsed)) return 0;
    if (parsed > 15) return 15;
    if (parsed < -15) return -15;
    return parsed;
}

function sanitizeBlessing(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const multiplier = 2; // Force blessing multiplier to always be 2
    const charges = Math.max(1, Math.min(5, parseInt(raw.charges ?? 0, 10) || 0));
    if (charges <= 0) return null;
    return {
        multiplier,
        charges,
        message: (raw.message || 'Une bénédiction différée est promise.').toString()
    };
}

function sanitizeScenario(raw) {
    if (!raw || typeof raw !== 'object') return DEFAULT_SCENARIO;
    if (!Array.isArray(raw.choices) || raw.choices.length < 2) return DEFAULT_SCENARIO;

    const trimmedChoices = raw.choices.slice(0, 2).map(choice => ({
        text: (choice?.text || '???').toString(),
        consequence: (choice?.consequence || '???').toString(),
        base_delta: clampDelta(choice?.base_delta),
        ecology_delta: clampDelta(choice?.ecology_delta),
        blessing: sanitizeBlessing(choice?.blessing)
    }));

    return {
        scenario: (raw.scenario || DEFAULT_SCENARIO.scenario).toString(),
        choices: trimmedChoices
    };
}

function parseCompletionContent(content) {
    if (!content || typeof content !== 'string') return DEFAULT_SCENARIO;
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }
    try {
        const parsed = JSON.parse(cleaned);
        return sanitizeScenario(parsed);
    } catch (_err) {
        return DEFAULT_SCENARIO;
    }
}

function buildScenarioTypes(settings) {
    const prompts = settings.scenarioPrompts || {};
    const definitions = [
        { key: 'divine_trial', embedTitle: 'Épreuve divine du dieu Capybara', resultTitle: 'Jugement du dieu Capybara', weight: 1.2 },
        { key: 'ethical_dilemma', embedTitle: 'Dilemme agricole capybarèsque', resultTitle: 'Chronique de la récolte', weight: 1.5 },
        { key: 'climate_ritual', embedTitle: 'Rituel météorologique capybarèsque', resultTitle: 'Oracles du climat', weight: 1 },
        { key: 'market_intrigue', embedTitle: 'Intrigue du bazar capybara', resultTitle: 'Verdict des marchés', weight: 1 },
        { key: 'ancestral_memory', embedTitle: 'Mémoire ancestrale des capybaras', resultTitle: 'Échos nocturnes', weight: 1 }
    ];

    return definitions.filter(def => prompts[def.key]);
}

function pickScenarioType(types) {
    const totalWeight = types.reduce((sum, type) => sum + (type.weight || 1), 0);
    const roll = Math.random() * totalWeight;
    let cumulative = 0;
    for (const type of types) {
        cumulative += type.weight || 1;
        if (roll <= cumulative) return type;
    }
    return types[0];
}

function createScenarioService(aiClient, settings) {
    const types = buildScenarioTypes(settings);
    if (!types.length) {
        throw new Error('Aucun scénario n\'est configuré dans settings.scenarioPrompts');
    }

    async function generateScenario() {
        const type = pickScenarioType(types);
        const prompt = settings.scenarioPrompts[type.key];
        let parsed = DEFAULT_SCENARIO;
        try {
            const completion = await aiClient.sendChat([
                { role: 'system', content: prompt }
            ], process.env.AI_MODEL || 'gpt-3.5-turbo');
            const raw = completion?.choices?.[0]?.message?.content;
            parsed = parseCompletionContent(raw);
        } catch (err) {
            console.error('Scenario generation failed, using fallback:', err.message);
        }

        return {
            type,
            payload: parsed
        };
    }

    return {
        generateScenario
    };
}

module.exports = createScenarioService;
