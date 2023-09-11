// menu.js
const { Markup } = require('telegraf');

// Function to generate the initial inline keyboard menu
function generateInitialMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Book an Ad slot', 'book_slot')],
    [Markup.button.callback('Update your current Ad', 'update_ad')],
    [Markup.button.callback('Show Ad stats and info', 'show_ad_info')],
  ]);
}

// Export the module functions
module.exports = {
  generateInitialMenu,
};
