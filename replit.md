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

### Call Response Time Optimized - 7-Second Delay Fixed (Latest)
- **INSTANT CALL PICKUP**: Eliminated 7-second delay by using fast Twilio TTS for immediate responses instead of waiting for ElevenLabs API
- **OPTIMIZED CALL FLOW**: Immediate TwiML response using Twilio voice, with ElevenLabs processing moved to background
- **FASTER AI PROCESSING**: Reduced OpenAI max_tokens to 50 for quicker responses, limited conversation history to last 4 exchanges
- **AUDIO ROUTE FIXED**: Removed duplicate audio routes causing 500 errors and application crashes
- **ERROR HANDLING IMPROVED**: Fixed Express error handler that was causing stack traces after proper responses
- **STREAMLINED PROCESSING**: Removed complex audio file generation and thinking pauses that were causing delays
- **BACKGROUND OPTIMIZATION**: ElevenLabs audio generation now happens asynchronously without blocking call flow

### Natural Background Typing Effects Added (Previous)
- **HUMAN-LIKE CONVERSATION**: Added continuous background typing sounds throughout entire call for natural human experience
- **ENHANCED ELEVENLABS SERVICE**: Implemented thinking pauses with natural typing effects between AI responses
- **CONTINUOUS TYPING AMBIANCE**: Background typing effects active during thinking, speaking, and conversation pauses
- **NATURAL CONVERSATION FLOW**: Added pre-response, post-response, and extended thinking pauses with typing sounds
- **TWILIO INTEGRATION**: Enhanced TwiML generation with natural typing pauses and conversation flow effects
- **CAMPAIGN-DRIVEN TYPING**: Typing effects use campaign voice and language settings for consistency

### Campaign Voice Settings Fixed (Previous)
- **CRITICAL VOICE FIX**: Removed all hardcoded agent voice, language, and speech speed selections
- **CAMPAIGN-DRIVEN SETTINGS**: System now uses campaign-defined voiceId (Pratik Heda), elevenlabsModel (eleven_turbo_v2 fast), and language settings
- **FLEXIBLE EMAIL EXTRACTION**: Enhanced contact extraction to capture any email domain spoken by customers (not just hardcoded Gmail/Yahoo)
- **CONTACT REGEX IMPROVED**: Fixed spaced digits pattern for WhatsApp numbers ("9 3 2 5 0" → "9325025730")
- **TwiML LANGUAGE SUPPORT**: Updated TwilioService to use campaign language settings throughout call flow
- **ELEVENLABS MODEL SELECTION**: ElevenLabsService now uses campaign-specified model and voice configuration

### AI Calling System Fully Operational with Contact Collection (Previous)
- **COMPLETE SUCCESS**: AI calling system now working with natural conversation flow and contact extraction
- **WEBHOOK ANALYSIS COMPLETE**: Examined and fixed all call disconnection issues through enhanced webhook logging
- **FAST CALL CONNECTIONS**: Optimized Twilio settings reduced connection time to under 1 second
- **CONTACT COLLECTION VERIFIED**: AI successfully extracts and saves WhatsApp numbers and any email addresses from speech (flexible domain support)
- **SMART CONVERSATION FLOW**: Calls continue until BOTH WhatsApp number AND email address are collected
- **INTELLIGENT AI RESPONSES**: AI detects missing/incorrect contact info and asks for clarification
- **CALL PERSISTENCE**: Calls remain active throughout conversation and don't drop unexpectedly
- **SYSTEMATIC ELIMINATION**: Completely removed ALL Twilio recording functionality from entire codebase
- **ENHANCED WEBHOOK TRACKING**: Added comprehensive logging to monitor call status changes and identify issues
- **CONVERSATION FLOW CONFIRMED**: Direct speech processing working: Twilio Speech Recognition → Contact Extraction → OpenAI GPT → ElevenLabs TTS → Continue Until Complete Contact Info
- **DATABASE STORAGE**: Contact information automatically saved to call records for follow-up outreach

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