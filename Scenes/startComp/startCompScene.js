const { Markup, Scenes } = require('telegraf');
const app = require('../../FireStorage/init.js');
const { getStorage, ref, getDownloadURL } = require('firebase/storage');
const { startCompetition, getFormattedDate } = require('../../util/functions.js');

const storage = getStorage(app);

// startComp scene
const startCompScene = new Scenes.BaseScene('startComp');

function getPreviousMenu(ctx) {
	// user details
	const userId = ctx.from.id;
	
	// Get the main menu buttons
	const mainMenuButtons = getMainMenuButtons(ctx);

	// Get the user's navigation stack
	ctx.scene.state.navigationStack.set(userId, [mainMenuButtons]);

	return ctx.scene.state.navigationStack.get(userId)[0];
	// Edit the existing message with the previous menu
	// await ctx.editMessageText('Choose an option:', previousMenu);
}

function getMainMenuButtons(ctx) {
	const compType = ctx.scene.state.compType != undefined ? ctx.scene.state.compType : 'not set';
	const firstPrize = ctx.scene.state.firstPrize != undefined ? `${ctx.scene.state.firstPrize} ${ctx.scene.state.tokenChain.toUpperCase()}` : 'not set';
	const secondPrize = ctx.scene.state.secondPrize != undefined ? `${ctx.scene.state.secondPrize} ${ctx.scene.state.tokenChain.toUpperCase()}` : 'not set';
	const thirdPrize = ctx.scene.state.thirdPrize != undefined ? `${ctx.scene.state.thirdPrize} ${ctx.scene.state.tokenChain.toUpperCase()}` : 'not set';
	const compLength = ctx.scene.state.compLength != undefined ? ctx.scene.state.compLength : 'not set';

	const menuButtons = Markup.inlineKeyboard([
		[Markup.button.callback(`🎯 Competition type (${compType}) 🎯`, 'set_comp_type')],
		[Markup.button.callback(`🥇 1st Prize (${firstPrize})`, 'comp_prize1'),
		Markup.button.callback(`🥈 2nd Prize (${secondPrize})`, 'comp_prize2')],
		[Markup.button.callback(`🥉 3rd Prize (${thirdPrize})`, 'comp_prize3'),
		Markup.button.callback(`⏳ Length (${compLength}) hrs ⏳`, 'comp_length')],
		// @TOD1: Add a button to set the reminder time
		//[Markup.button.callback('⏰ Competition Reminder ⏰', 'comp_reminder')],
		[Markup.button.callback('🏆 Start Competition 🏆', 'comp_start')],
		[Markup.button.callback('Cancel', 'comp_cancel')]
	])

	return menuButtons;
}

// ================== Scene handlers ==================

startCompScene.action(/comp_cancel/, async (ctx) => {

	const prompt = `
	Competition has been cancelled. If you would like to start a new competition, call the /start_comp command again from the group chat.
	
	<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
	`

	await ctx.editMessageText(prompt, {parse_mode: 'HTML'});


	// Leave the scene
	await ctx.scene.leave();
})

startCompScene.enter(async (ctx) => {
	// User Details
	const userId = ctx.from.id;

	// Get the group data from the scene state
	const { groupTitle } = ctx.scene.state; 

	// Initialise message prompt
	ctx.scene.state.menuTextTemplate = `
	⚙️ <b>BeamBot</b>

You are configuring a <i>Content Creation Competition</i> for <b>${groupTitle}</b>.

📊 <i>We recommend running an ad campaign with BeamBot to promote your competition and attract more participants! You can view more details about running ads with BeamBot by calling the /ad command in BeamBot's private chat!</i>
	`;

	// Initialise waiting variables for user input
	ctx.scene.state.waiting = {
		waitingFirstPrize: false,
		waitingSecondPrize: false,
		waitingThirdPrize: false,
		waitingCompLength: false
	};
	
	// Get the main menu buttons
	const mainMenuButtons = getMainMenuButtons(ctx);

	// Set the user's navigation stack
	ctx.scene.state.navigationStack = new Map();
	ctx.scene.state.navigationStack.set(userId, [mainMenuButtons]);

	const botMsg = await ctx.reply(ctx.scene.state.menuTextTemplate, {parse_mode: 'HTML', reply_markup: mainMenuButtons.reply_markup});
	ctx.scene.state.botMsgId = botMsg.message_id;
});

/* Select competition type */
startCompScene.action(/set_comp_type/, (ctx) => {
  // Competition Type menu
	const menuButtons = Markup.inlineKeyboard([
		[Markup.button.callback('🗳️ Majority Vote Mode 🗳️', 'comp_type_Majority-Vote')],
		[Markup.button.callback('🔒 Coming Soon 🔒', 'DISABLED_CompType_MCM')],
		[Markup.button.callback('⬅️ Go back', 'go_back')]
	])

	// Update the user's navigation stack
	ctx.scene.state.navigationStack.get(ctx.from.id).push(menuButtons);

	const prompt = `
	🎯 <b>Competition Type</b>
Choose the type of competition you want to run:
	
1. 🗳️ <b>Majority Vote Mode</b> 🗳️
Users vote for their favourite submissions to push them to the top and win the competition!

2. 🔒 <b>COMING SOON!</b> 🔒 
A new competition type is coming soon! Look out for more in the next BeamBot update!
	`

  // Show new menu
  ctx.editMessageText(prompt, {parse_mode:'HTML', reply_markup: menuButtons.reply_markup});
});

startCompScene.action(/go_back/, async (ctx) => {
	// Reset waiting variables
	ctx.scene.state.waiting.waitingFirstPrize = false;
	ctx.scene.state.waiting.waitingSecondPrize = false;
	ctx.scene.state.waiting.waitingThirdPrize = false;
	ctx.scene.state.waiting.waitingCompLength = false;

	const previousMenu = getPreviousMenu(ctx);

	await ctx.editMessageText(ctx.scene.state.menuTextTemplate, {parse_mode: 'HTML', reply_markup: previousMenu.reply_markup});
})

startCompScene.action(/comp_type_*/, async (ctx) => {
	// Store the selected competition type
	const selectedCompType = ctx.callbackQuery.data.replace('comp_type_', '');
	ctx.scene.state.compType = selectedCompType;

	const updatedPreviousMenu = getPreviousMenu(ctx);

	// Edit the existing message with the updated previous menu
	await ctx.editMessageText(ctx.scene.state.menuTextTemplate, {parse_mode: 'HTML', reply_markup: updatedPreviousMenu.reply_markup});
});

/* Select competition prize */
startCompScene.action(/comp_prize*/, async (ctx) => {
	// Prize for chosen position
	const prizePosition = ctx.callbackQuery.data.replace('comp_prize', '');

	// Token chain
	const tokenChain = ctx.scene.state.tokenChain

	// Go back button
	const goBackButton = Markup.inlineKeyboard([Markup.button.callback('⬅️ Go back', 'go_back')]);

	if (prizePosition == '1') {
		ctx.scene.state.waiting.waitingFirstPrize = true;

		const prompt = `
		🥇 <b>1st Place Prize</b> 🥇
		
➡️ Set the prize for the first position in ${tokenChain}. (e.g. 0.5)
		`
		await ctx.editMessageText(prompt, {parse_mode: 'HTML', reply_markup: goBackButton.reply_markup});
 	} else if (prizePosition == '2') {
		if (ctx.scene.state.firstPrize == undefined) {
			await ctx.reply('Please set the 1st prize first!');
			return;
		} else {
			ctx.scene.state.waiting.waitingSecondPrize = true;

			const prompt =`
			🥈 <b>2nd Place Prize</b> 🥈
			
➡️ Set the prize for the second position in ${tokenChain}. (e.g. 0.3)
			`
			await ctx.editMessageText(prompt, {parse_mode: 'HTML', reply_markup: goBackButton.reply_markup});
		}
	} else if (prizePosition == '3') {
		if (ctx.scene.state.firstPrize == undefined) {
			await ctx.reply('Please set the 1st prize first!');
			return;
		} else if (ctx.scene.state.secondPrize == undefined) {
			await ctx.reply('Please set the 2nd prize first!');
			return;
		} else {
			ctx.scene.state.waiting.waitingThirdPrize = true;

			const prompt = `
			🥉 <b>3rd Place Prize</b> 🥉
			
➡️ Set the prize for the third position in ${tokenChain}. (e.g. 0.2)
			`
			await ctx.editMessageText(prompt, { parse_mode: 'HTML', reply_markup: goBackButton.reply_markup});
		}
	}
})

/* Select competition length */
startCompScene.action(/comp_length/, async (ctx) => {
	// Go back button
	const goBackButton = Markup.inlineKeyboard([Markup.button.callback('⬅️ Go back', 'go_back')]);

	ctx.scene.state.waiting.waitingCompLength = true;

	await ctx.editMessageText(`
	⏳ <b>Competition Length</b> ⏳
	
➡️ Set the length of the competition in hours. (e.g. 24)`, {parse_mode: 'HTML', reply_markup: goBackButton.reply_markup});
})

/* Handle configuration for prizes and competition length */
startCompScene.hears(/./, async (ctx) => {
	const validNoErr = 'Please enter a valid number greater than 0.'

	// Handle input
	if (ctx.scene.state.waiting.waitingFirstPrize == true) {
		if (ctx.scene.state.deleteMessage != undefined) {
			await ctx.deleteMessage(ctx.scene.state.deleteMessage.message_id);
			ctx.scene.state.deleteMessage = undefined;
		}
		// Check input is a number and greater than 0
		if (isNaN(ctx.message.text) || ctx.message.text <= 0) {
			await ctx.deleteMessage(ctx.message.message_id);
			const errBotReply = await ctx.reply(validNoErr);
			ctx.scene.state.deleteMessage = errBotReply;
			return;
		}
		ctx.scene.state.firstPrize = ctx.message.text;
		ctx.scene.state.waiting.waitingFirstPrize = false;
	} else if (ctx.scene.state.waiting.waitingSecondPrize == true) {
		if (ctx.scene.state.deleteMessage != undefined) {
			await ctx.deleteMessage(ctx.scene.state.deleteMessage.message_id);
			ctx.scene.state.deleteMessage = undefined;
		}
		if (isNaN(ctx.message.text) || ctx.message.text < 0) {
			await ctx.deleteMessage(ctx.message.message_id);
			const errBotReply = await ctx.reply(validNoErr);
			ctx.scene.state.deleteMessage = errBotReply;
			return;
		}
		ctx.scene.state.secondPrize = ctx.message.text;
		ctx.scene.state.waiting.waitingSecondPrize = false;
	} else if (ctx.scene.state.waiting.waitingThirdPrize == true) {
		if (ctx.scene.state.deleteMessage != undefined) {
			await ctx.deleteMessage(ctx.scene.state.deleteMessage.message_id);
			ctx.scene.state.deleteMessage = undefined;
		}
		if (isNaN(ctx.message.text) || ctx.message.text < 0) {
			await ctx.deleteMessage(ctx.message.message_id);
			const errBotReply = await ctx.reply(validNoErr);
			ctx.scene.state.deleteMessage = errBotReply;
			return;
		}
		ctx.scene.state.thirdPrize = ctx.message.text;
		ctx.scene.state.waiting.waitingThirdPrize = false;
	} else if (ctx.scene.state.waiting.waitingCompLength == true) {
		if (ctx.scene.state.deleteMessage != undefined) {
			await ctx.deleteMessage(ctx.scene.state.deleteMessage.message_id);
			ctx.scene.state.deleteMessage = undefined;
		}
		// Check input is a number and greater than 0 and not a decimal
	  if (isNaN(ctx.message.text) || ctx.message.text < 0 || ctx.message.text.includes('.')) {
			await ctx.deleteMessage(ctx.message.message_id);
			const errBotReply = await ctx.reply('Please enter a valid number greater than 0. (No decimals)');
			ctx.scene.state.deleteMessage = errBotReply;
			return;
		}
		ctx.scene.state.compLength = ctx.message.text;
		ctx.scene.state.waiting.waitingCompLength = false;
	} else {
		return;
	}

	// Delete the user's message
	await ctx.deleteMessage(ctx.message.message_id);

	// Edit the existing message with the updated previous menu
	const updatedPreviousMenu = getPreviousMenu(ctx);
	await ctx.telegram.editMessageText(ctx.message.chat.id, ctx.scene.state.botMsgId, null, ctx.scene.state.menuTextTemplate, { parse_mode: 'HTML', reply_markup: updatedPreviousMenu.reply_markup});
})

/* Start competition */
startCompScene.action(/comp_start/, async (ctx) => {
	// @TODO1: (REMINDER) Check if the competition details are set

	// Get the group id
	const { groupId } = ctx.scene.state;

	// Check if the competition details are set
	if (ctx.scene.state.compType == undefined || ctx.scene.state.firstPrize == undefined || ctx.scene.state.compLength == undefined) {	
		await ctx.reply('Please make sure you set at least the competition type, 1st prize and competition length.');
		await ctx.scene.leave();
		return;
	}

	// Send a confirmation message to the group and the private chat
	// Add a button to the confirmation message to allow users to join the competition
	
	// Get the group image
	const groupImageRef = ref(storage, `groups/${groupId}/groupAssets/groupPhoto.jpg`);

	const groupImageURL = await getDownloadURL(groupImageRef)
	.catch(async (err) => {
		return 'error';
	});

	if (groupImageURL == 'error') {
		await ctx.reply('Error getting group image. Please try again later.');
		await ctx.scene.leave();
		return;
	}

	// Add competition details to the database
	/*
	groupId: number;
	isRunning: boolean;
	title: string;
	mode: string;
	startTime: Date;
	durationHrs: number;
	projectChain: string;
	prize1: number;
	prize2: number;
	prize3: number;
	*/
	const data = {
		groupId: groupId,
		title: ctx.scene.state.groupTitle,
		mode: ctx.scene.state.compType,
		durationHrs: ctx.scene.state.compLength,
		projectChain: ctx.scene.state.tokenChain,
		prize1: ctx.scene.state.firstPrize,
		prize2: ctx.scene.state.secondPrize || 0,
		prize3: ctx.scene.state.thirdPrize || 0,	
	}

	// Send the competition details to the backend
	const compStatus = await startCompetition(data);
	// console.log('compStatus');
	// console.log(compStatus);

	if (compStatus == 'error') {
		const prompt = `
		An error occurred while starting the competition. Please try again later.

<i>Please contact us at @BeamBotLabs if the issue persists.</i>
		`

		await ctx.reply(prompt, {parse_mode: 'HTML'});
		await ctx.scene.leave();
		return;
	}

	// Show startDate month day hour minute with the timezone in UTC. 
	const currentDate = new Date();
	const startDate = getFormattedDate(currentDate);
	// const startDate = new Date(currentDate.getTime());
	// const compStartMonth = startDate.toLocaleString('default', { month: 'short' });
	// const compStartDay = startDate.getDate();
	// const timeHrMin = startDate.toLocaleString('en-us').split(',')[1];

	const prompt = `
	🏁 <b>Content Creation Competition Started!</b> 🏁

<b>🎯 Competition Details 🎯</b>
☑️ <b>Competition Type:</b> ${ctx.scene.state.compType}
🥇 <b>1st Prize:</b> ${ctx.scene.state.firstPrize} ${ctx.scene.state.tokenChain.toUpperCase()}${ctx.scene.state.secondPrize != undefined ? `\n🥈 <b>2nd Prize:</b> ${ctx.scene.state.secondPrize} ${ctx.scene.state.tokenChain.toUpperCase()}` : ''}${ctx.scene.state.thirdPrize != undefined ? `\n🥉 <b>3rd Prize:</b> ${ctx.scene.state.thirdPrize} ${ctx.scene.state.tokenChain.toUpperCase()}` : ''}
🕥 <b>Start time:</b> ${startDate}
⏳ <b>Competition Length:</b> ${ctx.scene.state.compLength} hrs

- Use /comp to check time left and view competition details again

⬇️ <b>The Submission Portal Is Now Open!</b> ⬇️
	`;

	const uploadButton = Markup.inlineKeyboard([
		[Markup.button.login('🖼️ View Submissions 🖼️', `https://beambotlabs.com/group/${compStatus.groupId}/competition/${compStatus.id}`)],
		[Markup.button.url('🔺 Upload Submisison 🔺', `https://t.me/${ctx.botInfo.username}?start=uploadSubmission_${groupId}`)]
	]);

	// Update the existing message with the updated previous menu
	await ctx.editMessageText(prompt, {parse_mode: 'HTML', reply_markup: uploadButton.reply_markup})

	// Send the confirmation message to the group
	const compMsg = await ctx.sendPhoto(groupImageURL, {chat_id: groupId, caption: prompt, parse_mode: 'HTML', reply_markup: uploadButton.reply_markup})

	// Pin the message to the group
	await ctx.pinChatMessage(compMsg.message_id, {chat_id: groupId});
	
	// Leave the scene
	await ctx.scene.leave();
})

module.exports = { startCompScene };