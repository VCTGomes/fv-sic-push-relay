# fv-sic-push-relay

Esse é o Relay Push utilizado pelo Gestor de Vendas Web para envio de mensagens pushs para o aplicativo móvel disponível na Oracle Cloud.

## Por que existe

O `fv-sic-backend` roda na máquina do cliente e não deve carregar o `serviceAccountKey.json` do Firebase. O relay centraliza essa credencial na Oracle Cloud e expõe um endpoint simples que o backend local chama para disparar push.

```
fv-sic-backend (Windows/servidor local)
    │
    │  POST /push  (HTTPS via Cloudflare)
    ▼
relay-fv  (Oracle Cloud · relay-fv.vctgomes.com)
    │
    │  Firebase Admin SDK
    ▼
FCM → Tablet Android (app Força de Vendas)
```

## Tipos de notificação

1. Notificações visíveis exibem título/corpo e tocam som. É utilizado o tipo custom.
2. Notificações silenciosas acordam o app em background para sincronizar sem interação do usuário.

## Instalação

Esse arquivo não exige instalação, mas caso você queira auto-hospedar, sinta-se a vontade com os passos abaixo:
Obs.: é necessário recompilar o aplicativo com seu próprio código Firebase para que o push alterado funcione.

```bash
git clone https://github.com/VCTGomes/fv-sic-push-relay
cd relay-fv
npm install
```

Coloque o `firebase-service-account.json` (credencial do Firebase) na raiz do projeto.

## Uso

```bash
node index.js
```

O servidor escuta em `127.0.0.1:PORT` — nunca diretamente na internet. O acesso externo é feito via Cloudflare Tunnel ou nginx/caddy com TLS.

## Endpoint

### `POST /push`

Dispara uma notificação para um dispositivo.

**Body:**
```json
{
  "fcm_token": "token_do_dispositivo",
  "tipo": "catalogo",
  "push_secret": "seu_segredo_aqui",
  "titulo": "Opcional — só para notificações visíveis",
  "corpo": "Opcional — só para notificações visíveis"
}
```

**Resposta de sucesso:**
```json
{ "sucesso": true }
```

**Token inválido (410):**
```json
{ "erro": "messaging/registration-token-not-registered" }
```

O `fv-sic-backend` remove automaticamente tokens que retornem `410`.

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `SA_PATH` | — | Caminho para o `serviceAccountKey.json` do Firebase |
| `APP_SECRET` | — | Segredo compartilhado com o `fv-sic-backend` |
| `PORT` | `3099` | Porta local de escuta |
