https://kataman7.github.io/portfolio/

ENV configuration notes:
- `PROMPT_SYSTEM`: Put the AI system prompt here (use \n to add line breaks). If omitted, the bot will use a default prompt.
 - `PROMPT_SYSTEM`: (Deprecated) The system now prefers the `settings.json` file. Move your prompt to `settings.json` under `promptSystem`.
 - `punishRoleId` and `punishMessages` should be defined inside `settings.json` (see `settings.example.json`). The bot will not fallback to any env-based defaults.
 - `PROMPT_SYSTEM_FILE`: Deprecated — the bot now requires `promptSystem` to be in `settings.json`. If you previously used `PROMPT_SYSTEM_FILE`, move the prompt into `settings.json` instead.

Settings JSON:
- You can store bot messages and non-sensitive configuration in a JSON file instead of editing `.env`. Use `SETTINGS_FILE` in `.env` to point to a file (e.g. `./settings.json`).
- An example (`settings.example.json`) is included. The fields include:
	- `promptSystem`: either a string or an array of lines that will be joined with newlines.
	- `guildConfigs`: mapping of guild ids to welcome message and default role.
	- `punishMessages`: array of strings, one is randomly chosen when `punish` is triggered by the model.
	- `punishRoleId`: role id to assign when punish is requested.
	- `faith.levels`: optional map for faith level labels.

Set `SETTINGS_FILE` to the path of your JSON file (e.g. `./settings.json`). The bot now requires the following fields in that file:
 - `promptSystem` (string or array of lines) — the AI system prompt
 - `punishMessages` (array of strings) — messages used when model returns `punish: true` (mandatory)
 - `guildConfigs` (optional) — per-guild welcome messages and roles
 - `faith.levels` (optional) — to override faith level labels
 - `faith.levels` (REQUIRED) — a mapping of level keys -5..20 to string labels. This file is now required; the bot will exit if it is missing or incomplete.
	- `AI_API_KEY`: Canonical API key used by the provider (OpenAI or third-party like Deepseek). We recommend setting this.
	 - Old variable `OPENAI_API_KEY` is no longer supported; if you previously used it, move the value to `AI_API_KEY`.
 - `AI_API_BASE_URL`: Base URL for the API provider (ex: https://api.deepseek.com). If left empty the official OpenAI host is used.

Watermelon minigame:
- Use `/watermelon view [user]` to see your or another user's melon count.
- Use `/watermelon leaderboard` to view top 10 farmers.
- Use `/watermelon farm` to attempt a harvest (3 hour cooldown). The bot will call the AI to generate a scenario and present two choices; choose by clicking a button. Your faith level influences the chance of a positive outcome. The bot will update your watermelon count accordingly.
