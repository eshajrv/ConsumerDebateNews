# Practify

Consumer mobile app built with Expo (expo-router) and Convex.

## Running locally

1. Install dependencies:

   ```sh
   npm install
   ```

2. Start the Convex backend. The first run asks you to log in and pick a project, then writes `EXPO_PUBLIC_CONVEX_URL` to `.env.local` and keeps your functions in sync:

   ```sh
   npx convex dev
   ```

3. In a second terminal, start the app:

   ```sh
   npx expo start
   ```

To load sample topics for today (dates are UTC), run `npx convex run topics:seed`.

## Layout

- `app/`: screens (expo-router). `_layout.tsx` sets up the Convex provider and the Stack navigator.
- `convex/`: backend schema, queries, and mutations.
