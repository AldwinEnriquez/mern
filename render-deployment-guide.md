# Render Deployment Guide

## Service settings

| Setting          | Value                          |
|------------------|--------------------------------|
| Service type     | Web Service                    |
| Environment      | Node                           |
| Branch           | main                           |
| Root directory   | *(leave blank)*                |
| Build command    | `npm install && npm run build` |
| Start command    | `npm start`                    |
| Instance type    | Free                           |

## Environment variables to add in Render

| Variable       | Example value              | Purpose                          |
|----------------|----------------------------|----------------------------------|
| MONGODB_URI    | mongodb+srv://...          | Connects backend to MongoDB Atlas |
| SESSION_SECRET | a-long-random-string       | Signs the session cookie          |
| NODE_ENV       | production                 | Enables production behaviour      |
