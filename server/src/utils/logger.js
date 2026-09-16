// Structured, minimal server-side logger. Never pass secrets (passwords, JWTs) into meta.
function log(event, meta = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...meta,
  };
  process.stdout.write(JSON.stringify(entry) + "\n");
}

module.exports = { log };
