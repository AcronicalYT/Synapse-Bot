const axios = require('axios');
require('dotenv').config();

const BUNGIE_API_KEY = process.env.BUNGIE_API_KEY;
const BUNGIE_API_BASE_URL = 'https://www.bungie.net/Platform';

async function searchBungieUser(fullBungieName) {
    if (!BUNGIE_API_KEY) {
        console.error('Bungie API Key is missing. Check your .env file.');
        throw new Error('Bungie API Key not configured.');
    }

    const nameParts = fullBungieName.trim().split('#');
    if (nameParts.length !== 2) {
        console.warn(`Invalid Bungie Name format: ${fullBungieName}. Expected Name#Code.`);
        return null;
    }
    const displayName = nameParts[0];
    const displayNameCodeString = nameParts[1]; // Keep as string initially for validation

    if (!/^\d{3,4}$/.test(displayNameCodeString)) {
        console.warn(`Invalid Bungie Name code: ${displayNameCodeString}. Expected 3 or 4 digits.`);
        return null;
    }

    // The User.ExactSearchRequest schema likely expects displayNameCode as a number or string.
    // Let's assume string based on common practice, but API docs for User.ExactSearchRequest would confirm.
    // If it needs to be an integer: const displayNameCode = parseInt(displayNameCodeString);
    const displayNameCode = displayNameCodeString; // Or parseInt if schema requires int

    const membershipType = -1; // -1 for All, as per documentation
    const endpointPath = `/Destiny2/SearchDestinyPlayerByBungieName/${membershipType}/`;
    const url = `${BUNGIE_API_BASE_URL}${endpointPath}`;

    const requestBody = {
        displayName: displayName,
        displayNameCode: parseInt(displayNameCode) // Or parseInt(displayNameCode) if the schema demands an integer
    };

    try {
        const response = await axios.post(url, requestBody, {
            headers: {
                'X-API-Key': BUNGIE_API_KEY,
                'Content-Type': 'application/json' // Important for POST requests with a JSON body
            }
        });

        // Standard Bungie API response structure check
        if (response.data && response.data.ErrorCode && response.data.ErrorCode !== 1) {
            console.error(`Bungie API Error for ${url} (POST): ${response.data.Message} (ErrorCode: ${response.data.ErrorCode})`);
            return null; // Or an object indicating the error
        }

        // The response directly contains the array of UserInfoCard objects
        const apiResponseData = response.data.Response;

        if (!apiResponseData || apiResponseData.length === 0) {
            console.log(`No Bungie user found for "${fullBungieName}".`);
            return null;
        }

        // The API returns an array; we expect the first result to be the direct match.
        const userData = apiResponseData[0];

        return {
            membershipId: userData.membershipId,
            membershipType: userData.membershipType,
            bungieGlobalDisplayName: userData.bungieGlobalDisplayName, // This should be in UserInfoCard
            bungieGlobalDisplayNameCode: userData.bungieGlobalDisplayNameCode, // This should be in UserInfoCard
            // iconPath: userData.iconPath // Also part of UserInfoCard
        };

    } catch (error) {
        if (error.response) {
            console.error(`Bungie API HTTP Error for ${url} (POST): ${error.response.status}`, error.response.data);
        } else if (error.request) {
            console.error(`Bungie API No Response for ${url} (POST):`, error.request);
        } else {
            console.error('Axios or other error during Bungie API request (POST):', error.message);
        }
        return null;
    }
}

module.exports = { searchBungieUser };