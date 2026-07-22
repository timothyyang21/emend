import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, StateStorage } from 'zustand/middleware';

/** AsyncStorage adapter conforming to zustand's StateStorage interface. */
export const zustandStorage: StateStorage = {
  getItem: (name) => AsyncStorage.getItem(name),
  setItem: (name, value) => AsyncStorage.setItem(name, value),
  removeItem: (name) => AsyncStorage.removeItem(name),
};

/** Drop-in options for zustand's `persist` middleware, backed by AsyncStorage. */
export const persistOptions = (name: string) => ({
  name,
  storage: createJSONStorage(() => zustandStorage),
});
