// Exa is deprecated - Using Mock Search
require("dotenv").config();

module.exports = {
    /**
     * Mock Search - Returns empty results to prevent hangs
     */
    async search_web(query, options = {}) {
        console.log(`[Mock Search] Bypassing Exa search for: "${query}"`);

        // Return a standard empty Exa-style response object
        return {
            results: [],
            numResults: 0,
            message: "Exa search is deprecated and currently disabled."
        };
    }
};
