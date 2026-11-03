import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { init } from "./lib/store.ts";
import "./styles.css";

createRoot(document.getElementById("app")!).render(<App />);
init();
