# Client Folder Structure and File Explanations

This document provides a detailed overview of the `client` folder in the CallAgentAI project, describing the purpose and importance of each file and subfolder.

---

## Top-Level Files

- **index.html**  
  The main HTML entry point for the React application. Contains the root `<div>` for rendering the app and links to styles/scripts.

---

## `src` Folder

- **App.tsx**  
  The root React component. Sets up routing, global providers, and the main application layout.

- **index.css**  
  Global CSS styles for the app.

- **main.tsx**  
  Entry point for the React app. Renders `App` into the DOM.

### `components` Folder
- Contains reusable React components for UI and app features.
  - **CallTranscription.tsx**: Displays call transcription data.
  - **ColorPaletteSwitcher.tsx**: Allows users to switch color themes.
  - **sidebar.tsx**: Sidebar navigation component.
  - **TotalCampaignAnalytics.tsx**: Shows analytics for campaigns.

#### `components/ui` Subfolder
- Contains UI primitives and controls (accordion, alert, button, card, chart, dialog, form, input, table, toast, etc.) used throughout the app. These are mostly stateless, reusable building blocks for the interface.

### `hooks` Folder
- Custom React hooks for app logic.
  - **use-mobile.tsx**: Detects mobile device usage.
  - **use-toast.ts**: Manages toast notifications.
  - **use-websocket.tsx**: Handles WebSocket connections for real-time updates.

### `lib` Folder
- Utility libraries and shared logic.
  - **queryClient.ts**: Sets up TanStack Query client for server state management.
  - **utils.ts**: General utility functions used across the app.

### `pages` Folder
- Main app pages/views, each corresponding to a route.
  - **calls-analytics.tsx**: Analytics dashboard for calls.
  - **campaign-dashboard.tsx**: Dashboard for campaign performance.
  - **campaign-manager.tsx**: Manage campaigns and settings.
  - **contact-campaigns.tsx**: Manage contacts and their campaigns.
  - **enhanced-settings.tsx**: Advanced settings page.
  - **live-calls.tsx**: Real-time monitoring of live calls.
  - **not-found.tsx**: 404 error page.
  - **settings.tsx**: General settings page.
  - **whatsapp-bulk.tsx**: Bulk WhatsApp messaging interface.
  - **whatsapp-chats.tsx**: WhatsApp chat management.
  - **whatsapp-messaging.tsx**: WhatsApp messaging interface.

### `styles` Folder
- CSS files for custom styles and theme variables.
  - **palette-vars.css**: Defines color palette and theme variables for the app.

---

## Summary
- The top-level files and `src` folder set up the React app, routing, and global styles.
- The `components` and `components/ui` folders provide reusable UI elements.
- The `hooks` and `lib` folders contain custom logic and utilities.
- The `pages` folder organizes main views/routes.
- The `styles` folder manages theming and custom styles.

For deeper details on any specific file or component, refer to the source code or request a focused explanation.
