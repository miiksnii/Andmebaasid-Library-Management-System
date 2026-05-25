import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

async function readStream(stream) {
  if (!stream) return "";
  const chunks = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk).toString("utf8"));
  }

  return chunks.join("");
}

export function startService(scriptPath, env) {
  const proc = Bun.spawn(["bun", "run", scriptPath], {
    cwd: ROOT,
    env: {
      ...process.env,
      ...env,
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = Promise.all([readStream(proc.stdout), readStream(proc.stderr)]);

  return {
    proc,
    async stop() {
      proc.kill();
      await proc.exited.catch(() => undefined);
      const [stdout, stderr] = await output;
      return { stdout, stderr };
    },
  };
}

export async function waitForHealth(url, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
      lastError = new Error(`Health check returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await Bun.sleep(100);
  }

  throw lastError || new Error(`Timed out waiting for ${url}`);
}

export async function requestJson(baseUrl, path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json().catch(() => ({}));
  return { response, json };
}
