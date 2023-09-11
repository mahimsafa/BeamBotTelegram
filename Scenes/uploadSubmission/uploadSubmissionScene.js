const { Markup, Scenes } = require('telegraf');
const axios = require('axios');
const app = require('../../FireStorage/init.js');
const { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } = require("firebase/storage");
const { getActiveCompDetails, getUserSubmissions, uploadSubmission } = require('../../util/functions.js');
//const { getAnalytics } = require("firebase/analytics");

// Initialize Cloud Storage and get a reference to the service
const storage = getStorage(app);
// const storageRef = ref(storage);

// upload submission scene
const uploadSubmissionScene = new Scenes.BaseScene('uploadSubmission');

// ==================== Messages ====================

// Constant of ONE MegaByte
const ONE_MB = 1000000;

// Error messages
const captionLimit = 200;
const errReuploadRequest = `⛔️ <i>There was an error uploading your submission. Please try to upload your image again.</i>`
const errCaptionLength = `⛔️ <i>Your caption is too long. Please keep it under ${captionLimit} characters and reupload your image.</i>`
const errImageSize = `⛔️ <i>The maximum size is 1MB. Compress your image and click the <u>Upload Submission</u> button from your group to try again.</i>`
const errImageFormat = `⛔️ <i>Only JPEG/PNG formats are accepted for submissions. Please click the <u>Upload Submission</u> button from your group again.</i>`
const errUploadDB = `⛔️ <i>There was an error uploading your submission to the database. Please click the <u>Upload Submission</u> button from your group again.</i>`
const errNoCompetition = `⛔️ <i>There is currently no competition running in your group. Ask your group admin to start a Content Creation Competition</i>`
const errCompetitionEndingSoon = `⚠️ <i>The competition is ending within the next 2 mins. You can no longer submit your content.</i>`

// Button messages
const voteButtonMessage = '🗳️ Vote For This Submission! 🗳️'

// ==================== Scenes ====================

uploadSubmissionScene.enter(async (ctx) => {
	const { groupId, username } = ctx.scene.state;

	// user did not set username
	if (!username) {
		await ctx.reply('Please set a username in your Telegram settings before submitting your content.');
		await ctx.scene.leave();
		return;
	}

	// GET db to check if competition is already running
	const activeCompDetails = await getActiveCompDetails(groupId);
	ctx.scene.state.compId = activeCompDetails.id;

	// Exit command if competition is running or db call error
	if (activeCompDetails === undefined) {
		// Build prompt
		const prompt = `
		🎯 <b>No Competition Currently Running!</b> 🎯

<i>Ask your group admin to start a new Content Creation Competition!</i>

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
		`;

		// Send message
		await ctx.reply(prompt, { parse_mode: 'HTML'});
		await ctx.scene.leave();
		return;
	} else if (activeCompDetails == 'error') {
		// Build prompt
		const prompt = `
		⛔️ An error occurred while checking competition status. Please try again later.

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
		`;

		// Send message
		await ctx.reply(prompt, { parse_mode: 'HTML'});
		await ctx.scene.leave();
		return;
	} 

	/* Disable submission if user has 2 submissions */
	const userSubmissions = await getUserSubmissions(activeCompDetails.id, ctx.from.id);

	// Check if user has 2 submissions
	if (userSubmissions == 'error') {
		// Build prompt
		const prompt = `
		⛔️ An error occurred while checking your submissions. Please try again later.

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
		`;

		// Send message
		await ctx.reply(prompt, { parse_mode: 'HTML'});
		await ctx.scene.leave();
		return;		
	} else if (userSubmissions.length == 2) {
		// Build prompt
		const prompt = `
		⛔️ You have already submitted 2 images. You can not submit more content for this competition.

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
		`;

		// Send message
		await ctx.reply(prompt, { parse_mode: 'HTML' });
		await ctx.scene.leave();
		return;
	}

	/* Disable submission if duration is over 2 mins */
	const startTime = activeCompDetails.startTime;			// startTime format: 2023-07-05T18:45:21.420Z
	const durationHrs = activeCompDetails.durationHrs; 
	
	// Get time left in minutes
	const timeLeftMs = new Date(startTime).getTime() + (durationHrs * 60 * 60 * 1000) - Date.now();
	const timeLeftMins = Math.round(timeLeftMs / 60000);
	
	// if timeLeftMins is less than 2 mins, disable submission
	if (timeLeftMins <= 2) {
		await ctx.reply(errCompetitionEndingSoon, { parse_mode: 'HTML' });
		await ctx.scene.leave();
		return;
	} else {
		ctx.scene.state.compId = activeCompDetails.id;
	}

	// Scene start message
	const prompt = `
	🧙‍♂️ <b>BeamBot Submission Wizard</b> 🧙‍♂️

📎 <u>Submission Policies</u>
	- Only 2 submissions per user
	- Only 1 JPEG/PNG format image per submission
	- Maximum size per image is 1MB
	- Maximum 200 characters per caption

🚨 <u>Submission Rules</u>
	- No offensive content
	- No advertising or self-promotion
	- No hate speech
	- No plagiarism
<i>Failure to comply with the rules will result in disqualification and a ban from future competitions</i>

<i>If you are facing issues with your submission, contact us at @BeamBotLabs</i>
	`;

	await ctx.reply(prompt, { parse_mode: 'HTML'});

	const uploadPrompt = `
	📸 <b>Upload your submission</b> 📸

Send a photo to upload your submission. You can also set a caption (no more than 200 characters) with your submission.
	`;

	await ctx.reply(uploadPrompt, { parse_mode: 'HTML' })
});

// @TODO1: save user's wallet address to database, allow users to edit their submissions
uploadSubmissionScene.hears(/./, async () => {
	return
});

// Check user submission if they reply to the bot's initial message with a photo
uploadSubmissionScene.use(async (ctx, next) => {
	// Declare variables
	const { groupId } = ctx.scene.state;
	const message = ctx.update.message;

	// User uploads telegram compressed image - compressed message.photo format alraedy an image
	if (message.photo) {
		// Shows sending photo action
		await ctx.sendChatAction('upload_photo');

		// Get photo data
		const highestQualityPhoto = message.photo[message.photo.length - 1];
		const photoId = highestQualityPhoto.file_id;

		// retreive image from telegram servers
		const photoLink = await ctx.telegram.getFileLink(photoId);
		
		// download image from telegram servers
		const photo = await axios({
			url: photoLink,
			responseType: 'arraybuffer',
		}).catch(async (error) => {
			// Download image from telegram servers Error
			// console.log(error.name);
			await ctx.reply(errReuploadRequest, { parse_mode: 'HTML' })
			return;
		});
		
		// Get user's caption and username
		const submissionCaption = message.caption || '' ;

		// Check caption length
		if (submissionCaption.length > captionLimit) {
			await ctx.reply(errCaptionLength, { parse_mode: 'HTML' });
			return;
		}

		// Get username
		const creatorTGID = message.from.id;
		const creatorUsername = message.from.username;

		// create a folder in storage with the group's Id (.parent .child .root)
		const submissionPath = ref(storage, 'groups/' + groupId + '/' + photoId + '.jpg');

		const metadata = {
			contentType: 'image/jpeg',
			customMetadata: {
				creatorTGID: creatorTGID,
				caption: submissionCaption == '' ? 'No caption' : submissionCaption,
				description: 'BeamBot Competition Submission',
			},
		};

		// upload the image to the folder and the caption to the database
		const uploadStatusFS = await uploadBytes(submissionPath, photo.data, metadata).then(async (snapshot) => {
			// @TODO1: add a progress bar for the upload
		}).catch(async () => {
			// Upload to Storage Error
			return 'error'
		});

		if (uploadStatusFS == 'error') {
			await ctx.reply(errReuploadRequest,{ parse_mode: 'HTML' })
			return;
		}

		// get image url in storage
		const photoUrl = await getDownloadURL(submissionPath)
		.catch(async () => {
			return 'error';
		});

		if (photoUrl == 'error') {
			await ctx.reply(errReuploadRequest, { parse_mode: 'HTML' })
			return;
		}

		// Send submission to database
		const data = {
			creatorTGID: creatorTGID,
			username: creatorUsername,
			firstName: message.from.first_name,
			lastName: message.from.last_name || '',
			imageURL: photoUrl,
			caption: submissionCaption,
			competitionId: ctx.scene.state.compId,
		}

		const uploadSubmissionStatus = await uploadSubmission(ctx.scene.state.compId, data)

		if (uploadSubmissionStatus === 'error') {
			await ctx.reply(errUploadDB, { parse_mode: 'HTML' })
			await deleteObject(submissionPath);
			await ctx.scene.leave();
			return;
		};

		// submission message
		const submissionMessage = `
		📸 <b>BeamBot Competition Submission</b> 📸

🎨 Creator: @${creatorUsername}
💬 Caption: ${submissionCaption == '' ? 'No caption' : submissionCaption}

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
		`;

		// @TODO0: Update link to web app
		const voteButton = Markup.inlineKeyboard([
			[Markup.button.login(voteButtonMessage, `https://beambotlabs.com/group/${ctx.scene.state.groupId}/competition/${ctx.scene.state.compId}`)],
		])

		// Send upload confirmation message
		await ctx.replyWithPhoto(photoId, {
			caption: submissionMessage, 
			parse_mode: 'HTML' 
		});

		// Send submission to group
		await ctx.telegram.sendPhoto(groupId, photoId, {
			caption: submissionMessage,
			parse_mode: 'HTML',
			reply_markup: voteButton.reply_markup,
		})

		// Leave scene
		await ctx.scene.leave();
	} else if (message.document) {
		// Shows sending photo action
		await ctx.sendChatAction('upload_photo');

		// Get photo mime type
		const mimeType = message.document.mime_type

		// Upload uncompressed images JPG/JPEG/PNG 
		if (!(mimeType == 'image/jpeg' || mimeType == 'image/png')) {
			// Image is not JPEG/PNG
			await ctx.reply(errImageFormat, { parse_mode: 'HTML' });

			// Leave scene
			await ctx.scene.leave();

			return;
		}

		// Check images are less than 1MB
		if (message.document.file_size > ONE_MB) {
			// Image is too large
			await ctx.reply(errImageSize, { parse_mode: 'HTML' });

			// Leave scene
			await ctx.scene.leave();

			return;
		}

		// Photo id
		const photoId = message.document.file_id;

		// Retreive image from telegram servers
		const photoLink = await ctx.telegram.getFileLink(photoId);

		// Download image from telegram servers
		const photo = await axios({
			url: photoLink,
			responseType: 'arraybuffer',
		}).catch(async (error) => {
			// Download image from telegram servers Error
			// console.log(error.name);
			await ctx.reply(errReuploadRequest, { parse_mode: 'HTML' })
			return;
		});

		// Get user's caption and username
		const submissionCaption = message.caption || '' ;

		// Check caption length
		if (submissionCaption.length > captionLimit) {
			await ctx.reply(errCaptionLength, { parse_mode: 'HTML' });
			return;
		}

		// Get userID and username
		const creatorTGID = message.from.id;
		const creatorUsername = message.from.username;

		// create a folder in storage with the group's Id (.parent .child .root)
		const submissionPath = ref(storage, 'groups/' + groupId + '/' + photoId + `.${mimeType.split('/')[1]}`);

		const metadata = {
			contentType: 'image/jpeg',
			customMetadata: {
				creatorTGID: creatorTGID,
				caption: submissionCaption == '' ? 'No caption' : submissionCaption,
				description: 'BeamBot Competition Submission',
			},
		};

		// upload the image to the folder
		// upload the image to the folder and the caption to the database
		const uploadStatusFS = await uploadBytes(submissionPath, photo.data, metadata).then(async (snapshot) => {
			// @TODO1: add a progress bar for the upload
		}).catch(async () => {
			// Upload to Storage Error
			return 'error'
		});

		if (uploadStatusFS == 'error') {
			await ctx.reply(errReuploadRequest,{ parse_mode: 'HTML' })
			return;
		}

		// get image url in storage
		const photoUrl = await getDownloadURL(submissionPath)
		.catch(async () => {
			return 'error';
		});

		if (photoUrl == 'error') {
			await ctx.reply(errReuploadRequest, { parse_mode: 'HTML' })
			return;
		}

		// Send submission to database
		const data = {
			creatorTGID: creatorTGID,
			username: creatorUsername,
			firstName: message.from.first_name,
			lastName: message.from.last_name || '',
			imageURL: photoUrl,
			caption: submissionCaption,
			competitionId: ctx.scene.state.compId,
		}

		const uploadSubmissionStatus = await uploadSubmission(ctx.scene.state.compId, data)

		if (uploadSubmissionStatus === 'error') {
			await ctx.reply(errUploadDB, { parse_mode: 'HTML' })
			// delete uploaded submission from storage
			await deleteObject(submissionPath);
			await ctx.scene.leave();
			return;
		};

		// submission message
		const submissionMessage = `
		📸 <b>BeamBot Competition Submission</b> 📸

🎨 Creator: @${creatorUsername}
💬 Caption: ${submissionCaption === '' ? 'No caption' : submissionCaption}

<i>BeamBot is currently in beta. If you have any feedback or suggestions, please contact us at @BeamBotLabs.</i>
		`;

		// @TODO0: Update link to web app
		const voteButton = Markup.inlineKeyboard([
			[Markup.button.login(voteButtonMessage, `https://beambotlabs.com/group/${ctx.scene.state.groupId}/competition/${ctx.scene.state.compId}`)],
		])

		// Send upload confirmation message
		await ctx.replyWithPhoto(photoId, {
			caption: submissionMessage, 
			parse_mode: 'HTML' 
		});

		// Send submission to group
		await ctx.telegram.sendPhoto(groupId, photoId, {
			caption: submissionMessage,
			parse_mode: 'HTML',
			reply_markup: voteButton.reply_markup,
		})

		// Leave scene
		await ctx.scene.leave();
	}

	// Continue to next middleware
	next();
});

module.exports = { uploadSubmissionScene };