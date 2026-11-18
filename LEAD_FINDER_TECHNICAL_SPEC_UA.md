# Lead Finder — технічне завдання (ТЗ)

Версія: 1.0  
Дата: 18 листопада 2026  
Статус: Ready for Codex implementation  
Основний стек: Next.js (App Router, TypeScript), NestJS, PostgreSQL, Prisma, Render  
Мова інтерфейсу: українська  
Дефолт: країна — Україна (UA); місто — Івано-Франківськ; запит — «Стоматологія».

> Продукт має збирати власну, легально придатну до зберігання базу компаній, а не копію Google Maps чи вебпошукової видачі. «Не знайдено» в певному джерелі не дорівнює «бізнес закрився». Деякі інструменти (Google Maps/Brave) мають обмеження на створення бізнес-каталогів і накопичення результатів; конкретні інтеграції допускаються лише після перевірки умов використання.

## 1. Бізнес-мета й результат

Мета: зменшити ручну працю фрилансера, який шукає клієнтів для створення/оновлення сайтів. Продукт має знаходити потенційні бізнеси в заданій географії та сфері, вести їхню історію, виявляти зміни й допомагати у пріоритизації контактів.

Результат: приватний вебзастосунок, доступний у браузері, у якому користувач:

1. Вибирає країну (UA — за замовчуванням), місто, запит/категорію (наприклад, «Стоматологія»).

2. Запускає пошук і бачить прогрес, витрати/кількість перевірок, помилки окремих джерел.

3. Отримує дедуплікований список бізнесів і колонки: назва, адреса, категорія, сайт, Instagram, інші контакти за наявності, джерела, дата останнього підтвердження, стан пошуку, стан бізнесу, Google Maps (ручна перевірка), CRM-статус.

4. Повторно запускає той самий пошук: старі записи зберігаються, нові додаються, зміни фіксуються, відсутні у свіжому порівнянному джерелі маркуються без автоматичного припущення про закриття.

5. Фільтрує/сортує, переглядає історію та зберігає список у CSV/XLSX, включно з «лише нові після останнього запуску».

6. Веде власні нотатки, пріоритети та статус комунікації з бізнесами, що ніколи не втрачаються під час наступного імпорту.

Не входить до MVP: автоматичне надсилання масових повідомлень/DM, обхід антибот-захисту, парсинг Google Maps UI, Instagram UI, збір приватних акаунтів, автоматичне визначення, що відсутність картки Google доводить відсутність бізнесу.

## 2. Вимоги до джерел і дотримання умов

### 2.1 Реєстр джерел

| Джерело | Роль | Збереження/експорт | Умови |
| --- | --- | --- | --- |
| Overture Maps Places | Основні місця/компанії; інколи сайти, socials, телефони, адреси, operating_status | Так, за умови виконання ліцензій для конкретного запису й належної атрибуції | Прив'язувати source, license, release ID; переглядати походження даних |
| OpenStreetMap (опційно) | Додаткові POI там, де Overture неповний | За ODbL та її вимогами | Використовувати регіональні витяги/власне сховище; публічні Overpass/Nominatim не призначені для масштабного масового збору |
| Офіційні сайти бізнесів | Перевірка доменів, сторінки «Контакти», посилання на соцмережі, загальні бізнес-контакти | За допустимих умов доступу/використання, з повагою до robots.txt, законодавства і правил сайтів | Немає обходу логіна/капчі, немає агресивного crawling; пріоритет структурованим відкритим метаданим |
| Ліцензований search API (опційно) | Пошук нових кандидатів поза геобазою | Лише якщо договір прямо дозволяє збереження та експорт потрібних полів | Підключення за feature flag; договори й політика retention перевіряються до запуску |
| Brave Search API зі стандартними умовами | Лише тимчасова допоміжна вебвидача, без постійної БД із Search Results | Ні, якщо немає окремих storage rights | Стандартні умови забороняють базу з результатів; контракт із правом зберігання — окрема опція |
| Google Maps / Places | Ручна перевірка через відкриття Google Maps, за потреби дозволений окремий live UX | Не використовувати як джерело CRM/експорту за стандартними умовами | Не скрейпити, не робити масову копію; Google Places content і похідні статуси не додавати до експортної бази без окремо перевірених прав |
| Instagram | URL профілю із дозволених відкритих даних або з офіційного сайту компанії | URL за умови законного походження; не копіювати закритий/обмежений контент | Не використовувати логін-ботів, приватні API, обхід лімітів |
| Ручне введення користувача | Бізнеси й перевірені факти | Так, з дотриманням закону та прав третіх осіб | Окреме поле manual_verified_at і власний audit trail |

Перший реліз: Overture + дозволені факти з офіційних сайтів + ручні правки/Google Maps-check. Пошук поза геобазою автоматизувати окремим етапом після підключення джерела з правами на зберігання (інакше ручне додавання з незалежною перевіркою).

### 2.2 Спеціальні вимоги

- Кожен імпортований факт має походження (source_type, source_ref, license, observed_at, confidence, storage_rights). Невідоме право зберігання → факт не зберігати постійно.

- Google Maps: формувати пошукове посилання з незалежно отриманих назви/адреси, відкривати його в новій вкладці; користувач вручну може встановити не перевірено / знайдено вручну / не знайдено вручну / неоднозначно. Не імпортувати Google-дані автоматично. Ручні нотатки не повинні являти собою масове відтворення контенту Google.

- Не називати компанію «немає на Google Maps» автоматично: використовувати «не підтверджено присутність на Google Maps» або «не знайдено при ручній перевірці, дата».

- «Не знайдено сайт» ≠ «сайту немає». Виводити Знайдено / Не виявлено / Не перевірено / Помилка перевірки.

- Дані для outreach: не збирати приватні особисті дані без правової підстави; зберігати бізнес-контакти з provenance, вести opt-out/Do Not Contact, не здійснювати несанкціоновану автоматичну розсилку.

- Ліцензії та source-to-field provenance повинні передаватися у файл експорту через окремий лист «Джерела та ліцензії» або CSV metadata-файл.

## 3. UX і сторінки

### 3.1 Головні маршрути

| Шлях | Функції |
| --- | --- |
| /login | Авторизація, приватний доступ |
| /dashboard | Кількість бізнесів, нових, змінених, не знайдених, зацікавлених, останні скани |
| /search | Країна, місто, запит, категорія, джерела, запуск і оцінка витрат |
| /search/runs/:id | Прогрес пошуку, перелік джерел, статистика run, errors/coverage |
| /countries/:code/cities | Список міст, кількість бізнесів, останнє оновлення |
| /cities/:id | Усі бізнеси й пошукові профілі конкретного міста |
| /businesses | Глобальна таблиця, фільтри, сортування, масові дії й експорт |
| /businesses/:id | Картка компанії, контактні дані, посилання, CRM, факти/джерела/історія |
| /changes | Нові, змінені, відсутні, повторно знайдені, підтверджені закриття |
| /exports | Попередні експорти, параметри нового файлу, повторне формування |
| /settings | Джерела, ключі (статус, не самі секрети), бюджети, категорії, backup, політика доступу |

### 3.2 Форма пошуку

Поля: country (default UA), city (із підказками та точним city_id), query (довільна фраза), category (опційна таксономія), aliases (наприклад, стоматологія, стоматологічна клініка, dental clinic), mode (новий / оновити / перевірити зміни), sources, max_records, max_api_cost, verify_websites.

Кнопка «Знайти/Оновити» запускає асинхронне завдання; повторний клік під час активного ідентичного запуску не створює дубль. Показувати дату останнього повного scan і версію кожного джерела.

### 3.3 Таблиця бізнесів

Колонки: вибір рядків, назва, місто, адреса, категорія, сайт (URL + статус), Instagram (URL + статус), телефон/email за наявності законної підстави, Maps-check (ручний статус + дата), operating_status, source_visibility, пріоритет, CRM status, first_seen, last_seen, last_changed, source badges.

Фільтри: країна, місто, запит/категорія, першоджерело, нові з дати, змінені з дати, site_found, instagram_found, «є Instagram, сайту не знайдено», Maps-check, operating status, missing_candidate, confidence, пріоритет, CRM status, дата контакту, не контактувати. Сортування; збережені набори фільтрів; пагінація; пошук по назві, домену, телефону.

## 4. Модель станів: чотири різні виміри

Не змішувати їх в один status!

| Вимір | Значення | Пояснення |
| --- | --- | --- |
| operating_status | unknown, operational, temporarily_closed, permanently_closed | Заявлений стан діяльності. permanently_closed лише з незалежного надійного джерела або явної ручної перевірки; зникнення з пошуку недостатнє |
| discovery_status (відносно джерела/профілю) | seen, missing_once, missing_multiple, reappeared, unchecked | Чи присутня компанія в порівнянних повних сканах. Історично зберігається на рівні джерела та search profile |
| website_status / instagram_status | found, not_discovered, unchecked, error, а для сайту додатково unreachable | Відсутність результату не доводить відсутність ресурсу |
| maps_check_status | unchecked, manually_found, manually_not_found, ambiguous | Особиста ручна перевірка; це не ліцензійна основа для імпорту Google Maps-контенту |
| crm_status | new, planned, contacted, replied, interested, negotiation, won, lost, do_not_contact | Воронка продажів; незалежна від сканів |

У відображенні можна використовувати українські мітки: «Активний», «Тимчасово зачинено», «Зачинено назавжди», «Не знайдено в останньому повному скануванні», «Потребує перевірки». Зазначати джерело і дату статусу.

## 5. База даних (PostgreSQL + Prisma)

### 5.1 Таблиці (мінімально потрібна схема)

| Таблиця | Ключові поля та обмеження |
| --- | --- |
| users | id, email UNIQUE, password hash / auth provider, role, timestamps |
| countries | id, iso2 UNIQUE, name_uk, name_en |
| cities | id, country_id FK, name, region, slug, latitude, longitude, boundary_geojson_ref, geonames_id UNIQUE NULL, UNIQUE(country_id, region, slug) |
| categories | id, canonical_name, taxonomy_code, synonyms (JSON) |
| search_profiles | id, city_id, query_original, query_normalized, category_id NULL, aliases_json, boundary_version, profile_hash UNIQUE, timestamps |
| search_runs | id, profile_id, triggered_by, mode, state, started_at, finished_at, source_versions_json, counts_json, estimated_cost, actual_cost, error_summary, idempotency_key UNIQUE |
| source_run_statuses | id, run_id, source_type, source_version, scope_hash, state (complete, partial, failed, skipped), items_scanned, error, finished_at; UNIQUE(run_id, source_type) |
| businesses | id UUID PK, city_id FK, brand_id NULL, canonical_name, normalized_name, category_id, address, lat, lng, operating_status, operating_evidence_id NULL, first_seen_at, last_seen_at, last_changed_at, archived_at NULL, created_at, updated_at |
| brands | id, name, canonical_domain NULL; для мереж із кількома філіями |
| business_sources | id, business_id, source_type, external_id, source_uri, license_id, release_id, storage_permission, first_seen_at, last_seen_at, source_metadata_json (лише дозволені поля), UNIQUE(source_type, external_id) для непорожнього ID |
| business_facts | id, business_id, field_name, value_json, source_id, observed_at, verified_at, confidence, is_manual, is_locked, is_current, license_id; історичні версії без видалення |
| business_websites | id, business_id, url, normalized_domain, kind (official, booking, directory, unknown), status, last_http_checked_at, evidence_id, is_primary |
| business_socials | id, business_id, network, url, username, status, evidence_id, is_primary, UNIQUE(business_id, network, username) з обробкою NULL |
| business_contacts | id, business_id, contact_type, value, is_public_business_contact, evidence_id, do_not_contact, verified_at; персональні контакти — лише за правової підстави |
| profile_businesses | profile_id, business_id, first_discovered_at, last_confirmed_at, derived_discovery_status; UNIQUE(profile_id, business_id) |
| source_observations | id, run_id, source_type, business_id, source_record_id NULL, observed_present BOOLEAN, observed_at; UNIQUE(run_id, source_type, business_id) |
| change_events | id, business_id, run_id NULL, event_type, field_name NULL, before_json, after_json, source_id NULL, confidence, created_at |
| google_manual_checks | id, business_id, user_id, status, checked_at, comment (лише власні нотатки), без копіювання Google контенту |
| crm_entries | business_id UNIQUE, status, priority, notes, owner_id, last_contacted_at, next_followup_at, do_not_contact |
| exports | id, created_by, run_id NULL, filters_json, format, row_count, file_key NULL, state, expires_at, created_at, error |
| license_registry | id, source_name, license_code, attribution_text, license_url, version, allow_storage, allow_export |
| audit_logs | id, actor_id, action, entity_type, entity_id, timestamp, metadata_json (без токенів/секретів) |

### 5.2 Обов'язкові правила БД

- UUID як внутрішній бізнес-ідентифікатор; Overture ID як окремий source ID, але не PK бізнесу.

- Один запис = одна реальна локація/філія, не бренд. Два стоматологічні кабінети однієї мережі на різних адресах — два бізнеси з одним brand_id.

- Створення/оновлення виконуються транзакційно; унікальні індекси + advisory locks / job lock для однакових пошукових запусків.

- user-entered та is_locked=true поля не перезаписуються імпортом; зберігати пропозицію змін як окремий факт.

- business_facts — append-only versioning або SCD Type 2; change_events містить компактний diff.

- Індекси: cities(country_id), businesses(city_id, category_id), search_runs(profile_id, started_at DESC), source_observations(run_id, source_type), business_sources(source_type, external_id), trigram index для нормалізованої назви, domain/phone для дедуплікації.

- При видаленні джерела за правилами ліцензії мати механізм source purge/rebuild без втрати незалежних/manual фактів.

## 6. Алгоритм пошуку

1. Валідувати країну/місто/запит і права користувача. Визначити коректну межу міста (за незалежним джерелом геоданих), не покладатися лише на текстове «Івано-Франківськ».

2. Нормалізувати запит: lower-case, trim, Unicode NFKC, локальні синоніми; зв'язати з Overture category taxonomy. Зберігати оригінал і канонічну форму.

3. Знайти/створити search_profile через стабільний profile_hash(country, city, category, normalized query, normalized aliases, coverage scope).

4. Створити search_run, перевірити idempotency key, поставити задачу в job queue.

5. Імпортувати обрані джерела окремо. Для Overture використовувати фіксовану версію релізу та географічний bbox/полігон; брати тільки необхідні колонки; не завантажувати світову базу в оперативну пам'ять web-сервісу.

6. Нормалізувати лише факти, які можна зберігати: назви, адреси, категорії, сайти, соцпосилання, телефони, незалежний operating status, provenance/ліцензії.

7. Перевірити бізнеси на дублікати, додати або оновити факти, не затираючи ручних змін.

8. За бажанням перевірити незалежно знайдені офіційні сайти: DNS, SSL, HTTP status, redirects; витягнути посилання instagram.com/... із доступних за правилами сайту сторінок (тільки зовнішнє публічне посилання, не IG-контент).

9. Сформувати source_observations, change_events, статистику run.

10. Для тільки успішно завершених порівнянних сканувань визначити missing_once / missing_multiple, не змінюючи автоматично operating_status.

11. Позначити завершення (completed, partial, failed); відобразити результат, обмеження покриття і невизначеність.

### 6.1 Нюанси повторного запуску

- Повтор через 2 дні може не дати нових даних Overture, якщо опублікована та сама версія dataset. Не представляти однаковий реліз як свіжу зовнішню перевірку; повторне читання тієї самої версії dataset не збільшує лічильник незалежних перевірок missing. Для нового підтвердження відсутності потрібен свіжіший реліз або окрема незалежна дозволена перевірка, придатна для того самого scope; дозволені перевірки сайтів і ручні доповнення мають свої історії.

- Порівнянними є лише запуски з однаковим profile_hash, географічним охопленням і категоризацією, та source_run_status=complete. partial/failed ніколи не створює відсутність.

- Коли компанія виявлена в одному джерелі і пропала з іншого, її загальний стан не стає missing без перевірки інших джерел.

- При missing_once показувати «Не знайдено у джерелі після 1 повного сканування»; при двох послідовних порівнянних повних сканах — missing_multiple, але не «закрито».

- Якщо бізнес знову знайдений → reappeared event і seen; історію не видаляти.

- operating_status=permanently_closed встановлюється тільки при явному дозволеному сигналі Overture/офіційному повідомленні або ручній перевірці, з датою й evidence. При суперечності не перезаписувати автоматично: needs_review.

- Якщо старий сайт більше не відповідає, статус сайту unreachable, а не no website і не closed business.

- При невдалому скані жоден факт або стан присутності не губиться. Job retries мають бути idempotent.

### 6.2 Приклад дифу

- Запуск A: клініки A/B/C, сайт B=b.example, Instagram C знайдений.

- Запуск B (повний, порівнянний): A/B/D, домен B змінено → запис D додається, B зберігає старий домен в історії та новий як current, C стає missing_once лише для конкретного джерела; A без змін.

- Запуск C: C знову виявлено → reappeared; D лишається старим бізнесом і не дублюється.

## 7. Дедуплікація і злиття

Підготовка: нормалізація Unicode, назв юридичних форм («ТОВ», «ФОП» — обережно), телефонів у E.164, URL/domains (www, UTM, trailing slash), адрес та координат; transliteration aliases (українська/російська/англійська) без втрати оригіналу.

Рівні збігу:

1. Exact: такий самий source_type + external_id → 100% той самий запис джерела; зіставлення з business ID.

2. High confidence: перевірена офіційна доменна назва + дуже схожа назва + та сама фізична адреса; або телефон + назва + та сама адреса. Автозлиття лише за безпечних однозначних умов.

3. Candidate review: схожість назви (наприклад, pg_trgm) + геолокація (до 100 м) + схожа адреса, але немає сильних унікальних ідентифікаторів. На ручний розгляд.

4. Distinct: та сама мережа, але різні локації → НЕ зливати; спільний домен служби запису, агрегатора/Instagram не є доказом одного бізнесу.

Правила: зберігати merge_history та підтримати undo merge; поріг auto >= 0.95, review 0.75..0.95 є початковими продуктними параметрами, не доказовими й калібруються за тестовим датасетом. При сумніві — два окремі записи, позначені possible_duplicate.

## 8. Пошук сайту та Instagram

Послідовність:

1. Взяти websites[] / socials[] безпосередньо із дозволеного джерела.

2. Визначити тип URL: official website, social profile, marketplace/directory, booking page; домени-агрегатори не вважати офіційним сайтом.

3. Для офіційного сайту допустимим легким обходом перевірити головну/контакти/про нас, метадані sameAs, структуровані дані Organization, відкриті посилання на Instagram.

4. Нормалізувати Instagram URL, відрізняти профіль від окремих posts/reels/hashtags і сторонніх посилань. Стан found лише за ймовірного збігу з бізнесом, з рівнем впевненості; спірні → review.

5. Якщо нічого не знайдено — not_discovered, без твердження про відсутність.

6. Додаткове джерело пошуку поза базою реалізувати через окремий адаптер з дозволом на storage або ручне внесення кандидата; заборонене накопичення результатів стандартного пошукового API не допускати.

Вебперевірка: concurrency/budget, timeout, 429/403 backoff, чесний User-Agent, robots.txt, SSRF-захист (не дозволяти private IP/localhost/metadata URLs), обмеження redirects і розміру відповіді, жодного обходу авторизації чи CAPTCHA.

## 9. Google Maps: чітка межа функції

У картці бізнесу відображати кнопку «Перевірити на Google Maps». Для неї будувати посилання на пошук Google Maps із незалежної назви/адреси (без автоматичного скачування/віддзеркалення результатів). Відкривати браузер; користувач може зафіксувати ручний висновок:

- «Є збіг (вручну)»;

- «Не знайшов (вручну)»;

- «Неоднозначно»;

- «Не перевіряв».

Зберігати дату, перевіряючого й коротку власну нотатку. Не переносити з Google списки, назви, координати, телефони, фото, рейтинги або businessStatus до CRM чи export. Автоматизована Google Places інтеграція для lead-generation directory не входить до основного плану через обмеження правил і потребує окремої правової/договірної оцінки. Не рекламувати цю функцію як гарантоване знаходження усіх бізнесів, яких немає в Maps.

## 10. Історія та звіти

### 10.1 Події

BUSINESS_CREATED, BUSINESS_UPDATED, SOURCE_SEEN, SOURCE_MISSING_ONCE, SOURCE_MISSING_REPEATED, SOURCE_REAPPEARED, OPERATING_STATUS_CHANGED, WEBSITE_FOUND, WEBSITE_CHANGED, WEBSITE_UNREACHABLE, INSTAGRAM_FOUND, INSTAGRAM_CHANGED, MANUAL_OVERRIDE, MERGED, UNMERGED, CRM_STATUS_CHANGED.

Події містять дату, причину, джерело, old/new значення (тільки дані, що дозволено зберігати) і посилання на run. Для кожного міста можна побачити таймлайн оновлень.

### 10.2 Аналітика

Кількість за містом/категорією, приріст нових, змінених, зниклих у джерелі, частка із знайденим сайтом/Instagram, потребують перевірки, нові/контактовані/успішні. Якість покриття — кількість успішних джерел, старість релізу, частка даних із доказами. В аналітиці не називати missing «закритими».

## 11. Експорт і генерація файлу з пошуку

Типи експорту:

- CSV UTF-8 with BOM для Excel українською;

- XLSX із листами Бізнеси, Зміни, Пошук, Джерела та ліцензії;

- JSON — опційно для машинного обміну.

Зона експорту: вся база / місто / search_profile / конкретний search_run / вибрані рядки / поточні фільтри / лише нові / лише змінені / лише missing / CRM pipeline.

Обов'язкові поля у файлі: internal_business_id, country, city, query, business_name, address, category, website_url, website_status, instagram_url, instagram_status, public_business_phone (коли допустимо), operating_status, discovery_status, maps_manual_check_status, crm_status, priority, first_seen_at, last_seen_at, last_changed_at, source_names, data_confidence, notes (тільки якщо вибрано); run_id, export_created_at у metadata.

Обмеження: виключати дані із забороною зберігання/експорту; формувати файл із власної БД, не з Google Maps / стандартних Brave Search Results. Агреговані джерела/ліцензії та дату стану зазначати в експорті.

UX: кнопка Експорт → вибір CSV/XLSX, охоплення Поточний пошук / Усі бізнеси міста / Лише нові / Лише зміни, перемикач «Додати історію змін» → створення exports job → після завершення кнопка скачування. filename = lead-finder_UA_ivano-frankivsk_stomatolohiia_YYYY-MM-DD_HHmm.xlsx (slug і timestamp — server-generated). При великому файлі — streaming/тимчасове об'єктне сховище з URL, що спливає; при невеликому — stream attachment без серверної файлової системи. У метаданих зберігати параметри експорту, не обов'язково сам файл назавжди.

## 12. API контракт NestJS v1

Усі маршрути, крім auth/health, потребують авторизації, валідації DTO (class-validator або Zod), пагінації та обмеження доступу.

| Метод/ендпоінт | Призначення |
| --- | --- |
| POST /api/v1/auth/login, POST /api/v1/auth/logout, GET /api/v1/auth/me | Сесія; HttpOnly Secure cookies; CSRF protection де потрібно |
| GET /api/v1/countries, GET /api/v1/cities?country=UA&q=... | Географічні довідники |
| POST /api/v1/search-profiles, GET /api/v1/search-profiles, GET /api/v1/search-profiles/:id | Збережені запити |
| POST /api/v1/search-runs | Створити job; повертає 202 Accepted + run_id, location; idempotency key |
| GET /api/v1/search-runs/:id, GET /api/v1/search-runs/:id/events | Прогрес і журнал; polling або SSE |
| GET /api/v1/businesses | Фільтри, сорт, cursor pagination |
| GET /api/v1/businesses/:id, PATCH /api/v1/businesses/:id | Перегляд, ручне редагування |
| GET /api/v1/businesses/:id/history | Історія й походження полів |
| POST /api/v1/businesses/:id/maps-manual-check | Запис власної ручної перевірки |
| PATCH /api/v1/businesses/:id/crm | CRM статус/notes/priority |
| GET /api/v1/duplicates, POST /api/v1/duplicates/:id/resolve | Перевірка можливих дублів, merge/keep separate |
| GET /api/v1/changes, GET /api/v1/analytics/overview | Зміни та статистика |
| POST /api/v1/exports, GET /api/v1/exports/:id, GET /api/v1/exports/:id/download | Генерація і скачування файлу |
| GET /api/v1/health/live, GET /api/v1/health/ready | Render monitoring / DB readiness |

### Приклад запиту

```text
POST /api/v1/search-runs  
{  
  "countryCode": "UA",  
  "cityId": "uuid-of-ivano-frankivsk",  
  "query": "Стоматологія",  
  "aliases": ["стоматології", "стоматологічна клініка", "dental clinic"],  
  "mode": "refresh",  
  "sources": ["overture", "official_site_enrichment"],  
  "maxRecords": 500,  
  "maxCostUsd": 2.00,  
  "verifyWebsites": true  
}
```

Відповідь: 202 {"runId":"uuid","state":"queued"}. Зміни відбуваються лише після завершення конкретного кроку і DB commit. GET run повертає coverage, sourceVersions, created/updated/unchanged/missingCandidate/errors, а не лише один загальний відсоток.

## 13. Архітектура репозиторію

```text
lead-finder/  
  apps/  
    web/                     # Next.js App Router + TS + Tailwind + UI components  
    api/                     # NestJS REST API, auth, Prisma services  
    worker/                  # NestJS standalone worker / queue consumer  
  packages/  
    db/                      # Prisma schema, migrations, seed  
    shared/                  # Zod DTO/types/enums, constants  
    data-sources/            # source adapter contracts + license guards  
  scripts/  
    import-overture/         # versioned, bounded geospatial import  
  docs/  
    PRD.md  
    ARCHITECTURE.md  
    DATA_SOURCES_AND_LICENSES.md  
    API.md  
    DEPLOY_RENDER.md  
    RUNBOOK.md  
  tests/  
    fixtures/  
    integration/  
    e2e/  
  render.yaml                # Render Blueprint, no secrets  
  pnpm-workspace.yaml  
  package.json  
  .env.example  
  AGENTS.md
```

Стек:

- Frontend: Next.js App Router, TypeScript, Tailwind, shadcn/ui, TanStack Query, TanStack Table, React Hook Form + Zod.

- Backend: NestJS, Prisma, PostgreSQL, Swagger/OpenAPI, Zod або class-validator, Pino logs.

- Пошук у БД: PostgreSQL pg_trgm; PostGIS опційно для геодистанції/полігонів (або координати + SQL на MVP).

- Background jobs: PostgreSQL-backed queue (наприклад, pg-boss; перевірити сумісність актуальної версії) і окремий Render background worker або ідемпотентна chunked-job архітектура для економного прототипу; для production — worker.

- Overture import: batch job із DuckDB/Python CLI за межами вебпроцесу з параметрами релізу/географії, stream/batches → PostgreSQL; у Render worker потрібні належні RAM/CPU.

- Export: ExcelJS / CSV streaming, Content-Disposition attachment; резервний варіант — S3-compatible storage з TTL.

- Auth: email/password + Argon2id або керований auth provider; одноосібний приватний доступ у MVP.

## 14. Render deployment

Продуктова конфігурація:

1. Web — Render Web Service (Next.js SSR, якщо потрібні серверні функції; для чисто клієнтської адмінки можна Static Site).

2. API — Render Web Service (NestJS), PORT від Render, binding 0.0.0.0.

3. Worker — Render Background Worker (очередь Postgres jobs, imports, enrich, exports).

4. Postgres — Render Postgres paid для довготривалих даних або сумісний зовнішній керований PostgreSQL; підключення TLS/секрети.

5. Optional Cron — планове оновлення/бекап, якщо є сенс. Окремий web cron не є потрібним для ручного MVP.

Прототип із мінімальними витратами: Next.js Static Site + NestJS Web Service + зовнішній постійний PostgreSQL; малі імпорти виконувати ідемпотентними порціями, без гарантії фонової роботи після простою. Це не production-аналог постійного worker.

Особливості Render:

- Файлова система вебсервісу ephemeral: SQLite та .xlsx як постійне сховище не використовувати.

- Безкоштовний Render Postgres має обмеження 1 GB і термін 30 днів; для накопичувальної CRM непридатний без переходу на paid або міграції.

- Безкоштовні web services можуть засинати; тривалі job запускати у worker на платному плані, не тримати відкритим один HTTP-запит.

- render.yaml описує topology/build/start/health; секрети в Environment Groups, ніколи в Git.

- prisma migrate deploy під час деплою як контрольований pre-deploy step; зворотносумісні міграції, backups, налаштована CORS allowlist.

- План щоденного backup DB + перевірка відновлення, метрики disk/DB/queue; alerts на завислі jobs/API квоти.

## 15. Безпека, якість і експлуатація

- Security: auth, RBAC (owner/admin), brute-force protection, rate limits, session expiration, CSRF, HTTPS, CSP, CORS allowlist.

- API keys only server-side; encryption at rest provider side, redaction logs; robots.txt, privacy policy за потреби.

- SSRF mitigation для HTTP-перевірки будь-яких URL, DNS recheck, private IP denylist; no arbitrary port scanning.

- Cost controls: per-run maxRecords, timeout, daily API quota, retry with jitter, provider rate limits, budget stop with partial status.

- Stability: job idempotency, checkpoints, dead-letter/failure reporting, structured logs з run_id, retry only transient errors, transaction isolation, DB unique constraints.

- Data quality: confidence per fact, non-destructive merges, manual override immutable across ingestion, provenance/licence.

- Privacy: мінімізація даних, розділення бізнес- та персональних контактів, можливість видалення/виправлення, do-not-contact, retention policy.

- Observability: log provider latency, counts, errors, coverage completeness; Sentry/OTel — опційно.

- Accessibility: keyboard navigation, loading/empty/error states, responsive mobile and desktop, українська локалізація.

## 16. Покроковий план для Codex (виконувати послідовно)

### Фаза 0 — Specification & research gate

- Створити docs/PRD.md, docs/ARCHITECTURE.md, docs/DATA_SOURCES_AND_LICENSES.md і AGENTS.md на основі ТЗ.

- Перевірити актуальність Overture taxonomy, schema, license attribution, Render pricing і Terms provider API.

- У DATA_SOURCES_AND_LICENSES.md дати таблицю can_store/can_export/retention/restrictions і відключити непридатні інтеграції.

- Готово, коли: в коді є centralized source policy guard; Google/Brave restricted data не потрапляють у persistent lead DB.

### Фаза 1 — Monorepo, CI, контейнеризація

- Створити pnpm workspace: web, api, worker, packages/db, shared.

- ESLint, Prettier, TypeScript strict, .env.example, Docker Compose для локального PostgreSQL, test commands, GitHub Actions lint/test/build.

- Готово, коли: чистий clone, pnpm install, pnpm dev, pnpm test працюють, TS build без помилок.

### Фаза 2 — Schema, migrations, seed

- Реалізувати Prisma schema із §5, міграції, constraints, індекси, seed countries (UA default) і міста Івано-Франківськ.

- Додати normalized lookup keys, source licensing metadata, таблицю change events.

- Готово, коли: prisma migrate deploy, seed і повторний seed ідемпотентні; створюються тестові бізнеси без дублів.

### Фаза 3 — Auth, API foundation

- Login/session/logout, Swagger, health/live+ready, DTO validation, error handler, configuration, scoped auth.

- Готово, коли: усі приватні endpoints без авторизації повертають 401, готовність БД перевіряється.

### Фаза 4 — UI: географія, search profiles, таблиця

- Dashboard, форма пошуку default Україна/Івано-Франківськ/Стоматологія, saved search profiles, бізнес-таблиця, мобільна адаптивність.

- Спочатку використати fixtures, не прив'язувати UI до конкретного data provider.

- Готово, коли: користувач зберігає профіль, переглядає компанії та фільтрує без API-інтеграцій.

### Фаза 5 — Queue & run engine

- POST search-runs повертає 202/run_id; run state machine (queued, running, completed, partial, failed, cancelled), checkpoint/retry, concurrency guard, progress updates.

- Готово, коли: випадковий рестарт/дубль webhook/повторна кнопка не дублюють результати; помилки джерел видимі.

### Фаза 6 — Overture adapter (перший реальний source)

- Узгодити taxonomy mappings, country/city geo boundaries, release version; extract потрібні Parquet фрагменти пакетно через DuckDB/Python, нормалізувати names, websites, socials, addresses, operating_status, sources.

- Зберегти license attribution, release id, source-specific IDs; не завантажувати весь світ у NestJS memory.

- Готово, коли: реальний запуск для Івано-Франківська створює записи з коректними доказами та окремими source run outcomes.

### Фаза 7 — Dedup, incremental sync, history (критична)

- Реалізувати source-ID match, strong composite match, fuzzy candidate review, unique constraints, safe merge/unmerge.

- Реалізувати повторний scan (append-only history, only changes update current facts, user lock preserved), correct missing status for full comparable runs.

- Готово, коли: три послідовні запуски за fixtures A/B/C дають очікувані new, changed, missing_once, reappeared, без видалення бізнесів.

### Фаза 8 — Official website / Instagram enrichment

- Легальні перевірки офіційних URL; robots/ToS, rate limit, HTTP status, redirect, sameAs, публічні посилання на Instagram з сайту; функції on/off, budgets.

- Готово, коли: вихідний домен і Instagram прив'язуються лише до правильного бізнесу, агрегатор не стає офіційним сайтом, 403/timeout не сприймається як «немає сайту».

### Фаза 9 — Google Maps manual check UI

- На бізнес-картці — кнопка Google Maps Search link; manual check form (4 стани + дата + власна нотатка), жодного автоматичного збереження Google Places data.

- Готово, коли: користувач може позначити ручний результат, але в DB не з'являються копії Google Maps-даних.

### Фаза 10 — CRM, filters, saved views

- CRUD notes/CRM status/priority/follow-up, Do Not Contact; фільтри, пагінація, saved views, counts.

- Готово, коли: ручний CRM статус не змінюється при повторному імпорті, список фільтрується server-side.

### Фаза 11 — Export CSV / XLSX

- UI export scope+filters, server-side job, CSV UTF-8 BOM, XLSX із metadata/history/licensing, стримінг та файли з обмеженим життям.

- Готово, коли: експорт того самого run відтворюваний, source rights enforced, Excel відкриває українські символи, розділи new/changed/missing коректні.

### Фаза 12 — Automated search outside geo dataset (license gate)

- Додати SearchCandidateProvider adapter тільки для юридично дозволеного API з правом storage+export; до наявності ліцензії — manual candidate flow.

- Candidate → незалежна верифікація з офіційного сайту → dedup → business; статус not_found_on_maps тільки вручну та з датою.

- Готово, коли: можна додавати нові компанії, яких немає в Overture, без копіювання забороненої пошукової видачі.

### Фаза 13 — E2E tests, data quality, security

- Playwright E2E: login, search, rerun, missing, duplicate review, manual maps check, export; unit/integration tests for state machines; load tests 1k+ businesses; access audit.

- Готово, коли: 100% критичних acceptance scenarios проходять, npm audit/scan, API keys not exposed.

### Фаза 14 — Deploy Render, backup/runbook

- Створити Render Blueprint, Web/API/Worker/Postgres, config env, health checks, CI deploy, backups, restore rehearsal, monitoring.

- Готово, коли: після redeploy усі бізнеси/статуси/історія/CRM зберігаються; новий і повторний scan повністю проходить у продакшені.

### Фаза 15 — Post-MVP опції

- AI аналіз власних офіційних сайтів (мобільна версія, CTA, форма запису, структура; без забороненого використання Google/Brave контенту для AI).

- Бал пріоритету: відсутній/слабкий сайт, Instagram є, ніша, публічні дані, давність контакту; не оцінювати персональні характеристики людей.

- Інтеграції CRM, scheduled scans, search license integration, картографічні візуалізації на open map із належною ліцензією.

## 17. Тестові сценарії / критерії приймання

| ID | Сценарій | Очікуваний результат |
| --- | --- | --- |
| AC-01 | Відкрити /search уперше | Країна UA, місто Івано-Франківськ, запит «Стоматологія» |
| AC-02 | Пошукати інше місто | Дані зберігаються окремо, належать правильній країні/місту |
| AC-03 | Провести той самий пошук 2 рази з тим самим source snapshot | Кількість бізнесів не подвоюється; немає фальшивих змін |
| AC-04 | У 2-му повному scan з'явився новий бізнес | Новий рядок + BUSINESS_CREATED, старі рядки збережені |
| AC-05 | Змінився website URL | Старе значення в історії, нове current, подія зміни |
| AC-06 | Бізнес зник з 1-го повного source scan | missing_once лише в цьому джерелі; operating не змінено |
| AC-07 | Другий повний scan знову не знайшов | missing_multiple; не permanently_closed |
| AC-08 | Source scan помилковий або неповний | Не створювати missing events |
| AC-09 | Раніше відсутній бізнес з'явився | reappeared, попередня історія та CRM збережені |
| AC-10 | Один бренд із двома філіями | Два бізнеси, один brand, не зливаються |
| AC-11 | Ручно змінено сайт/CRM статус | Новий імпорт не стирає ручних даних, є audit log |
| AC-12 | Сайт повертає 403 або timeout | error/unreachable, не no website, не business closed |
| AC-13 | Немає Instagram у доступних джерелах | not_discovered, не твердження про відсутність |
| AC-14 | Відкрито Google Maps із картки | Зовнішній пошук; жодного bulk Google ingestion |
| AC-15 | Збережено manual Google Maps check | Зберігається ручний статус + дата, не Google content |
| AC-16 | Експорт лише нові після run X | Вивантажуються лише ці нові бізнеси, метадані і ліцензії включені |
| AC-17 | Експорт XLSX українською | Коректні літери, багатолистовий файл, поля не зламані |
| AC-18 | Provider API без storage rights | Результати не опиняються в persistent DB/export |
| AC-19 | Перезапуск Render deployment | База, run history, CRM і файли в належному сховищі збережені |
| AC-20 | Одночасно двічі запущено такий самий scan | Немає подвоєння рядків; jobs lock/idempotency |
| AC-21 | Бізнес вручну додано, source його не знає | Він залишається в CRM, статус джерела «не перевірено» |
| AC-22 | Source змінив ліцензію або revocation | Зупинка відповідного adapter, source purge/rehydrate за політикою без втрати незалежних даних |

## 18. Визначення готового MVP

Застосунок можна вважати готовим для щоденної роботи, коли він:

- авторизує власника та працює через Render;

- приймає country/city/query з дефолтами;

- отримує хоча б одне реальне дозволене джерело бізнесів по місту (Overture);

- показує сайт/Instagram за наявності незалежно підтверджених джерел;

- не дублює бізнес при rerun, зберігає раніше знайдені компанії й журнал змін;

- правильно розділяє не знайдено і зачинено;

- дозволяє ручний Google Maps-check, CRM notes/priority;

- експортує CSV та XLSX з фільтрами й ліцензіями;

- не втрачає дані після перезапуску/deploy і має backup;

- проходить AC-01..AC-22 із §17.

## 19. Інструкція для Codex: як виконувати ТЗ

AGENTS.md — вимоги до агента:

- Перед кожною фазою читати це ТЗ, architecture docs і попередні ADR; виконувати рівно одну фазу за раз.

- Не вигадувати неіснуючих provider APIs і не обходити ToS; якщо storage/export права невідомі — блокувати запис даних, описати blocker.

- Не змінювати стан permanently_closed з відсутності в джерелі; не перезаписувати manual CRM/locked facts.

- Для кожної фази створити міграції/тести/документацію; запускати lint, typecheck, tests, build; звітувати, що зроблено і що лишилося.

- Не зберігати секрети, приватні дані, великі сторонні raw payloads; використовувати adapters і mock fixtures в тестах.

- Не переходити до наступної фази, доки acceptance tests поточної фази не пройдено.

Перший промпт для Codex:

> Прочитай LEAD_FINDER_TECHNICAL_SPEC_UA.md. Працюй як senior full-stack engineer/architect. Спочатку виконай лише Фазу 0 та Фазу 1. Сформуй AGENTS.md, docs/ARCHITECTURE.md, docs/DATA_SOURCES_AND_LICENSES.md, ADR щодо ліцензій і стратегії incremental sync. Підніми monorepo Next.js + NestJS + PostgreSQL/Prisma, налаштуй локальний запуск, CI, lint/types/tests. Не підключай Google Maps або Brave як джерело перманентної CRM. Наприкінці покажи результат тестів, дерево файлів, ризики та конкретні команди запуску. Наступні фази не реалізовуй без окремого завдання.

Наступний промпт (повторювати для Фази N):

> Виконай Фазу N з LEAD_FINDER_TECHNICAL_SPEC_UA.md з дотриманням залежностей. Спочатку оціни існуючу кодову базу. Реалізуй лише вимоги фази, додай unit/integration тести й міграції (за потреби), онови docs. Перевір pnpm lint, pnpm typecheck, pnpm test, pnpm build. Не порушуй source license guard, append-only history, CRM manual locks і state distinctions. Наприкінці звіт із виконаних acceptance criteria та blockers.

## 20. Джерела для технічної і правової перевірки

Перевірено 18.11.2026; перед запуском production актуалізувати умови сервісів. Це не юридичний висновок.

- Overture Places guide: https://docs.overturemaps.org/guides/places/

- Overture schema: https://github.com/OvertureMaps/schema/blob/main/schema/places/place.yaml

- Overture license/attribution: https://docs.overturemaps.org/attribution/

- Overture releases/catalog: https://stac.overturemaps.org/catalog.json

- Google Maps Platform Terms: https://cloud.google.com/maps-platform/terms

- Google Places policy: https://developers.google.com/maps/documentation/places/web-service/policies

- Google Places search: https://developers.google.com/maps/documentation/places/web-service/text-search

- Brave API Terms: https://api-dashboard.search.brave.com/app/documentation/general/terms-of-service

- Brave API storage rights: https://brave.com/search/api/

- Render Next.js: https://render.com/docs/deploy-nextjs-app

- Render service types: https://render.com/docs/service-types

- Render Free limitations: https://render.com/docs/free

- Render Cron: https://render.com/docs/cronjobs

- UK ICO business-to-business marketing guidance (приклад privacy rules для міжнародного ринку): https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/



Пріоритет реалізації: стабільність і право зберігати дані > точність дедуплікації та історії > обсяг джерел > AI-функції. Не обіцяти повноту всієї кількості стоматологій у місті: відкриті геодані та вебіндекси неповні.
