import { Hono } from "hono";
import { homePage } from "../pages/home";
import { tncPage } from "../pages/tnc";
import { privacyPage } from "../pages/privacy";

const legalRoutes = new Hono<{ Bindings: CloudflareBindings }>();

legalRoutes.get("/home", (c) => c.html(homePage()));
legalRoutes.get("/tnc", (c) => c.html(tncPage()));
legalRoutes.get("/privacy-policy", (c) => c.html(privacyPage()));

export { legalRoutes };
