// Fora do Netlify não há plataforma injetando as variáveis: sem isto, subir o
// servidor local falha na primeira consulta com "Environment variable not
// found: CONTROL_PLANE_DATABASE_URL", mesmo com o .env no lugar. Em produção
// não existe arquivo .env e o dotenv simplesmente não faz nada.
import "dotenv/config";

import { app } from "./app";

const port = Number(process.env.PORT ?? 3334);

app.listen(port, () => {
  console.log(`SysBelt Control Plane disponível na porta ${port}`);
});
