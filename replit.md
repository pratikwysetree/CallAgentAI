# WhatsApp Messaging Platform

## Overview
This project is a WhatsApp bulk messaging platform designed for pathology lab partnerships with the LabsCheck platform. The system focuses exclusively on WhatsApp messaging, contact management, and messaging templates. It serves as a communication tool for building partnerships with laboratories across India, using a zero-commission model to foster transparency and bridge the gap between people seeking tests and labs offering diagnostics. The platform enables businesses to conduct WhatsApp campaigns, manage contacts, and track engagement metrics.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built with React 18 and TypeScript, utilizing Shadcn/ui components (based on Radix UI) for the UI and Tailwind CSS for styling. State management is handled by TanStack Query, and Wouter is used for lightweight client-side routing. Vite serves as the build tool, and WebSocket integration provides real-time updates for live call statuses.

### Backend Architecture
The backend is powered by Node.js with the Express.js framework, written in TypeScript. It features RESTful API endpoints with structured error handling and a WebSocket server for broadcasting call events. Development leverages TSX for hot reloading, and ESBuild is used for production bundling.

### Database & ORM
PostgreSQL is the chosen database, hosted on Neon for serverless capabilities. Drizzle ORM provides type-safe schema definitions and is used with Drizzle Kit for migrations and schema management. Connection pooling is managed by `@neondatabase/serverless`. The schema includes tables for users, contacts, campaigns, WhatsApp templates, bulk message jobs, contact engagement tracking, and campaign metrics.

### WhatsApp Integration
Meta Business API is integrated for WhatsApp messaging capabilities. The system manages bulk messaging campaigns, template management, and contact engagement tracking. Messages are sent using Meta's WhatsApp Business API with proper formatting and delivery tracking. The platform supports template-based messaging with dynamic variables for personalization.

### Authentication & Security
Session management is handled by Express sessions with PostgreSQL storage. Environment variables securely manage credentials, Zod schemas enforce input validation, and comprehensive error boundaries and logging are in place.

### Real-time Features
A WebSocket server facilitates bi-directional communication, broadcasting live call status updates and metrics to connected clients for real-time dashboard monitoring. The system includes automatic reconnection and error handling for robust real-time performance.

### Development & Build
The project emphasizes type safety with full TypeScript coverage. Development benefits from hot reloading (Vite HMR for frontend, TSX for backend) and organized imports via path aliases. The monorepo structure ensures shared schema and types between the client and server.

## Recent Changes (August 6, 2025)

### Complete Platform Transformation
- **MAJOR ARCHITECTURAL CHANGE**: Completely removed all calling functionality due to persistent technical issues
- Transformed from AI calling agent to WhatsApp messaging platform exclusively
- Deleted all calling-related services: callManager, twilio, elevenLabs, conversation services, and OpenAI integration
- Removed calling-related database tables: calls, callMessages, and all related schemas
- Cleaned up frontend by removing calling components, pages, and routes
- Updated navigation and branding from "AI Caller" to "WhatsApp Messenger"
- Preserved WhatsApp messaging functionality, contact management, and template system
- Platform now focuses solely on bulk WhatsApp messaging for lab partnerships

### Database Schema Cleanup
- Removed all calling-related tables and relationships
- Simplified schema to focus on WhatsApp messaging: contacts, campaigns, templates, bulk jobs
- Added contact engagement tracking and campaign metrics for messaging analytics
- Maintained backward compatibility for existing contact and campaign data
- Updated storage layer to remove all calling functionality

### Frontend Simplification
- Removed calling-related pages: analytics, live-conversation, elevenlabs-setup
- Simplified navigation to focus on WhatsApp functionality
- Updated app branding and icons to reflect messaging focus
- Set WhatsApp Bulk as the default home page
- Preserved essential pages: contact campaigns, WhatsApp chats, settings

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