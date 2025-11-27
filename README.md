# Capybara Discord Bot

A modular, Docker-ready Discord bot for running faith-based, ecological, and crypto-themed games in your server. Powered by AI (Deepseek/OpenAI), MySQL, and Discord.js.

## Concept
Capybara Bot est un jeu Discord de farm et d'économie où les joueurs doivent satisfaire une IA (LLM) qui se prend pour un dieu capybara. Pour progresser, il faut cultiver des ressources (pastèques, etc.), répondre à des épreuves divines, investir, et gérer son foi et son écologie. L'IA juge vos actions, distribue des bénédictions ou des punitions, et propose des scénarios interactifs. Le but est de monter dans les classements, accumuler des richesses, et rester dans les bonnes grâces du dieu capybara.

## Features
- **Farm & Économie** : Cultivez des pastèques, achetez des upgrades, gérez vos ressources.
- **Épreuves divines** : L'IA génère des scénarios, dilemmes et punitions selon vos choix.
- **Classements** : Comparez votre foi, écologie et richesse avec les autres joueurs.
- **Trading crypto** : Investissez virtuellement dans des cryptos et suivez vos performances.
- **Bénédictions & Punitions** : Recevez des boosts ou des malus selon votre comportement.
- **Configurable** : Personnalisez prompts, rôles et messages dans `settings.json`.
- **Déploiement facile** : Docker, Compose, et Adminer pour la gestion.

## Quickstart

### 1. Clone & Install
```bash
# Clone the repo
git clone https://github.com/Kataman7/capybara.git
cd capybara

# Copy and edit your environment config
cp .env.example .env
# Edit .env and settings.json with your Discord token, DB credentials, and AI keys
```

### 2. Run with Docker Compose
```bash
docker-compose up --build
```
- Bot runs in `capybara` container
- MySQL DB in `capybara_db` container
- Adminer UI at [localhost:8182](http://localhost:8182)

### 3. Local Development
```bash
npm install
npm run dev
```

## Configuration
- **.env**: Secrets and runtime config (never commit real .env; use .env.example)
- **settings.json**: Prompts, roles, messages, faith levels, scenario templates
- **settings.example.json**: Template for settings
- **db/migrations/init.sql**: MySQL schema

## Commands
- `/farm` : Lance une récolte de pastèques et une épreuve divine générée par l'IA.
- `/buy` : Achète des upgrades ou ressources pour améliorer votre production.
- `/profil` : Affiche votre profil, niveau de foi, écologie, et inventaire.
- `/leaderboard` : Classement des joueurs selon la foi, l'écologie ou la richesse.
- `/trade` : Investit virtuellement dans une crypto et affiche vos performances.
- `/bless` : Reçoit ou utilise une bénédiction divine.
- `/items` : Liste vos objets et upgrades disponibles.
- `/accuser`, `/defendre`, `/proces`, `/slot`, `/eval` : Commandes spéciales pour des interactions, mini-jeux ou modération.

Chaque commande peut déclencher des réactions de l'IA capybara, qui juge, récompense ou punit selon vos choix et votre comportement.

## Code Structure
- `bot/` — Discord bot logic
  - `index.js` — Entry point
  - `services/` — AI, chat, scenario, trial services
  - `commands/` — Command handlers
- `db/` — Database layer
  - `core.js` — Connection pool
  - `repositories/` — Domain logic (users, resources, trade, blessings)
  - `migrations/` — SQL schema
- `settings.json` — Bot config
- `Dockerfile`, `docker-compose.yml` — Deployment

## License
Business Source License (BUSL). See LICENSE file for details and usage restrictions.
