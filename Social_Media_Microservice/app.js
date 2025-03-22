const express = require('express');
const axios = require('axios');
const https = require('https');
const app = express();
const port = 3000;

const auth = {
    "token_type": "Bearer",
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiZXhwIjoxNzQyNjIzMzA0LCJpYXQiOjE3NDI2MjMwMDQsImlzcyI6IkFmZm9yZG1lZCIsImp0aSI6IjIzYWI3OTNjLWIzZDQtNDMwMi1hNDViLTRlY2JiZWQ4Mzg1ZSIsInN1YiI6ImhhcmRpay5wYW5kZXkuMjJjc2VAYm11LmVkdS5pbiJ9LCJjb21wYW55TmFtZSI6IkFmZm9yZG1lZCIsImNsaWVudElEIjoiMjNhYjc5M2MtYjNkNC00MzAyLWE0NWItNGVjYmJlZDgzODVlIiwiY2xpZW50U2VjcmV0IjoicmNkbEZuZG5EUlRzYXBMTSIsIm93bmVyTmFtZSI6IkhhcmRpayBQYW5kZXkiLCJvd25lckVtYWlsIjoiaGFyZGlrLnBhbmRleS4yMmNzZUBibXUuZWR1LmluIiwicm9sbE5vIjoiMjIwQzIwMzAxNDgifQ.sy27fvcVgGpR8PFIs0oyHjfJU9KILj2qh43jDYclib4",
    "expires_in": 1742623304
}

const axiosInstance = axios.create({
    baseURL: 'http://20.244.56.144',
    headers: {
        'Authorization': `${auth.token_type} ${auth.access_token}`
    },
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    }),
    timeout: 5000
});

let cachedData = {
    users: [],
    posts: [],
    comments: []
};

async function fetchUsersFromTestServer() {
    try {
        const response = await axiosInstance.get('/test/users');
        const usersDict = response.data.users;
        if (!usersDict || typeof usersDict !== 'object') {
            throw new Error('Invalid users data format');
        }
        return Object.keys(usersDict).map(userId => ({
            id: parseInt(userId, 10),
            username: usersDict[userId]
        }));
    } catch (error) {
        return [];
    }
}

async function fetchPostsForUser(userId) {
    try {
        const response = await axiosInstance.get(`/test/users/${userId}/posts`);
        const posts = response.data.posts || [];
        return posts.map(post => ({
            id: post.id,
            userId: post.userid,
            content: post.content
        }));
    } catch (error) {
        return [];
    }
}

async function fetchCommentsForPost(postId) {
    try {
        const response = await axiosInstance.get(`/test/posts/${postId}/comments`);
        const comments = response.data.comments || [];
        return comments.map(comment => ({
            id: comment.id,
            postId: comment.postid,
            content: comment.content
        }));
    } catch (error) {
        return [];
    }
}

async function initializeData() {
    cachedData.users = await fetchUsersFromTestServer();
    if (cachedData.users.length === 0) {
        return;
    }

    for (const user of cachedData.users) {
        const userPosts = await fetchPostsForUser(user.id);
        if (userPosts && Array.isArray(userPosts)) {
            cachedData.posts.push(...userPosts);
        }
    }

    for (const post of cachedData.posts) {
        const postComments = await fetchCommentsForPost(post.id);
        if (postComments && Array.isArray(postComments)) {
            cachedData.comments.push(...postComments);
        }
    }
}

initializeData();

function getUserPostCounts(posts) {
    const postCounts = {};
    posts.forEach(post => {
        const userId = post.userId;
        if (userId !== undefined && userId !== null) {
            postCounts[userId] = (postCounts[userId] || 0) + 1;
        }
    });
    return postCounts;
}

function getCommentCounts(comments) {
    const commentCounts = {};
    comments.forEach(comment => {
        const postId = comment.postId;
        if (postId !== undefined && postId !== null) {
            commentCounts[postId] = (commentCounts[postId] || 0) + 1;
        }
    });
    return commentCounts;
}

function enrichPosts(posts, users, commentCounts) {
    return posts.map(post => {
        const user = users.find(u => u.id === post.userId);
        return {
            id: post.id,
            userId: post.userId,
            username: user ? user.username : "Unknown",
            content: post.content,
            commentCount: commentCounts[post.id] || 0
        };
    });
}

app.get('/users', async (req, res) => {
    if (cachedData.users.length === 0) await initializeData();

    const postCounts = getUserPostCounts(cachedData.posts);
    const userPostCounts = Object.keys(postCounts).map(userId => ({
        userId: parseInt(userId, 10),
        postCount: postCounts[userId]
    }));

    userPostCounts.sort((a, b) => b.postCount - a.postCount || a.userId - b.userId);
    const topUsers = userPostCounts.slice(0, 5);

    const response = topUsers.map(user => {
        const userDetails = cachedData.users.find(u => u.id === user.userId);
        return {
            userId: user.userId,
            username: userDetails ? userDetails.username : "Unknown",
            postCount: user.postCount
        };
    });

    res.json(response);
});

app.get('/posts', async (req, res) => {
    const { type } = req.query;

    if (!type || !['popular', 'latest'].includes(type)) {
        return res.status(400).json({ error: "Query parameter 'type' must be 'popular' or 'latest'" });
    }

    if (cachedData.users.length === 0) await initializeData();

    const commentCounts = getCommentCounts(cachedData.comments);
    let enrichedPosts = enrichPosts(cachedData.posts, cachedData.users, commentCounts);

    if (type === 'popular') {
        enrichedPosts.sort((a, b) => b.commentCount - a.commentCount);
        const maxCommentCount = enrichedPosts[0]?.commentCount || 0;
        const popularPosts = enrichedPosts.filter(post => post.commentCount === maxCommentCount);
        res.json(popularPosts);
    } else {
        enrichedPosts.sort((a, b) => b.id - a.id);
        const latestPosts = enrichedPosts.slice(0, 5);
        res.json(latestPosts);
    }
});

app.listen(port, () => {});