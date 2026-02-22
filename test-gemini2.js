const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

async function testGemini2() {
    try {
        const obj1Text = "order";
        const obj2Text = "chaos";
        
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const prompt = `You are a helpful assistant for a social awareness sorting game. The user is presented with two concepts: "${obj1Text}" and "${obj2Text}". This is a consensus poll where there is no objectively right answer; players must guess which concept the majority of other players will choose.
                
Write 4 short, distinct feedback messages (1-2 sentences each) explaining the potential psychology or reasoning behind the player's choice.
Do NOT use markdown outside of the JSON block. Return EXACTLY a valid JSON object with these exact keys:
"consensus_1_majority": (Feedback if the majority chose ${obj1Text}, and the player also chose ${obj1Text})
"consensus_1_minority": (Feedback if the majority chose ${obj2Text}, but the player chose ${obj1Text})
"consensus_2_majority": (Feedback if the majority chose ${obj2Text}, and the player also chose ${obj2Text})
"consensus_2_minority": (Feedback if the majority chose ${obj1Text}, but the player chose ${obj2Text})
`;
        
        const result = await model.generateContent(prompt);
        let rawText = result.response.text();
        console.log("RAW RESPONSE:\n", rawText);
        
        let cleanedText = rawText.replace(/```json/ig, "").replace(/```/g, "").trim();
        console.log("\nCLEANED TEXT:\n", cleanedText);
        
        const feedbackData = JSON.parse(cleanedText);
        console.log("\nPARSED SUCCESS!", Object.keys(feedbackData));
    } catch (err) {
        console.error("GEMINI ERROR:", err);
    }
}
testGemini2();
