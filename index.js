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
  console.log("=== Webhook da Kiwify chegou ===");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  console.log("Query:", req.query);

  // tentamos pegar do Railway com variações de nome
  const ENV_TOKEN =
    process.env.KIWIFY_TOKEN ||
    process.env.KIWIFI_TOKEN ||
    process.env.KIWIFY_SIGNATURE;

  console.log("Token vindo do Railway:", ENV_TOKEN);

  // o que a Kiwify está mandando de fato (vimos no log):
  // ?signature=4159...
  const querySignature = req.query.signature;
  const headerToken =
    req.headers["x-webhook-token"] ||
    req.headers["x-token"] ||
    req.headers["x-kiwify-token"];
  const bodyToken = req.body.token;

  // prioridade: query > header > body
  const incomingToken = querySignature || headerToken || bodyToken;
  console.log("Token recebido da Kiwify (signature/header/body):", incomingToken);

  // se tiver ENV_TOKEN configurado, valida
  if (ENV_TOKEN && incomingToken !== ENV_TOKEN) {
    return res.status(401).json({
      error: "invalid token/signature",
      received: incomingToken
    });
  }

  // se não tiver ENV_TOKEN, aceita assim mesmo (pra não travar desenvolvimento)
  const { Customer, order_status, webhook_event_type } = req.body;

  // precisamos do e-mail pra liberar o acesso depois
  const email = Customer?.email;
  const status = order_status; // no log veio "paid"
  const plan = req.body?.Product?.product_name || "default";

  if (!email) {
    return res.status(400).json({ error: "email is required in webhook" });
  }

  if (status === "paid" || webhook_event_type === "order_approved") {
    const userId = `user-${Date.now()}`;
    usersAccess[email.toLowerCase()] = {
      allowed: true,
      userId,
      plan
    };
    return res.json({ ok: true, message: "user allowed", userId });
  }

  // se não estiver pago ainda
  usersAccess[email.toLowerCase()] = {
    allowed: false,
    userId: null,
    plan
  };

  return res.json({ ok: true, message: "user not allowed yet" });
});

// sobe o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

