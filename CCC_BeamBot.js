const { Telegraf, Markup, Scenes, session } = require('telegraf')
const axios = require('axios');
// Functions
const utilFunctions = require('./util/functions.js');

// Scenes
const { registerGroupScene, startCompScene, uploadSubmissionScene, endCompScene } = require('./Scenes/Scenes.js');

// Start BeamBot
const { bot, BOT_API_TOKEN } = require('./util/botInit.js');
const botUsername = 'LabsBeamBot';

// Ad implementation files
const { generateInitialMenu } = require('./ad/adMenu');
const { handleBookSlot, handleUpdateAd, handleBackToInitial } = require('./ad/callbacks');
const adInfo = require('./ad/adInfo.js');

// Hashmaps
// @TODO0: Redo navStack for ad, make in scene state
const navigationStacks = new Map(); // Store navigation stacks for each user
const dataMap = new Map(); 					// Store data using session IDs as keys, object value should contain date for flushing (if old)

// Sessions that are 2.5 mins old in the hashmap will be cleared
const FLUSH_MAP_INTERVAL = 1500000; // 2.5 mins
setInterval(() => {
	dataMap.forEach((value, key) => {
		if (Date.now() - value.date > FLUSH_MAP_INTERVAL) {
			dataMap.delete(key);
		}
	});
}, FLUSH_MAP_INTERVAL);

// Register scenes
/* TTL: 
works for clearing a scene from memory either if the user hasn't interacted with the
scene for the ttl duration or if the user left and the ttl duration has passed
*/
const TTL_DURATION = 60000; // 1 min
const stage = new Scenes.Stage([registerGroupScene, startCompScene, uploadSubmissionScene, endCompScene], { ttl: TTL_DURATION });
bot.use(session());
bot.use(stage.middleware());

// register commands list
bot.telegram.setMyCommands([
	{ command: 'help', description: 'View the help message' },
	{ command: 'ad', description: 'Advertise with BeamBot' },
	{ command: 'register_group', description: 'Register the group with BeamBot' },
	{ command: 'start_comp', description: 'Start a Content Creation Competition' },
	{ command: 'comp', description: 'View the current competition details (Vote and Submit)' },
	{ command: 'end_comp', description: 'End your active Content Creation Competition' },
]);

// ========================== Custom Event Listeners ==========================


// ========================== Shared Cmds ==========================
bot.command('help', async (ctx) => {
  // if user is admin
	const helpMessage = `
	⚙️ <b><u>BeamBot</u></b>

BeamBot is a Telegram bot that helps you run content creation competitions in your groups.

👥 <b>Group Commands</b>
🔹 /help - View the help message
🔹 /register_group - Register your group with BeamBot
🔹 /start_comp - Start a Content Creation Competition
🔹 /comp - View the current competition details (Vote and Submit)
🔹 /end_comp - End your active Content Creation Competition

👤 <b>Private Commands</b>
🔹 /ad - Advertise with BeamBot

🛠️ <b><u>How to to start a Content Creation Competition</u></b>

<b>1.</b> Add BeamBot to your group chat.
<b>2.</b> Run the /register_group command to register your group with BeamBot.
<b>3.</b> Run the /start_comp command to configure and start a competition.
<b>4.</b> Once the competition starts, BeamBot will send a message to your group with the competition details. 
<b>5.</b> Users can view the competition details by running the /comp command in the group.
<b>6.</b> Participants can vote for or upload their submissions by clicking on the buttons under the /comp message.
<b>7.</b> BeamBot will announce the end of the competition once the duration is over.

<i>We are constantly working to improve BeamBot. BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
`;

	await ctx.reply(helpMessage, { parse_mode: 'HTML' });
});

// ========================== Group Cmds ==========================

// Handle the /registerGroup command
bot.command('register_group', async (ctx) => {
	// Command only works if typed in a group chat
	const isGroup = await utilFunctions.isGroupOrSuper(ctx);
	if (!isGroup) {
		await ctx.reply('This command is not supported in this chat type. Please run the command in a group chat to register your token.');
		return
	}

	// Check if user is admin
	const userIsAdmin = await utilFunctions.isUserAdmin(ctx);
	if (!userIsAdmin) {
		await ctx.reply('This command requires you to be an administrator/creator in the group.');
		return;
	}

	// Different Bot permissions available (later)
	// Check if bot is admin
	const botIsAdmin = await utilFunctions.isBotAdmin(ctx);
	if (!botIsAdmin) {
		await ctx.reply('This command requires me to be an administrator in the group.');
		return;
	}

	// Get the group title and ID
	const userId = ctx.from.id;
	const groupTitle = ctx.chat.title; 
	const groupId = ctx.chat.id; 

	// Get the group photo path
	const groupPhotoFileId = await utilFunctions.getPhotoId(groupId);
	if (groupPhotoFileId === undefined) {
		await ctx.reply('⛔️ Please set a photo for your group and call the /register_group command again.');
		return;
	}

	// Retrieve the file path
	const groupPhotoPath = await utilFunctions.getPhotoPath(groupPhotoFileId);
	if (groupPhotoPath === undefined) {
		await ctx.reply('⛔️ An error occurred while retrieving your group photo. Please try again later.');
		return;
	}

	// Session ID
	const sessionId = utilFunctions.generateSessionId();

	// Store the group details in the dataMap
	dataMap.set(sessionId, { groupTitle, groupId, groupPhotoPath, date: Date.now() });

	// Build Repsonse
	const prompt = 'To proceed with registering your group, please click the button below:';
	const startUrl = `https://t.me/${botUsername}?start=registerGroup_${userId}_${sessionId}`;
	const keyboard = Markup.inlineKeyboard([
		Markup.button.url('Register Group', startUrl),
	]);

	await ctx.reply(prompt, keyboard);
});

// Handle the /start_comp command
bot.command('start_comp', async (ctx) => {
	// Command only works if typed in a group chat
	const isGroup = await utilFunctions.isGroupOrSuper(ctx);
	if (!isGroup) {
		await ctx.reply('This command is not supported in this chat type. Please run the command in a group chat to register your token.');
		return
	}
	
	// Check if user is admin
	const userIsAdmin = await utilFunctions.isUserAdmin(ctx);
	if (!userIsAdmin) {
		await ctx.reply('This command requires you to be an administrator/creator in the group.');
		return;
	}

	// Different Bot permissions available (later)
	// Check if bot is admin
	const botIsAdmin = await utilFunctions.isBotAdmin(ctx);
	if (!botIsAdmin) {
		await ctx.reply('This command requires me to be an administrator in the group.');
		return;
	}

	// GET db api endpoint for group details (token chain, so far)
	const userId = ctx.from.id;
	const groupTitle = ctx.chat.title;
	const groupId = ctx.chat.id;
	
	// Check if group is registered
	const registeredGroupDetails = await utilFunctions.getGroupDetails(groupId);

	// Check if group is registered
	// Check if group title is the same
	// @TODO1: Check if group photo changed
	if (registeredGroupDetails === undefined) {
		const prompt = `
		To proceed with starting a competition in your group, your group has to be registered with BeamBot. Please run the /register_group command to register your group.

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
		`;

		await ctx.reply(prompt, { parse_mode: 'HTML' });
		return;
	} else if (registeredGroupDetails == 'error') {
		const errPrompt = `
		An error occurred while checking if your group is registered with BeamBot. Please try again later.

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
		`;

		await ctx.reply(errPrompt, { parse_mode: 'HTML' });
		return;
	}
	
	// Check Group details changes
	if (registeredGroupDetails.groupName !== groupTitle) {
		// Build Repsonse
		const errPrompt = `
		Your group title has been updated since you last registered. Please run the /register_group command to update your group details with BeamBot.

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>	
		`

		await ctx.reply(errPrompt, { parse_mode: 'HTML' });
		return
	}

	// GET db to check if competition is already running
	const activeCompDetails = await utilFunctions.getActiveCompDetails(groupId);

	// Exit command if competition is running or db call error
	if (activeCompDetails === 'error') {
		const errPrompt = `
		An error occurred while checking if a competition is running in your group. Please try again later.

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
		`
		
		await ctx.reply(errPrompt, { parse_mode: 'HTML' });
		return
	}	else if (activeCompDetails) {
		const prompt = `
		🛑 <b>A competition is already running in this group!</b> BeamBot does not recommended stopping competitions abruptly, but you can stop the current competition running the /end_comp command in your group.

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
		`

		await ctx.reply(prompt, { parse_mode: 'HTML' });
		return
	}

	// Assigning token Chain
	const tokenChain = registeredGroupDetails.projectTokenChain;

	// Session ID
	const sessionId = utilFunctions.generateSessionId();

	dataMap.set(sessionId, { groupTitle, groupId, tokenChain, date: Date.now() });

	// Build Repsonse
	const prompt = `
	🏆 Start a Content Creation Competition by clicking on the button below! 🏆
	`;
	const startUrl = `https://t.me/${botUsername}?start=startComp_${userId}_${sessionId}`;
	const keyboard = Markup.inlineKeyboard([
		Markup.button.url('⚙️ Configure Competition ⚙️', startUrl),
	]);

	await ctx.reply(prompt, keyboard);

	// @TODO1: Implement comp reminder
	// 4.1 start reminder duration
	// 4.2 start comp length timer

	// submission & voting flow
	// 7. submission: type comp, url to the bot to start submission process
	// 8. voting: type comp, url to the site to view submissions and vote
});

// Handle the /comp command
bot.command('comp', async (ctx) => {
	// Command only works if typed in a group chat
	const isGroup = await utilFunctions.isGroupOrSuper(ctx);
	if (!isGroup) {
		await ctx.reply('This command is not supported in this chat type. Please run the command in a group chat to register your token.');
		return
	}

	// Group details
	const groupId = ctx.chat.id;

	// Check if group is registered
	const registeredGroupDetails = await utilFunctions.getGroupDetails(groupId);

	// Check if group is registered
	// Check if group title is the same
	if (registeredGroupDetails === undefined) {
		const prompt = `
		Your group has to be registered with BeamBot to run this command. Please run the /register_group command to register your group.

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
		`;

		await ctx.reply(prompt, { parse_mode: 'HTML' });
		return;
	} else if (registeredGroupDetails == 'error') {
		const errPrompt = `
		An error occurred while checking if your group is registered with BeamBot. Please try again later.

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
		`;

		await ctx.reply(errPrompt, { parse_mode: 'HTML' });
		return;
	}

	// GET db to check if competition is already running
	const activeCompDetails = await utilFunctions.getActiveCompDetails(groupId);

	if (activeCompDetails === undefined) {
		// Get latest competition details if exists
		const latestCompDetails = await utilFunctions.getLatestCompDetails(groupId);

		// Exit command if no previous competition or db call error
		if (latestCompDetails === undefined) {
			// Build prompt
			const prompt = `
			🎯 <b>No Competition Currently Running!</b> 🎯
	
<i>Ask your group admin to start a new Content Creation Competition!</i>

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
			`;
	
			// Send message
			await ctx.reply(prompt, { parse_mode: 'HTML'});
			return;
		} else if (latestCompDetails == 'error') {
			// Build prompt
			const prompt = `
			⛔️ An error occurred while getting latest competition in the group. Please try again later.

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
			`;

			// Send message
			await ctx.reply(prompt, { parse_mode: 'HTML'});
			return;
		}

		// Build prompt
		const latestCompStartTime = utilFunctions.getFormattedDate(latestCompDetails.startTime);
		const latestCompStartTimeMs = new Date(latestCompDetails.startTime);

		const latestCompDuration = latestCompDetails.durationHrs;
		const latestCompEndTime = utilFunctions.getFormattedDate(new Date(latestCompStartTimeMs.getTime() + (latestCompDuration * 60 * 60 * 1000)));

		const prompt = `
		🏁 <b>Content Creation Competition Ended!</b> 🏁

<b>🎯 Competition Details 🎯</b>
☑️ <b>Competition Type:</b> ${latestCompDetails.mode}
🥇 <b>1st Prize:</b> ${latestCompDetails.prize1} ${latestCompDetails.projectChain.toUpperCase()}${latestCompDetails.prize2 == undefined || 0 ? '' : `\n🥈 <b>2nd Prize:</b> ${latestCompDetails.prize2} ${latestCompDetails.projectChain.toUpperCase()}`}${latestCompDetails.prize3 == undefined || 0 ? '' : `\n🥉 <b>3rd Prize:</b> ${latestCompDetails.prize3} ${latestCompDetails.projectChain.toUpperCase()}`}
🕥 <b>Start time:</b> ${latestCompStartTime}
⌛️ <b>End time:</b> ${latestCompEndTime}
⏳ <b>Duration:</b> ${latestCompDuration} hrs 

<i>You can start a new competition by running the /start_comp command in your group.</i>

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
		`;

		// Send message
		await ctx.reply(prompt, { parse_mode: 'HTML'});
		return;
	} else if (activeCompDetails == 'error') {
		// Build prompt
		const prompt = `
		⛔️ An error occurred while checking whether your a competition is running. Please try again later.

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
		`;

		// Send message
		await ctx.reply(prompt, { parse_mode: 'HTML'});
		return;
	} 

	// Response if competition is running
	// Calculate Time Left
	const compStartTime = utilFunctions.getFormattedDate(activeCompDetails.startTime);
	const compStartTimeMs = new Date(activeCompDetails.startTime);
	const compDuration = activeCompDetails.durationHrs * 60 * 60 * 1000; // Convert to ms
	const timeLeftHrs = Math.floor((compDuration - (Date.now() - compStartTimeMs)) / (1000 * 60 * 60));
	const timeLeftMins = Math.floor((compDuration - (Date.now() - compStartTimeMs)) / (1000 * 60)) % 60;
	const timeLeftSecs = Math.floor((compDuration - (Date.now() - compStartTimeMs)) / 1000) % 60;

	// Build prompt
	const prompt = `
	🏁 <b>Content Creation Competition Running!</b> 🏁

<b>🎯 Competition Details 🎯</b>
☑️ <b>Competition Type:</b> ${activeCompDetails.mode}
🥇 <b>1st Prize:</b> ${activeCompDetails.prize1} ${activeCompDetails.projectChain.toUpperCase()}${activeCompDetails.prize2 == undefined || 0 ? '' : `\n🥈 <b>2nd Prize:</b> ${activeCompDetails.prize2} ${activeCompDetails.projectChain.toUpperCase()}`}${activeCompDetails.prize3 == undefined || 0 ? '' : `\n🥉 <b>3rd Prize:</b> ${activeCompDetails.prize3} ${activeCompDetails.projectChain.toUpperCase()}`}
🕥 <b>Start time:</b> ${compStartTime}
⏳ <b>Time Left:</b> ${timeLeftHrs != 0 ? `${timeLeftHrs} hrs ` : ''}${timeLeftMins != 0 ? `${timeLeftMins} mins ` : ''}${timeLeftSecs} secs


⬇️ <b>Submission Portal Open!</b> ⬇️
	`;

	const uploadButton = Markup.inlineKeyboard([
		// @TODO0: Update URL to website
		[Markup.button.login('🖼️ View Submissions 🖼️', `https://beambotlabs.com/group/${activeCompDetails.groupId}/competition/${activeCompDetails.id}`)],
		[Markup.button.url('🔺 Upload Submisison 🔺', `https://t.me/${botUsername}?start=uploadSubmission_${groupId}`)]
	]);

	// Send message
	await ctx.reply(prompt, { 
		parse_mode: 'HTML', 
		reply_markup: uploadButton.reply_markup 
	});
});

// Handle the /end_comp command
bot.command('end_comp', async (ctx) => {
	// Command only works if typed in a group chat
	const isGroup = utilFunctions.isGroupOrSuper(ctx);
	if (!isGroup) {
		// Ignore the command in other chat types
		await ctx.reply('This command is not supported in this chat type. Please add me to a group chat to use this command.');
		return;
	}

	// Check if user is admin
	const userIsAdmin = await utilFunctions.isUserAdmin(ctx);
	if (!userIsAdmin) {
		await ctx.reply('This command requires you to be an administrator/owner in the group.');
		return;
	}

	// Check if bot is admin
	const botIsAdmin = await utilFunctions.isBotAdmin(ctx);
	if (!botIsAdmin) {
		await ctx.reply('This command requires me to be an administrator in the group.');
		return;
	}

	// Group details
	const groupId = ctx.chat.id;

	// get active Competition
	const activeCompDetails = await utilFunctions.getActiveCompDetails(groupId);

	if (activeCompDetails === undefined) {
		// Build prompt
		const prompt = `
		🎯 <b>No Competition Currently Running!</b> 🎯

<i>Ask your group admin to start a new Content Creation Competition!</i>

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
		`;

		// Send message
		await ctx.reply(prompt, { parse_mode: 'HTML'});
		return;
	} else if (activeCompDetails == 'error') {
		// Build prompt
		const prompt = `
		⛔️ An error occurred while checking whether your a competition is running. Please try again later.

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
		`;

		// Send message
		await ctx.reply(prompt, { parse_mode: 'HTML'});
		return;
	} 

	// Get competition id
	const compId = activeCompDetails.id;

	await ctx.scene.enter('endComp', { compId });
});

// bot.command('test', async (ctx) => {

// 	const groupId = ctx.chat.id;

// 	const uploadButton = Markup.inlineKeyboard([
// 		[Markup.button.url('🖼️ View Submissions 🖼️', `https://t.me/${botUsername}?start=test`)],
// 		[Markup.button.url('🔺 Upload Submission 🔺', `https://t.me/${botUsername}?start=uploadSubmission_${groupId}`)]
// 	]);
	
// 	await ctx.reply('Testing Upload', uploadButton);

// 	// const mediaGroup = [
//   //   { type: 'photo', media: 'https://api.dicebear.com/6.x/adventurer/jpg?seed=Toby', caption: 'Photo 1 Caption' },
//   //   { type: 'photo', media: 'https://api.dicebear.com/6.x/adventurer/jpg?seed=Snuggles'},
//   //   { type: 'photo', media: 'https://api.dicebear.com/6.x/adventurer/jpg?seed=Sammy'}
//   // ];

//   // await ctx.replyWithMediaGroup(mediaGroup)
// 	await axios.get('http://172.31.62.7:3000/submission/test').then((res) => {
// 		console.log('a');
// 	}).catch((err) => {
// 		console.log('b');
// 		console.log(err.message);
// 	});
// });

// ========================== Private Msgs ==========================

/* ====== Start ====== */
bot.command('start', async (ctx) => {
	// Get user ID
	const userId = ctx.from.id;
	
	// Check 'start' url parameters
	const startParams = ctx.message.text.split('_');

	// Get Params
	const command = startParams[0].split(' ')[1]; // E.g. '/start command'
	const callerId = startParams[1];
	const sessionId = startParams[2]; 

	// Handle the 'start' command for normal use cases if chat type is private
	if (!(command == 'uploadSubmission')) {
		if (command == undefined || callerId != userId) {
			// Check chat type is private
			const chatType = ctx.chat.type;

			if (chatType === 'private') {
				const startMessage = `
				<b>Welcome to BeamBot!</b>

Welcome to BeamBot! BeamBot is a Telegram bot that helps you run Content Creation Competitions in your group chats!
		
Run the /help command for more details on how to use BeamBot.

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
				`

				await ctx.reply(startMessage, { parse_mode: 'HTML' });
			}

			return
		} 
	}
	
	// Get session data for the commands
	const sessionData = dataMap.get(sessionId);

	// Check if session is still valid
	if (command === 'registerGroup' || command === 'startComp') {

		if (sessionData === undefined) {
			const prompt = `
			⛔️ This session has expired. 

Please run the command again to start the ${command} wizard 🧙‍♂️

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
			`;

			// Session is old and deleted
			await ctx.reply(prompt, { parse_mode: 'HTML' });

			return;
		}
	}

  if (command === 'registerGroup') {
		// Extract the group Title and ID from the command parameter
		const groupTitle = sessionData.groupTitle;
    const groupId = sessionData.groupId; 
		const groupPhotoPath = sessionData.groupPhotoPath;
		const groupPhotoURL = `https://api.telegram.org/file/bot${BOT_API_TOKEN}/${groupPhotoPath}`;

		// Delete the session data
		dataMap.delete(sessionId);

		// Enter the registerGroup scene
		await ctx.scene.enter('registerGroup', { groupTitle, groupId, groupPhotoURL }); 
  } else if (command === 'startComp') {
		// Extract the group Id from the command parameter
		const groupTitle = sessionData.groupTitle;
    const groupId = sessionData.groupId;
		const tokenChain = sessionData.tokenChain;

		// Delete the session data
		dataMap.delete(sessionId);

		// Enter the startComp scene
		await ctx.scene.enter('startComp', { groupTitle, groupId, tokenChain }); // Enter the startComp scene
	}	else if (command === 'uploadSubmission') {
		// Extract the group Id from the command parameter
		const groupId = startParams[1];
		const username = ctx.from.username;

		await ctx.scene.enter('uploadSubmission', { groupId, username }); // Enter the startComp scene
	} 
});

/* ====== Ad ====== */
bot.command('ad', (ctx) => {
	const chatType = ctx.chat.type;

	// Check if the command was sent in a private chat
	if (chatType === 'private') {

		const userId = ctx.from.id;

		// Create the initial inline keyboard menu
		const initialMenu = generateInitialMenu();

		// Clear the user's navigation stack and send the prompt message with the initial inline keyboard menu
		navigationStacks.set(userId, [initialMenu]);
		ctx.reply('What would you like me to help you with?', initialMenu);
	}
});

/* ====== Ad Callbacks ====== */

bot.on('callback_query', async (ctx) => {
  const userId = ctx.from.id;
  const navigationStack = navigationStacks.get(userId);

  const callbackData = ctx.callbackQuery.data;

  if (callbackData === 'book_slot') {
    await handleBookSlot(ctx, navigationStack, userId);
  } else if (callbackData === 'update_ad') {
    await handleUpdateAd(ctx, navigationStack, userId);
  } else if (callbackData === 'show_ad_info') {
		await ctx.editMessageText(adInfo, { parse_mode: 'HTML' });
	} else if (callbackData === 'back_to_initial') {
		await handleBackToInitial(ctx, navigationStack);
	}
});

/* ============= Comp End custom Event Listener ================= */
// NestJS backend will call this endpoint to send a message to the passed group ID when a competition ends

bot.launch()