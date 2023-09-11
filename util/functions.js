const axios = require('axios');
const { bot } = require('./botInit');

// ================ Session Functions =================
const generateSessionId = () => {
  // Generate a random alphanumeric string or use any other method to create a unique session ID
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const length = 10;

  let sessionId = '';
  for (let i = 0; i < length; i++) {
    sessionId += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return sessionId;
}

// ================ Telegram Functions =================
const getPhotoId = async (groupId) => {
	return await bot.telegram.getChat(groupId)
	.then(async (chat) => {
		// Retrieve the file_id of the profile picture
		try {
			const fileId = chat.photo.big_file_id || undefined; 

			return fileId;			
		} catch (error) {
			// If there is no profile picture
			return;
		}
	}).catch((error) => {
		console.error('Error occurred while getting group information:', error);
		return undefined
	});
}

const getPhotoPath = async (photoFileId) => {
	return await bot.telegram.getFile(photoFileId)
	.then((file) => {
		// Retrieve the file path
		const filePath = file.file_path || undefined;

		return filePath;
	}).catch((error) => {
		console.error('Error occurred while getting file information:', error);
	});
}

// ================ Verification Functions =================
const isBotAdmin = async (ctx) => {
	const botMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.botInfo.id);
	return botMember.status === 'administrator';
}

const isUserAdmin = async (ctx) => {
	const userMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
	return userMember.status === 'administrator' || userMember.status === 'creator';
}

const isGroupOrSuper = async (ctx) => {
	const chatType = ctx.chat.type;
	return chatType === 'group' || chatType === 'supergroup';
}

// ================ DB Functions =================
const getGroupDetails = async (groupId) => {
	const groupData = await axios.get(`http://172.31.62.7:3000/tg-group/${groupId}/details`)
	.then(async (res) => {
		// console.log(res.data);
		return res.data;
	})
	.catch(async (err) => {
		// console.log(err);
		// If axios err connection refused
		if (err.code === 'ECONNREFUSED') {
			return 'error';
		} else if (err.response.status === 404) {
			// Group is not registered
			return
		} else {
			// Other errors
			return 'error';
		}
	});

	return groupData;
}

const getActiveCompDetails = async (groupId) => {
	const compData = await axios.get(`http://172.31.62.7:3000/competition/${groupId}/active`)
	.then(async (res) => {
		return res.data;
	})
	.catch(async (err) => {
		// If axios err connection refused
		if (err.code === 'ECONNREFUSED') {
			return 'error';
		} else if (err.response.status === 404) {
			return; 
		} else {
			return 'error';
		}
	});

	return compData;
}

const getLatestCompDetails = async (groupId) => {
	const compData = await axios
	.get(`http://172.31.62.7:3000/competition/${groupId}/latest`)
	.then(async (res) => {
		return res.data;
	})
	.catch(async (err) => {
		// If axios err connection refused
		if (err.code === 'ECONNREFUSED') {
			return 'error';
		} else if (err.response.status === 404) {
			return; 
		} else {
			return 'error';
		}
	});

	return compData;
}

const uploadSubmission = async (compId, data) => {
	const uploadStatus = await axios
	.post(`http://172.31.62.7:3000/submission/${compId}/submit`, data)
	.then(async (res) => {
		// Submission uploaded successfuly
		return 'uploaded'
	})
	.catch (async (error) => {
		// If axios err connection refused
		if (error.code === 'ECONNREFUSED') {
			return 'error';
		} else {
			return 'error';
		}
	});

	return uploadStatus;
}

const getUserSubmissions = async (compId, userId) => {
	const userSubmissions = await axios
	.get(`http://172.31.62.7:3000/submission/${compId}/submissions/${userId}`)
	.then(async (res) => {
		return res.data;
	})
	.catch(async (err) => {
		// If axios err connection refused
		if (err.code === 'ECONNREFUSED') {
			return 'error';
		} else if (err.response.status === 404) {
			return;
		} else {
			return 'error';
		}
	});

	return userSubmissions;
}

const registerGroup = async (data) => {
	const registerStatus = await axios
	.post('http://172.31.62.7:3000/tg-group/register', data)
	.then(async (res) => {
		// Token registered successfuly
		return 'registered'
	})
	.catch(async (err) => {
		// If axios err connection refused
		if (err.code === 'ECONNREFUSED') {
			return 'error';
		} else if (err.response.status === 404) {
			return; 
		} else {
			// Return true to prevent competition from starting
			return 'error';
		}
	})

	return registerStatus;
}

const updateGroupDetails = async (data) => {
	const updateStatus = await axios
	.post(`http://172.31.62.7:3000/tg-group/update`, data)
	.then(async (res) => {
		// Group details updated successfuly
		return 'updated'
	})
	.catch(async (err) => {
		// If axios err connection refused
		if (err.code === 'ECONNREFUSED') {
			return 'error';
		} else if (err.response.status === 404) {
			// Group not found
			return 'not found'
		} else {
			// Other errors
			return 'error';
		}
	})

	return updateStatus;
}

const startCompetition = async (data) => {
	const startStatus = await axios
	.post('http://172.31.62.7:3000/competition/start', data)
	.then(async (res) => {
		// Competition started successfuly
		return res.data;
	})
	.catch(async (err) => {
		// If axios err connection refused
		if (err.code === 'ECONNREFUSED') {
			return 'error';
		} else {
			// Other errors
			return 'error';
		}
	})

	return startStatus;
}

const endCompetition = async (groupId, compId) => {
	const endStatus = await axios
	.get(`http://172.31.62.7:3000/competition/${groupId}/end/${compId}`)
	.then(async () => {
		return 'ended'
	})
	.catch(async (err) => {
		// console.log(err);
		// If axios err connection refused
		if (err.code === 'ECONNREFUSED') {
			return 'error';
		} else if (err.response.status === 404) {
			// No competition running
			return 'not found';
		} else {
			// Other errors
			return 'error';
		}
	});

	return endStatus;
}

// ================ External API Calls Functions =================
const getTokenData = async (tokenChain, tokenAddress) => {
	const tokenData = await axios.get(`https://api.coingecko.com/api/v3/coins/${tokenChain.toLowerCase()}/contract/${tokenAddress}`)
	.then(async (res) => {
		return res.data;
	})
	.catch(async (err) => {
		// If axios err connection refused
		if (err.code === 'ECONNREFUSED') {
			return 'error';
		} else if (err.response.data.errors[0].status == '404') {
			return 'not found'
		} else {
			// Other errors
			return 'error';
		}
	});

	return tokenData;
}

// ================ Util Functions =================
const getFormattedDate = (startTime) => {
	const compStartTime = new Date(startTime);

	// Get start time in format: 1 Jan 2021, 12:00 AM
	const compStartTimeMs = new Date(compStartTime.getTime())
	const compStartMonth = compStartTimeMs.toLocaleString('default', { month: 'short' });
	const compStartDay = compStartTimeMs.getDate();
	const timeHrMin = compStartTimeMs.toLocaleString('en-us').split(',')[1];

	// Get Timezone (example: GMT+8, UTC-5, etc.)
	const localTimeZoned = new Date().toString().match(/([A-Z]+[\+-][0-9]+)/)[1];

	// Example localTimeZoned: GMT+0300
	// Format localTimeZoned so that there are not zeros in front of the hour and minutes
	const localTimeZonedSplit = localTimeZoned.split('');
	const localTimeZonedHour = localTimeZonedSplit[4] == 0 ? localTimeZonedSplit[5] : localTimeZonedSplit[4] + localTimeZonedSplit[5];
	const localTimeZonedMin = localTimeZonedSplit[6] == 0 && localTimeZonedSplit[7] == 0 ? '' : localTimeZonedSplit[6] + localTimeZonedSplit[7];
	const localTimeZonedFormatted = `${localTimeZonedSplit[0]}${localTimeZonedSplit[1]}${localTimeZonedSplit[2]}${localTimeZonedSplit[3]}${localTimeZonedHour}${localTimeZonedMin == '' ? '' : ':' + localTimeZonedMin}`;

	return `${compStartDay} ${compStartMonth},${timeHrMin} ${localTimeZonedFormatted}`;
}

module.exports = {
	generateSessionId,
	getPhotoId,
	getPhotoPath,
	isBotAdmin,
	isUserAdmin,
	isGroupOrSuper,
	getGroupDetails,
	getActiveCompDetails,
	getTokenData,
	registerGroup,
	updateGroupDetails,
	startCompetition,
	endCompetition,
	getUserSubmissions,
	uploadSubmission,
	getLatestCompDetails,
	getFormattedDate
}
