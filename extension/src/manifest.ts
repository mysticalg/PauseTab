import { defineManifest } from "@crxjs/vite-plugin";

const iconPath = (size: 16 | 32 | 48 | 128) => `icons/icon${size}.png`;

export default defineManifest({
  manifest_version: 3,
  name: "PauseTab",
  version: "0.1.0",
  description: "Add intentional friction before distracting websites.",
  action: {
    default_popup: "src/popup/index.html",
  },
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  options_page: "src/options/index.html",
  permissions: ["storage", "tabs", "alarms"],
  host_permissions: ["http://*/*", "https://*/*"],
  content_scripts: [
    {
      matches: ["http://*/*", "https://*/*"],
      js: ["src/content/gate.tsx"],
      run_at: "document_start",
    },
  ],
  icons: {
    16: iconPath(16),
    32: iconPath(32),
    48: iconPath(48),
    128: iconPath(128),
  },
  web_accessible_resources: [
    {
      resources: ["src/content/styles/gate.css"],
      matches: ["http://*/*", "https://*/*"],
    },
  ],
});
