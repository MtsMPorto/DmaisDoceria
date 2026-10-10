import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.port, () => {
  console.log(`Servidor ouvindo na porta ${env.port}`);
});
