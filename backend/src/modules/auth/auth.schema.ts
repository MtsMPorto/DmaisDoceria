import { z } from "zod";

export const loginSchema = z.strictObject({
  username: z.string().trim().min(1, "Informe o usuário.").max(50, "Máximo de 50 caracteres."),
  password: z.string().min(1, "Informe a senha.").max(200, "Máximo de 200 caracteres."),
});

export type LoginInput = z.infer<typeof loginSchema>;
