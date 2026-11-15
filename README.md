# Fallout Shelter Planner

Публичный планировщик убежищ для обычного режима Fallout Shelter на PlayStation 5. Сайт работает в браузере, интерфейс доступен на русском и английском.

В v1 входят каталог консольных комнат, редактор этажей, баланс ресурсов и рабочих мест, смета в крышках, маршрут нападения на изученных схемах, проверка простоя и обмен планами через ссылку, PNG и PDF.

- [Доска проекта](https://github.com/users/IaroslavAl/projects/2)
- [Milestone v1.0](https://github.com/IaroslavAl/fallout-shelter-planner/milestone/1)
- [Реестр источников](docs/data.md)

Это независимый фанатский проект. Fallout Shelter принадлежит Bethesda.

[Открыть конструктор / Open the planner](https://iaroslaval.github.io/fallout-shelter-planner/)

Выберите демонстрационную схему или чистое убежище, затем выберите комнату и свободную клетку. На компьютере комнату можно перетащить мышью. На телефоне для перетаскивания потяните за ручку на карточке или у комнаты. Зелёный контур показывает клетку, в которую встанет комната при отпускании. Работники и улучшения меняются на вкладке «Комната». В смете включается режим проверки последовательной перестройки, а на вкладке «Нападение» можно отключить несколько комнат и проверить запас. Ссылка открывает редактируемую копию, JSON даёт переносимый резервный файл.

## English

A browser vault planner for Fallout Shelter on PS5, Normal mode. Build a layout, set workers and Mr. Handy floors, compare resources against demand, and test a temporary production outage. Share an editable link or export PNG, print PDF, or JSON. Public tables and measurements inform the model. Some estimates still need a PS5 spot check. [Data and limitations](docs/data.md)

## Local development

Use Node.js 24 and npm. Commands:

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
```

The map opens in illustrated view. Use the image button on the map toolbar to switch to the schematic. [Room artwork and prompts](docs/art.md). The schematic uses [Lucide icons](https://lucide.dev/license). Fonts are self-hosted via Fontsource.
