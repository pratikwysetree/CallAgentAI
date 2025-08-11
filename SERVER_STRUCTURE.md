# Server Folder Structure and File Explanations

This document provides a detailed overview of the `server` folder in the CallAgentAI project, describing the purpose and importance of each file and subfolder.

---

## Top-Level Files

- **db.ts**  
  Handles database connection and ORM setup. Connects to Neon PostgreSQL using Drizzle ORM. All database queries and models are initialized here.

- **import-csv.ts**  
  Utility or script for importing contacts, campaigns, or other data from CSV files into the database.

- **index.ts**  
  The main entry point for your backend server. Sets up Express, middleware, API routes, error handling, and starts the server.

- **routes.ts**  
  Registers all API endpoints and WebSocket handlers. Connects Express routes to service logic and manages HTTP/WebSocket traffic.

- **storage.ts**  
  Manages file storage, such as audio recordings, CSV uploads, or other assets. Handles saving, retrieving, and possibly cleaning up files.

- **vite.ts**  
  Integrates Vite middleware for development, serving the client app, and handling hot module reloading. Ensures smooth dev experience and static file serving.

---

## `routes` Folder

- **directAudioAPI.ts**  
  Handles API endpoints for direct audio operations—such as uploading, streaming, or processing audio files. May be used for call recordings or speech input.

---

## `services` Folder

- **callManager.ts**  
  Core logic for managing calls: initiating, tracking, ending calls, and handling call events. Integrates with Twilio and AI for call flow.

- **campaignService.ts**  
  Manages campaign creation, updates, analytics, and related operations. Handles campaign-specific business logic.

- **directSpeechService.ts**  
  Processes direct speech input/output, possibly for real-time AI conversations or speech-to-text features.

- **elevenlabsService.ts**  
  Integrates with ElevenLabs API for AI voice synthesis. Handles generating speech from text for calls or messaging.

- **excelService.ts**  
  Utilities for reading/writing Excel files, likely for bulk contact/campaign import/export.

- **messagingService.ts**  
  Handles messaging logic, including sending WhatsApp messages, managing message jobs, and tracking delivery/read status.

- **openaiService.ts**  
  Integrates with OpenAI API for AI-powered conversations, prompt management, and response generation.

- **twilioService.ts**  
  Manages Twilio integration for telephony: outbound calls, call status updates, webhook handling, and recording management.

- **whatsappService.ts**  
  Handles WhatsApp messaging via Meta Business API: sending messages, managing templates, and tracking engagement.

- **whatsappTemplateService.ts**  
  Manages WhatsApp message templates, including creation, validation, and dynamic variable substitution.

---

## Summary
- The top-level files set up the server, database, routes, and storage.
- The `routes` folder contains specialized API endpoints.
- The `services` folder contains business logic for calls, campaigns, messaging, AI, telephony, and integrations.

For deeper details on any specific file or service, refer to the source code or request a focused explanation.
