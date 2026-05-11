import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Redux state type
export interface SystemState {
  darkMode: boolean;
  preferences: string[]; // Your string array for things like "stay-offline"
  tutorials: string[];
}

// Redux state types
export interface ReduxSystemRootState {
  system: SystemState;
}

const initialState: SystemState = {
  darkMode: true,
  preferences: [],
  tutorials: [],
};

const system = createSlice({
  name: "system",
  initialState,
  reducers: {
    toggleTheme: (state, action: PayloadAction<boolean | undefined>) => {
      state.darkMode =
        action.payload !== undefined ? action.payload : !state.darkMode;
      if (typeof window !== "undefined") {
        localStorage.setItem("darkMode", JSON.stringify(state.darkMode)); // persist to localStorage
      }
      // console.log("New Theme Dark Mode Saved: ", action.payload);
    },

    /**
     * Adds a single preference string if it doesn't already exist.
     */
    addPreference: (state, action: PayloadAction<string>) => {
      // If state.preferences is undefined (from old persist data), initialize it
      if (!state.preferences) {
        state.preferences = [];
      }

      if (!state.preferences.includes(action.payload)) {
        state.preferences.push(action.payload);
      }
    },

    /**
     * Accepts an array of strings, merges them with existing preferences,
     * and automatically removes duplicates.
     */
    setPreferences: (state, action: PayloadAction<string[]>) => {
      // Ensure we have an array to work with
      const currentPrefs = state.preferences || [];
      const combined = [...currentPrefs, ...action.payload];
      state.preferences = [...new Set(combined)];
    },

    removePreference: (state, action: PayloadAction<string>) => {
      state.preferences = state.preferences.filter((p) => p !== action.payload);
    },

    clearPreferences: (state) => {
      state.preferences = [];
    },

    /**
     * Adds a single tutorial string if it doesn't already exist.
     */
    addTutorial: (state, action: PayloadAction<string>) => {
      if (!state.tutorials) {
        state.tutorials = [];
      }

      if (!state.tutorials.includes(action.payload)) {
        state.tutorials.push(action.payload);
      }
    },

    /**
     * Accepts an array of strings, merges them with existing tutorials
     * and automatically removes duplicates.
     */
    setTutorials: (state, action: PayloadAction<string[]>) => {
      // Ensure we have an array to work with
      const currentTutorials = state.tutorials || [];
      const combined = [...currentTutorials, ...action.payload];
      state.tutorials = [...new Set(combined)];
    },

    removeTutorial: (state, action: PayloadAction<string>) => {
      state.tutorials = state.tutorials.filter((p) => p !== action.payload);
    },

    clearTutorial: (state) => {
      state.tutorials = [];
    },
  },
});

export const {
  toggleTheme,
  addPreference,
  setPreferences,
  removePreference,
  clearPreferences,
  addTutorial,
  setTutorials,
  removeTutorial,
  clearTutorial,
} = system.actions;
export default system.reducer;
