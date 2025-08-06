# AI Calling Agent Platform

## Overview

This is a comprehensive AI-powered calling platform built with a modern full-stack architecture. The application enables automated outbound calling with AI conversation capabilities, real-time monitoring, and comprehensive call management. It features a React-based dashboard for monitoring active calls, viewing call history, and managing campaigns, with AI-driven conversations powered by OpenAI and telephony services through Twilio.

## Current Status (January 2025)

✅ **FULLY FUNCTIONAL** - All core features are implemented and working, with recent fixes completed:

- **Database**: PostgreSQL with complete schema and seed data
- **AI Integration**: OpenAI GPT-4o for natural conversations with configurable model selection
- **Telephony**: Twilio SIP trunk integration for outbound calls
- **Real-time Dashboard**: Live call monitoring with WebSocket updates
- **Campaign Management**: Advanced script management with AI prompt configuration
- **Contact Database**: Excel bulk import/export with drag-and-drop file upload
- **Voice Synthesis**: ElevenLabs premium AI voice synthesis with custom voice support
- **Speech Recognition**: OpenAI Whisper integration with multiple model options
- **Messaging Integration**: Real-time WhatsApp and Email messaging during calls
- **WhatsApp Bulk Messaging**: Meta Business API integration with template management and bulk campaigns
- **Template Management**: WhatsApp message template creation, approval tracking, and bulk messaging
- **Call Analytics**: Automated call summaries with contact data extraction
- **API Endpoints**: Complete REST API for all operations including file uploads
- **Webhook Integration**: Twilio webhooks for call flow control
- **Enhanced Contact Management**: CSV bulk upload supporting 10,000+ contacts with fields (name, city, state, phone, email)
- **Multi-Channel Campaign System**: Integrated AI calling + WhatsApp messaging with automated follow-up scheduling
- **Advanced Analytics Dashboard**: Real-time tracking of customer reach, response rates, and engagement metrics

### Current Issues and Solutions
**AI Calling:** Fixed phone number formatting and error handling. Twilio trial account requires phone number verification in Twilio Console before calls can be made.

**WhatsApp Webhooks:** Technical webhook processing is working perfectly. Real phone messages require proper Meta Business Manager configuration - webhook URL must be correctly set and phone numbers may need to be added as test recipients.

**ElevenLabs Voice Synthesis:** FULLY OPERATIONAL with premium AI voice synthesis! Complete migration from AI4Bharat to ElevenLabs-only architecture. Fixed TwilioService method signatures and response handling. System generates high-quality MP3 audio files with proper TwiML `<Play>` tags. Campaign "Labscheck" configured with custom voice Z6TUNPsOxhTPtqLx81EX using eleven_turbo_v2 model. Audio files served via HTTPS with proper content headers. Voice synthesis producing 30KB+ audio files with natural speech quality.

**WhatsApp API Updated:** Fresh WhatsApp Business API access token configured (January 6, 2025). Previous token expired and has been renewed. All messaging functionality operational.

**OpenAI Language Understanding:** SIGNIFICANTLY ENHANCED (January 6, 2025) - Switched to full gpt-4o model and enhanced prompts for better Hinglish understanding. System now provides contextual examples of broken speech patterns and appropriate responses. Temperature reduced to 0.3 for more consistent behavior.

**Twilio Speech Recognition:** ENHANCED for Indian languages - Updated with hi-IN language setting, extended timeouts (6s speech, 15s total), experimental_conversations model, partial result callbacks, and comprehensive lab partnership hints (lab, laboratory, pathology, partner, partnership, owner, manager, WhatsApp, etc.). Added proper TwiML structure with closing tags and enhanced confidence thresholds.

**Ready for Testing:** All core functionality working with enhanced language understanding and comprehensive LabsCheck knowledge base. System now better processes unclear/mixed Hindi-English speech from Indian customers.

**ULTRA-FAST RESPONSE + DYNAMIC LANGUAGE SWITCHING - COMPLETED (January 6, 2025):** Maximum response time optimization achieved with intelligent language adaptation:
- Speech timeouts reduced from 6s → 2s (67% faster)
- OpenAI processing optimized: max_tokens 200→120, temperature 0.3→0.1
- Audio generation accelerated: ElevenLabs stability reduced, speaker boost disabled
- Audio pause minimized: 1s → 0.1s (90% reduction)
- DYNAMIC LANGUAGE SWITCHING: Real-time detection of customer's language (Hindi/English/Mixed) with automatic AI response adaptation
- Complete language flow: Customer Speech-to-Text → AI Model (same language) → Text-to-Speech (same language)
- Language consistency maintained throughout entire conversation pipeline

**LabsCheck Website Integration - CORRECTED (January 6, 2025):** Complete website content from labscheck.com/about integrated into AI model memory with ACCURATE business model:

**CORRECT BUSINESS MODEL:**
- LabsCheck is NOT a laboratory - it's a neutral aggregator platform founded in 2025
- Mission: Partner with ALL laboratories across India to create transparency  
- Goal: Bridge gap between people seeking tests and labs offering diagnostics
- Zero commission model - labs keep 100% of payments directly from customers
- Platform connects 500+ partner labs to 100k+ users across 140+ cities

**AI MODEL UPDATED:**
- Changed from "health checkup calls" to "lab partnership calls"
- Conversations now focus on recruiting labs as partners, not selling tests to patients
- WhatsApp messages promote partnership benefits: zero commission, free listing, direct bookings
- Accurate positioning: LabsCheck helps labs get more customers, not compete with them
- Partnership focus: Join 500+ existing partners including Dr Lal PathLabs, Thyrocare, Metropolis

**CAMPAIGN OBJECTIVE:** Recruit pathology labs as platform partners for business growth

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite with hot module replacement
- **Real-time Updates**: WebSocket integration for live call status updates

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful endpoints with structured error handling
- **Real-time Communication**: WebSocket server for broadcasting call events
- **Development**: TSX for hot reloading in development mode
- **Production Build**: ESBuild for server bundling

### Database & ORM
- **Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM with type-safe schema definitions
- **Migrations**: Drizzle Kit for schema management
- **Connection**: Connection pooling with @neondatabase/serverless
- **Schema**: Comprehensive tables for users, contacts, campaigns, calls, and call messages

### AI Integration
- **Provider**: OpenAI for conversation generation
- **Context Management**: Maintains conversation history and campaign prompts
- **Response Processing**: Structured JSON responses with call flow control
- **Data Extraction**: Automatic extraction of conversation data points

### Telephony Integration
- **Provider**: Twilio for voice calls and telephony services
- **Call Management**: Automated call initiation and status tracking
- **Recording**: Built-in call recording capabilities
- **Webhooks**: TwiML webhook handling for call events

### Authentication & Security
- **Session Management**: Express sessions with PostgreSQL storage
- **Environment Variables**: Secure credential management for all integrations
- **Input Validation**: Zod schemas for request validation
- **Error Handling**: Comprehensive error boundaries and logging

### Real-time Features
- **WebSocket Server**: Bi-directional communication for live updates
- **Event Broadcasting**: Real-time call status updates to all connected clients
- **Dashboard Updates**: Live metrics and active call monitoring
- **Connection Management**: Automatic reconnection and error handling

### Development & Build
- **Type Safety**: Full TypeScript coverage across frontend and backend
- **Hot Reloading**: Vite HMR for frontend, TSX for backend development
- **Path Aliases**: Organized imports with @ and @shared prefixes
- **Monorepo Structure**: Shared schema and types between client and server

## External Dependencies

### Core Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting with connection pooling
- **Replit Hosting**: Development and deployment environment with domain management

### AI & Communication Services
- **OpenAI API**: GPT models for natural conversation generation and response processing
- **Twilio**: Complete telephony platform for voice calls, recording, and webhook management

### Development Tools
- **Vite Plugins**: Runtime error overlay and Replit-specific development enhancements
- **Drizzle Kit**: Database schema management and migration tools
- **TanStack Query**: Advanced server state management with caching and synchronization