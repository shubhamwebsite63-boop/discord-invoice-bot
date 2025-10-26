const { Client, GatewayIntentBits } = require('discord.js');
const PDFDocument = require('pdfkit');
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const token = process.env.BOT_TOKEN; // We will set this in Railway

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async message => {
    if(message.content.startsWith("!invoice")) {
        const args = message.content.split(" ");
        const amount = args[1];
        const name = args[2];

        // Create PDF invoice
        const doc = new PDFDocument();
        const fileName = `invoice_${name}.pdf`;
        doc.pipe(fs.createWriteStream(`/tmp/${fileName}`));
        doc.fontSize(25).text('Invoice', {align: 'center'});
        doc.moveDown();
        doc.fontSize(18).text(`Name: ${name}`);
        doc.text(`Amount: ₹${amount}`);
        doc.end();

        // Send PDF in Discord
        setTimeout(() => {
            message.channel.send({
                files: [{ attachment: `/tmp/${fileName}`, name: fileName }]
            });
        }, 1000);
    }
});

client.login(token);
