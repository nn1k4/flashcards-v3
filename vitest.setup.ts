import '@testing-library/jest-dom';

// Глобальные моки для браузерных API
Object.defineProperty(window, 'btoa', {
  value: (str: string) => Buffer.from(str).toString('base64'),
});

Object.defineProperty(window, 'atob', {
  value: (str: string) => Buffer.from(str, 'base64').toString(),
});
