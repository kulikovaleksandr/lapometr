import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { initMonitoring } from "./lib/monitoring";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initializeCloud } from "./lib/cloud";

// Инициализация систем мониторинга
initMonitoring();

// Автоматическая инициализация облачного режима
initializeCloud().then((success) => {
  if (success) {
    console.log("[App] ✓ Облачный режим активирован и готов к работе");
  } else {
    console.log("[App] ℹ Приложение работает в локальном режиме");
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
