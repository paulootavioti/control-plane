import { app } from "./app";

const port = Number(process.env.PORT ?? 3334);

app.listen(port, () => {
  console.log(`SysBelt Control Plane disponível na porta ${port}`);
});
