// Portable readiness probe (Windows + CI). Exits 0 once the SUT answers, 1 on timeout.
const url = process.env.BASE_URL || "http://localhost:3000";
const timeoutMs = Number(process.env.WAIT_TIMEOUT_MS || 30000);
const deadline = Date.now() + timeoutMs;

(async function poll() {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/products`);
      if (res.ok) {
        console.log(`SUT ready at ${url}`);
        process.exit(0);
      }
    } catch (_) {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error(`SUT not ready at ${url} after ${timeoutMs}ms`);
  process.exit(1);
})();
