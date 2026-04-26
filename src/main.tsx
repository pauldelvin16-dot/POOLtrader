import { createRoot } from "react-dom/client";
import "./lib/web3Config"; // Initialize Web3Modal store before React mounts
import App from "./App.tsx";
import "./index.css";
import "./i18n";


createRoot(document.getElementById("root")!).render(<App />);
