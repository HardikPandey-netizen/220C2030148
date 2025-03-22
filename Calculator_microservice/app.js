const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 5000;

// Define the window size
const WINDOW_SIZE = 10;

// Store the current window of numbers (initially empty)
let windowNumbers = [];

// JWT token (Bearer token)
const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiZXhwIjoxNzQyNjI0ODg5LCJpYXQiOjE3NDI2MjQ1ODksImlzcyI6IkFmZm9yZG1lZCIsImp0aSI6IjIzYWI3OTNjLWIzZDQtNDMwMi1hNDViLTRlY2JiZWQ4Mzg1ZSIsInN1YiI6ImhhcmRpay5wYW5kZXkuMjJjc2VAYm11LmVkdS5pbiJ9LCJjb21wYW55TmFtZSI6IkFmZm9yZG1lZCIsImNsaWVudElEIjoiMjNhYjc5M2MtYjNkNC00MzAyLWE0NWItNGVjYmJlZDgzODVlIiwiY2xpZW50U2VjcmV0IjoicmNkbEZuZG5EUlRzYXBMTSIsIm93bmVyTmFtZSI6IkhhcmRpayBQYW5kZXkiLCJvd25lckVtYWlsIjoiaGFyZGlrLnBhbmRleS4yMmNzZUBibXUuZWR1LmluIiwicm9sbE5vIjoiMjIwQzIwMzAxNDgifQ.p1J2XcRj_fkmFa30j6dirt0QOWET4rDVd4NqMWRjpTE';

// Map of numberId to API endpoints
const API_ENDPOINTS = {
  'p': 'http://20.244.56.144/test/primes',
  'f': 'http://20.244.56.144/test/fibo',
  'e': 'http://20.244.56.144/test/even',
  'r': 'http://20.244.56.144/test/rand'
};

// Helper function to calculate the average of an array of numbers
const calculateAverage = (numbers) => {
  if (numbers.length === 0) return 0;
  const sum = numbers.reduce((acc, num) => acc + num, 0);
  return parseFloat((sum / numbers.length).toFixed(2));
};

// Helper function to check if the token is expired
const isTokenExpired = (expiresIn) => {
  const currentTime = Math.floor(Date.now() / 1000); // Current time in Unix timestamp (seconds)
  return currentTime > expiresIn;
};

// Main endpoint: /numbers/:numberId
app.get('/numbers/:numberId', async (req, res) => {
  const { numberId } = req.params;

  // Validate numberId
  if (!['p', 'f', 'e', 'r'].includes(numberId)) {
    return res.status(400).json({ error: 'Invalid numberId. Must be one of: p, f, e, r' });
  }

  // Check if token is expired (expires_in: 1742624363)
  if (isTokenExpired(1742624363)) {
    return res.status(401).json({ error: 'JWT token has expired. Please obtain a new token.' });
  }

  // Store the previous window state
  const windowPrevState = [...windowNumbers];

  let fetchedNumbers = [];

  try {
    // Fetch numbers from the third-party API with a 500ms timeout and JWT token
    const response = await axios.get(API_ENDPOINTS[numberId], {
      timeout: 500,
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`
      }
    });
    fetchedNumbers = response.data.numbers || [];

    // Ensure numbers are unique by filtering out duplicates from fetchedNumbers
    // and numbers already in the window
    const uniqueFetchedNumbers = [...new Set(fetchedNumbers)].filter(
      num => !windowNumbers.includes(num)
    );

    // Add the new unique numbers to the window
    windowNumbers.push(...uniqueFetchedNumbers);

    // If the window exceeds the size limit, remove the oldest numbers
    if (windowNumbers.length > WINDOW_SIZE) {
      windowNumbers = windowNumbers.slice(windowNumbers.length - WINDOW_SIZE);
    }

    // Calculate the average of the current window
    const avg = calculateAverage(windowNumbers);

    // Respond with the required format
    return res.json({
      windowPrevState,
      windowCurrState: windowNumbers,
      numbers: fetchedNumbers,
      avg
    });
  } catch (error) {
    // If the API call fails or times out, return the current state without updating
    console.error('Error fetching numbers:', error.message);
    return res.json({
      windowPrevState,
      windowCurrState: windowNumbers,
      numbers: fetchedNumbers,
      avg: calculateAverage(windowNumbers)
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});