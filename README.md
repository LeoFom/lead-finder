# Lead Finder

Головна сторінка тепер формує зовнішній пошук у Google Search, Google Maps та Google-пошук Instagram. Ключі не потрібні; видача не завантажується, не зберігається та не експортується. Наявна ручна CRM доступна окремо за `/crm`. [Рішення та межі](docs/EXTERNAL_SEARCH.md)

У розділі `/crm` гостьовий режим працює без входу, API та БД: ручні записи, профілі, CRM, історія, пошук у збережених записах і CSV. Дані гостя зберігаються без пароля у цьому браузері; для приватних записів є окремий зашифрований простір. Добровільний вхід власника відкриває серверну CRM через Vercel → NestJS на Render Free → PostgreSQL на Neon Free. Простори не об’єднуються автоматично. [Робота без БД](docs/OFFLINE.md) · [Реєстрація та відновлення пароля](docs/REGISTRATION_REVIEW.md) · [Backend і запуск](docs/BACKEND.md)

## Запуск у браузері

Опублікована стартова сторінка працює на Vercel. Проєкт збирає `apps/web` із гілки `main`. Для перегляду достатньо браузера. [Відкрити Lead Finder](https://lead-finder-bay-five.vercel.app)

Для розробки відкрийте **Code → Codespaces → Create codespace** у репозиторії. Конфігурація запускає PostgreSQL і контейнер Node.js. Залежності встановлюються у віддаленому середовищі. [Репозиторій GitHub](https://github.com/LeoFom/lead-finder)

У терміналі Codespaces виконайте команди нижче.

```sh
pnpm db:validate
pnpm db:check
pnpm dev
```

У вкладці **Ports** відкрийте порт **3000**. На сторінці має з’явитися Lead Finder. API слухає **3001**, запит до його кореня поки повертає 404. Worker повідомляє про ініціалізацію в терміналі. Для цього запуску ключі постачальників не потрібні. Дані dev-контейнера придатні для розробки. [GitHub Codespaces](https://docs.github.com/en/codespaces/setting-up-your-project-for-codespaces/adding-a-dev-container-configuration/introduction-to-dev-containers)

## Перевірка без залежностей проєкту

Виконайте з кореня на Node.js 24.14+ гілки 24. Тест читає TypeScript безпосередньо засобами Node. Йому не потрібен доступ до PostgreSQL або мережі.

```sh
node --test tests/*.test.mts
```

З наявним pnpm той самий набір запускає `pnpm test`. Запуск скриптів не ініціює автоматичну інсталяцію.

## Локальний запуск за бажанням

Для розробки гостьового інтерфейсу достатньо Node.js, pnpm та команд `pnpm install` і `pnpm --filter @lead-finder/web dev`. PostgreSQL і серверні ключі для цього режиму не потрібні. Демонстраційні контакти автоматично не створюються.

Потрібні Node.js 24 (версія середовища в `.node-version`), pnpm 11.25.0 та PostgreSQL 17. Для локальної БД можна використати Docker Compose. Якщо є доступна PostgreSQL, достатньо її URL у `.env` і крок із Docker можна пропустити.

```powershell
Copy-Item .env.example .env
docker compose up -d --wait postgres
pnpm install
pnpm db:validate
pnpm db:check
pnpm dev
```

На macOS та Linux перша команда — `cp .env.example .env`. У локальному браузері відкрийте [стартову сторінку](http://localhost:3000). Параметри Compose і DATABASE_URL повинні вказувати на ту саму БД. Значення зі зразка призначені для локального loopback. Ctrl+C завершує процеси розробки. `docker compose stop` зупиняє PostgreSQL зі збереженням тому.

## Перевірки та CI

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm db:validate
pnpm db:check
pnpm build
```

`pnpm format` форматує код і документацію. `pnpm format:check` перевіряє формат. Вихідне ТЗ виключено з автоматичних змін форматування.

GitHub Actions запускає перелічені перевірки на push, pull request або вручну, створює тимчасову PostgreSQL 17 і перевіряє старт `pnpm dev` для web, API й worker. CI та Vercel встановлюють версії з `pnpm-lock.yaml` у режимі `--frozen-lockfile`. [Workflow](.github/workflows/ci.yml)

## Структура

```text
apps/
  web/app/             layout, стартова сторінка, стилі
  api/src/             HTTP-процес NestJS
  worker/src/          фоновий процес NestJS
packages/
  shared/src/          типи джерел і походження
  data-sources/src/    перевірка прав на операцію
  db/                  конфігурація Prisma, datasource, проба SELECT 1
tests/                 тести політики та strict-конфігурація
docs/
  PRD.md
  ARCHITECTURE.md
  DATA_SOURCES_AND_LICENSES.md
  DEPLOY_RENDER.md
  adr/0001-source-rights.md
  adr/0002-incremental-sync.md
.devcontainer/         конфігурація хмарного робочого середовища
.github/workflows/     CI з PostgreSQL
compose.yaml           локальна PostgreSQL з іменованим томом
AGENTS.md              правила наступних змін
LEAD_FINDER_TECHNICAL_SPEC_UA.md
```

Кореневі `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.mjs`, `.prettierrc.json` та `.env.example` задають спільні правила. Кожен із шести пакетів має власні manifest і tsconfig. [Архітектура](docs/ARCHITECTURE.md) · [Вимоги й критерії](docs/PRD.md) · [План Render](docs/DEPLOY_RENDER.md)

## Межа наступного завдання

За рішенням власника спочатку реалізовано mock UI, потім приватний NestJS backend. Наступні задачі — дозволений Overture adapter, черга запусків, incremental sync для зовнішніх джерел, XLSX та перевірене резервне копіювання. Пошукові джерела очікують окремого підключення. [Правила Codex](AGENTS.md) · [Рішення про синхронізацію](docs/adr/0002-incremental-sync.md)
