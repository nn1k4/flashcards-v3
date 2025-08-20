# Мануал по парсингу результатов пакетной обработки в React

## Структура результатов Message Batch

Результаты пакета доступны для загрузки по свойству `results_url` в Message Batch
[(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing). Результаты будут в
формате `.jsonl`, где каждая строка является валидным JSON объектом, представляющим результат одного
запроса в Message Batch
[(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing).

## Типы результатов

После завершения обработки пакета каждый запрос Messages будет иметь один из 4 типов результатов
[(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing):

| Тип результата | Описание                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `succeeded`    | Запрос был успешным. Включает результат сообщения [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)                                                 |
| `errored`      | Запрос столкнулся с ошибкой и сообщение не было создано [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)                                           |
| `canceled`     | Пользователь отменил пакет до того, как этот запрос мог быть отправлен модели [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)                     |
| `expired`      | Пакет достиг своего 24-часового срока действия до того, как этот запрос мог быть отправлен модели [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing) |

## Базовый пример парсинга результатов в TypeScript

```typescript
const results = await anthropic.messages.batches.results(batch_id);
for await (const entry of results) {
  if (entry.result.type === 'succeeded') {
    console.log(entry.result.message.content);
  }
}
```

[(2)](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/README.md)

## Полный React компонент для парсинга результатов

```typescript
import React, { useState, useEffect } from 'react';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env['ANTHROPIC_API_KEY'],
});
```

[(2)](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/README.md)

```typescript
interface BatchResult {
  custom_id: string;
  result: {
    type: 'succeeded' | 'errored' | 'canceled' | 'expired';
    message?: any;
    error?: any;
  };
}

const BatchResultsParser: React.FC<{ batchId: string }> = ({ batchId }) => {
  const [results, setResults] = useState<BatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const parseResults = async () => {
      try {
        const batchResults = await client.messages.batches.results(batchId);
        const parsedResults: BatchResult[] = [];

        for await (const entry of batchResults) {
          parsedResults.push(entry as BatchResult);
        }

        setResults(parsedResults);
      } catch (err) {
        setError(`Ошибка при получении результатов: ${err}`);
      } finally {
        setLoading(false);
      }
    };

    parseResults();
  }, [batchId]);

  if (loading) return <div>Загрузка результатов...</div>;
  if (error) return <div>Ошибка: {error}</div>;

  return (
    <div>
      <h2>Результаты пакетной обработки</h2>
      {results.map((result) => (
        <ResultItem key={result.custom_id} result={result} />
      ))}
    </div>
  );
};
```

## Компонент для отображения отдельного результата

```typescript
const ResultItem: React.FC<{ result: BatchResult }> = ({ result }) => {
  const renderResultContent = () => {
    switch (result.result.type) {
      case 'succeeded':
        return (
          <div className="success-result">
            <h4>Успешно: {result.custom_id}</h4>
            <div>
              {result.result.message?.content?.map((content: any, index: number) => (
                <p key={index}>{content.text}</p>
              ))}
            </div>
            <small>
              Токены: вход {result.result.message?.usage?.input_tokens},
              выход {result.result.message?.usage?.output_tokens}
            </small>
          </div>
        );

      case 'errored':
        return (
          <div className="error-result">
            <h4>Ошибка: {result.custom_id}</h4>
            <p>Тип ошибки: {result.result.error?.type}</p>
            <p>Сообщение: {result.result.error?.message}</p>
          </div>
        );

      case 'canceled':
        return (
          <div className="canceled-result">
            <h4>Отменен: {result.custom_id}</h4>
            <p>Запрос был отменен до обработки</p>
          </div>
        );

      case 'expired':
        return (
          <div className="expired-result">
            <h4>Истек: {result.custom_id}</h4>
            <p>Запрос истек до обработки (24 часа)</p>
          </div>
        );

      default:
        return <div>Неизвестный тип результата</div>;
    }
  };

  return <div className="result-item">{renderResultContent()}</div>;
};
```

## Пример результатов в формате .jsonl

```json
{"custom_id":"my-second-request","result":{"type":"succeeded","message":{"id":"msg_014VwiXbi91y3JMjcpyGBHX5","type":"message","role":"assistant","model":"claude-opus-4-20250514","content":[{"type":"text","text":"Hello again! It's nice to see you. How can I assist you today? Is there anything specific you'd like to chat about or any questions you have?"}],"stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":11,"output_tokens":36}}}}
{"custom_id":"my-first-request","result":{"type":"succeeded","message":{"id":"msg_01FqfsLoHwgeFbguDgpz48m7","type":"message","role":"assistant","model":"claude-opus-4-20250514","content":[{"type":"text","text":"Hello! How can I assist you today? Feel free to ask me any questions or let me know if there's anything you'd like to chat about."}],"stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":34}}}}
```

[(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing)

## Компонент с фильтрацией и статистикой

```typescript
const BatchResultsAnalyzer: React.FC<{ batchId: string }> = ({ batchId }) => {
  const [results, setResults] = useState<BatchResult[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadResults = async () => {
      try {
        const batchResults = await client.messages.batches.results(batchId);
        const parsedResults: BatchResult[] = [];

        for await (const entry of batchResults) {
          parsedResults.push(entry as BatchResult);
        }

        setResults(parsedResults);
      } catch (err) {
        console.error('Ошибка загрузки результатов:', err);
      } finally {
        setLoading(false);
      }
    };

    loadResults();
  }, [batchId]);

  const getStatistics = () => {
    const stats = {
      succeeded: 0,
      errored: 0,
      canceled: 0,
      expired: 0,
      total: results.length
    };

    results.forEach(result => {
      stats[result.result.type]++;
    });

    return stats;
  };

  const filteredResults = results.filter(result =>
    filter === 'all' || result.result.type === filter
  );

  const stats = getStatistics();

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <div className="statistics">
        <h3>Статистика пакета</h3>
        <p>Всего: {stats.total}</p>
        <p>Успешно: {stats.succeeded}</p>
        <p>Ошибки: {stats.errored}</p>
        <p>Отменено: {stats.canceled}</p>
        <p>Истекло: {stats.expired}</p>
      </div>

      <div className="filters">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Все результаты</option>
          <option value="succeeded">Успешные</option>
          <option value="errored">Ошибки</option>
          <option value="canceled">Отмененные</option>
          <option value="expired">Истекшие</option>
        </select>
      </div>

      <div className="results-list">
        {filteredResults.map((result) => (
          <ResultItem key={result.custom_id} result={result} />
        ))}
      </div>
    </div>
  );
};
```

## Важные особенности парсинга

### Порядок результатов

Результаты пакета могут возвращаться в любом порядке и могут не соответствовать порядку запросов при
создании пакета [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing). Для
правильного сопоставления результатов с соответствующими запросами всегда используйте поле
`custom_id` [(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing).

### Обработка ошибок

Если ваш результат содержит ошибку, его `result.error` будет установлен в стандартную форму ошибки
[(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing).

### Доступность результатов

Результаты пакета доступны в течение 29 дней после создания
[(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing). После этого вы все еще
можете просматривать пакет, но его результаты больше не будут доступны для загрузки
[(1)](https://docs.anthropic.com/en/docs/build-with-claude/batch-processing).

## CSS стили для компонентов

```css
.result-item {
  border: 1px solid #ddd;
  margin: 10px 0;
  padding: 15px;
  border-radius: 5px;
}

.success-result {
  background-color: #f0f8f0;
  border-left: 4px solid #28a745;
}

.error-result {
  background-color: #fff5f5;
  border-left: 4px solid #dc3545;
}

.canceled-result {
  background-color: #fff8e1;
  border-left: 4px solid #ffc107;
}

.expired-result {
  background-color: #f8f9fa;
  border-left: 4px solid #6c757d;
}

.statistics {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 5px;
  margin-bottom: 20px;
}

.filters {
  margin-bottom: 20px;
}

.filters select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
}
```

Этот мануал предоставляет полное решение для парсинга и отображения результатов пакетной обработки в
React приложении, включая обработку всех типов результатов и статистику.
