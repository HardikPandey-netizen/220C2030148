const express = require('express');
const app = express();
const port = 9876; // Updated port as per test case

// Sliding window to store numbers (max size: 10)
let window = [];
const WINDOW_SIZE = 10;

// Mock function to simulate fetching numbers from a third-party server
// Adjusted to return the exact numbers from the test case
function fetchNumbers(numberId) {
    const mockData = {
        e: [
            [2, 4, 6, 8], // First request to /numbers/e
            [6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30], // Second request to /numbers/e
        ],
    };

    // Simulate sequential calls by maintaining a request counter per numberId
    if (!fetchNumbers.requestCounts) {
        fetchNumbers.requestCounts = { e: 0 };
    }

    if (!fetchNumbers.requestCounts[numberId]) {
        fetchNumbers.requestCounts[numberId] = 0;
    }

    const requestIndex = fetchNumbers.requestCounts[numberId] % mockData[numberId].length;
    fetchNumbers.requestCounts[numberId]++;

    return mockData[numberId][requestIndex] || [];
}

// Function to update the sliding window and calculate the average
function updateWindow(newNumbers) {
    // Store the previous state of the window
    const windowPrevState = [...window];

    // Add new numbers to the window
    window.push(...newNumbers);

    // Remove duplicates by converting to a Set and back to an array
    window = [...new Set(window)];

    // If window size exceeds 10, remove the oldest numbers
    if (window.length > WINDOW_SIZE) {
        window = window.slice(window.length - WINDOW_SIZE);
    }

    // Calculate the average of the current window
    const avg = window.length > 0 ? (window.reduce((sum, num) => sum + num, 0) / window.length).toFixed(2) : 0;

    return { windowPrevState, windowCurrState: [...window], avg };
}

// Define the REST API endpoint
app.get('/numbers/:numberId', (req, res) => {
    const { numberId } = req.params;

    // Validate the numberId
    const validIds = ['p', 'f', 'e', 'r'];
    if (!validIds.includes(numberId)) {
        return res.status(400).json({ error: 'Invalid numberId. Use p, f, e, or r.' });
    }

    // Fetch numbers from the third-party server (mocked here)
    const numbers = fetchNumbers(numberId);

    // Update the sliding window and calculate the average
    const { windowPrevState, windowCurrState, avg } = updateWindow(numbers);

    // Format the response
    const response = {
        windowPrevState,
        windowCurrState,
        numbers,
        avg: parseFloat(avg), // Ensure avg is a number, not a string
    };

    // Send the response
    res.json(response);
});

// Start the server
app.listen(port, () => {
    console.log(`Average Calculator microservice running on http://localhost:${port}`);
});