document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const addFieldBtn = document.getElementById('add-field-btn');
    const runBtn = document.getElementById('run-btn');
    const inputContainer = document.getElementById('input-container');
    const resultContainer = document.getElementById('result-container');
    const loader = document.getElementById('loader');
    const resultContent = document.getElementById('result-content');
    const apiKeyDisplay = document.getElementById('api-key-display'); // Assuming you might add this to show key status

    // --- State ---
    // IMPORTANT: Storing API keys directly in client-side code (even if prompted)
    // is not recommended for production applications due to security risks.
    // For a simple demo, it's acceptable. For real apps, use a backend proxy.
    let geminiApiKey = localStorage.getItem('geminiApiKey') || ""; // Persist key
    if (geminiApiKey && apiKeyDisplay) {
        apiKeyDisplay.textContent = 'API Key Loaded (from localStorage)';
    }

    // --- Configuration ---
    // Use a currently supported model. 'gemini-1.5-flash' is a good balance
    // of performance and cost for text generation tasks.
    // Always check Google's official documentation for the latest model names.
    const GEMINI_MODEL = "gemini-1.5-flash"; // Or "gemini-1.5-pro" for higher quality
    const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

    // --- Event Listeners ---
    addFieldBtn.addEventListener('click', addInputField);
    runBtn.addEventListener('click', handleRun);

    // --- Functions ---

    /**
     * Adds a new topic input field to the DOM.
     */
    function addInputField() {
        const inputCount = inputContainer.getElementsByClassName('topic-input').length;
        const newInput = document.createElement('input');
        newInput.type = 'text';
        newInput.className = 'topic-input';
        newInput.placeholder = `Enter topic #${inputCount + 1}`;
        inputContainer.appendChild(newInput);
    }

    /**
     * Handles the click event for the 'Run' button, orchestrating the idea mixing process.
     */
    async function handleRun() {
        // Prompt for API key if not already set
        if (!geminiApiKey) {
            geminiApiKey = prompt("Please enter your Google Gemini API Key:", "");
            if (!geminiApiKey) {
                alert("API Key is required to mix ideas.");
                return;
            }
            localStorage.setItem('geminiApiKey', geminiApiKey); // Persist
            if (apiKeyDisplay) {
                apiKeyDisplay.textContent = 'API Key Loaded (from user input)';
            }
        }

        // 1. Collect and validate topics
        const topicInputs = document.querySelectorAll('.topic-input');
        const topics = Array.from(topicInputs)
            .map(input => input.value.trim())
            .filter(topic => topic !== ''); // Filter out empty fields

        if (topics.length < 2) {
            alert("Please enter at least two topics to mix.");
            return;
        }

        // 2. Prepare UI for loading
        setLoadingState(true);

        // 3. Construct the prompt for the Gemini API
        const prompt = createPrompt(topics);

        try {
            // 4. Call the Gemini API
            const api_url = `${API_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`;

            const response = await fetch(api_url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    // Optional: Add generation config for more control
                    generationConfig: {
                        temperature: 0.9, // Adjust for creativity (0.0 - 1.0)
                        topP: 1,
                        topK: 1,
                        maxOutputTokens: 800, // Limit output length if needed
                    },
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                let errorMessage = `API Error: ${response.status} - `;
                if (errorData && errorData.error && errorData.error.message) {
                    errorMessage += errorData.error.message;
                    // Specific handling for common errors
                    if (errorData.error.message.includes("API key not valid")) {
                        errorMessage += ". Please check your API key.";
                        geminiApiKey = ""; // Clear invalid key
                        localStorage.removeItem('geminiApiKey');
                        if (apiKeyDisplay) apiKeyDisplay.textContent = 'API Key Invalid. Please re-enter.';
                    } else if (errorData.error.message.includes("models/gemini-pro is not found")) {
                        errorMessage += `. Model '${GEMINI_MODEL}' might be incorrect or unavailable for your region/project. Check documentation.`;
                    }
                } else {
                    errorMessage += "Unknown error.";
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();

            // Check if candidates array exists and has content
            if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
                // 5. Process and display the result
                const ideaText = data.candidates[0].content.parts[0].text;
                resultContent.innerHTML = formatResponse(ideaText);
            } else {
                resultContent.innerHTML = `<p class="error-message">No ideas generated. The model might have been filtered or returned an empty response.</p>`;
            }

        } catch (error) {
            console.error("Error fetching from Gemini API:", error);
            resultContent.innerHTML = `<p class="error-message">An error occurred: ${error.message}.</p>`;
            // Provide a hint to the user for API key issues
            if (error.message.includes("API key not valid")) {
                resultContent.innerHTML += `<p class="error-message">Please ensure your Gemini API key is correct and has the necessary permissions.</p>`;
            }
        } finally {
            // 6. Reset UI from loading state
            setLoadingState(false);
        }
    }

    /**
     * Constructs the prompt string for the Gemini API based on provided topics.
     * @param {string[]} topics - An array of topics to mix.
     * @returns {string} The formatted prompt string.
     */
    function createPrompt(topics) {
        return `
You are a highly creative brainstorming assistant called 'Idea Mixer'.
Your goal is to generate innovative and exciting ideas by combining a list of seemingly unrelated topics.

Here are the topics to mix:
${topics.map(topic => `- ${topic}`).join('\n')}

Please generate 3 to 5 distinct, well-developed ideas from these topics.
For each idea, provide the following in clear Markdown format:

### Idea Title (A catchy name)
**Concept:** A short, compelling paragraph explaining the core idea.
**Target Audience:** A brief description of who this idea is for.
---
Ensure the final output is only the generated ideas, without any introductory or concluding remarks from you.
        `;
    }

    /**
     * Sets the loading state of the UI.
     * @param {boolean} isLoading - True to show loading, false to hide.
     */
    function setLoadingState(isLoading) {
        if (isLoading) {
            loader.style.display = 'block';
            resultContent.innerHTML = ''; // Clear previous results
            runBtn.disabled = true;
            runBtn.textContent = 'Mixing...';
        } else {
            loader.style.display = 'none';
            runBtn.disabled = false;
            runBtn.textContent = 'Mix Ideas!';
        }
    }

    /**
     * Converts a subset of Markdown text to HTML for display.
     * @param {string} text - The Markdown text to convert.
     * @returns {string} The HTML formatted string.
     */
    function formatResponse(text) {
        // Basic Markdown to HTML conversion
        let html = text
            .replace(/### (.*)/g, '<h3>$1</h3>') // h3 for titles
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold for labels
            .replace(/---/g, '<hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">') // Horizontal rule
            .replace(/\n/g, '<br>'); // New lines

        return html;
    }

});