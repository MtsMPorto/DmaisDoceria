import { AppError } from "../../shared/utils/errors.js";

export function requireMailConfiguration() {
  if (!process.env.RESEND_API_KEY || !process.env.ACCOUNT_EMAIL_FROM) {
    throw new AppError(
      503,
      "EMAIL_UNAVAILABLE",
      "O envio de e-mails ainda não está disponível. Tente novamente mais tarde.",
    );
  }
}
export async function sendAccountEmail(
  to: string,
  subject: string,
  text: string,
) {
  requireMailConfiguration();
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.ACCOUNT_EMAIL_FROM,
        to: [to],
        reply_to:
          process.env.ACCOUNT_EMAIL_REPLY_TO || "suporte@dmaisdoceria.com",
        subject,
        text,
      }),
    });
    if (!response.ok) {
      console.error("Resend rejected email request", {
        status: response.status,
        requestId: response.headers.get("x-resend-request-id"),
      });
      throw new Error("Email provider error");
    }
  } catch (error) {
    if (error instanceof Error && error.name !== "Error") {
      console.error("Resend email request failed", { type: error.name });
    }
    throw new AppError(
      503,
      "EMAIL_UNAVAILABLE",
      "Não foi possível enviar o e-mail. Aguarde um minuto e tente novamente.",
    );
  }
}
