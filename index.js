const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// habilita CORS e JSON
app.use(cors());
app.use(express.json());

// "bancos" em memória (temporário)
const usersAccess = {};
const progressStore = {};

// Rota de saúde (pra testar se está no ar)
app.get("/", (req, res) => {
  res.send("Backend Tesouro Direto ON");
});

// Rota para o app checar se o usuário tem acesso (login/autorização)
app.post("/auth/check", (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ allowed: false, reason: "email_required" });
  }

  const record = usersAccess[email.toLowerCase()];

  if (!record) {
    return res.json({
      allowed: false,
      reason: "payment_not_found"
    });
  }

  return res.json({
    allowed: true,
    userId: record.userId,
    plan: record.plan
  });
});

// Rota para salvar progresso do usuário (passos, quiz, etc.)
app.post("/progress", (req, res) => {
  const { userId, section, step, completed, quizDone } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  if (!progressStore[userId]) {
    progressStore[userId] = { steps: [], quizDone: false };
  }

  if (section === "steps" && completed && step) {
    const exists = progressStore[userId].steps.includes(step);
    if (!exists) {
      progressStore[userId].steps.push(step);
    }
  }

  if (quizDone === true) {
    progressStore[userId].quizDone = true;
  }

  return res.json({
    ok: true,
    progress: progressStore[userId]
  });
});

// Rota para buscar o progresso do usuário
app.get("/progress/:userId", (req, res) => {
  const { userId } = req.params;
  const progress = progressStore[userId] || { steps: [], quizDone: false };
  return res.json(progress);
});

// Rota que simula/recebe o webhook da Kiwifi
app.post("/webhook/kiwifi", (req, res) => {
  // 1. logar tudo que chegou
  console.log("=== Webhook da Kiwifi chegou ===");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);

  const KIWI_TOKEN = "obnhpy4xsf2"; // pode ficar entre aspas SIM

  // 2. tentar pegar o token de vários lugares
  const headerToken =
    req.headers["x-webhook-token"] ||
    req.headers["x-token"] ||
    req.headers["x-kiwifi-token"];
  const bodyToken = req.body.token;
  const finalToken = headerToken || bodyToken;

  // 3. validar
  if (!finalToken || finalToken !== KIWI_TOKEN) {
    return res.status(401).json({ error: "invalid token" });
  }

  const { email, status, plan } = req.body;

  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  if (status === "paid") {
    const userId = `user-${Date.now()}`;
    usersAccess[email.toLowerCase()] = {
      allowed: true,
      userId,
      plan: plan || "default"
    };
    return res.json({ ok: true, message: "user allowed", userId });
  }

  usersAccess[email.toLowerCase()] = {
    allowed: false,
    userId: null,
    plan: plan || "default"
  };

  return res.json({ ok: true, message: "user not allowed yet" });
});

// sobe o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

