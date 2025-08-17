
/** Главный каркас приложения.
 *  Далее сюда добавим TextInput/ProcessingView/ContentView по плану.
 */
import BatchPlayground from '../pages/BatchPlayground';
export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center">
      <div className="p-6 bg-white rounded-xl shadow">
        <h1 className="text-2xl font-bold text-primary-700">Флэшкарт v3 — Bootstrap</h1>
        <p className="text-gray-600 mt-2">
          База проекта готова. Далее — MANIFEST-FIRST, агрегация по SID, FSM и Zod DTO.
        </p>
        <BatchPlayground />;
      </div>
    </div>
  );
}
