# AI Calling Agent Platform

## Overview
This project is an AI-powered calling platform designed for automated outbound calls with AI conversation capabilities, real-time monitoring, and comprehensive call management. Its core purpose is to enable businesses to conduct automated campaigns, such as recruiting pathology labs as partners, using AI-driven conversations. The platform features a React-based dashboard for monitoring and managing calls, leveraging AI and telephony services for seamless interaction. The business vision is to act as a neutral aggregator platform connecting laboratories across India, offering a zero-commission model to foster transparency and bridge the gap between people seeking tests and labs offering diagnostics. It aims to scale by partnering with numerous laboratories and expanding its user base.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built with React 18 and TypeScript, utilizing Shadcn/ui components (based on Radix UI) for the UI and Tailwind CSS for styling. State management is handled by TanStack Query, and Wouter is used for lightweight client-side routing. Vite serves as the build tool, and WebSocket integration provides real-time updates for live call statuses.

### Backend Architecture
The backend is powered by Node.js with the Express.js framework, written in TypeScript. It features RESTful API endpoints with structured error handling and a WebSocket server for broadcasting call events. Development leverages TSX for hot reloading, and ESBuild is used for production bundling.

### Database & ORM
PostgreSQL is the chosen database, hosted on Neon for serverless capabilities. Drizzle ORM provides type-safe schema definitions and is used with Drizzle Kit for migrations and schema management. Connection pooling is managed by `@neondatabase/serverless`. The schema includes comprehensive tables for users, contacts, campaigns, calls, and call messages.

### AI Integration
OpenAI is integrated for generating conversations. The system manages conversation history and campaign prompts, processes structured JSON responses for call flow control, and automatically extracts data points from conversations. The AI model is specifically updated to understand Hinglish, with contextual examples for broken speech patterns and temperature reduced to 0.3 for consistency. It is configured to recruit pathology labs as partners, focusing on benefits like zero commission and free listing.

### Telephony Integration
Twilio is used for all voice call and telephony services, handling automated call initiation, status tracking, and call recording. TwiML webhooks are utilized for managing call events. The system employs Twilio's speech recognition enhanced for Indian languages (hi-IN), with extended timeouts and specific hints for lab-related terms.

### Enhanced Voice Processing Pipeline
A sophisticated voice processing pipeline is implemented for seamless conversations. This includes an enhanced direct audio service capable of language auto-detection (Hindi/English/Hinglish) and voice matching (OpenAI TTS responds in the customer's detected language, e.g., Nova for Hindi/Hinglish, Alloy for English). The system eliminates interrupting prompts, ensuring a continuous flow from recording to Whisper transcription, GPT-4o processing, language-matched TTS, and playback. All "Please speak" and "Please continue" prompts have been removed, with `Record` tags replacing `Gather` tags in TwiML for uninterrupted flow.

### Authentication & Security
Session management is handled by Express sessions with PostgreSQL storage. Environment variables securely manage credentials, Zod schemas enforce input validation, and comprehensive error boundaries and logging are in place.

### Real-time Features
A WebSocket server facilitates bi-directional communication, broadcasting live call status updates and metrics to connected clients for real-time dashboard monitoring. The system includes automatic reconnection and error handling for robust real-time performance.

### Development & Build
The project emphasizes type safety with full TypeScript coverage. Development benefits from hot reloading (Vite HMR for frontend, TSX for backend) and organized imports via path aliases. The monorepo structure ensures shared schema and types between the client and server.

## External Dependencies

### Core Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting.
- **Replit Hosting**: Development and deployment environment.

### AI & Communication Services
- **OpenAI API**: Used for GPT models, Whisper for speech recognition, and various TTS models (e.g., Nova, Alloy).
- **ElevenLabs**: Premium AI voice synthesis for generating high-quality audio responses.
- **Twilio**: Provides telephony services, including voice calls, recording, and webhook management.
- **Meta Business API**: Integrated for WhatsApp bulk messaging and template management.

### Development Tools
- **Vite Plugins**: For development enhancements.
- **Drizzle Kit**: For database schema management.
- **TanStack Query**: For advanced server state management.