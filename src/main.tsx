import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { initMonitoring } from "./lib/monitoring";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Инициализация систем мониторинга
initMonitoring();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
