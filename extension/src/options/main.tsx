import { createRoot } from "react-dom/client";

import "../ui/surface.css";
import "./options.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
