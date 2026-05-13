'use strict';
require('dotenv').config();
const express   = require('express');
const admin     = require('firebase-admin');
const rateLimit = require('express-rate-limit');
const fs        = require('fs');

const PORT    = 3099;
const SA_PATH = process.env.SA_PATH || './firebase-service-account.json';

const TIPOS_VALIDOS = [
    'catalogo', 'clientes', 'sync_background', 'sync_forcada',
    'enviar_relatorio', 'enviar_relatorio_completo',          
    'custom', 'ping', 'solicitar_ids',
    'reenviar_rascunhos', 'reenviar_rascunho',              
];

// Campos extras permitidos por tipo
const EXTRAS_PERMITIDOS = {
    reenviar_rascunho: ['pedido_id'],
    custom:            ['titulo', 'corpo'],
};

admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(SA_PATH, 'utf-8')))
});

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

const limitPush = rateLimit({ windowMs: 60 * 60 * 1000, max: 120, message: { erro: 'rate limit excedido' } });

app.post('/push', limitPush, async (req, res) => {
    const { fcm_token, tipo, titulo, corpo, pedido_id } = req.body;

    if (!fcm_token || !tipo)
        return res.status(400).json({ erro: 'fcm_token e tipo obrigatórios' });
    if (!TIPOS_VALIDOS.includes(tipo))
        return res.status(400).json({ erro: `tipo inválido: ${tipo}` });

    const isVisivel = tipo === 'custom';

    const titulos = {
        catalogo:                  'Atualizando catálogo...',
        clientes:                  'Atualizando clientes...',
        sync_background:           'Sincronizando...',
        sync_forcada:              'Sincronização obrigatória',
        enviar_relatorio:          'Relatórios enviados',
        enviar_relatorio_completo: 'Relatórios enviados',       
        ping:                      'Verificando conexão...',
        solicitar_ids:             'Sincronizando rascunhos...',
        reenviar_rascunhos:        'Reenviando pedidos...',      
        reenviar_rascunho:         'Reenviando pedido...',
    };

    // Monta data apenas com campos permitidos para o tipo
    const data = { tipo };
    if (isVisivel) {
        if (titulo) data.titulo = titulo;
        if (corpo)  data.corpo  = corpo;
    }
    if (tipo === 'reenviar_rascunho' && pedido_id) {
        data.pedido_id = String(pedido_id);
    }

    const msg = {
        token: fcm_token,
        data,
        android: {
            priority: 'high',
            fcmOptions: { analyticsLabel: tipo },
            notification: {
                channelId: isVisivel ? 'forca_vendas_v2' : 'fv_sync_silent',
                tag: tipo,
                ...(isVisivel ? { sound: 'default' } : {
                    defaultSound:         false,
                    notificationPriority: 'PRIORITY_MIN',
                    visibility:           'secret',
                }),
            },
        },
        apns: {
            headers: { 'apns-priority': isVisivel ? '10' : '5' },
            payload: { aps: {
                'content-available': 1,
                ...(isVisivel ? {
                    alert: { title: titulo || '', body: corpo || '' },
                    sound: 'default',
                } : {}),
            }},
        },
        notification: {
            title: isVisivel ? (titulo || '') : ' ',
            body:  isVisivel ? (corpo  || '') : ' ',
        },
    };

    try {
        await admin.messaging().send(msg);
        res.json({ sucesso: true });
    } catch (err) {
        const code = err.errorInfo?.code || err.message;
        console.error('[RELAY] Erro FCM:', code);
        const invalido = [
            'messaging/invalid-registration-token',
            'messaging/registration-token-not-registered',
        ].includes(code);
        res.status(invalido ? 410 : 500).json({ erro: code });
    }
});

app.listen(PORT, '127.0.0.1', () => console.log(`[RELAY] Rodando na porta ${PORT}`));