import { Hono } from "hono";
import { clearAllMeetings } from "./helpers/kv";
import { meetRoutes } from "./routes/meet";
import { authRoutes } from "./routes/auth";
import { legalRoutes } from "./routes/legal";

const app = new Hono<{ Bindings: CloudflareBindings }>();

// --- Routes ---
app.route("/", meetRoutes);
app.route("/", authRoutes);
app.route("/", legalRoutes);

// --- Export ---
export default {
  fetch: app.fetch,

  async scheduled(
    _controller: ScheduledController,
    env: CloudflareBindings,
    _ctx: ExecutionContext
  ) {
    const deleted = await clearAllMeetings(env.MEET_KV);
    console.log(`Cron: cleared ${deleted} meeting(s) from KV`);
  },
};
