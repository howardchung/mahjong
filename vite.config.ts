import fs from "node:fs";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const certPath = env.HTTPS_CERT_PATH;
  const keyPath = env.HTTPS_KEY_PATH;

  const https =
    certPath &&
    keyPath &&
    fs.existsSync(certPath) &&
    fs.existsSync(keyPath)
      ? {
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath),
        }
      : undefined;

  return {
    server: {
      allowedHosts: true,
      https,
    },
    preview: {
      allowedHosts: true,
      https,
    },
    optimizeDeps: {
      exclude: ["onnxruntime-web"],
    },
  };
});
