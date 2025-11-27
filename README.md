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

### Providing build commit info / Git usage
`/version` reads version information primarily from the local Git repository using `git describe`, `git rev-parse`, and `git log`.

If `.git` is not available at runtime (common in CI/CD or trimmed images), prefer adding a small `COMMIT` file at build time with the short commit hash. This is more robust than setting a runtime env var and avoids leaking other envs.

Example Docker build (writes `COMMIT` and `BRANCH` into the image):
```bash
docker build --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) -t capybara:latest .
```
Dockerfile:
```Dockerfile
ARG GIT_COMMIT
ARG GIT_BRANCH
ENV COMMIT_HASH=${GIT_COMMIT}
ENV BRANCH_NAME=${GIT_BRANCH}
RUN echo ${COMMIT_HASH} > /usr/src/app/COMMIT && echo ${BRANCH_NAME} > /usr/src/app/BRANCH
```

Then `/version` will use the `COMMIT` and `BRANCH` files to display the build commit and branch when `.git` is not present. Otherwise, keep `.git` accessible at runtime (or mount it) so `/version` can show the branch, tag/description, commit hash and commit details accurately.

Important note for development with Docker Compose:
If you use `docker-compose` with a host volume mount (for example `./:/usr/src/app`), the host overlay will hide the `COMMIT` file that was written during image build and will also mask `.git`. In that case `/version` will revert to using `git` if `.git` is mounted, or fall back to `package.json` if not.

Suggested workflow:
- For production images: build the image with `GIT_COMMIT` build-arg and run without mounting the source tree.
- For development: mount your `.git` into the container if you want `/version` to use Git, or rely on your local `git` when running the bot locally (outside of Docker).

## Commands
- `/farm` : Lance une récolte de pastèques et une épreuve divine générée par l'IA.
- `/buy` : Achète des upgrades ou ressources pour améliorer votre production.
- `/profil` : Affiche votre profil, niveau de foi, écologie, et inventaire.
- `/leaderboard` : Classement des joueurs selon la foi, l'écologie ou la richesse.
- `/trade` : Investit virtuellement dans une crypto et affiche vos performances.
- `/bless` : Reçoit ou utilise une bénédiction divine.
- `/items` : Liste vos objets et upgrades disponibles.
- `/accuser`, `/defendre`, `/proces`, `/slot`, `/eval` : Commandes spéciales pour des interactions, mini-jeux ou modération.
- `/accuser`, `/defendre`, `/proces`, `/slot`, `/eval` : Commandes spéciales pour des interactions, mini-jeux ou modération.
- `/version` : Affiche la version du bot (hash court du commit Git ou info de build), utile pour prouver que le code public est le même que le code exécuté.

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
