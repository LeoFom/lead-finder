# NestJS API та безкоштовне розгортання

API працює окремим Node.js процесом на Render Free. Дані зберігаються у Neon Free PostgreSQL 17 у Frankfurt. Prisma 7 використовує pg adapter із пулом до п’яти підключень. Vercel містить frontend та серверний проксі. Ключ проксі та DATABASE_URL доступні тільки на сервері.

## Приватний доступ

Перший власник створює обліковий запис із приватним OWNER_SETUP_TOKEN. Сторінка входу просить email, пароль від 12 символів та одноразовий код. Після першого створення користувача setup повертає 409. У БД зберігається scrypt-хеш пароля зі сіллю, у сесії — SHA-256 хеш випадкового токена. Cookie HttpOnly, SameSite=Lax, Secure у production, строк сім днів. Logout видаляє сесію. Зміни вимагають дозволеного Origin. DB-ліміт обмежує спроби входу та setup вісьмома на 15 хвилин за IP.

## Реалізовані операції

| Маршрут /api/v1                                | Поведінка                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| GET health/live, health/ready                  | Liveness та підключення до БД                                              |
| GET auth/status, POST auth/setup               | Одноразове створення власника                                              |
| POST auth/login, POST auth/logout, GET auth/me | Сесія власника                                                             |
| GET countries, cities                          | Довідники України та чотирьох міст                                         |
| GET/POST search-profiles                       | Збережені профілі з унікальним scope                                       |
| GET workspace                                  | Сумісний із UI агрегат, до 500 бізнесів на профіль і 100 останніх подій    |
| GET businesses                                 | Cursor pagination, profileId, q, limit до 100                              |
| GET businesses/:id, businesses/:id/history     | Поточні факти, походження і версії                                         |
| POST businesses                                | Незалежне ручне додавання, Idempotency-Key UUID і підтвердження походження |
| PATCH businesses/:id/crm                       | CRM та ручний сайт, revision обов’язкова, 409 при конфлікті                |
| POST exports/csv                               | До 500 вибраних UUID, BOM, права кожного поля та атрибуція в кожному рядку |
| POST search-runs                               | 409 SOURCE_NOT_CONFIGURED до появи дозволеного адаптера                    |

Постійна БД починається з довідників та реєстру ручного джерела. Демодані localStorage автоматично не переносяться до CRM. Ручні записи мають стабільні UUID і окремі membership пошукового профілю. Інший запит або місто зберігає попередню базу. Філії не зливаються автоматично.

Додавання бізнесу, фактів, джерела, CRM та журналу є однією транзакцією. Ключ повтору з іншим payload повертає 409. CRM-правки беруть блокування філії, перевіряють revision та атомарно збільшують її. Зміна сайту додає нову версію факту й залишає стару в історії. Частковий унікальний індекс дозволяє лише один current-факт для поля філії. Імпортних маршрутів для запису CRM немає.

Експортер звіряє provenance та чинні права license_registry повторно. Відкликані джерела й обмежені поля відкидаються. CSV екранує формули Excel. XLSX, автоматичний Overture import, jobs/worker, merge/unmerge, розширена таксономія, контакти й заплановані скани є наступними окремими етапами.

## Запуск та перевірки

Скопіювати .env.example у .env, запустити PostgreSQL і встановити залежності. Побудувати пакети, застосувати міграції та seed, потім виконати pnpm dev. Next.js потребує .env.local у apps/web із API_BASE_URL, API_PROXY_KEY та NEXT_PUBLIC_DATA_MODE=api. API підхоплює кореневу .env через Node --env-file або середовище процесу.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @lead-finder/db migrate
pnpm --filter @lead-finder/db seed
pnpm test
pnpm test:api
```

test:api призначений для окремої чистої тестової БД. CI створює PostgreSQL 17, застосовує міграції й seed, тестує приватний доступ, setup, login/logout, ідемпотентне додавання, конкурентні правки, попередній сайт, CRM/opt-out, CSV і відхилення чужого Origin.

## Render та Neon

render.yaml явно обирає plan free. Free API засинає після простою, тому перший запит може тривати близько хвилини. Постійної черги на цьому етапі немає. Міграції та ідемпотентний seed виконуються перед стартом Node, оскільки free web service має обмеження pre-deploy. При помилці міграції запуск зупиняється. PostgreSQL живе окремо від ephemeral-диска Render.

Neon Free має обмеження storage/compute й короткий період відновлення. Перевіряти квоти в консолі та робити власні резервні копії перед суттєвими міграціями. Надійний щоденний production backup і репетиція restore потребують окремого налаштування. [Neon Free](https://neon.com/pricing) · [Render Free](https://render.com/docs/free)

Секрети у Render та Vercel environment. Локальні .env.deploy і .env.render виключені з Git. Код налаштування власника передається власнику окремо. Не розміщувати секрети в NEXT_PUBLIC змінних.
