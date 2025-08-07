# WhatsApp Messaging Platform

## Overview
This project is a comprehensive AI-powered communication platform designed for pathology lab partnerships with the LabsCheck platform. The system combines AI calling capabilities with WhatsApp bulk messaging to create a complete outreach solution. It features an AI calling agent that follows a specific flow (Start Call → ElevenLabs TTS → Speech-to-Text → OpenAI GPT → ElevenLabs TTS → Loop/End) alongside robust WhatsApp messaging functionality. The platform serves as a dual-channel communication tool for building partnerships with laboratories across India, using a zero-commission model to foster transparency and bridge the gap between people seeking tests and labs offering diagnostics.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built with React 18 and TypeScript, utilizing Shadcn/ui components (based on Radix UI) for the UI and Tailwind CSS for styling. State management is handled by TanStack Query, and Wouter is used for lightweight client-side routing. Vite serves as the build tool, and WebSocket integration provides real-time updates for live call statuses.

### Backend Architecture
The backend is powered by Node.js with the Express.js framework, written in TypeScript. It features RESTful API endpoints with structured error handling and a WebSocket server for broadcasting call events. Development leverages TSX for hot reloading, and ESBuild is used for production bundling.

### Database & ORM
PostgreSQL is the chosen database, hosted on Neon for serverless capabilities. Drizzle ORM provides type-safe schema definitions and is used with Drizzle Kit for migrations and schema management. Connection pooling is managed by `@neondatabase/serverless`. The schema includes tables for users, contacts, campaigns, WhatsApp templates, bulk message jobs, contact engagement tracking, and campaign metrics.

### AI Calling Integration
The platform features a comprehensive AI calling system powered by multiple services:
- **Twilio Integration**: Manages voice calls, call routing, and webhook handling for real-time call events
- **OpenAI Integration**: Provides conversational AI using GPT models for natural, context-aware responses
- **ElevenLabs Integration**: Delivers high-quality text-to-speech conversion for natural-sounding AI voice
- **Call Management**: Orchestrates the complete call flow from initiation to completion with conversation tracking
- **Real-time Monitoring**: Live call status updates and conversation history tracking

### WhatsApp Integration
Meta Business API is integrated for WhatsApp messaging capabilities. The system manages bulk messaging campaigns, template management, and contact engagement tracking. Messages are sent using Meta's WhatsApp Business API with proper formatting and delivery tracking. The platform supports template-based messaging with dynamic variables for personalization.

### Authentication & Security
Session management is handled by Express sessions with PostgreSQL storage. Environment variables securely manage credentials, Zod schemas enforce input validation, and comprehensive error boundaries and logging are in place.

### Real-time Features
A WebSocket server facilitates bi-directional communication, broadcasting live call status updates and metrics to connected clients for real-time dashboard monitoring. The system includes automatic reconnection and error handling for robust real-time performance.

### Development & Build
The project emphasizes type safety with full TypeScript coverage. Development benefits from hot reloading (Vite HMR for frontend, TSX for backend) and organized imports via path aliases. The monorepo structure ensures shared schema and types between the client and server.

## Recent Changes (August 7, 2025)

### AI Calling System Fully Operational with Direct Speech Processing (Latest)
- **COMPLETE SUCCESS**: AI calling system now working with natural conversation flow
- **SYSTEMATIC ELIMINATION**: Completely removed ALL Twilio recording functionality from entire codebase
- **NEW ARCHITECTURE**: Created directSpeechService.ts for clean speech processing without any recording downloads
- **CALL TRACKING**: Fixed call manager to properly track active calls across server restarts
- **CONVERSATION FLOW**: Direct speech processing working: Twilio Speech Recognition → Direct Processing → OpenAI GPT → ElevenLabs TTS → Continue Conversation
- **DATABASE CLEANUP**: Removed all recording URLs, audio recording tables, and recording-related schema
- **VALIDATION**: Added speech input validation, cleanup, and intelligent call termination detection
- **CONFIRMED WORKING**: System successfully processes speech, generates AI responses, saves conversation history, and continues call flow

### AI Calling Agent with Natural Conversation Flow (Previous)
- **MAJOR ARCHITECTURAL CHANGE**: Rebuilt complete AI calling functionality from fresh implementation
- Restored AI calling agent following exact flow: Start Call → ElevenLabs TTS → User speaks → Speech-to-Text → OpenAI GPT → ElevenLabs TTS → Play audio → Loop/End
- **NEW FEATURE**: Added background typing sounds with lower intensity to make calls sound natural and human-like
- Enhanced ElevenLabs service with background typing simulation during AI response generation
- Updated call flow to include thinking pauses with subtle typing sounds between responses
- Created fresh AI calling services: openaiService.ts, elevenlabsService.ts, twilioService.ts, callManager.ts
- Updated database schema with new calling tables (calls, callMessages) and proper relations
- Added comprehensive campaign management with custom scripts, AI prompts, language selection, ElevenLabs models, and voice agents
- Created comprehensive API routes for calling functionality and Twilio webhooks
- Built frontend pages: live-calls.tsx, calls-analytics.tsx, and campaign-manager.tsx
- Updated navigation to include calling features alongside WhatsApp messaging
- Changed platform branding to "LabsCheck AI" reflecting combined WhatsApp + AI calling capabilities
- Platform now supports both AI calling campaigns and WhatsApp bulk messaging for lab partnerships

### Database Schema Restoration
- Added calls table with comprehensive call tracking fields (duration, status, recordings, etc.)
- Added call_messages table for conversation history tracking
- Implemented proper foreign key relationships with contacts and campaigns
- Added AI-specific fields: conversation_summary, extracted_whatsapp, ai_response_time, success_score
- Storage layer updated with full calling CRUD operations alongside existing WhatsApp functionality

### Frontend Architecture Updates
- Created live-calls.tsx page for real-time call monitoring with active call status
- Created calls-analytics.tsx page for call performance metrics and historical data
- Created campaign-manager.tsx page for comprehensive campaign management with CRUD operations
- Added campaign features: name, introduction script, AI prompt, language selection, ElevenLabs model selection, voice agent selection
- Updated App.tsx with navigation for both WhatsApp and calling features
- Added proper routing for /live-calls, /calls-analytics, and /campaign-manager paths
- Maintained existing WhatsApp functionality while adding calling capabilities

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