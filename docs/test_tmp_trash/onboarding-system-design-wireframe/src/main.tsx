import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { ScenarioProvider } from "./contexts/ScenarioContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ScenarioProvider>
      <App />
    </ScenarioProvider>
  </StrictMode>
);
