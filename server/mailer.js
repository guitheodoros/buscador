// Email de alerta via Resend (resend.com — plano gratuito: 3000 emails/mês).
// Configure RESEND_API_KEY no .env para ativar.

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.ALERT_FROM_EMAIL || "Buscador de Sonhos <onboarding@resend.dev>";

export async function sendPriceAlert({ to, monitor, currentPrice }) {
  if (!RESEND_KEY) {
    console.log(`[mailer] RESEND_API_KEY ausente — alerta não enviado (${monitor.origin}→${monitor.destination} R$${currentPrice})`);
    return;
  }

  const prevPrice = monitor.lastPrice;
  const drop = prevPrice && prevPrice > currentPrice
    ? Math.round(((prevPrice - currentPrice) / prevPrice) * 100)
    : 0;
  const belowTarget = monitor.targetPrice && currentPrice <= monitor.targetPrice;

  const cabineLabel = { ECONOMY: "Econômica", PREMIUM_ECONOMY: "Premium Eco", BUSINESS: "Executiva", FIRST: "Primeira" }[monitor.cabin] ?? monitor.cabin;

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f7;padding:40px 24px;max-width:520px;margin:0 auto;border-radius:20px;">
  <p style="margin:0 0 2px;font-size:13px;color:#86868b;letter-spacing:.05em;text-transform:uppercase;">Buscador de Sonhos</p>
  <h1 style="margin:0 0 24px;font-size:30px;font-weight:800;color:#1d1d1f;">✈️ Alerta de preço</h1>

  <div style="background:#fff;border-radius:14px;padding:20px;margin-bottom:12px;">
    <p style="margin:0 0 2px;font-size:11px;color:#86868b;text-transform:uppercase;letter-spacing:.05em;">Rota</p>
    <p style="margin:0;font-size:22px;font-weight:700;color:#1d1d1f;">${monitor.origin} → ${monitor.destination}</p>
    <p style="margin:4px 0 0;font-size:13px;color:#6e6e73;">
      Ida ${monitor.departureDate}${monitor.returnDate ? " · Volta " + monitor.returnDate : " (somente ida)"} · ${cabineLabel}
    </p>
  </div>

  <div style="background:#111113;border-radius:14px;padding:20px;margin-bottom:12px;">
    <p style="margin:0 0 2px;font-size:11px;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.05em;">Preço mais barato encontrado</p>
    <p style="margin:0;font-size:36px;font-weight:800;color:#fff;">R$ ${currentPrice.toLocaleString("pt-BR")}</p>
    ${drop > 0 ? `<p style="margin:6px 0 0;font-size:13px;color:#4ade80;">↓ ${drop}% mais barato que ontem</p>` : ""}
  </div>

  ${belowTarget ? `
  <div style="background:#0071e3;border-radius:14px;padding:16px 20px;margin-bottom:12px;">
    <p style="margin:0;font-weight:700;color:#fff;font-size:15px;">🎯 Meta atingida! Você queria pagar até R$ ${monitor.targetPrice.toLocaleString("pt-BR")}</p>
  </div>` : ""}

  ${monitor.targetPrice && currentPrice > monitor.targetPrice ? `
  <div style="background:#fff;border-radius:14px;padding:16px 20px;margin-bottom:12px;">
    <p style="margin:0;font-size:13px;color:#6e6e73;">Meta: <strong style="color:#1d1d1f;">R$ ${monitor.targetPrice.toLocaleString("pt-BR")}</strong> · Faltam R$ ${(currentPrice - monitor.targetPrice).toLocaleString("pt-BR")} para atingir</p>
  </div>` : ""}

  <p style="font-size:11px;color:#86868b;text-align:center;margin:20px 0 0;">
    Verificação automática diária · Buscador de Sonhos
  </p>
</div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: `✈️ ${monitor.origin}→${monitor.destination} por R$ ${currentPrice.toLocaleString("pt-BR")}${belowTarget ? " — Meta atingida!" : drop > 0 ? ` (↓${drop}%)` : ""}`,
        html,
      }),
    });
    if (!res.ok) console.error("[mailer] Erro Resend:", await res.text());
    else console.log(`[mailer] Email enviado para ${to}`);
  } catch (err) {
    console.error("[mailer] Falha ao enviar:", err.message);
  }
}
