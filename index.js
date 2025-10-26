// index.js
const { Client, GatewayIntentBits } = require('discord.js');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const express = require('express');
const dayjs = require('dayjs');

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error("ERROR: BOT_TOKEN environment variable is not set.");
  process.exit(1);
}

// Simple express server so Railway sees an open port
const app = express();
app.get('/', (req, res) => res.send('Invoice bot is running.'));
app.listen(PORT, () => console.log(`HTTP server listening on port ${PORT}`));

// Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Helper: create invoice PDF, returns filepath Promise
function createInvoicePDF({ name, amount, items = [], company = 'Your Company' }) {
  return new Promise((resolve, reject) => {
    try {
      const invoiceId = 'INV-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      const date = dayjs().format('YYYY-MM-DD');
      const fileName = `${invoiceId}_${name || 'customer'}.pdf`.replace(/\s+/g, '_');
      const outPath = path.join(os.tmpdir(), fileName);

      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = fs.createWriteStream(outPath);
      doc.pipe(stream);

      // Header
      doc.fontSize(20).text(company, { align: 'left' });
      doc.fontSize(10).text(`Invoice #: ${invoiceId}`, { align: 'right' });
      doc.text(`Date: ${date}`, { align: 'right' });
      doc.moveDown();

      // Customer
      doc.fontSize(14).text('Bill To:');
      doc.fontSize(12).text(name || 'N/A');
      doc.moveDown();

      // Items table (if provided)
      if (items.length > 0) {
        doc.fontSize(12).text('Items:', { underline: true });
        items.forEach((it, idx) => {
          doc.text(`${idx + 1}. ${it.description} — Qty: ${it.qty} — ₹${it.price}`);
        });
        doc.moveDown();
      }

      // Amount
      doc.fontSize(14).text(`Total: ₹${amount}`, { align: 'right' });

      // Footer
      doc.moveDown();
      doc.fontSize(10).text('Thank you for your business!', { align: 'center' });

      doc.end();

      stream.on('finish', () => resolve({ path: outPath, fileName }));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

// Delete temp file helper
function safeUnlink(p) {
  fs.unlink(p, (err) => {
    if (err) console.warn('Temp file unlink error:', err.message);
  });
}

// Command handling: !invoice <amount> <name> [company]
client.on('messageCreate', async message => {
  try {
    if (message.author.bot) return;

    const prefix = '!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();

    if (cmd === 'invoice') {
      // Usage examples:
      // !invoice 500 Shubham
      // !invoice 1500 "Shubham Kumar" "Shararat Team"
      const amount = args[0];
      const name = args[1] ? args.slice(1).join(' ') : 'Customer';

      if (!amount || isNaN(Number(amount))) {
        return message.reply('Usage: `!invoice <amount> <name>` — please provide a numeric amount.');
      }

      await message.reply('Creating invoice...');

      const invoiceData = {
        name,
        amount: Number(amount),
        company: 'Shararat Team'
      };

      const { path: filePath, fileName } = await createInvoicePDF(invoiceData);

      // Send PDF
      await message.channel.send({
        files: [{ attachment: filePath, name: fileName }]
      });

      // Remove temp file
      safeUnlink(filePath);
    }

  } catch (err) {
    console.error('Error handling message:', err);
    message.reply('Something went wrong creating the invoice.');
  }
});

client.login(BOT_TOKEN).catch(err => {
  console.error('Failed to login to Discord:', err);
  process.exit(1);
});
