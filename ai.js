async function generateTrivia(category, primingText) {
    const systemPrompt = `You are a trivia game host. Generate a single, challenging multiple-choice question based on the user's category.
The question should be interesting and not too obvious. Provide 4 distinct options.
Respond ONLY with a JSON object in the following format, with no other text or explanations:
{
  "question": "The question text.",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "answer": "The correct option text, which must exactly match one of the options."
}`;

    let userContent = `Category: "${category}"`;
    if (primingText && primingText.trim()) {
        userContent += `\n\nAdditional context: "${primingText}"`;
    }

    try {
        const completion = await websim.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userContent }
            ],
            json: true,
        });

        const result = completion.content;

        // Basic validation
        if (result.question && Array.isArray(result.options) && result.options.length === 4 && result.answer && result.options.includes(result.answer)) {
            return result;
        } else {
            console.error("Invalid JSON structure from AI:", result);
            throw new Error("Received invalid trivia structure from AI.");
        }

    } catch (error) {
        console.error("Error generating trivia with AI:", error);
        throw error; // Re-throw to be handled by the caller
    }
}

export { generateTrivia };