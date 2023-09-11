const { Markup, Scenes } = require('telegraf');
const axios = require('axios');
const app = require('../../FireStorage/init.js');
const { getStorage, ref, uploadBytes, getDownloadURL } = require("firebase/storage");
const utilFunctions = require('../../util/functions.js');

// Initialize Cloud Storage and get a reference to the service
const storage = getStorage(app);

// registerGroup scene
const registerGroupScene = new Scenes.BaseScene('registerGroup');

// Step 1: Select token chain
registerGroupScene.enter(async (ctx) => {
	// Get the group data from the scene state
	const { groupTitle, groupId } = ctx.scene.state; 

	// Set update mode to false
	ctx.scene.state.updateMode = false;
	
	// Check if group exists in database to get data
	const registeredGroupDetails = await utilFunctions.getGroupDetails(groupId);

	// If group does not exist in database
	if (registeredGroupDetails === undefined) {
		const prompt = `
		➡️ You are registering a token for ${groupTitle}.

<i>This process will register the following details: group title, group Id, group photo, group portal, token chain, token address, token name, and token symbol.</i>
		`
		await ctx.reply(prompt, { parse_mode: 'HTML' });

		const promptPortal = `
		Please set your group's portal link. The link should start with "t.me/".

<i>e.g. t.me/LabsBeamBot</i>
	`

		await ctx.reply(promptPortal, {parse_mode: 'HTML'});
		return;
	} else if (registeredGroupDetails == 'error') {
		// Check if group is registered
		const errPrompt = '⛔️ There was an error processing your group details. Please try again.';

		await ctx.reply(errPrompt, { parse_mode: 'HTML' });
		await ctx.scene.leave();
		return;
	}

	// GET db to check if competition is already running
	const activeCompDetails = await utilFunctions.getActiveCompDetails(groupId);

	// Exit command if competition is running or db call error
	if (activeCompDetails == 'error') {
		const errPrompt = `
		An error occurred. Please try again later.

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
		`

		await ctx.reply(errPrompt, { parse_mode: 'HTML' });
		await ctx.scene.leave();
		return
	}	else if (activeCompDetails) {
		const prompt = `
		🛑 <b>A competition is already running in this group!</b> BeamBot does not recommended stopping competitions abruptly, but you can stop the current competition by running the /end_comp command in your group.

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
		`

		await ctx.reply(prompt, { parse_mode: 'HTML' });
		await ctx.scene.leave();
		return
	}

	// console.log(registeredGroupDetails);

	// Group exists in database
	const prompt = `
	⚠️ BeamBot has detected that this group is already registered.

🪪 <b>Group Name</b>: ${registeredGroupDetails.groupName} 
🖼️ <b>Group Image</b>: Set
🔗 <b>Group Portal</b>: ${registeredGroupDetails.tgPortal}
🪙 <b>Token</b>: ${registeredGroupDetails.projectName} (${registeredGroupDetails.projectSymbol}) on the <b>${registeredGroupDetails.projectTokenChain}</b> network.
📪 <b>CA</b>: ${registeredGroupDetails.contractAddress}
	
If you would like to update the group details, click the <b>Update</b> button. Otherwise, click on the <b>Cancel</b> button to exit.

<i>Note that group details like the group name and group image are automatically updated according to the current name and photo in the group.</i>
`
	const buttons = Markup.inlineKeyboard([
		[Markup.button.callback('⚙️ Update ⚙️', 'proceed')],
		[Markup.button.callback('🛑 Cancel 🛑', 'cancel')],
	]);

	await ctx.reply(prompt, { parse_mode: 'HTML', reply_markup: buttons.reply_markup});
})

registerGroupScene.action(/cancel/, async (ctx) => {
	await ctx.reply('🛑 Group details update cancelled.');
	await ctx.scene.leave();
});

registerGroupScene.action(/proceed/, async (ctx) => {
	// Set update mode to true
	ctx.scene.state.updateMode = true;

	const prompt = `
	Please set your group's portal link. The link should start with "t.me/".

<i>e.g. t.me/LabsBeamBot</i>
	`

	await ctx.editMessageText(prompt, {parse_mode: 'HTML'});
});

// Add action to add group portal. redirect action in proceed and scene enter to point to this action and this action points to select-chain action
registerGroupScene.action(/group_portal/, async (ctx) => {
	const prompt = `
	Please set your group's portal link. The link should start with "t.me/".

<i>e.g. t.me/LabsBeamBot</i>
	`

	await ctx.editMessageText(prompt, {parse_mode: 'HTML'});
})

registerGroupScene.hears(/(https:\/\/)?t\.me\/[\w\-\+]+/, async (ctx) => {
	// Format the portal link
	if (!ctx.message.text.startsWith('https://')) {
		ctx.message.text = 'https://' + ctx.message.text;
	}

	// Add to state
	ctx.scene.state.tgPortal = ctx.message.text

	const buttons = Markup.inlineKeyboard([
		[Markup.button.callback('Etheruem (ETH)', 'select_chain_ETH')],
		[Markup.button.callback('Binance Smart Chain (Coming Soon)', 'DISABLED')], //_select_chain_BSC
		// @TODO2: Other chain options...
	])

	await ctx.reply(`Group Portal URL set to ${ctx.scene.state.tgPortal}\n\n⛓️ Select the token chain:`, buttons);
});

registerGroupScene.action(/select_chain_*/, async (ctx) => {
  // Store the selected chain
  const selectedChain = ctx.callbackQuery.data.replace('select_chain_', '');
  ctx.scene.state.selectedChain = selectedChain;

  // Transition to the next step
  await ctx.editMessageText(`[${selectedChain}] Type token's address`);
});

// Step 2: Enter token address
registerGroupScene.hears(/^0x[0-9a-fA-F]+$/, async (ctx) => {
	// If state.selectedChain is undefined, then the user has not selected a chain
	if (ctx.scene.state.selectedChain === undefined) {
		await ctx.reply('You must first select a token chain before inputting your token\'s address. Please call the /register_group command again from the group chat.');
		await ctx.scene.leave();
		return;
	}

  // Store the token address
  const tokenAddress = ctx.message.text;
	ctx.scene.state.tokenAddress = tokenAddress;

	const tokenData = await utilFunctions.getTokenData(ctx.scene.state.selectedChain.toLowerCase(), ctx.scene.state.tokenAddress);
	
	if (tokenData == 'error') {
		const prompt = `
		⛔️ Something went wrong when checking your token details. Please run the /register_group command again.

<i>If this issue persists, please contact us at @BeamBotLabs.</i>
		`

		await ctx.reply(prompt, { parse_mode: 'HTML' });
		await ctx.scene.leave();
		return;
	} else if (tokenData == 'not found') {
		const prompt = `
		Token not found. Please check your contract address and call the /register_group command again.

<i>If you are sure that the contract address is correct, please contact us at @BeamBotLabs.</i>
		`;

		await ctx.reply(prompt, { parse_mode: 'HTML' });
		await ctx.scene.leave();
		return;
	}

	// Get the token name and symbol
	// console.log(tokenData);
	const tokenName = tokenData.name.toUpperCase();
	const tokenSymbol = tokenData.symbol.toUpperCase();

	// Store the token name and symbol
	ctx.scene.state.tokenName = tokenName;
	ctx.scene.state.tokenSymbol = tokenSymbol;

	// Build the prompt
	const prompt = `✅ Token found!\n\nIs this the token you are looking for?\n➡️ ${tokenName} (${tokenName})`;

	const buttons = Markup.inlineKeyboard([
		[Markup.button.callback('Yes', 'token_found_true')],
		[Markup.button.callback('No', 'token_found_false')],
	]);

	await ctx.reply(prompt, buttons);
});

registerGroupScene.action(/token_found_*/, async (ctx) => {
	const tokenFound = ctx.callbackQuery.data.replace('token_found_', '');

	if (tokenFound === 'false') {
		// Token not found
		const prompt = `
		⛔️ Please check that the chain and contract address you entered are correct and call the /register_group command again.

<i>If you are sure that the contract address is correct, please contact us at @BeamBotLabs.</i>
		`

		await ctx.reply(prompt, { parse_mode: 'HTML' });
		await ctx.scene.leave();
		return
	}

	// Upload groupPhoto to firebase storage
	const { groupPhotoURL, groupId } = ctx.scene.state;

	const groupIdFolder = ref(storage, `groups/${groupId}/groupAssets/groupPhoto.jpg`); 

	// get streamarraay
	const groupPhotoStream = await axios.get(groupPhotoURL, 
		{ responseType: 'arraybuffer' }
	);

	const metadata = {
		contentType: 'image/jpeg',
		customMetadata: {
			description: `${ctx.scene.state.groupTitle} group photo`,
		},
	};
		
	// upload group photo to firebase storage
	const res = await uploadBytes(groupIdFolder, groupPhotoStream.data, metadata).catch(async (err) => {
		// console.log(err);
		return 'error';
	});

	if (res === 'error') {
		const prompt = `
		⛔️ [FS1] There was an error uploading your group details. Please try again.

<i>If this issue persists, please contact us at @BeamBotLabs.</i>
		`

		await ctx.reply(prompt, { parse_mode: 'HTML' });
		await ctx.scene.leave();
		return;
	}

	// get fire storage group photo url
	const fsGroupPhotoURL = await getDownloadURL(groupIdFolder).catch(async (err) => {
		// console.log(err);
		return 'error';
	});

	if (fsGroupPhotoURL == 'error') {
		const prompt = `
		⛔️ [FS2] There was an error uploading your group details. Please try again.

<i>If this issue persists, please contact us at @BeamBotLabs.</i>
		`

		await ctx.reply(prompt, { parse_mode: 'HTML' });
		await ctx.scene.leave();
		return;
	}

	// Data to send to database
	const data = {
		groupTitle: ctx.scene.state.groupTitle,
		groupId: ctx.scene.state.groupId,
		fsGroupPhotoURL: fsGroupPhotoURL,
		tgPortal: ctx.scene.state.tgPortal,
		selectedChain: ctx.scene.state.selectedChain,
		tokenAddress: ctx.scene.state.tokenAddress,
		tokenName: ctx.scene.state.tokenName,
		tokenSymbol: ctx.scene.state.tokenSymbol,
	};

	// Send data to database
	if (ctx.scene.state.updateMode) {
		// Update mode
		const updateStatus = await utilFunctions.updateGroupDetails(data);
		
		if (updateStatus == 'updated') {
			const prompt = `
			✅ Group details updated successfuly! You can now go back to your group chat to start a content creation competition.

⚠️ <u>If you would like to update your group details, please call the /register_group command again.</u>

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
			`

			await ctx.reply(prompt, { parse_mode: 'HTML' });
			await ctx.scene.leave();
			return;
		} else if (updateStatus == 'not found') {
			const prompt = `
			⛔️ Telegram group not found. 

<i>Please contact us at @BeamBotLabs if this issue persists.</i>
			`

			await ctx.reply(prompt, { parse_mode: 'HTML' });
			await ctx.scene.leave();
			return;
		} else if (updateStatus == 'error') {
			const prompt = `
			⛔️ There was an error updating your group details. Please try again.

<i>Please contact us at @BeamBotLabs if this issue persists.</i>
			`

			await ctx.reply(prompt, { parse_mode: 'HTML' });
			await ctx.scene.leave();
			return;
		}
	} else {
		// Register mode
		const registerStatus = await utilFunctions.registerGroup(data);

		if (registerStatus == 'registered') {
			const prompt = `
			✅ Your group has been registered successfuly! You can now go back to your group chat to start a content creation competition.

<u>If you would like to update your group details, please call the /register_group command again.</u>

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
			`

			await ctx.reply(prompt, { parse_mode: 'HTML' });
			await ctx.scene.leave();
			return;
		} else if (registerStatus == 'not found') {
			const prompt = `
			⛔️ Telegram group not found.

<i>Please contact us at @BeamBotLabs if this issue persists.</i>
			`

			await ctx.reply(prompt, { parse_mode: 'HTML' });
			await ctx.scene.leave();
			return;
		} else if (registerStatus == 'error') {
			const prompt = `
			⛔️ There was an error registering your group details. Please try again.

<i>Please contact us at @BeamBotLabs if this issue persists.</i>
			`

			await ctx.reply(prompt, { parse_mode: 'HTML' });
			await ctx.scene.leave();
			return;
		}
	}

	await ctx.scene.leave();
});

module.exports = { registerGroupScene };