# Подробная инструкция по работе с Message Batches API для React

## Что такое Message Batches API

Message Batches API — это мощный и экономически эффективный способ асинхронной обработки больших
объемов запросов Messages
[(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing). Этот подход хорошо
подходит для задач, которые не требуют немедленных ответов, при этом большинство пакетов завершается
менее чем за 1 час, снижая затраты на 50% и увеличивая пропускную способность
[(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing).

## Установка и настройка

Для работы с TypeScript/JavaScript используйте официальную библиотеку
[(2)](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/README.md):

```bash
npm install @anthropic-ai/sdk
```

[(2)](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/README.md)

## Базовая настройка клиента

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env['ANTHROPIC_API_KEY'], // Это значение по умолчанию и может быть опущено
});
```

[(2)](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/README.md)

## 1. Создание Message Batch

### Базовый пример создания пакета

```typescript
await anthropic.messages.batches.create({
  requests: [
    {
      custom_id: 'my-first-request',
      params: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello, world' }],
      },
    },
    {
      custom_id: 'my-second-request',
      params: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hi again, friend' }],
      },
    },
  ],
});
```

[(2)](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/README.md)

### Структура запроса

Message Batch состоит из списка запросов для создания сообщения
[(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing). Форма отдельного
запроса включает:

- Уникальный `custom_id` для идентификации запроса Messages
  [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)
- Объект `params` со стандартными параметрами Messages API
  [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)

### Ограничения и важные моменты

- Message Batch ограничен либо 100,000 запросами Messages, либо 256 МБ по размеру, в зависимости от
  того, что достигается первым
  [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)
- `custom_id` имеет ограничение в 64 символа
  [(3)](https://github.com/anthropics/anthropic-sdk-python/issues/984)
- Каждый запрос в пакете должен иметь уникальный `custom_id`
  [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)

## 2. Отслеживание статуса пакета

### Опрос статуса завершения

Для опроса Message Batch вам понадобится его `id`, который предоставляется в ответе при создании
запроса
[(4)](https://docs.anthropic.com/en/api/messages-batch-examples#polling-for-message-batch-completion):

```python
import anthropic

client = anthropic.Anthropic()

message_batch = None
while True:
    message_batch = client.messages.batches.retrieve(
        MESSAGE_BATCH_ID
    )
    if message_batch.processing_status == "ended":
        break

    print(f"Batch {MESSAGE_BATCH_ID} is still processing...")
    time.sleep(60)
print(message_batch)
```

[(4)](https://docs.anthropic.com/en/api/messages-batch-examples#polling-for-message-batch-completion)

### Статусы обработки

Поле `processing_status` Message Batch указывает на стадию обработки пакета
[(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing):

- `in_progress` — пакет обрабатывается
  [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)
- `ended` — все запросы в пакете завершили обработку
  [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)

## 3. Получение результатов пакета

### Получение результатов после завершения

Как только статус вашего Message Batch станет `ended`, вы сможете просмотреть `results_url` пакета и
получить результаты в виде файла `.jsonl`
[(4)](https://docs.anthropic.com/en/api/messages-batch-examples#polling-for-message-batch-completion):

```python
import anthropic

client = anthropic.Anthropic()

# Потоковая передача файла результатов в эффективных по памяти фрагментах, обработка по одному за раз
for result in client.messages.batches.results(
    MESSAGE_BATCH_ID,
):
    print(result)
```

[(4)](https://docs.anthropic.com/en/api/messages-batch-examples#polling-for-message-batch-completion)

### Типы результатов

После завершения обработки пакета каждый запрос Messages в пакете будет иметь результат
[(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing). Существует 4 типа
результатов:

| Тип результата | Описание                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `succeeded`    | Запрос был успешным. Включает результат сообщения [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)                                                 |
| `errored`      | Запрос столкнулся с ошибкой и сообщение не было создано [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)                                           |
| `canceled`     | Пользователь отменил пакет до того, как этот запрос мог быть отправлен модели [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)                     |
| `expired`      | Пакет достиг своего 24-часового срока действия до того, как этот запрос мог быть отправлен модели [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing) |

### Работа с результатами в TypeScript

```typescript
const results = await anthropic.messages.batches.results(batch_id);
for await (const entry of results) {
  if (entry.result.type === 'succeeded') {
    console.log(entry.result.message.content);
  }
}
```

[(2)](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/README.md)

## 4. Использование с кэшированием промптов

Message Batches API поддерживает кэширование промптов, что позволяет потенциально снизить затраты и
время обработки для пакетных запросов
[(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing). Скидки на цены от
кэширования промптов и Message Batches могут складываться, обеспечивая еще большую экономию затрат
при совместном использовании обеих функций
[(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing).

### Пример с кэшированием

```bash
curl https://api.anthropic.com/v1/messages/batches \
     --header "x-api-key: $ANTHROPIC_API_KEY" \
     --header "anthropic-version: 2023-06-01" \
     --header "content-type: application/json" \
     --data \
'{
    "requests": [
        {
            "custom_id": "my-first-request",
            "params": {
                "model": "claude-opus-4-20250514",
                "max_tokens": 1024,
                "system": [
                    {
                        "type": "text",
                        "text": "You are an AI assistant tasked with analyzing literary works. Your goal is to provide insightful commentary on themes, characters, and writing style.\n"
                    },
                    {
                        "type": "text",
                        "text": "<the entire contents of Pride and Prejudice>",
                        "cache_control": {"type": "ephemeral"}
                    }
                ],
                "messages": [
                    {"role": "user", "content": "Analyze the major themes in Pride and Prejudice."}
                ]
            }
        }
    ]
}'
```

[(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)

## 5. Отмена пакета

### Отмена Message Batch

```python
import anthropic

client = anthropic.Anthropic()

message_batch = client.messages.batches.cancel(
    MESSAGE_BATCH_ID,
)
print(message_batch)
```

[(4)](https://docs.anthropic.com/en/api/messages-batch-examples#polling-for-message-batch-completion)

Сразу после отмены `processing_status` пакета будет `canceling`
[(4)](https://docs.anthropic.com/en/api/messages-batch-examples#polling-for-message-batch-completion).
Вы можете использовать ту же технику опроса для завершения пакета, чтобы опросить, когда отмена
будет завершена, поскольку отмененные пакеты также заканчиваются `ended` и могут содержать
результаты
[(4)](https://docs.anthropic.com/en/api/messages-batch-examples#polling-for-message-batch-completion).

## 6. Поддерживаемые модели

Message Batches API в настоящее время поддерживает
[(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing):

- Claude Opus 4 (`claude-opus-4-20250514`)
  [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)
- Claude Sonnet 4 (`claude-sonnet-4-20250514`)
  [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)
- Claude Sonnet 3.7 (`claude-3-7-sonnet-20250219`)
  [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)
- Claude Sonnet 3.5 (`claude-3-5-sonnet-20240620` и `claude-3-5-sonnet-20241022`)
  [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)
- Claude Haiku 3.5 (`claude-3-5-haiku-20241022`)
  [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)
- Claude Haiku 3 (`claude-3-haiku-20240307`)
  [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)
- Claude Opus 3 (`claude-3-opus-20240229`)
  [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)

## 7. Ценообразование

Batches API предлагает значительную экономию затрат
[(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing). Все использование
взимается по цене 50% от стандартных цен API
[(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing).

## 8. Лучшие практики

Для максимально эффективного использования Batches API
[(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing):

- Регулярно отслеживайте статус обработки пакета и реализуйте соответствующую логику повторных
  попыток для неудачных запросов
  [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)
- Используйте значимые значения `custom_id` для легкого сопоставления результатов с запросами,
  поскольку порядок не гарантирован
  [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)
- Рассмотрите разбиение очень больших наборов данных на несколько пакетов для лучшей управляемости
  [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)
- Выполните пробный запуск одной формы запроса с Messages API, чтобы избежать ошибок валидации
  [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)

ИСТОЧНИКИ:
[(4)](https://docs.anthropic.com/en/api/messages-batch-examples#polling-for-message-batch-completion),
[(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing),
[(5)](https://docs.anthropic.com/en/api/creating-message-batches#feature-support),
[(2)](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/README.md),
[(3)](https://github.com/anthropics/anthropic-sdk-python/issues/984),
[(6)](https://github.com/anthropics/anthropic-sdk-typescript/issues/553)
