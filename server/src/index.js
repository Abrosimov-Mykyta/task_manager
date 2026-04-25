import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "./prisma.js";
import { authMiddleware, signToken } from "./auth.js";
import { seedDefaultWorkspaceIfEmpty } from "./defaultWorkspace.js";

const app = express();

const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || "";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "";
const corsOrigins = CORS_ORIGIN
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.warn("JWT_SECRET is not set. Create server/.env from server/.env.example");
}

app.use(
  cors({
    origin(origin, cb) {
      // allow non-browser requests (no Origin header)
      if (!origin) return cb(null, true);
      // allow any localhost port for dev
      if (/^http:\/\/localhost:\d+$/.test(origin)) return cb(null, true);
      // allow explicit list (if provided)
      if (corsOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: false,
  })
);
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const requireAuth = authMiddleware({ jwtSecret: JWT_SECRET });

app.post(
  "/auth/register",
  asyncHandler(async (req, res) => {
  const parsed = credsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already in use" });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { email, passwordHash } });
  await seedDefaultWorkspaceIfEmpty(prisma, user.id);
  const token = signToken(user.id, JWT_SECRET);

  return res.json({ token, user: { id: user.id, email: user.email } });
  })
);

app.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
  const parsed = credsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken(user.id, JWT_SECRET);
  return res.json({ token, user: { id: user.id, email: user.email } });
  })
);

app.get(
  "/auth/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true },
    });
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    await seedDefaultWorkspaceIfEmpty(prisma, user.id);
    return res.json({ user });
  })
);

const groupCreateSchema = z.object({
  name: z.string().min(1).max(64),
  color: z.string().min(1).max(32).optional(),
});

app.get(
  "/groups",
  requireAuth,
  asyncHandler(async (req, res) => {
    const groups = await prisma.taskGroup.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, color: true },
    });
    res.json({ groups });
  })
);

app.post(
  "/groups",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = groupCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });
    const group = await prisma.taskGroup.create({
      data: { userId: req.userId, ...parsed.data },
      select: { id: true, name: true, color: true },
    });
    res.status(201).json({ group });
  })
);

app.patch(
  "/groups/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = groupCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

    const existing = await prisma.taskGroup.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const group = await prisma.taskGroup.update({
      where: { id: req.params.id },
      data: parsed.data,
      select: { id: true, name: true, color: true },
    });
    res.json({ group });
  })
);

app.delete(
  "/groups/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const existing = await prisma.taskGroup.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });

    await prisma.taskGroup.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

const taskCreateSchema = z.object({
  title: z.string().min(1).max(140),
  minutes: z.number().int().min(5).max(24 * 60).default(30),
  color: z.string().min(1).max(32).optional(),
  groupId: z.string().optional().nullable(),
});

app.get(
  "/tasks",
  requireAuth,
  asyncHandler(async (req, res) => {
    const tasks = await prisma.task.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, minutes: true, color: true, groupId: true },
    });
    res.json({ tasks });
  })
);

app.post(
  "/tasks",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = taskCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

    const groupId = parsed.data.groupId ?? null;
    if (groupId) {
      const group = await prisma.taskGroup.findFirst({
        where: { id: groupId, userId: req.userId },
        select: { id: true },
      });
      if (!group) return res.status(400).json({ error: "Invalid groupId" });
    }

    const task = await prisma.task.create({
      data: { userId: req.userId, ...parsed.data, groupId },
      select: { id: true, title: true, minutes: true, color: true, groupId: true },
    });
    res.status(201).json({ task });
  })
);

app.patch(
  "/tasks/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = taskCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

    const existing = await prisma.task.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const groupId = parsed.data.groupId ?? undefined;
    if (groupId !== undefined) {
      if (groupId) {
        const group = await prisma.taskGroup.findFirst({
          where: { id: groupId, userId: req.userId },
          select: { id: true },
        });
        if (!group) return res.status(400).json({ error: "Invalid groupId" });
      }
    }

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...parsed.data,
        ...(groupId !== undefined ? { groupId: groupId ?? null } : {}),
      },
      select: { id: true, title: true, minutes: true, color: true, groupId: true },
    });
    res.json({ task });
  })
);

app.delete(
  "/tasks/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const existing = await prisma.task.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });

    await prisma.task.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const entryCreateSchema = z.object({
  date: z.string().regex(dateRegex),
  dayIndex: z.number().int().min(0).max(6),
  startMin: z.number().int().min(0).max(1439),
  minutes: z.number().int().min(5).max(24 * 60).default(30),
  title: z.string().min(1).max(140),
  color: z.string().min(1).max(32).optional(),
  groupId: z.string().optional().nullable(),
});
const entryUpdateSchema = entryCreateSchema.extend({ done: z.boolean().optional() }).partial();

const entrySelect = {
  id: true,
  date: true,
  dayIndex: true,
  startMin: true,
  minutes: true,
  title: true,
  color: true,
  groupId: true,
  done: true,
};

app.get(
  "/entries",
  requireAuth,
  asyncHandler(async (req, res) => {
    const from = req.query.from;
    const to = req.query.to;
    const where = { userId: req.userId };
    if (from && dateRegex.test(from) && to && dateRegex.test(to)) {
      where.date = { gte: from, lte: to };
    } else if (from && dateRegex.test(from)) {
      where.date = { gte: from };
    } else if (to && dateRegex.test(to)) {
      where.date = { lte: to };
    }
    const entries = await prisma.calendarEntry.findMany({
      where,
      orderBy: [{ date: "asc" }, { startMin: "asc" }],
      select: entrySelect,
    });
    res.json({ entries });
  })
);

app.post(
  "/entries",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = entryCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

    const groupId = parsed.data.groupId ?? null;
    if (groupId) {
      const group = await prisma.taskGroup.findFirst({
        where: { id: groupId, userId: req.userId },
        select: { id: true },
      });
      if (!group) return res.status(400).json({ error: "Invalid groupId" });
    }

    const entry = await prisma.calendarEntry.create({
      data: { userId: req.userId, ...parsed.data, groupId },
      select: entrySelect,
    });
    res.status(201).json({ entry });
  })
);

app.patch(
  "/entries/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = entryUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

    const existing = await prisma.calendarEntry.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const groupId = parsed.data.groupId ?? undefined;
    if (groupId !== undefined) {
      if (groupId) {
        const group = await prisma.taskGroup.findFirst({
          where: { id: groupId, userId: req.userId },
          select: { id: true },
        });
        if (!group) return res.status(400).json({ error: "Invalid groupId" });
      }
    }

    const entry = await prisma.calendarEntry.update({
      where: { id: req.params.id },
      data: { ...parsed.data, ...(groupId !== undefined ? { groupId: groupId ?? null } : {}) },
      select: entrySelect,
    });
    res.json({ entry });
  })
);

app.delete(
  "/entries/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const existing = await prisma.calendarEntry.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: "Not found" });

    await prisma.calendarEntry.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${PORT}`);
});

