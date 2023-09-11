// callbacks.js
const { Markup } = require('telegraf');
const axios = require('axios');
const { fetchAvailableSlots, updateAdSlot } = require('./api');


// Callback handler for the 'book_slot' action
async function handleBookSlot(ctx, navigationStack, userId) {
	// @TODO: use userID to book slot
	
	const res = await fetchAvailableSlots();

	if (res.connected) {
		if (res.available) {
			// Process the response with time slot details
			const timeSlots = res.data; // Assuming the response is an array of time slot details

			// Create an array of buttons for the available time slots
			const buttons = timeSlots.map((slot) => {
				return Markup.button.callback(slot.time, `slot_${slot.id}`);
			});

			// Add the "Back" button to the array of buttons
			buttons.push(Markup.button.callback('⬅ Back', 'back_to_initial'));

			// Create the menu with the available time slots and the "Back" button
			const menu = Markup.inlineKeyboard(buttons);

			// Add the current menu to the user's navigation stack
			navigationStack.push(menu);

			// Edit the existing message with the new inline keyboard menu
			ctx.editMessageText('Choose a time slot:', menu);
		} else {
			// Create a disabled button with lock emojis
			const buttons = [];
			buttons.push(Markup.button.callback('🔒 All ad slots are currently full', 'disabled'))
			// Add the "Back" button to the array of buttons
			buttons.push(Markup.button.callback('⬅ Back', 'back_to_initial'));

			// Create the menu with the disabled button
			const menu = Markup.inlineKeyboard(buttons.map((button) => [button]));

			// Add the current menu to the user's navigation stack
			navigationStack.push(menu);

			// Edit the existing message with the new inline keyboard menu
			ctx.editMessageText('Choose an option:', menu);
		}
	} else {
		// If connection refused
		ctx.editMessageText('Error fetching ad slot details. Please try again later.');
	}
}

// Callback handler for the 'update_ad' action
async function handleUpdateAd(ctx, navigationStack, userId) {
	
	const res = await updateAdSlot(userId);

	if (res.connected) {
		// expected response: {"adReserved":false,"adDetails":{"adId": 0, "adText":"", "adURL":""}}
		if (res.adReserved) {
			// Process the response with ad slot details
			const adDetails = res.data; // Assuming the response is an array of ad slot details
		
			// Create an array of buttons for the available ad slots
			const buttons = adDetails.map((slot) => {
				return Markup.button.callback(slot.slotName, `ad_slot_${slot.id}`);
			});
	
			// Add the "Back" button to the array of buttons
			buttons.push(Markup.button.callback('⬅ Back', 'back_to_initial'));
	
			// Create the menu with the available ad slots and the "Back" button
			const menu = Markup.inlineKeyboard(buttons);
	
			// Add the current menu to the user's navigation stack
			navigationStack.push(menu);
	
			// Edit the existing message with the new inline keyboard menu
			ctx.editMessageText('Choose an ad slot:', menu);
		} else {
			// Create a button to indicate no ad slot is booked
			const menuButtons = Markup.inlineKeyboard([
				[Markup.button.callback('You have no ad slots booked', 'no_ad_slot')],
				[Markup.button.callback('⬅ Back', 'back_to_initial')],
			]);
	
			// Add the current menu to the user's navigation stack
			navigationStack.push(menuButtons);
	
			// Edit the existing message with the new inline keyboard menu
			ctx.editMessageText('Choose an option:', menuButtons);
		}
	} else {
		// If connection refused
		ctx.editMessageText('Error fetching ad booking details. Please try again later.');
	}
} 

// Callback handler for the 'back_to_initial' action
async function handleBackToInitial(ctx, navigationStack) {
  try {
    // Remove the current menu from the navigation stack
    navigationStack.pop();

    // Retrieve the previous menu from the navigation stack
    const previousMenu = navigationStack[navigationStack.length - 1];

    // Edit the existing message with the previous inline keyboard menu
    ctx.editMessageText('What would you like me to help you with?', previousMenu);
  } catch (error) {
    // Handle the error
    // ...
  }
}

// Export the module functions
module.exports = {
  handleBookSlot,
  handleUpdateAd,
  handleBackToInitial,
};
