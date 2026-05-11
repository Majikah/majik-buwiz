// src/lib/wasm-loader.ts
// WASM files should be placed in public/ and copied by Tauri bundler

async function loadUnrarWasm(): Promise<ArrayBuffer> {
  const response = await fetch("/unrar.wasm");
  if (!response.ok) throw new Error("Failed to load unrar.wasm");
  return await response.arrayBuffer();
}

async function load7zWasm(): Promise<ArrayBuffer> {
  const response = await fetch("/7z.wasm");
  if (!response.ok) throw new Error("Failed to load 7z.wasm");
  return await response.arrayBuffer();
}
