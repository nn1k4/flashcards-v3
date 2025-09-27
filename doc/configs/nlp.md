# nlp.json — Сегментация

Цель: управлять выбором движка сегментации латышского текста.

Файл: `config/nlp.json`

Структура:

```json
{
  "segmentation": {
    "engine": "primitive",
    "engines": {
      "primitive": { "enabled": true },
      "latvian_sentence_tester:local": { "enabled": false }
    }
  }
}
```

Ключи:

- `segmentation.engine`: текущий движок сегментации. Значения:
  - `primitive` — детерминированный встроенный сплиттер (по умолчанию)
  - `latvian_sentence_tester:local` — локальный усовершенствованный движок из внешнего проекта
- `segmentation.engines.*.enabled`: флажки наличия/готовности движков (информационные)

Интеграция:

- В коде используется `buildManifestWithEngine(..., engine)`, где `engine` читается из `config.nlp`.
- При `engine = "latvian_sentence_tester:local"` функция `segmentText()` вызывает
  `splitIntoSentencesAdvanced()` из локального файла `src/external/latvianSegmentation.ts`.

Синхронизация внешнего модуля:

- Источник: `/mnt/d/latvian_sentence_tester/project/client/src/utils/latvianSegmentation.ts`
- Копировать в этот проект по пути: `src/external/latvianSegmentation.ts`
- Место использования: `src/utils/segmentation.ts`
- Режим обновления: при каждом релевантном изменении во внешнем проекте копируйте файл заново (без
  модификаций интерфейса). Базовый функционал уже реализован во внешнем модуле.

Примечание:

- Если локальный файл отсутствует, переключите `engine` обратно на `primitive` или добавьте файл.
- Дальнейшая эволюция может заменить копирование на npm-пакет или git submodule.
