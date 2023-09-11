// api.js
const axios = require('axios');

// Function to fetch available ad slots from the API
async function fetchAvailableSlots() {
	const URL = 'http://172.31.62.7:3000/ad-slot/available-slots';

  return await axios.get(URL)
		.then((response) => {
			// checks if response list is empty
			if (response.data.length == 0) {
				return {
					"connected": true,
					"available": false,
					"data": []
				}
			} else {
				return {
					"connected": true,
					"available": false,
					"data": response.data
				}
			}
		}).catch((error) => {
			return {
				"connected": false,
			}
		});		
}

// Function to update the ad slot for a specific user
async function updateAdSlot(userId) {
	const URL = `http://172.31.62.7:3000/ad-slot/update-slot/${userId}`

	return await axios.get(URL)
		.then((response) => {
			if (response.data.adReserved) {
				return {
					"connected": true,
					"adReserved": true,
					"data": response.data.adDetails
				}
			} else {
				return {
					"connected": true,
					"adReserved": false,
					"data": []
				}
			}
		})
		.catch((error) => {
			return {
				"connected": false,
			}
		})
};


// Export the module functions
module.exports = {
  fetchAvailableSlots,
  updateAdSlot,
};
