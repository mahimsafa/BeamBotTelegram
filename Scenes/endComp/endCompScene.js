const { Markup, Scenes } = require('telegraf');
const { endCompetition } = require('../../util/functions');

// endComp Scene
const endCompScene = new Scenes.BaseScene('endComp');

endCompScene.enter(async (ctx) => {
	// Ask for confirmation
	const prompt = `
	🛑 <b>Are you sure you want to end the competition?</b> 🛑

<i>BeamBot does not recommended stopping competitions abruptly. This action <b>CANNOT</b> be undone.</i>
	`
	const confirmButton = Markup.inlineKeyboard([
		[Markup.button.callback('Yes', 'end_comp_yes')], 
		[Markup.button.callback('No', 'end_comp_no')],
	]);

	await ctx.reply(prompt, { parse_mode: 'HTML', reply_markup: confirmButton.reply_markup });
});

endCompScene.action(/end_comp_*/, async (ctx) => {
	const action = ctx.match.input.split('_')[2];

	if (action === 'yes') {
		// Get the competition id from the scene state
		const { compId } = ctx.scene.state;
		const groupId = ctx.chat.id;

		// End active competition
		const endStatus = await endCompetition(groupId, compId);

		if (endStatus === 'ended') {
			// Build Repsonse
			const prompt = `
			🛑 <b>Competition Ended!</b> 🛑

<i>You can now start a new Content Creation Competition!</i>

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
			`

			await ctx.reply(prompt, { parse_mode: 'HTML' });
		} else if (endStatus === 'not found') {
			await ctx.reply('⛔️ No competition is currently running. Use /comp to check competition details');
		} else if (endStatus === 'error') {
			await ctx.reply('⛔️ An error occurred while checking if a competition is running. Please try again later.');
		}
	} else {
		// No
		const prompt = `
		✅ Competition is still running. Use /comp to check competition details

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
		`

		await ctx.reply(prompt, { parse_mode: 'HTML' });
	}

	// End scene
	await ctx.scene.leave();
});

module.exports = { endCompScene };