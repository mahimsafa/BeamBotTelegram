const { Telegraf } = require('telegraf');
require('dotenv').config();

const BOT_API_TOKEN = process.env.BOT_API_TOKEN;
const bot = new Telegraf(BOT_API_TOKEN);

module.exports = {bot, BOT_API_TOKEN};