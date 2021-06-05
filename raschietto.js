const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.RASCHIETTO_BOT_TOKEN);

bot.telegram.sendMessage(process.env.CHAT_ID, "Hey there!!!");

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));