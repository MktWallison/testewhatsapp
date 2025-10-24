const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');

async function connectToWhatsApp() {
  // Salva a autenticação em arquivos para não precisar ler o QR Code sempre
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true, // Imprime o QR code no terminal
    auth: state,
  });

  // Salva as credenciais sempre que elas forem atualizadas
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Conexão fechada devido a ', lastDisconnect.error, ', reconectando... ', shouldReconnect);
      // Reconecta se não for logout
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('Conectado ao WhatsApp!');
    }

    // Se tiver um QR code, ele será impresso aqui.
    // No Railway, você verá isso nos logs do deploy.
    if (qr) {
        console.log('QR Code recebido, escaneie com seu celular!');
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message) return;

    const remetente = msg.key.remoteJid;
    const textoRecebido = msg.message.conversation || msg.message.extendedTextMessage?.text;

    console.log(`Mensagem de ${remetente}: ${textoRecebido}`);

    // Exemplo de resposta simples
    if (remetente) {
        await sock.sendMessage(remetente, { text: 'Olá!' });
    }
  });
}

// Inicia a conexão
connectToWhatsApp();